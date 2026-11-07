import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const BLOCKED_DOMAINS = [
  "research.com",
  "scholarshipregion.com",
  "studyportals.com",
  "mastersportal.com",
  "bachelorsportal.com",
  "phdportal.com",
  "edu-live.com"
];

const SUBJECTS = [
  "mathematics",
  "mathematical",
  "applied mathematics",
  "mathematics education",
  "statistics",
  "data science",
  "data analytics",
  "mathematical data science",
  "computational mathematics",
  "operations research",
  "machine learning",
  "artificial intelligence"
];

const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function clean(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hostOf(url = "") {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlocked(url = "") {
  const host = hostOf(url);

  return BLOCKED_DOMAINS.some(
    domain => host === domain || host.endsWith(`.${domain}`)
  );
}

// Country is determined from the official website's domain,
// never from incidental mentions of countries in page text.
function countryFromOfficialHost(url = "") {
  const host = hostOf(url);

  if (!host) return null;

  if (
    host.endsWith(".edu.au") ||
    host.endsWith(".gov.au") ||
    host.endsWith(".ac.au")
  ) {
    return "Australia";
  }

  if (host.endsWith(".ca") || host.endsWith(".gc.ca")) {
    return "Canada";
  }

  if (host.endsWith(".edu") || host.endsWith(".gov")) {
    return "USA";
  }

  const europeanDomains = [
    ".ac.uk",
    ".gov.uk",
    ".de",
    ".fr",
    ".it",
    ".nl",
    ".se",
    ".fi",
    ".no",
    ".es",
    ".pt",
    ".be",
    ".ch",
    ".at",
    ".ie",
    ".dk",
    ".pl",
    ".cz",
    ".hu",
    ".gr",
    ".eu",
    ".europa.eu"
  ];

  if (europeanDomains.some(domain => host.endsWith(domain))) {
    return "Europe";
  }

  return null;
}

function isOfficialHost(url = "") {
  const host = hostOf(url);

  return Boolean(host) &&
    !isBlocked(url) &&
    Boolean(countryFromOfficialHost(url));
}

function dateISO(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseDate(text = "") {
  const value = String(text);

  let match = value.match(
    /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/
  );

  if (match) {
    return dateISO(+match[1], +match[2] - 1, +match[3]);
  }

  match = value.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i
  );

  if (match) {
    return dateISO(
      +match[3],
      MONTHS[match[1].toLowerCase()],
      +match[2]
    );
  }

  match = value.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)[,]?\s+(20\d{2})\b/i
  );

  if (match) {
    return dateISO(
      +match[3],
      MONTHS[match[2].toLowerCase()],
      +match[1]
    );
  }

  return null;
}

function dateStatus(opening, closing) {
  const now = new Date();

  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )).toISOString().slice(0, 10);

  if (closing && closing < today) return "CLOSED";
  if (opening && opening > today) return "OPENING SOON";
  if (closing && closing >= today) return "OPEN NOW";

  return "Dates unconfirmed";
}

function getSearchWindow() {
  const now = new Date();

  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1
  ));

  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 3,
    0
  ));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function withinSearchWindow(opening, closing, window) {
  const today = new Date().toISOString().slice(0, 10);

  if (closing && closing < today) return false;

  // Previously opened applications are included if still open.
  if (opening && opening < window.start) {
    return Boolean(closing && closing >= today);
  }

  // Applications opening during the three-month window.
  if (opening && opening >= window.start && opening <= window.end) {
    return true;
  }

  // If the opening date is unknown, include only a future deadline
  // within the window. Do not guess an opening date.
  if (
    !opening &&
    closing &&
    closing >= today &&
    closing <= window.end
  ) {
    return true;
  }

  return false;
}

