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

const ALLOWED_REGIONS = ["Europe", "USA", "Canada", "Australia"];

const BLOCKED_DOMAINS = [
  "research.com",
  "scholarshipregion.com",
  "studyportals.com",
  "mastersportal.com",
  "bachelorsportal.com",
  "phdportal.com"
];

const SUBJECT_TERMS = [
  "mathematics",
  "mathematical",
  "mathematics education",
  "applied mathematics",
  "statistics",
  "data science",
  "data analytics",
  "mathematical data science",
  "computational mathematics",
  "operations research",
  "machine learning",
  "artificial intelligence"
];

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

function isOfficialHost(url = "") {
  const host = hostOf(url);

  return (
    host.endsWith(".edu") ||
    host.endsWith(".ac.uk") ||
    host.endsWith(".ac.au") ||
    host.endsWith(".edu.au") ||
    host.endsWith(".ac.ca") ||
    host.endsWith(".gc.ca") ||
    host.endsWith(".europa.eu") ||
    host.endsWith(".daad.de") ||
    host.endsWith(".gov") ||
    host.endsWith(".gov.au") ||
    host.endsWith(".gov.uk") ||
    host.endsWith(".ca") ||
    host.endsWith(".de") ||
    host.endsWith(".fr") ||
    host.endsWith(".it") ||
    host.endsWith(".nl") ||
    host.endsWith(".se") ||
    host.endsWith(".fi") ||
    host.endsWith(".no") ||
    host.endsWith(".es") ||
    host.endsWith(".pt") ||
    host.endsWith(".be") ||
    host.endsWith(".ch") ||
    host.endsWith(".at") ||
    host.endsWith(".ie") ||
    host.endsWith(".dk") ||
    host.endsWith(".pl") ||
    host.endsWith(".cz") ||
    host.endsWith(".hu") ||
    host.endsWith(".gr") ||
    host.endsWith(".eu")
  );
}

function countryFromUrl(url = "", text = "") {
  const host = hostOf(url);
  const value = `${host} ${text}`.toLowerCase();

  if (host.endsWith(".edu.au") || host.endsWith(".gov.au") || value.includes("australia")) {
    return "Australia";
  }

  if (host.endsWith(".ca") || host.endsWith(".ac.ca") || value.includes("canada")) {
    return "Canada";
  }

  if (host.endsWith(".edu") || value.includes("united states") || value.includes("usa")) {
    return "USA";
  }

  if (
    host.endsWith(".de") || host.endsWith(".fr") ||
    host.endsWith(".it") || host.endsWith(".nl") ||
    host.endsWith(".se") || host.endsWith(".fi") ||
    host.endsWith(".no") || host.endsWith(".es") ||
    host.endsWith(".pt") || host.endsWith(".be") ||
    host.endsWith(".ch") || host.endsWith(".at") ||
    host.endsWith(".ie") || host.endsWith(".dk") ||
    host.endsWith(".pl") || host.endsWith(".cz") ||
    host.endsWith(".hu") || host.endsWith(".gr") ||
    host.endsWith(".europa.eu") || host.endsWith(".eu")
  ) {
    return "Europe";
  }

  const europeanCountries = [
    "germany", "france", "italy", "netherlands", "sweden",
    "finland", "norway", "spain", "portugal", "belgium",
    "switzerland", "austria", "ireland", "denmark",
    "poland", "czech republic", "hungary", "greece"
  ];

  if (europeanCountries.some(country => value.includes(country))) {
    return "Europe";
  }

  return "Unknown";
}

function getSearchWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function parseDate(value) {
  if (!value) return null;

  const text = String(value).trim();

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];

  const named = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i
  );

  if (named) {
    const month = monthNames.indexOf(named[1].toLowerCase());
    return new Date(Date.UTC(+named[3], month, +named[2]));
  }

  const reverse = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)[,]?\s+(20\d{2})\b/i
  );

  if (reverse) {
    const month = monthNames.indexOf(reverse[2].toLowerCase());
    return new Date(Date.UTC(+reverse[3], month, +reverse[1]));
  }

  return null;
}

