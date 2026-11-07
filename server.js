
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const ALLOWED_REGIONS = ["Europe", "USA", "Canada", "Australia"];

const BLOCKED_DOMAINS = [
  "facebook.com", "instagram.com", "reddit.com",
  "tiktok.com", "youtube.com", "linkedin.com",
  "x.com", "twitter.com",
  "letzstudy.com", "leverageedu.com", "yocket.com",
  "scholarshiproar.com", "opportunitiesforafricans.com",
  "scholars4dev.com", "mastersportal.com",
  "scholarshipportal.com", "studyportals.com",
  "findamasters.com", "applykite.com",
  "wemakescholars.com", "hotcoursesabroad.com",
  "advance-africa.com", "advanceafrica.com",
  "educations.com", "shiksha.com"
];

const INSTITUTIONS = [
  { host: "uchicago.edu", name: "University of Chicago", country: "USA" },
  { host: "usc.edu", name: "University of Southern California", country: "USA" },
  { host: "umich.edu", name: "University of Michigan", country: "USA" },
  { host: "ucsd.edu", name: "University of California San Diego", country: "USA" },
  { host: "mit.edu", name: "Massachusetts Institute of Technology", country: "USA" },
  { host: "stanford.edu", name: "Stanford University", country: "USA" },
  { host: "berkeley.edu", name: "University of California, Berkeley", country: "USA" },
  { host: "harvard.edu", name: "Harvard University", country: "USA" },
  { host: "ox.ac.uk", name: "University of Oxford", country: "Europe" },
  { host: "cam.ac.uk", name: "University of Cambridge", country: "Europe" },
  { host: "ethz.ch", name: "ETH Zurich", country: "Europe" },
  { host: "epfl.ch", name: "EPFL", country: "Europe" },
  { host: "tum.de", name: "Technical University of Munich", country: "Europe" },
  { host: "utoronto.ca", name: "University of Toronto", country: "Canada" },
  { host: "ubc.ca", name: "University of British Columbia", country: "Canada" },
  { host: "mcgill.ca", name: "McGill University", country: "Canada" },
  { host: "unimelb.edu.au", name: "University of Melbourne", country: "Australia" },
  { host: "sydney.edu.au", name: "University of Sydney", country: "Australia" },
  { host: "anu.edu.au", name: "Australian National University", country: "Australia" }
];

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3,
  may: 4, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11
};

function clean(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(value = "") {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostMatches(host, domain) {
  return host === domain || host.endsWith("." + domain);
}

function normalUrl(value = "") {
  try {
    const url = new URL(value);
    return (
      url.hostname.toLowerCase().replace(/^www\./, "") +
      url.pathname.toLowerCase()
    ).replace(/\/+$/, "");
  } catch {
    return String(value).toLowerCase();
  }
}

function isBlocked(url, title = "") {
  const host = hostOf(url);

  if (BLOCKED_DOMAINS.some(domain => hostMatches(host, domain))) {
    return true;
  }

  const genericTitle =
    /top\s+\d+|scholarship list|scholarships for|directory of|degree scholarships available|study options|how to apply for scholarships|best scholarships|accepting students now.*programs/i.test(title);

  const genericPage =
    /research\.com/i.test(host) &&
    /degree|scholarship|program list|directory/i.test(title);

  return genericTitle || genericPage;
}

function isOfficialHost(url) {
  const host = hostOf(url);

  if (!host || isBlocked(url)) return false;

  if (
    hostMatches(host, "intermaths.eu") ||
    hostMatches(host, "erasmus-plus.ec.europa.eu") ||
    hostMatches(host, "erasmusmundus.eu")
  ) {
    return true;
  }

  if (INSTITUTIONS.some(item => hostMatches(host, item.host))) {
    return true;
  }

  return /\.(edu|ac\.[a-z]{2}|edu\.[a-z]{2}|gov\.[a-z]{2})$/.test(host) ||
    /\.(de|fr|it|es|nl|be|ch|se|fi|no|dk|at|pl|pt|ie|cz|hu|gr|ee|lt|lv|si|sk|ro|bg|hr|is|uk)$/.test(host);
}

function countryFromHost(host) {
  if (!host) return "Not confirmed";

  const known = INSTITUTIONS.find(item => hostMatches(host, item.host));
  if (known) return known.country;

  if (host.endsWith(".ca")) return "Canada";
  if (host.endsWith(".edu.au") || host.endsWith(".gov.au")) return "Australia";
  if (host.endsWith(".edu")) return "USA";

  if (/\.(uk|de|fr|it|es|nl|be|ch|se|fi|no|dk|at|pl|pt|ie|cz|hu|gr|ee|lt|lv|si|sk|ro|bg|hr|is)$/.test(host)) {
    return "Europe";
  }

  return "Not confirmed";
}

function institutionFrom(url, text = "") {
  const host = hostOf(url);

  if (hostMatches(host, "intermaths.eu")) {
    return {
      name: "InterMaths Erasmus Mundus Joint Master consortium",
      country: "Europe"
    };
  }

  const known = INSTITUTIONS.find(item => hostMatches(host, item.host));

  if (known) {
    return { name: known.name, country: known.country };
  }

  const lower = text.toLowerCase();

  const aliases = [
    ["University of Chicago", "university of chicago", "USA"],
    ["University of Southern California", "university of southern california", "USA"],
    ["University of California San Diego", "university of california san diego", "USA"],
    ["University of Michigan", "university of michigan", "USA"],
    ["University of Oxford", "university of oxford", "Europe"],
    ["University of Cambridge", "university of cambridge", "Europe"],
    ["University of Toronto", "university of toronto", "Canada"],
    ["University of British Columbia", "university of british columbia", "Canada"],
    ["McGill University", "mcgill university", "Canada"],
    ["University of Melbourne", "university of melbourne", "Australia"],
    ["University of Sydney", "university of sydney", "Australia"]
  ];

  for (const [name, phrase, country] of aliases) {
    if (lower.includes(phrase)) return { name, country };
  }

  return {
    name: "Institution not confirmed",
    country: countryFromHost(host)
  };
}

function validDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function inferYear(month, day) {
  const today = new Date();
  const current = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ));

  const year = today.getUTCFullYear();

  const candidates = [year - 1, year, year + 1]
    .map(y => validDate(y, month, day))
    .filter(Boolean);

  candidates.sort((a, b) =>
    Math.abs(a - current) - Math.abs(b - current)
  );

  return candidates[0] || null;
}