// Extract only dates clearly connected to the applicant's programme
// application. Exclude referee, interview, result and PhD dates.
function extractApplicationDates(raw = "") {
  const text = String(raw).replace(/\r/g, "");

  const lines = text
    .split(/[\n.!?;]+/)
    .map(clean)
    .filter(Boolean);

  let opening = null;
  let closing = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      /referee|recommendation|reference letter|result|interview|decision|phd|doctoral/.test(lower)
    ) {
      continue;
    }

    const date = parseDate(line);

    if (!date) continue;

    if (
      !opening &&
      /\b(application|applications|online application|apply|admissions?)\b/.test(lower) &&
      /\b(opens?|open from|opening|starts?|begin|available from)\b/.test(lower)
    ) {
      opening = date;
    }

    // FIX:
    // Official pages may simply say "The deadline is February 17, 2027"
    // without using the words application/programme/admissions.
    if (
      !closing &&
      /\b(deadline|closes?|closing date|due date|last day)\b/.test(lower)
    ) {
      closing = date;
    }
  }

  // Also handle official tables formatted as:
  // Opens: September 2, 2026 | Closes: February 3, 2027
  if (!opening || !closing) {
    const compact = text.match(
      /opens?\s*:\s*([^\n|]{4,45})[\s|,;]+closes?\s*:\s*([^\n|]{4,45})/i
    );

    if (compact) {
      opening ||= parseDate(compact[1]);
      closing ||= parseDate(compact[2]);
    }
  }

  return { opening, closing };
}