function dateString(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function extractApplicationDates(text = "") {
  const lines = String(text).split(/\n/);
  let opening = null;
  let closing = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Do not confuse referee, recommendation, result or interview dates
    // with the applicant's own application deadline.
    if (
      /referee|recommendation|reference letter|results announced|result announcement|interview|decision notification/.test(lower)
    ) {
      continue;
    }

    const date = parseDate(line);
    if (!date) continue;

    if (
      !opening &&
      /(application|online application|apply|applications).{0,35}(open|opens|opening|start|starts|from)/i.test(line)
    ) {
      opening = dateString(date);
    }

    if (
      !closing &&
      /(application|scholarship|admission|apply).{0,45}(deadline|close|closes|closing|due date)/i.test(line)
    ) {
      closing = dateString(date);
    }
  }

  return { opening, closing };
}

function dateStatus(opening, closing) {
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const openDate = opening ? Date.parse(`${opening}T00:00:00Z`) : null;
  const closeDate = closing ? Date.parse(`${closing}T23:59:59Z`) : null;

  if (closeDate && closeDate < today) {
    return "CLOSED";
  }

  if (openDate && openDate > today) {
    return "OPENING SOON";
  }

  if (closeDate && closeDate >= today) {
    return "OPEN NOW";
  }

  return "Dates unconfirmed";
}

function withinSearchWindow(opening, closing, window) {
  const start = Date.parse(`${window.start}T00:00:00Z`);
  const end = Date.parse(`${window.end}T23:59:59Z`);
  const today = Date.now();

  const openDate = opening ? Date.parse(`${opening}T00:00:00Z`) : null;
  const closeDate = closing ? Date.parse(`${closing}T23:59:59Z`) : null;

  // Include opportunities that opened earlier but are still open.
  if (openDate && openDate < start && closeDate && closeDate >= today) {
    return true;
  }

  // Include applications opening during the requested window.
  if (openDate && openDate >= start && openDate <= end) {
    return true;
  }

  // If opening date is unknown, include only if an unexpired
  // application deadline falls within the search window.
  if (!openDate && closeDate && closeDate >= today && closeDate <= end) {
    return true;
  }

  return false;
}

function detectEnglish(text = "") {
  const lower = text.toLowerCase();

  if (
    /medium of instruction|english was the language of instruction|previous degree.*taught in english|degree.*completed in english/.test(lower)
  ) {
    return "MOI accepted or possible — check official conditions";
  }

  if (/ielts.{0,40}(required|minimum)|toefl.{0,40}(required|minimum)/.test(lower)) {
    return "IELTS/TOEFL required or listed";
  }

  if (/english language proficiency|proof of english|english test/.test(lower)) {
    return "English evidence required — exact accepted tests to confirm";
  }

  return "English requirement not confirmed";
}

function detectApplicationFee(text = "") {
  const lower = text.toLowerCase();

  if (/no application fee|application fee is waived|free to apply|there is no application fee/.test(lower)) {
    return "No application fee";
  }

  if (/application fee waiver|fee waiver available/.test(lower)) {
    return "Fee waiver mentioned — eligibility to confirm";
  }

  const fee = text.match(/application fee[^.\n]{0,80}?\$?\s?(\d{2,3}(?:\.\d{2})?)/i);
  if (fee) return `Application fee mentioned: ${fee[1]} — currency/details to confirm`;

  if (/application fee/.test(lower)) {
    return "Application fee mentioned — amount not confirmed";
  }

  return "Unknown — not confirmed";
}

function detectTuition(text = "") {
  const lower = text.toLowerCase();

  if (/tuition.{0,50}(waived|covered|fully funded)|tuition fee waiver/.test(lower)) {
    return "Tuition waiver/coverage mentioned — verify exact conditions";
  }

  const match = text.match(/(?:tuition|annual fee|programme fee)[^.\n]{0,70}?(\$|€|£)\s?[\d,]+/i);
  if (match) return clean(match[0]);

  return "Tuition not confirmed";
}