function parseDate(value) {
  const text = clean(value).toLowerCase();
  if (!text) return null;

  let match = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);

  if (match) {
    return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  const months = Object.keys(MONTHS).join("|");

  match = text.match(
    new RegExp("\\b(" + months + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s*(20\\d{2})\\b", "i")
  );

  if (match) {
    return validDate(
      Number(match[3]),
      MONTHS[match[1].toLowerCase()] + 1,
      Number(match[2])
    );
  }

  match = text.match(
    new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + months + ")\\s+(20\\d{2})\\b", "i")
  );

  if (match) {
    return validDate(
      Number(match[3]),
      MONTHS[match[2].toLowerCase()] + 1,
      Number(match[1])
    );
  }

  match = text.match(
    new RegExp("\\b(" + months + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b", "i")
  );

  if (match) {
    return inferYear(
      MONTHS[match[1].toLowerCase()] + 1,
      Number(match[2])
    );
  }

  match = text.match(
    new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + months + ")\\b", "i")
  );

  if (match) {
    return inferYear(
      MONTHS[match[2].toLowerCase()] + 1,
      Number(match[1])
    );
  }

  return null;
}

function dateString(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function windowStartDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function windowEndDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0));
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
}

function findLabeledDate(text, labels) {
  const lines = String(text || "").split(/\n|\r|(?<=[.;])\s+/);

  for (const line of lines) {
    const normalized = clean(line);
    if (!normalized) continue;
    if (!labels.some(label => label.test(normalized))) continue;

    const date = parseDate(normalized);
    if (date) return date;
  }

  return null;
}

function extractDates(text) {
  const source = String(text || "");

  const openLabels = [
    /application form opens?/i,
    /applications? open(?:s|ing)?/i,
    /application opening date/i,
    /opening date/i,
    /call for applications? opens?/i,
    /application period begins?/i,
    /applications? begin/i
  ];

  const closeLabels = [
    /deadline for scholarships?/i,
    /scholarship application deadline/i,
    /application deadline/i,
    /applications? deadline/i,
    /deadline/i,
    /applications? close(?:s|d|ing)?/i,
    /apply by/i,
    /last date to apply/i
  ];

  let open = findLabeledDate(source, openLabels);
  let close = findLabeledDate(source, closeLabels);

  if (!open) {
    const patterns = [
      /applications?\s+(?:open|opens|opened)\s+(?:on\s+)?([^.;\n]{3,70})/i,
      /(?:online\s+)?application form opens?\s*(?:on|:|from)?\s*([^.;\n]{3,70})/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match && (open = parseDate(match[1]))) break;
    }
  }

  if (!close) {
    const patterns = [
      /deadline(?:s)?(?: for scholarships?)?\s*(?:is|:|on)?\s*([^.;\n]{3,70})/i,
      /applications?\s+(?:close|closes|closed)\s+(?:on\s+)?([^.;\n]{3,70})/i,
      /apply\s+by\s+([^.;\n]{3,70})/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match && (close = parseDate(match[1]))) break;
    }
  }

  const deadlineDates = [];
  const deadlineSections = String(source).match(
    /(?:application\s+)?deadlines?[^.\n]{0,180}/gi
  ) || [];

  const datePattern =
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s*(?:20\d{2})?|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*(?:20\d{2})?/gi;

  for (const section of deadlineSections) {
    let match;

    while ((match = datePattern.exec(section)) !== null) {
      const date = parseDate(match[0]);

      if (date && !deadlineDates.some(item =>
        item.getTime() === date.getTime()
      )) {
        deadlineDates.push(date);
      }
    }
  }

  deadlineDates.sort((a, b) => a - b);

  const futureDeadlines = deadlineDates.filter(date => date >= todayUTC());

  if (futureDeadlines.length) {
    close = futureDeadlines[0];
  } else if (!close && deadlineDates.length) {
    close = deadlineDates[deadlineDates.length - 1];
  }

  return {
    open,
    close,
    multipleDeadlines: deadlineDates.length > 1
      ? deadlineDates.map(dateString)
      : []
  };
}