function hasMastersEvidence(text = "") {
  return /\b(master'?s|master of|m\.?s\.?|m\.?a\.?|msc|m\.sc\.?|graduate degree|postgraduate degree|erasmus mundus joint master)\b/i.test(text);
}

function isRelevantProgramme(title = "", content = "") {
  const titleText = title.toLowerCase();
  const contentText = content.toLowerCase();

  if (!hasMastersEvidence(`${title}\n${content}`)) {
    return false;
  }

  // A subject match in the actual title is strong evidence.
  if (SUBJECTS.some(term => titleText.includes(term))) {
    return true;
  }

  // Otherwise require the subject and Master's evidence together
  // in the same short passage. The search query itself is not evidence.
  const passages = contentText
    .split(/[\n.!?]+/)
    .map(text => text.trim())
    .filter(Boolean);

  return passages.some(passage =>
    passage.length < 700 &&
    hasMastersEvidence(passage) &&
    SUBJECTS.some(term => passage.includes(term))
  );
}

function detectEnglish(text = "") {
  const lower = text.toLowerCase();

  if (
    /medium of instruction|english was the language of instruction|previous degree.{0,60}taught in english|degree.{0,60}completed in english/.test(lower)
  ) {
    return "MOI accepted or possible — check official conditions";
  }

  if (/ielts|toefl|pte academic|cambridge english/.test(lower)) {
    return "English test listed — check exact score and exemptions";
  }

  if (/english language proficiency|proof of english|english test/.test(lower)) {
    return "English evidence required — accepted tests to confirm";
  }

  return "English requirement not confirmed";
}

function detectApplicationFee(text = "") {
  const lower = text.toLowerCase();

  if (
    /no application fee|there is no application fee|free to apply|application fee is waived/.test(lower)
  ) {
    return "No application fee";
  }

  if (/application fee waiver|fee waiver available/.test(lower)) {
    return "Fee waiver mentioned — eligibility to confirm";
  }

  const match = text.match(
    /application fee[^.\n]{0,65}?(US\$|USD|C\$|CAD|A\$|AUD|€|£|\$)\s?([\d,]+(?:\.\d{2})?)/i
  );

  if (match) {
    return `Application fee: ${match[1]} ${match[2]} — confirm applicant category`;
  }

  if (/application fee/.test(lower)) {
    return "Application fee mentioned — amount not confirmed";
  }

  return "Unknown — not confirmed";
}

function detectTuition(text = "") {
  const lower = text.toLowerCase();

  if (
    /tuition.{0,55}(waived|covered)|tuition fee waiver|participation costs.{0,40}waived/.test(lower)
  ) {
    return "Tuition/participation-cost waiver mentioned — check eligibility and scope";
  }

  const match = text.match(
    /(?:annual tuition|tuition fee|tuition|programme fee|program fee)[^\n.]{0,70}?((?:US\$|USD|C\$|CAD|A\$|AUD|€|£|\$)\s?[\d,]+(?:\.\d{2})?)/i
  );

  return match ? clean(match[0]) : "Tuition not confirmed";
}

function detectFunding(text = "") {
  const lower = text.toLowerCase();

  if (
    /master'?s students.{0,80}(do not|not).{0,30}(financial aid|financial support|funding)|no financial assistance.{0,50}master|master'?s.{0,40}self-funded/.test(lower)
  ) {
    return "No Master's financial assistance stated — self-funded";
  }

  if (/scholarship|studentship|fellowship|financial aid|financial support|funded place/.test(lower)) {
    return "Funding mentioned — Master's eligibility and coverage not confirmed";
  }

  return "Funding not confirmed";
}

function regionMatches(country, region) {
  return !region ||
    region === "all" ||
    country.toLowerCase() === region.toLowerCase();
}

function makeResult(data) {
  const institution =
    data.institution ||
    data.university ||
    "Institution not reliably identified";

  const programme =
    data.programme ||
    data.title ||
    "Programme not confirmed";

  const opening = data.applicationOpeningDate || null;
  const closing = data.applicationClosingDate || null;

  const verificationStatus =
    data.verificationStatus ||
    "Not verified";

  return {
    title: data.title || programme,
    institution,
    university: institution,
    programme,
    country: data.country || "Not confirmed",
    programmeStart: data.programmeStart || data.start || "Not confirmed",
    start: data.programmeStart || data.start || "Not confirmed",
    applicationOpeningDate: opening,
    applicationClosingDate: closing,
    deadline: closing || "Not confirmed",
    applicationStatus:
      data.applicationStatus ||
      dateStatus(opening, closing),
    tuition:
      data.tuition ||
      "Tuition not confirmed",
    scholarship:
      data.scholarship ||
      "Funding not confirmed",
    fundingStatus:
      data.fundingStatus ||
      data.scholarship ||
      "Funding not confirmed",
    english:
      data.english ||
      "English requirement not confirmed",
    applicationFee:
      data.applicationFee ||
      "Unknown — not confirmed",
    description:
      data.description ||
      "",
    snippet:
      data.snippet ||
      data.description ||
      "",
    officialLink:
      data.officialLink ||
      null,
    officialUniversityLink:
      data.officialUniversityLink ||
      data.officialLink ||
      null,
    sourceLink:
      data.sourceLink ||
      data.officialLink ||
      null,
    sourceType:
      data.sourceType ||
      "Discovery source",
    verification:
      data.verification ||
      "Check the official programme page before applying.",
    verificationStatus,
    partiallyVerified:
      verificationStatus === "Partially verified",
    scholarshipVerification:
      data.scholarshipVerification ||
      "Scholarship details not confirmed",
    verified:
      verificationStatus === "Verified"
  };
}

// Exact records checked for the 2026–2027 cycle only.
// These dates must be rechecked before being reused for another cycle.
function knownOfficialResults(query) {
  const q = query.toLowerCase();

  if (
    !SUBJECTS.some(term => q.includes(term)) &&
    !/math|stat|data|comput/.test(q)
  ) {
    return [];
  }

  const records = [
    makeResult({
      title: "Interdisciplinary Mathematics — InterMaths",
      institution: "InterMaths Erasmus Mundus Consortium",
      programme: "Erasmus Mundus Joint Master in Interdisciplinary Mathematics",
      country: "Europe",
      start: "2027 — exact start date to confirm",
      applicationOpeningDate: "2026-11-06",
      applicationClosingDate: "2027-02-17",
      tuition: "Participation costs waived for scholarship holders",
      scholarship:
        "18 EMJM scholarships; €1,400 per month; participation costs waived. Accommodation, travel, equipment and personal expenses are not separately waived.",
      fundingStatus:
        "Erasmus Mundus scholarship available — 18 awards stated on the official page",
      english:
        "CEFR B2. MOI evidence accepted under stated previous-study conditions; otherwise an approved English test is required.",
      applicationFee: "No application fee",
      description:
        "Online applications opened 6 November 2026. Scholarship applicant deadline: 17 February 2027 at 13:00 CET. The 3 March referee deadline is not the applicant deadline. Eritrea is listed among targeted regions; this does not guarantee an individual award.",
      officialLink:
        "https://www.intermaths.eu/apply",
      sourceLink:
        "https://www.intermaths.eu/apply",
      sourceType:
        "Official programme page",
      verificationStatus:
        "Verified",
      verification:
        "Programme and 2026–27 application details checked against the official programme page.",
      scholarshipVerification:
        "Official page states 18 scholarships, €1,400/month, participation-cost waiver and 17 February applicant deadline."
    }),

    makeResult({
      title: "MS Mathematics Admissions",
      institution: "University of Michigan",
      programme:
        "MS Mathematics — Actuarial, Applied, General and Secondary Teachers options",
      country: "USA",
      start: "Fall 2027",
      applicationClosingDate: "2027-02-01",
      tuition:
        "Not confirmed — consult the university tuition schedule",
      scholarship:
        "The listed Master's programmes are self-funded; general departmental financial support is not offered to Master's students.",
      fundingStatus:
        "No general Master's financial assistance stated — self-funded",
      english:
        "TOEFL or IELTS required for relevant non-native English-speaking applicants, subject to Rackham exemptions.",
      applicationFee:
        "International application fee waiver unavailable; exact fee not confirmed here",
      description:
        "Fall 2027 application deadline: 1 February 2027. The Marjorie Lee Browne support programme has US citizenship/permanent-residency restrictions and should not be treated as funding open to all international Master's applicants.",
      officialLink:
        "https://lsa.umich.edu/math/graduates/Admissions/applying1.html",
      sourceType:
        "Official university page",
      verificationStatus:
        "Verified",
      verification:
        "Admissions and Master's funding statements checked against the official university page.",
      scholarshipVerification:
        "Official page states no general financial support for these Master's programmes."
    }),

    makeResult({
      title: "Graduate Mathematics Admissions — Master's programmes",
      institution: "University of California San Diego",
      programme:
        "MA Pure Mathematics; MA Applied Mathematics; MS Statistics",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: "2026-09-02",
      applicationClosingDate: "2027-02-03",
      tuition:
        "Not confirmed — consult the university tuition schedule",
      scholarship:
        "Departmental financial support described for PhD students; Master's funding is not confirmed.",
      fundingStatus:
        "Master's funding not confirmed — PhD support does not apply",
      english:
        "TOEFL, IELTS or PTE requirements apply to relevant international applicants; check official exemptions.",
      applicationFee:
        "US$155 for international applicants",
      description:
        "Fall 2027 Master's deadline: 3 February 2027. The page also lists earlier PhD deadlines; those are not Master's deadlines.",
      officialLink:
        "https://math.ucsd.edu/students/graduate/how-to-apply",
      sourceType:
        "Official university page",
      verificationStatus:
        "Verified",
      verification:
        "Master's deadlines and international application fee checked against the official page.",
      scholarshipVerification:
        "No Master's departmental funding confirmed; PhD funding excluded."
    }),

    makeResult({
      title:
        "Mathematics Master's Admissions — standard Fall programmes",
      institution:
        "University of Southern California",
      programme:
        "Applied Mathematics MA/MS; Mathematics MA; Statistics MS",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: "2026-09-01",
      applicationClosingDate: "2027-02-01",
      tuition:
        "Not confirmed — consult the university tuition schedule",
      scholarship:
        "The department states that Master's students do not receive financial assistance.",
      fundingStatus:
        "No Master's financial assistance stated",
      english:
        "TOEFL 100, IELTS 7.0 or PTE 68 where English proof is required; exemptions may apply.",
      applicationFee:
        "Fee-waiver eligibility for this applicant category not confirmed",
      description:
        "This record covers the standard Fall 2027 Master's programmes with a 1 February deadline. Mathematical Data Science MS has a separate 15 February deadline; Mathematical Finance MS has a 30 March deadline.",
      officialLink:
        "https://dornsife.usc.edu/mathematics/admissions",
      sourceType:
        "Official university page",
      verificationStatus:
        "Verified",
      verification:
        "Programme deadlines and Master's funding statement checked against the official page.",
      scholarshipVerification:
        "Official page states no Master's financial assistance."
    }),

    makeResult({
      title:
        "Mathematical Data Science MS — Fall 2027",
      institution:
        "University of Southern California",
      programme:
        "MS Mathematical Data Science",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: "2026-09-01",
      applicationClosingDate: "2027-02-15",
      tuition:
        "Not confirmed — consult the university tuition schedule",
      scholarship:
        "The department states that Master's students do not receive financial assistance.",
      fundingStatus:
        "No Master's financial assistance stated",
      english:
        "TOEFL 100, IELTS 7.0 or PTE 68 where English proof is required; exemptions may apply.",
      applicationFee:
        "Fee-waiver eligibility for this applicant category not confirmed",
      description:
        "Separate Fall 2027 deadline for the MS Mathematical Data Science programme: 15 February 2027.",
      officialLink:
        "https://dornsife.usc.edu/mathematics/admissions",
      sourceType:
        "Official university page",
      verificationStatus:
        "Verified",
      verification:
        "Programme deadline and Master's funding statement checked against the official page.",
      scholarshipVerification:
        "Official page states no Master's financial assistance."
    }),

    makeResult({
      title:
        "Mathematical Finance MS — Fall 2027",
      institution:
        "University of Southern California",
      programme:
        "MS Mathematical Finance",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: "2026-09-01",
      applicationClosingDate: "2027-03-30",
      tuition:
        "Not confirmed — consult the university tuition schedule",
      scholarship:
        "The department states that Master's students do not receive financial assistance.",
      fundingStatus:
        "No Master's financial assistance stated",
      english:
        "TOEFL 100, IELTS 7.0 or PTE 68 where English proof is required; exemptions may apply.",
      applicationFee:
        "Fee-waiver eligibility for this applicant category not confirmed",
      description:
        "Separate Fall 2027 deadline for the MS Mathematical Finance programme: 30 March 2027.",
      officialLink:
        "https://dornsife.usc.edu/mathematics/admissions",
      sourceType:
        "Official university page",
      verificationStatus:
        "Verified",
      verification:
        "Programme deadline and Master's funding statement checked against the official page.",
      scholarshipVerification:
        "Official page states no Master's financial assistance."
    }),

    makeResult({
      title:
        "PhD and MS Programmes — 2027 Admissions Cycle",
      institution:
        "University of Chicago",
      programme:
        "Master of Science (MS) programme",
      country: "USA",
      start: "Fall 2027",
      applicationClosingDate: "2027-02-01",
      tuition:
        "Not confirmed",
      scholarship:
        "Funding not confirmed for the Master's programme.",
      fundingStatus:
        "Master's funding not confirmed",
      english:
        "English requirement not confirmed on the announcement page",
      applicationFee:
        "Not confirmed",
      description:
        "The official announcement lists Master's application rounds with deadlines of 2 November 2026, 1 February 2027 and 3 May 2027. The November round has passed; later rounds remain. PhD funding on the page must not be attributed to Master's applicants.",
      officialLink:
        "https://cam.uchicago.edu/news/article/cam-is-now-accepting-applications-for-the-phd-and-ms-programs-for-the-2027-cycle",
      sourceType:
        "Official university announcement",
      verificationStatus:
        "Partially verified",
      verification:
        "Official announcement confirms Master's rounds; full programme, fee and funding details need separate confirmation.",
      scholarshipVerification:
        "Master's funding not confirmed; PhD funding excluded."
    })
  ];

  return records.filter(record => {
    const text = `${record.programme} ${record.title}`.toLowerCase();

    return SUBJECTS.some(term => text.includes(term)) ||
      (/math|stat|data/.test(q) &&
       /interdisciplinary mathematics|mathematics|statistics|data science/.test(text));
  });
}

async function tavilySearch(query, region) {
  if (!TAVILY_API_KEY) {
    return {
      items: [],
      warning: "Live web search is not configured."
    };
  }

  const regionText = region === "all"
    ? "Europe OR United States OR Canada OR Australia"
    : region;

  const queries = [
    `official university master's ${query} admissions 2027 ${regionText}`,
    `official scholarship master's ${query} 2027 ${regionText}`,
    `Erasmus Mundus joint master ${query} scholarship 2027 official`
  ];

  const items = [];
  const errors = [];

  for (const searchQuery of queries) {
    try {
      const response = await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: searchQuery,
            search_depth: "advanced",
            max_results: 8,
            include_answer: false,
            include_raw_content: true
          })
        }
      );

      if (!response.ok) {
        errors.push(`Search provider returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      items.push(...(data.results || []));
    } catch (error) {
      errors.push(error.message);
    }
  }

  return {
    items,
    warning:
      errors.length
        ? "Some live searches failed; official-source records are still shown."
        : null
  };
}

function resultFromSearchItem(item, window) {
  const url = item.url || "";

  if (
    !url ||
    isBlocked(url) ||
    !isOfficialHost(url)
  ) {
    return null;
  }

  const title = clean(item.title || "");
  const content = clean(
    item.raw_content ||
    item.content ||
    ""
  );

  if (!isRelevantProgramme(title, content)) {
    return null;
  }

  const country = countryFromOfficialHost(url);

  if (!country) {
    return null;
  }

  const dates = extractApplicationDates(content);

  if (!withinSearchWindow(
    dates.opening,
    dates.closing,
    window
  )) {
    return null;
  }

  const host = hostOf(url);

  return makeResult({
    title,
    institution: `Institution to confirm (${host})`,
    programme:
      title ||
      "Master's programme — exact title to confirm",
    country,
    applicationOpeningDate:
      dates.opening,
    applicationClosingDate:
      dates.closing,
    tuition:
      detectTuition(content),
    scholarship:
      detectFunding(content),
    fundingStatus:
      detectFunding(content),
    english:
      detectEnglish(content),
    applicationFee:
      detectApplicationFee(content),
    description:
      content.slice(0, 1100),
    snippet:
      clean(item.content || "").slice(0, 450),
    officialLink:
      url,
    sourceLink:
      url,
    sourceType:
      "Official-domain discovery — details not fully verified",
    verificationStatus:
      "Partially verified",
    verification:
      "The source uses a recognized official-domain ending and appears relevant. Institution, programme, dates and eligibility still require confirmation on the linked page.",
    scholarshipVerification:
      "Scholarship eligibility and coverage not independently confirmed."
  });
}

// FIX:
// Treat different official InterMaths application pages
// describing the same Interdisciplinary Mathematics EMJM
// as one canonical result.
function canonicalKey(item) {
  const host =
    hostOf(
      item.sourceLink ||
      item.officialLink ||
      ""
    );

  const programmeText =
    (item.title || "") +
    " " +
    (item.programme || "") +
    " " +
    (item.description || "");

  if (
    host === "intermaths.eu" &&
    /interdisciplinary\s+mathematics/i.test(programmeText)
  ) {
    return "intermaths|erasmusmundus|interdisciplinarymathematics";
  }

  return (
    (item.institution || "") +
    "|" +
    (item.programme || "")
  )
    .toLowerCase()
    .replace(
      /\b(ms|m\.s\.|ma|m\.a\.|msc|m\.sc\.)\b/g,
      "master"
    )
    .replace(/[^a-z0-9|]/g, "")
    .replace(/\|+/g, "|");
}

function deduplicate(items) {
  const map = new Map();

  for (const item of items) {
    const key = canonicalKey(item);
    const previous = map.get(key);

    if (!previous) {
      map.set(key, item);
      continue;
    }

    const score = result =>
      (result.verificationStatus === "Verified"
        ? 4
        : result.verificationStatus === "Partially verified"
          ? 2
          : 0) +
      (
        result.scholarshipVerification &&
        !/not confirmed/i.test(
          result.scholarshipVerification
        )
          ? 1
          : 0
      );

    if (score(item) > score(previous)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Scholarship Finder server is running",
    build: "accurate-filter-v4",
    tavilyConfigured:
      Boolean(TAVILY_API_KEY),
    timestamp:
      new Date().toISOString()
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const query =
      clean(req.query.q || "");

    const region =
      clean(req.query.region || "all");

    if (!query) {
      return res.status(400).json({
        success: false,
        error:
          "Please enter a subject or programme."
      });
    }

    if (
      ![
        "all",
        "Europe",
        "USA",
        "Canada",
        "Australia"
      ].includes(region)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid region filter."
      });
    }

    const window =
      getSearchWindow();

    const known =
      knownOfficialResults(query)
        .filter(item =>
          regionMatches(
            item.country,
            region
          ) &&
          item.applicationStatus !== "CLOSED"
        );

    const search =
      await tavilySearch(
        query,
        region
      );

    const discovered =
      search.items
        .map(item =>
          resultFromSearchItem(
            item,
            window
          )
        )
        .filter(Boolean);

    let results =
      deduplicate([
        ...known,
        ...discovered
      ]);

    results =
      results.filter(item =>
        regionMatches(
          item.country,
          region
        )
      );

    results.sort((a, b) => {
      const rank = item => {
        const value =
          item.english.toLowerCase();

        if (
          /moi|medium of instruction/.test(
            value
          )
        ) {
          return 0;
        }

        if (/waiver/.test(value)) {
          return 1;
        }

        if (/not confirmed/.test(value)) {
          return 2;
        }

        if (
          /ielts|toefl|pte/.test(value)
        ) {
          return 3;
        }

        return 2;
      };

      return rank(a) - rank(b);
    });

    const counts = {
      total:
        results.length,

      openNow:
        results.filter(
          item =>
            item.applicationStatus ===
            "OPEN NOW"
        ).length,

      openingSoon:
        results.filter(
          item =>
            item.applicationStatus ===
            "OPENING SOON"
        ).length,

      closingSoon:
        results.filter(item => {
          if (
            !item.applicationClosingDate
          ) {
            return false;
          }

          const days =
            (
              Date.parse(
                `${item.applicationClosingDate}T00:00:00Z`
              ) -
              Date.now()
            ) /
            86400000;

          return (
            days >= 0 &&
            days <= 14
          );
        }).length,

      possiblyOpen:
        results.filter(
          item =>
            item.applicationStatus ===
            "Dates unconfirmed"
        ).length,

      verified:
        results.filter(
          item =>
            item.verificationStatus ===
            "Verified"
        ).length,

      partiallyVerified:
        results.filter(
          item =>
            item.verificationStatus ===
            "Partially verified"
        ).length,

      notVerified:
        results.filter(
          item =>
            item.verificationStatus ===
            "Not verified"
        ).length
    };

    res.json({
      success: true,
      query,
      selectedRegion:
        region,

      searchWindow:
        window,

      dateRule:
        "Selected by application opening date. Earlier-opening applications are included only when a future closing date indicates they remain open.",

      filters: {
        region
      },

      totalResults:
        results.length,

      counts,

      results,

      warning:
        search.warning,

      message:
        results.length
          ? "Official-source records and carefully filtered official-domain discoveries are shown. Verify eligibility and all application details before applying."
          : "No matching Master's programmes with sufficient subject and date evidence were found in this search window."
    });

  } catch (error) {
    console.error(
      "Search error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        "The search could not be completed.",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Please try again shortly."
    });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error:
      "API endpoint not found."
  });
});

app.use((req, res) => {
  res.sendFile(
    "index.html",
    {
      root: "public"
    }
  );
});

app.listen(PORT, () => {
  console.log(
    `Scholarship Finder server running on port ${PORT}`
  );
});