function detectFunding(text = "") {
  const lower = text.toLowerCase();

  if (
    /master'?s students.*(do not|not).*financial (aid|support)|no financial assistance.*master|master'?s programme.*self-funded|master'?s students.*self-funded/.test(lower)
  ) {
    return "No Master's financial assistance stated — self-funded";
  }

  if (
    /scholarship.{0,100}(master|eligible applicants)|master.{0,100}scholarship|erasmus mundus scholarship/.test(lower)
  ) {
    return "Scholarship mentioned — coverage and eligibility must be verified";
  }

  return "Funding not confirmed";
}

function relevantToSubject(text = "", query = "") {
  const lower = `${text} ${query}`.toLowerCase();

  return SUBJECT_TERMS.some(term => lower.includes(term));
}

function regionMatches(country, region) {
  if (!region || region === "all") return true;
  return country.toLowerCase() === region.toLowerCase();
}

function makeResult(data) {
  return {
    title: data.title || data.programme || "Programme details not confirmed",
    university: data.university || "University not confirmed",
    programme: data.programme || data.title || "Programme not confirmed",
    country: data.country || "Unknown",
    start: data.start || "Not confirmed",
    applicationOpeningDate: data.applicationOpeningDate || null,
    applicationClosingDate: data.applicationClosingDate || data.deadline || null,
    deadline: data.applicationClosingDate || data.deadline || "Not confirmed",
    applicationStatus: data.applicationStatus || "Dates unconfirmed",
    tuition: data.tuition || "Tuition not confirmed",
    scholarship: data.scholarship || "Funding not confirmed",
    fundingStatus: data.fundingStatus || data.scholarship || "Funding not confirmed",
    english: data.english || "English requirement not confirmed",
    applicationFee: data.applicationFee || "Unknown — not confirmed",
    description: data.description || "",
    snippet: data.snippet || data.description || "",
    officialLink: data.officialLink || null,
    officialUniversityLink: data.officialUniversityLink || data.officialLink || null,
    sourceLink: data.sourceLink || data.officialLink || null,
    sourceType: data.sourceType || "Web search — not independently verified",
    verification: data.verification || "Not verified against an official programme page",
    scholarshipVerification: data.scholarshipVerification || "Funding not independently confirmed",
    verified: Boolean(data.verified)
  };
}

/*
 * Official-source records with facts checked for the 2026–2027 cycle.
 * These are intentionally date-specific. Do not carry these dates into
 * another admissions cycle without checking the official page again.
 */