function explicitOpenEvidence(text) {
  return /call for applications.{0,40}(now )?open|applications are now open|applications are open|currently accepting applications|portal is open|apply now|accepting applications for|now accepting applications|application window is open/i.test(
    String(text || "")
  );
}

function dateStatus(open, close, text, windowEnd) {
  const today = todayUTC();
  const soon = new Date(today);
  soon.setUTCDate(soon.getUTCDate() + 30);

  if (close && close < today) return "CLOSED";
  if (open && open > windowEnd) return "Outside search window";

  if (open && open <= today && close && close >= today) {
    return close <= soon
      ? "CLOSING SOON — deadline approaching"
      : "OPEN NOW";
  }

  if (open && open > today && open <= windowEnd) {
    return "OPENING SOON";
  }

  if (!open && close && close >= today && explicitOpenEvidence(text)) {
    return "Possibly open — opening date not confirmed";
  }

  if (open && open <= today && !close && explicitOpenEvidence(text)) {
    return "Possibly open — closing date not confirmed";
  }

  return "Dates unconfirmed";
}

function fundingFrom(text) {
  const t = String(text || "").toLowerCase();

  const explicitNoFunding =
    /master'?s (?:students|programs|programmes|degrees).{0,100}(?:no financial assistance|no financial support|do not receive financial|not eligible for financial)|no financial assistance.{0,100}master|no form of financial support.{0,100}master|students must self[- ]fund|self[- ]funded only|does not provide funding for master|no scholarships? (?:are )?available for master/.test(t);

  if (explicitNoFunding) {
    return {
      status: "No Master's funding stated",
      detail: "The official information says Master's students do not receive financial assistance or must self-fund. Funding for PhD students or other programmes is not counted as Master's funding."
    };
  }

  if (
    /no funding (?:is )?available|does not provide funding|self[- ]funded only|no scholarships? (?:are )?available/.test(t)
  ) {
    return {
      status: "Self-funded / no funding stated",
      detail: "The official page indicates that funding is unavailable or that students must fund the programme themselves."
    };
  }

  const hasScholarship =
    /scholarship|scholarships|stipend|financial support|funding available|grant award|fellowship/.test(t);

  if (hasScholarship) {
    return {
      status: "Scholarship or funding mentioned — coverage not confirmed",
      detail: "Funding is mentioned on the source page, but the specific Master's programme, eligibility, amount and coverage need separate confirmation."
    };
  }

  return {
    status: "Funding not confirmed",
    detail: "No specific Master's scholarship coverage was confirmed in the checked text."
  };
}

function englishFrom(text) {
  const t = String(text || "").toLowerCase();

  if (/medium of instruction|\bmoi\b|english as (?:the )?medium of instruction/.test(t)) {
    return "MOI / English-medium evidence mentioned — check the stated conditions";
  }

  if (/english.{0,35}(?:waiver|exempt)|(?:ielts|toefl).{0,25}(?:waiver|exempt)|waiver.{0,25}(?:ielts|toefl)/.test(t)) {
    return "English-test waiver possible — conditions apply";
  }

  if (/ielts|toefl|pte academic|cambridge english/.test(t)) {
    return "IELTS/TOEFL or another English test mentioned";
  }

  return "Not confirmed";
}

function feeFrom(text) {
  const original = String(text || "");
  const t = original.toLowerCase();

  if (
    /no (?:application|applicant) fee|free to apply|application (?:process|is) (?:is )?free|won't charge you any fee to take part in the application/i.test(t)
  ) {
    return "No application fee";
  }

  if (/application fee waiver|fee waiver available|waive the application fee|eligible for an application fee waiver/.test(t)) {
    return "Fee waiver mentioned — eligibility must be checked";
  }

  const match = original.match(
    /application fee[^$€£\d]{0,35}([$€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp|cad|aud))/i
  );

  if (match) {
    return "Application fee mentioned: " + match[1];
  }

  if (/application fee.{0,45}(?:required|must pay|is \$|is €)/i.test(t)) {
    return "Application fee mentioned — amount not confirmed";
  }

  return "Unknown — not confirmed";
}

function isRelevantProgramme(title, content, url) {
  const t = (String(title || "") + " " + String(content || "")).toLowerCase();
  const titleText = String(title || "").toLowerCase();

  if (isBlocked(url, title)) return false;

  const hasSubject =
    /mathemat|statistic|data science|data analytics|computational|operations research|machine learning|artificial intelligence/.test(t);

  if (!hasSubject) return false;

  const hasMasters =
    /\b(master|masters|msc|m\.sc|m\.s\.|ms degree|graduate programme|graduate program|postgraduate|joint master)\b/.test(t);

  if (!hasMasters) return false;

  if (
    /scholarship directory|browse scholarships|all scholarships|degree scholarships available|top \d+|list of \d+|how to find scholarships|study abroad guide|scholarship database/.test(titleText)
  ) {
    return false;
  }

  const hasProgrammeSignal =
    /admission|apply|application|programme|program|degree|master|call for applications|curriculum/.test(titleText);

  return hasProgrammeSignal;
}

function programmeName(title, url) {
  const host = hostOf(url);

  if (hostMatches(host, "intermaths.eu")) {
    return "InterMaths Erasmus Mundus Joint Master";
  }

  if (hostMatches(host, "math.ucsd.edu")) {
    return "UC San Diego Mathematics Master's programmes";
  }

  if (hostMatches(host, "dornsife.usc.edu")) {
    return "USC Mathematics Master's programmes";
  }

  if (hostMatches(host, "lsa.umich.edu")) {
    return "University of Michigan Mathematics Master's programmes";
  }

  if (hostMatches(host, "cam.uchicago.edu")) {
    return "MS in Computational and Applied Mathematics";
  }

  return clean(title)
    .replace(/^(apply for|apply to|admissions?:|applications? for)\s+/i, "")
    .replace(/\s*[|–—-]\s*(official|admissions|apply now).*$/i, "")
    .trim();
}