function knownOfficialResults(query) {
  const q = query.toLowerCase();
  const results = [];

  if (
    /math|mathematical|statistics|data/.test(q)
  ) {
    results.push(makeResult({
      title: "Interdisciplinary Mathematics — InterMaths",
      university: "InterMaths Erasmus Mundus Consortium",
      programme: "Erasmus Mundus Joint Master in Interdisciplinary Mathematics",
      country: "Europe",
      start: "2027 — exact start date to confirm",
      applicationOpeningDate: "2026-11-06",
      applicationClosingDate: "2027-02-17",
      applicationStatus: dateStatus("2026-11-06", "2027-02-17"),
      tuition: "Participation costs waived for scholarship holders",
      scholarship: "18 EMJM scholarships; €1,400 per month; participation costs waived. Personal expenses such as accommodation, travel and equipment are not separately waived.",
      fundingStatus: "EMJM scholarship available — 18 awards stated on official page",
      english: "CEFR B2. MOI evidence accepted under the stated previous-study conditions; otherwise approved English test required.",
      applicationFee: "No application fee",
      description: "The online application opened on 6 November 2026. Scholarship application deadline: 17 February 2027 at 13:00 CET. Referee deadline is 3 March 2027 and is not the applicant deadline. Eritrea is listed among targeted regions, but this does not guarantee an award to an individual applicant.",
      officialLink: "https://www.intermaths.eu/apply",
      officialUniversityLink: "https://www.intermaths.eu/apply",
      sourceLink: "https://www.intermaths.eu/apply",
      sourceType: "Official programme page",
      verification: "Official programme page identified",
      scholarshipVerification: "Scholarship amount, number of awards, fee and applicant deadline stated on official page",
      verified: true
    }));

    results.push(makeResult({
      title: "M.S. Admissions — Mathematics",
      university: "University of Michigan",
      programme: "MS Mathematics — Actuarial, Applied, General and Secondary Teachers options",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: null,
      applicationClosingDate: "2027-02-01",
      applicationStatus: "OPEN NOW",
      tuition: "Not confirmed here — check the university tuition schedule",
      scholarship: "Master's programmes are self-funded; departmental financial support is not offered for these Master's programmes.",
      fundingStatus: "No Master's financial assistance stated — self-funded",
      english: "TOEFL or IELTS required for non-native English speakers, subject to Rackham exemptions",
      applicationFee: "International application fee waiver not available; exact fee not confirmed here",
      description: "The Fall 2027 application window is open. Deadline: 1 February 2027. The Marjorie Lee Browne support programme has citizenship restrictions and should not be treated as funding available to all international Master's applicants.",
      officialLink: "https://lsa.umich.edu/math/graduates/Admissions/applying1.html",
      officialUniversityLink: "https://lsa.umich.edu/math/graduates/Admissions/applying1.html",
      sourceLink: "https://lsa.umich.edu/math/graduates/Admissions/applying1.html",
      sourceType: "Official university page",
      verification: "Official university admissions page identified",
      scholarshipVerification: "Official page states no general Master's financial support",
      verified: true
    }));

    results.push(makeResult({
      title: "Graduate Mathematics Admissions — Master's programmes",
      university: "University of California San Diego",
      programme: "MA Pure Mathematics; MA Applied Mathematics; MS Statistics",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: "2026-09-02",
      applicationClosingDate: "2027-02-03",
      applicationStatus: "OPEN NOW",
      tuition: "Not confirmed here — check the university tuition schedule",
      scholarship: "Departmental financial support described for PhD students; Master's funding is not stated as available.",
      fundingStatus: "Funding not confirmed for Master's applicants — PhD support does not apply",
      english: "TOEFL, IELTS or PTE requirements apply to relevant international applicants; check official exemptions",
      applicationFee: "US$155 for international applicants",
      description: "The Master's application deadline for Fall 2027 is 3 February 2027. The page also contains earlier PhD deadlines; those are not the Master's deadline.",
      officialLink: "https://math.ucsd.edu/students/graduate/how-to-apply",
      officialUniversityLink: "https://math.ucsd.edu/students/graduate/how-to-apply",
      sourceLink: "https://math.ucsd.edu/students/graduate/how-to-apply",
      sourceType: "Official university page",
      verification: "Official university admissions page identified",
      scholarshipVerification: "No Master's departmental funding confirmed; PhD funding excluded",
      verified: true
    }));

    results.push(makeResult({
      title: "Mathematics Master's Admissions",
      university: "University of Southern California",
      programme: "Applied Mathematics MA/MS; Mathematics MA; Mathematical Data Science MS; Mathematical Finance MS; Statistics MS",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: "2026-09-01",
      applicationClosingDate: "2027-02-01",
      applicationStatus: "OPEN NOW",
      tuition: "Not confirmed here — check the university tuition schedule",
      scholarship: "The department states that Master's students do not receive financial assistance.",
      fundingStatus: "No Master's financial assistance stated",
      english: "TOEFL 100, IELTS 7.0 or PTE 68 where English proof is required; exemptions may apply",
      applicationFee: "Fee waiver availability for this applicant category not confirmed",
      description: "Fall 2027 deadlines vary by programme: most listed Master's programmes have a 1 February deadline; Mathematical Data Science MS has a 15 February deadline; Mathematical Finance MS has a 30 March deadline. Spring and PhD deadlines are not Master's Fall deadlines.",
      officialLink: "https://dornsife.usc.edu/mathematics/admissions",
      officialUniversityLink: "https://dornsife.usc.edu/mathematics/admissions",
      sourceLink: "https://dornsife.usc.edu/mathematics/admissions",
      sourceType: "Official university page",
      verification: "Official university admissions page identified",
      scholarshipVerification: "Official page states no Master's financial assistance",
      verified: true
    }));

    results.push(makeResult({
      title: "PhD and MS Programmes — 2027 Admissions Cycle",
      university: "University of Chicago",
      programme: "Master of Science (MS) programme",
      country: "USA",
      start: "Fall 2027",
      applicationOpeningDate: null,
      applicationClosingDate: "2027-02-01",
      applicationStatus: "OPEN NOW",
      tuition: "Not confirmed",
      scholarship: "Funding not confirmed for the Master's programme",
      fundingStatus: "Funding not confirmed",
      english: "English requirements not confirmed here",
      applicationFee: "Not confirmed",
      description: "The official page lists Master's application rounds with deadlines of 2 November 2026, 1 February 2027 and 3 May 2027. The November round has passed; the later rounds remain relevant. The page's PhD funding should not be treated as Master's funding.",
      officialLink: "https://cam.uchicago.edu/news/article/cam-is-now-accepting-applications-for-the-phd-and-ms-programs-for-the-2027-cycle",
      officialUniversityLink: "https://cam.uchicago.edu/news/article/cam-is-now-accepting-applications-for-the-phd-and-ms-programs-for-the-2027-cycle",
      sourceLink: "https://cam.uchicago.edu/news/article/cam-is-now-accepting-applications-for-the-phd-and-ms-programs-for-the-2027-cycle",
      sourceType: "Official university announcement",
      verification: "Official university announcement identified",
      scholarshipVerification: "Master's funding not confirmed",
      verified: true
    }));
  }

  return results;
}