function programmeKey(result) {
  const host = hostOf(result.sourceLink);

  if (hostMatches(host, "intermaths.eu")) return "intermaths-master";
  if (hostMatches(host, "math.ucsd.edu")) return "ucsd-mathematics-masters";
  if (hostMatches(host, "dornsife.usc.edu")) return "usc-mathematics-masters";
  if (hostMatches(host, "lsa.umich.edu")) return "michigan-mathematics-masters";
  if (hostMatches(host, "cam.uchicago.edu")) return "uchicago-cam-ms";

  return (result.programme + " " + result.institution)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatResult(item) {
  const title = clean(item.title || "");
  const description = clean(item.content || "");
  const combined = title + ". " + description;

  const details = institutionFrom(item.url, combined);
  const dates = extractDates(combined);
  const funding = fundingFrom(combined);

  let closing = dateString(dates.close);

  if (dates.multipleDeadlines.length > 1) {
    closing = "Multiple deadlines: " + dates.multipleDeadlines.join(", ");
  }

  return {
    title,
    programme: programmeName(title, item.url),
    university: details.name,
    institution: details.name,
    country: details.country,
    region: ALLOWED_REGIONS.includes(details.country)
      ? details.country
      : "Other",

    applicationOpeningDate: dateString(dates.open),
    applicationClosingDate: closing,
    applicationStatus: dateStatus(
      dates.open,
      dates.close,
      combined,
      windowEndDate()
    ),

    programmeStart: "Not confirmed",
    start: "Not confirmed",
    tuition: "Not confirmed",

    fundingStatus: funding.status,
    scholarship: funding.detail,
    english: englishFrom(combined),
    applicationFee: feeFrom(combined),

    sourceType: isOfficialHost(item.url)
      ? "Official institution/programme source"
      : "Discovery source — not an official page",

    sourceLink: item.url,
    officialLink: null,
    officialUniversityLink: null,

    verificationStatus: "Not checked",
    description: description || "No description supplied by the search provider.",
    verification: "Awaiting official-page check."
  };
}

/*
 * Specific official-page rules.
 * These override generic keyword detection when the exact official page
 * is found. This prevents PhD funding or unrelated information from
 * being mistaken for Master's scholarship funding.
 */
function knownOfficialFacts(url) {
  const normal = normalUrl(url);

  if (normal.includes("intermaths.eu/apply")) {
    return {
      institution: "InterMaths Erasmus Mundus Joint Master consortium",
      country: "Europe",
      programme: "InterMaths Erasmus Mundus Joint Master",
      opening: "2026-11-06",
      closing: "2027-02-17",
      fundingStatus: "Erasmus Mundus scholarships available — competitive",
      scholarship: "The official page states that 18 Erasmus Mundus scholarships are available. Each scholarship provides €1,400 per month for up to 24 months (€33,600 over 24 months if paid for the full period). Scholarship holders have participation costs waived, including tuition, registration and mandatory course participation costs. Accommodation, living, travel, equipment and personal expenses remain the student's responsibility and must be budgeted for. Full insurance coverage is stated. The scholarship is competitive; eligibility and selection are not guaranteed.",
      english: "MOI route may be accepted if the applicant completed at least one year of study at an English-speaking institution. Confirm with the programme whether the applicant's institution and MOI document meet this condition. Otherwise an accepted English test is required.",
      applicationFee: "No application fee",
      officialLink: "https://www.intermaths.eu/apply",
      explicitOpen: true,
      deadlineNote: "Scholarship application deadline: 17 February 2027, 1:00 pm CET. Referee deadline: 3 March 2027. Results announcement: 30 April 2027. The referee and results dates are not the applicant's scholarship deadline.",
      verified: true
    };
  }

  if (normal.includes("lsa.umich.edu/math/graduates/admissions/applying1.html")) {
    return {
      institution: "University of Michigan",
      country: "USA",
      programme: "University of Michigan Mathematics Master's programmes",
      opening: null,
      closing: "2027-02-01",
      fundingStatus: "No Master's funding stated",
      scholarship: "The official Mathematics admissions information states that Master's students are self-funded and that financial support is not available for most Master's students. PhD funding must not be treated as Master's funding. A separate restricted programme may have different eligibility, but it is not evidence of funding for this applicant's general Master's options.",
      english: "IELTS or TOEFL is required for many international applicants, subject to the university's official exemption rules. Check the current Rackham English proficiency policy.",
      applicationFee: "International application fee waiver unavailable — application fee amount not confirmed by this page",
      officialLink: "https://lsa.umich.edu/math/graduates/Admissions/applying1.html",
      explicitOpen: true,
      verified: true
    };
  }

  if (normal.includes("math.ucsd.edu/students/graduate/how-to-apply")) {
    return {
      institution: "University of California San Diego",
      country: "USA",
      programme: "UC San Diego Mathematics Master's programmes",
      opening: "2026-09-02",
      closing: "2027-02-03",
      fundingStatus: "No Master's funding confirmed",
      scholarship: "The official page describes departmental financial support for PhD students. That PhD support is not Master's funding. No Master's scholarship or financial support is confirmed by this page.",
      english: "International applicants from non-English-speaking countries are asked to provide an accepted English proficiency test, subject to the university's official exemption policy.",
      applicationFee: "Application fee required: $155 for international applicants",
      officialLink: "https://math.ucsd.edu/students/graduate/how-to-apply",
      explicitOpen: true,
      verified: true
    };
  }

  if (normal.includes("dornsife.usc.edu/mathematics/admissions")) {
    return {
      institution: "University of Southern California",
      country: "USA",
      programme: "USC Mathematics Master's programmes",
      opening: "2026-09-01",
      closing: "2027-02-01",
      fundingStatus: "No Master's funding stated",
      scholarship: "The Mathematics admissions information states that Master's programmes do not receive financial assistance from the department. Financial support described for PhD students must not be counted as Master's funding. Deadlines are programme-specific: most Master's programmes have a 1 February deadline; Mathematical Data Science MS has a 15 February deadline; Mathematical Finance MS has a 30 March deadline.",
      english: "TOEFL, IELTS or PTE may be required for international applicants who need to demonstrate English proficiency. Exemptions depend on the university's official policy.",
      applicationFee: "Application fee and any waiver eligibility must be checked on the USC Graduate Admissions fee page; not confirmed by this department page.",
      officialLink: "https://dornsife.usc.edu/mathematics/admissions",
      explicitOpen: true,
      verified: true
    };
  }

  if (normal.includes("cam.uchicago.edu/news/article/cam-is-now-accepting-applications-for-the-phd-and-ms-programs-for-the-2027-cycle")) {
    return {
      institution: "University of Chicago",
      country: "USA",
      programme: "MS in Computational and Applied Mathematics",
      opening: null,
      closing: "2027-02-01",
      fundingStatus: "Funding not confirmed",
      scholarship: "The official admissions announcement confirms Master's application rounds but does not confirm a scholarship or funding package for the Master's programme. PhD funding must not be assumed to apply to Master's students.",
      english: "Not confirmed — check the university's graduate English proficiency requirements.",
      applicationFee: "Unknown — not confirmed",
      officialLink: "https://cam.uchicago.edu/news/article/cam-is-now-accepting-applications-for-the-phd-and-ms-programs-for-the-2027-cycle",
      explicitOpen: true,
      deadlineNote: "The page lists Master's application rounds with deadlines of 2 November 2026, 1 February 2027 and 3 May 2027. The next listed deadline is 1 February 2027.",
      verified: true
    };
  }

  return null;
}

function knownFactsAsEvidence(facts) {
  return {
    opening: facts.opening,
    closing: facts.closing,
    nextDeadline: facts.closing,
    fundingStatus: facts.fundingStatus,
    scholarship: facts.scholarship,
    english: facts.english,
    applicationFee: facts.applicationFee,
    explicitOpen: facts.explicitOpen,
    officialText: facts.deadlineNote || "",
    deadlineNote: facts.deadlineNote || ""
  };
}

function applyKnownFacts(result, facts) {
  result.programme = facts.programme;
  result.university = facts.institution;
  result.institution = facts.institution;
  result.country = facts.country;
  result.region = facts.country;
  result.applicationOpeningDate = facts.opening;
  result.applicationClosingDate = facts.closing;
  result.fundingStatus = facts.fundingStatus;
  result.scholarship = facts.scholarship;
  result.english = facts.english;
  result.applicationFee = facts.applicationFee;
  result.officialLink = facts.officialLink;
  result.officialUniversityLink = facts.officialLink;
  result.verificationStatus = "Official page verified";
  result.verification = "The official programme or provider page was identified. Scholarship availability, funding coverage and personal eligibility are assessed separately.";
  result._officialExplicitOpen = facts.explicitOpen;
  result._effectiveDeadline = facts.closing;
  result.deadlineNote = facts.deadlineNote || "";

  const open = facts.opening
    ? new Date(facts.opening + "T00:00:00Z")
    : null;

  const close = facts.closing
    ? new Date(facts.closing + "T00:00:00Z")
    : null;

  result.applicationStatus = dateStatus(
    open,
    close,
    facts.explicitOpen ? "Applications are now open" : "",
    windowEndDate()
  );

  if (!open && facts.explicitOpen && close && close >= todayUTC()) {
    result.applicationStatus = "Possibly open — opening date not confirmed";
  }

  return result;
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(word =>
      word.length > 3 &&
      ![
        "master", "masters", "programme", "program",
        "university", "admission", "official"
      ].includes(word)
    );
}

function titleSimilarity(expected, candidate) {
  const a = [...new Set(tokenize(expected))];
  const b = new Set(tokenize(candidate));

  if (!a.length) return 0;

  return a.filter(word => b.has(word)).length / a.length;
}

async function tavily(endpoint, body) {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const response = await fetch(
    "https://api.tavily.com/" + endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.TAVILY_API_KEY
      },
      body: JSON.stringify(body)
    }
  );

  const responseText = await response.text();

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      data.detail || data.message || responseText.slice(0, 250);

    throw new Error(
      "Tavily " + endpoint + " failed (" + response.status + "): " + message
    );
  }

  return data;
}

async function searchWeb(query, max = 8) {
  return tavily("search", {
    query,
    search_depth: "advanced",
    max_results: max,
    include_answer: false,
    include_raw_content: true
  });
}

async function verifyOfficial(result) {
  const candidates = [];

  if (isOfficialHost(result.sourceLink)) {
    candidates.push({
      title: result.title,
      url: result.sourceLink,
      content: result.description,
      host: hostOf(result.sourceLink)
    });
  }

  const query =
    '"' + result.programme + '" "' +
    result.institution +
    '" official admissions application';

  try {
    const found = await searchWeb(query, 5);

    for (const item of found.results || []) {
      const host = hostOf(item.url);

      if (!isOfficialHost(item.url)) continue;

      const candidateText = clean(item.title) + " " + clean(item.content);

      if (result.institution !== "Institution not confirmed") {
        const knownHost = INSTITUTIONS.find(entry =>
          entry.name === result.institution
        );

        const sameKnownInstitution =
          knownHost && hostMatches(host, knownHost.host);

        const consortiumMatch =
          result.programme.includes("InterMaths") &&
          hostMatches(host, "intermaths.eu");

        const institutionTextMatch =
          candidateText.toLowerCase().includes(
            result.institution.toLowerCase()
          );

        if (
          !sameKnownInstitution &&
          !consortiumMatch &&
          !institutionTextMatch
        ) {
          continue;
        }
      }

      candidates.push({
        title: clean(item.title),
        url: item.url,
        content: clean(item.content),
        host
      });
    }
  } catch (error) {
    console.warn("Official-page search failed:", error.message);
  }

  const unique = [
    ...new Map(
      candidates.map(item => [normalUrl(item.url), item])
    ).values()
  ];

  unique.sort((a, b) =>
    titleSimilarity(
      result.programme,
      b.title + " " + b.content
    ) -
    titleSimilarity(
      result.programme,
      a.title + " " + a.content
    )
  );

  const chosen = unique.find(item => {
    const known = knownOfficialFacts(item.url);
    if (known) return true;

    if (result.programme.includes("InterMaths")) {
      return hostMatches(item.host, "intermaths.eu");
    }

    return titleSimilarity(
      result.programme,
      item.title + " " + item.content
    ) >= 0.45;
  });

  if (!chosen) {
    return {
      verificationStatus: "Not verified",
      officialLink: null,
      officialUniversityLink: null,
      verification: "No sufficiently matching official university or programme-provider page was found. This discovery result is not verified."
    };
  }

  // Use deterministic evidence for official pages with known programme details.
  const known = knownOfficialFacts(chosen.url);

  if (known) {
    return {
      verificationStatus: "Official page verified",
      officialLink: known.officialLink,
      officialUniversityLink: known.officialLink,
      officialPageTitle: chosen.title,
      verification: "The official page was matched. Specific programme, funding, fee and deadline information is handled using the official page's stated details.",
      officialEvidence: knownFactsAsEvidence(known),
      _knownFacts: known
    };
  }

  let officialContent = chosen.content || "";

  try {
    const extracted = await tavily("extract", {
      urls: [chosen.url],
      extract_depth: "advanced",
      format: "markdown"
    });

    const extractedItem =
      (extracted.results || []).find(item =>
        normalUrl(item.url) === normalUrl(chosen.url)
      ) || (extracted.results || [])[0];

    if (extractedItem && extractedItem.raw_content) {
      officialContent = String(extractedItem.raw_content);
    }
  } catch (error) {
    console.warn("Official-page extraction failed:", error.message);
  }

  const fullText = clean(officialContent);
  const dates = extractDates(officialContent);
  const funding = fundingFrom(fullText);
  const fee = feeFrom(fullText);

  const officialInstitution = institutionFrom(
    chosen.url,
    chosen.title + " " + fullText
  );

  const sameInstitution =
    result.institution === "Institution not confirmed" ||
    officialInstitution.name === result.institution;

  if (!sameInstitution) {
    return {
      verificationStatus: "Not verified",
      officialLink: null,
      officialUniversityLink: null,
      verification: "A page from a different institution was found and rejected as a programme match."
    };
  }

  const score = titleSimilarity(
    result.programme,
    chosen.title + " " + fullText
  );

  if (score < 0.45) {
    return {
      verificationStatus: "Partially verified",
      officialLink: chosen.url,
      officialUniversityLink: chosen.url,
      verification: "An official institution page was found, but the exact programme title could not be matched confidently."
    };
  }

  return {
    verificationStatus: "Official page verified",
    officialLink: chosen.url,
    officialUniversityLink: chosen.url,
    officialPageTitle: chosen.title,
    verification: "The official programme page was checked. Scholarship availability and personal eligibility are not assumed from programme verification alone.",
    officialEvidence: {
      opening: dateString(dates.open),
      closing: dateString(dates.close),
      nextDeadline: dateString(dates.close),
      fundingStatus: funding.status,
      scholarship: funding.detail,
      english: englishFrom(fullText),
      applicationFee: fee,
      explicitOpen: explicitOpenEvidence(fullText),
      officialText: fullText.slice(0, 10000)
    }
  };
}