async function tavilySearch(query, region) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured on the server.");
  }

  const regionText = region === "all"
    ? "Europe OR USA OR Canada OR Australia"
    : region;

  const searchQueries = [
    `2026 2027 master's scholarships ${query} ${regionText} application deadline official university`,
    `2027 master's admission ${query} scholarship funding ${regionText} official`,
    `Erasmus Mundus master's ${query} 2027 scholarship application official`
  ];

  const all = [];

  for (const searchQuery of searchQueries) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        search_depth: "advanced",
        max_results: 8,
        include_answer: false,
        include_raw_content: true
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Search provider returned ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    all.push(...(data.results || []));
  }

  const seen = new Set();

  return all.filter(item => {
    const url = item.url || "";
    if (!url || isBlocked(url)) return false;

    const key = url.split("#")[0].replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function resultFromSearchItem(item, query, window) {
  const url = item.url || "";
  const title = clean(item.title || "");
  const content = clean(item.raw_content || item.content || "");
  const combined = `${title}\n${content}`;

  if (!relevantToSubject(combined, query)) return null;

  const country = countryFromUrl(url, combined);
  if (!ALLOWED_REGIONS.includes(country)) return null;

  const dates = extractApplicationDates(content);
  const status = dateStatus(dates.opening, dates.closing);

  if (!withinSearchWindow(dates.opening, dates.closing, window)) {
    return null;
  }

  const official = isOfficialHost(url);
  const host = hostOf(url);
  const university = host
    ? host.split(".").slice(-2, -1)[0]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase())
    : "University not confirmed";

  const funding = detectFunding(content);

  return makeResult({
    title,
    university,
    programme: title,
    country,
    start: "Not confirmed",
    applicationOpeningDate: dates.opening,
    applicationClosingDate: dates.closing,
    applicationStatus: status,
    tuition: detectTuition(content),
    scholarship: funding,
    fundingStatus: funding,
    english: detectEnglish(content),
    applicationFee: detectApplicationFee(content),
    description: content.slice(0, 1200),
    snippet: clean(item.content || "").slice(0, 500),
    officialLink: official ? url : null,
    officialUniversityLink: official ? url : null,
    sourceLink: url,
    sourceType: official ? "Official university/provider page" : "External discovery source",
    verification: official
      ? "Official domain identified; individual details still require checking"
      : "Not verified against an official programme page",
    scholarshipVerification: "Scholarship coverage not independently confirmed",
    verified: false
  });
}

function deduplicate(results) {
  const map = new Map();

  for (const item of results) {
    const key = `${item.university}|${item.programme}`
      .toLowerCase()
      .replace(/[^a-z0-9|]/g, "");

    const previous = map.get(key);

    if (!previous) {
      map.set(key, item);
      continue;
    }

    // Prefer the official source over a third-party discovery result.
    if (!previous.officialLink && item.officialLink) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Scholarship Finder server is running",
    tavilyConfigured: Boolean(TAVILY_API_KEY),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const query = clean(req.query.q || "");
    const region = clean(req.query.region || "all");
    const english = clean(req.query.english || "all");
    const applicationFee = clean(req.query.applicationFee || "all");
    const tuition = clean(req.query.tuition || "all");

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Please enter a subject or programme."
      });
    }

    const window = getSearchWindow();

    const known = knownOfficialResults(query);
    const searchItems = await tavilySearch(query, region);

    const discovered = searchItems
      .map(item => resultFromSearchItem(item, query, window))
      .filter(Boolean);

    let results = deduplicate([...known, ...discovered]);

    results = results.filter(item => {
      if (!regionMatches(item.country, region)) return false;

      if (english !== "all") {
        const value = item.english.toLowerCase();

        if (english === "moi" && !value.includes("moi")) return false;
        if (english === "ielts" && !/ielts|toefl|required|test/.test(value)) return false;
        if (english === "no-ielts" && /ielts\/toefl required/.test(value)) return false;
      }

      if (applicationFee !== "all") {
        const value = item.applicationFee.toLowerCase();

        if (applicationFee === "no-fee" && !value.includes("no application fee")) return false;
        if (applicationFee === "fee" && value.includes("no application fee")) return false;
      }

      if (tuition !== "all") {
        const value = item.tuition.toLowerCase();

        if (tuition === "low" && !/under|below|less than|free|waived|covered/.test(value)) return false;
        if (tuition === "funded" && !/waived|covered|fully funded/.test(value)) return false;
      }

      return true;
    });

    const priority = value => {
      const text = `${value.english} ${value.applicationStatus}`.toLowerCase();

      let rank = 5;

      if (text.includes("moi")) rank = 0;
      else if (text.includes("english requirement not confirmed")) rank = 2;
      else if (text.includes("ielts") || text.includes("toefl")) rank = 4;

      if (value.applicationStatus === "OPEN NOW") rank -= 1;

      return rank;
    };

    results.sort((a, b) => priority(a) - priority(b));

    const counts = {
      total: results.length,
      openNow: results.filter(item => item.applicationStatus === "OPEN NOW").length,
      openingSoon: results.filter(item => item.applicationStatus === "OPENING SOON").length,
      closingSoon: results.filter(item => {
        if (!item.applicationClosingDate) return false;
        const days = (Date.parse(`${item.applicationClosingDate}T00:00:00Z`) - Date.now()) / 86400000;
        return days >= 0 && days <= 14;
      }).length,
      possiblyOpen: results.filter(item => item.applicationStatus === "Dates unconfirmed").length,
      verified: results.filter(item => item.verified).length
    };

    return res.json({
      success: true,
      query,
      selectedRegion: region,
      searchWindow: window,
      dateRule: "Selected by application opening date. Previously opened applications are included only when evidence indicates they remain open.",
      filters: {
        region,
        english,
        applicationFee,
        tuition
      },
      totalResults: results.length,
      counts,
      results,
      message: results.length
        ? "Results include official-source records and additional discoveries. Check each programme's official page before applying."
        : "No matching results were found for this search window. Try another related subject or region."
    });
  } catch (error) {
    console.error("Search error:", error);

    return res.status(500).json({
      success: false,
      error: "The search could not be completed.",
      details: process.env.NODE_ENV === "development"
        ? error.message
        : "Please try again shortly."
    });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found."
  });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`Scholarship Finder server running on port ${PORT}`);
});