function deduplicate(results) {
  const map = new Map();

  for (const result of results) {
    const key = programmeKey(result);
    const previous = map.get(key);

    if (!previous) {
      map.set(key, result);
      continue;
    }

    const score = item =>
      (isOfficialHost(item.sourceLink) ? 10 : 0) +
      (/\/apply|admission|application/i.test(item.sourceLink) ? 3 : 0) +
      (item.description.length > 250 ? 1 : 0);

    if (score(result) > score(previous)) {
      map.set(key, result);
    }
  }

  return [...map.values()];
}

function dateInWindowOrPreviouslyOpen(result) {
  const open = result.applicationOpeningDate
    ? new Date(result.applicationOpeningDate + "T00:00:00Z")
    : null;

  const deadlineText = result._effectiveDeadline ||
    result.applicationClosingDate || "";

  const close = /^\d{4}-\d{2}-\d{2}$/.test(deadlineText)
    ? new Date(deadlineText + "T00:00:00Z")
    : null;

  const today = todayUTC();
  const start = windowStartDate();
  const end = windowEndDate();

  if (close && close < today) return false;
  if (open && open > end) return false;

  if (open && open < start && (!close || close >= today)) {
    return true;
  }

  if (open && open >= start && open <= end) {
    return true;
  }

  return !open && Boolean(result._officialExplicitOpen);
}

function applyOfficialEvidence(result, evidence) {
  if (evidence.opening) {
    result.applicationOpeningDate = evidence.opening;
  }

  if (evidence.closing) {
    result.applicationClosingDate = evidence.closing;
  }

  if (evidence.fundingStatus) {
    result.fundingStatus = evidence.fundingStatus;
    result.scholarship = evidence.scholarship;
  }

  if (evidence.english && evidence.english !== "Not confirmed") {
    result.english = evidence.english;
  }

  if (evidence.applicationFee &&
      evidence.applicationFee !== "Unknown — not confirmed") {
    result.applicationFee = evidence.applicationFee;
  }

  result._officialExplicitOpen = evidence.explicitOpen;

  if (evidence.nextDeadline) {
    result._effectiveDeadline = evidence.nextDeadline;
  }

  if (!evidence.opening && evidence.explicitOpen) {
    result.applicationStatus = "Possibly open — opening date not confirmed";
  } else {
    const open = evidence.opening
      ? new Date(evidence.opening + "T00:00:00Z")
      : null;

    const close = evidence.nextDeadline
      ? new Date(evidence.nextDeadline + "T00:00:00Z")
      : null;

    result.applicationStatus = dateStatus(
      open,
      close,
      evidence.explicitOpen ? "Applications are now open" : evidence.officialText,
      windowEndDate()
    );
  }

  if (evidence.deadlineNote) {
    result.deadlineNote = evidence.deadlineNote;
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Scholarship Finder server is running",
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY)
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const subject = clean(req.query.q || "Mathematics");
    const selectedRegion = clean(req.query.region || "all");

    if (
      selectedRegion !== "all" &&
      !ALLOWED_REGIONS.includes(selectedRegion)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid region filter."
      });
    }

    const start = windowStartDate();
    const end = windowEndDate();

    const startText = dateString(start);
    const endText = dateString(end);

    const queries = [
      '"' + subject + '" Master scholarship application deadline official university Europe USA Canada Australia',
      '"' + subject + '" MSc MS Master admissions 2027 official university application',
      '"' + subject + '" Erasmus Mundus joint Master scholarship application 2027',
      '"' + subject + '" Master programme scholarship funding call for applications 2027'
    ];

    const gathered = [];
    const failedSearches = [];

    for (const query of queries) {
      try {
        const data = await searchWeb(query, 8);

        for (const item of data.results || []) {
          if (!item.url || isBlocked(item.url, item.title || "")) {
            continue;
          }

          if (!isRelevantProgramme(
            item.title || "",
            item.content || "",
            item.url
          )) {
            continue;
          }

          const result = formatResult(item);

          if (
            selectedRegion !== "all" &&
            result.region !== selectedRegion
          ) {
            continue;
          }

          gathered.push(result);
        }
      } catch (error) {
        failedSearches.push({
          query,
          error: error.message
        });
      }
    }

    const uniqueResults = deduplicate(gathered);

    uniqueResults.sort((a, b) => {
      const official = item =>
        isOfficialHost(item.sourceLink) ? 1 : 0;

      return official(b) - official(a);
    });

    // Verify a larger shortlist before selecting final results.
    const shortlist = uniqueResults.slice(0, 12);
    const results = [];

    for (const result of shortlist) {
      const verification = await verifyOfficial(result);

      Object.assign(result, verification);

      if (verification._knownFacts) {
        applyKnownFacts(result, verification._knownFacts);
      } else if (verification.officialEvidence) {
        applyOfficialEvidence(result, verification.officialEvidence);
      }

      if (
        result.applicationStatus === "CLOSED" ||
        result.applicationStatus === "Outside search window"
      ) {
        continue;
      }

      if (!dateInWindowOrPreviouslyOpen(result)) {
        continue;
      }

      if (
        selectedRegion !== "all" &&
        result.country !== selectedRegion
      ) {
        continue;
      }

      results.push(result);
    }

    const finalResults = deduplicate(results);

    finalResults.sort((a, b) => {
      const priority = item => {
        if (item.fundingStatus.includes("scholarship available")) return 0;
        if (item.fundingStatus.includes("Scholarship or funding mentioned")) return 1;
        if (item.fundingStatus === "Funding not confirmed") return 2;
        if (item.fundingStatus.includes("No Master's funding")) return 3;
        if (item.fundingStatus.includes("Self-funded")) return 4;
        return 5;
      };

      return priority(a) - priority(b);
    });

    const counts = {
      total: finalResults.length,

      openNow: finalResults.filter(item =>
        item.applicationStatus.startsWith("OPEN NOW")
      ).length,

      openingSoon: finalResults.filter(item =>
        item.applicationStatus.startsWith("OPENING SOON")
      ).length,

      closingSoon: finalResults.filter(item =>
        item.applicationStatus.startsWith("CLOSING SOON")
      ).length,

      possiblyOpen: finalResults.filter(item =>
        item.applicationStatus.startsWith("Possibly open")
      ).length,

      officialPageVerified: finalResults.filter(item =>
        item.verificationStatus === "Official page verified"
      ).length,

      partiallyVerified: finalResults.filter(item =>
        item.verificationStatus === "Partially verified"
      ).length,

      notVerified: finalResults.filter(item =>
        item.verificationStatus === "Not verified"
      ).length,

      scholarshipAvailable: finalResults.filter(item =>
        item.fundingStatus.includes("scholarship available")
      ).length,

      fundingNotConfirmed: finalResults.filter(item =>
        item.fundingStatus === "Funding not confirmed"
      ).length,

      noMastersFunding: finalResults.filter(item =>
        item.fundingStatus.includes("No Master's funding") ||
        item.fundingStatus.includes("Self-funded")
      ).length
    };

    res.json({
      success: true,
      searchedSubject: subject,
      selectedRegion,

      searchWindow: {
        start: startText,
        end: endText
      },

      dateRule: "Results are selected by application opening date. Applications opened before the search window are included only when evidence indicates they remain open. Applications opening within the search window are included even when their deadline is later.",

      totalResults: finalResults.length,
      counts,
      failedSearches,

      notice: "An official programme page does not automatically prove that a scholarship is available. PhD funding is not treated as Master's funding. Application fees, tuition fees and scholarship coverage are separate. Eligibility and scholarship selection are never guaranteed.",

      results: finalResults
    });

  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Unexpected server error."
    });
  }
});

// Express 5-compatible fallback route.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile("index.html", {
    root: "public"
  });
});

app.listen(PORT, () => {
  console.log(
    "Scholarship Finder server running on port " + PORT
  );
});
