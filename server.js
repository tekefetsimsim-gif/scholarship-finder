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

const BUILD = "query-aware-v6";
const SEARCH_MONTHS = 3;
const MAX_RESULTS_PER_SEARCH = 8;

const REGION_DOMAINS = {
  europe: [
    "europa.eu", "erasmus-plus.ec.europa.eu", "daad.de",
    "study-in-germany.de", "campusfrance.org",
    "studyinitaly.esteri.it", "universityadmissions.se",
    "studyinsweden.se", "studyinnorway.no",
    "studyindenmark.dk", "studyinfinland.fi",
    "ethz.ch", "epfl.ch", "unige.ch", "unil.ch",
    "unibo.it", "unipd.it", "unimi.it", "unipi.it",
    "unipv.it", "univie.ac.at"
  ],
  usa: [".edu", "educationusa.state.gov", "fulbrightprogram.org"],
  canada: [".ca", "educanada.ca", "vanier.gc.ca"],
  australia: [".edu.au", "dfat.gov.au", "australiaawards.gov.au"]
};

const REGION_QUERIES = {
  europe: "Europe",
  usa: "United States",
  canada: "Canada",
  australia: "Australia",
  all: "Europe OR United States OR Canada OR Australia"
};

const BLOCKED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "reddit.com",
  "wikipedia.org",
  "linkedin.com"
];

function localToday() {
  // Uganda local calendar date (UTC+3).
  return new Date(
    Date.now() + 3 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);
}

function getSearchWindow() {
  const today = localToday();
  const [year, month] = today.split("-").map(Number);

  const start =
    `${year}-${String(month).padStart(2, "0")}-01`;

  const endDate = new Date(
    Date.UTC(year, month - 1 + SEARCH_MONTHS, 0)
  );

  const end = endDate.toISOString().slice(0, 10);

  return { start, end };
}

function parseDate(value) {
  if (!value) return null;

  const s = String(value)
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let m = s.match(
    /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/
  );

  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  m = s.match(
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/
  );

  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);

    if (a > 12 && b <= 12) {
      return `${m[3]}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }

    if (b > 12 && a <= 12) {
      return `${m[3]}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    }
  }

  const months = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12"
  };

  m = s.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(20\d{2})\b/i
  );

  if (m) {
    return `${m[3]}-${months[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  }

  m = s.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(20\d{2})\b/i
  );

  if (m) {
    return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  }

  return null;
}

function dateStatus(opening, closing) {
  const today = localToday();

  if (closing && closing < today) {
    return "CLOSED";
  }

  if (opening && opening > today) {
    return "OPENING SOON";
  }

  if (
    opening &&
    opening <= today &&
    (!closing || closing >= today)
  ) {
    return "OPEN NOW";
  }

  return "POSSIBLY OPEN";
}

function withinSearchWindow(opening, closing, window) {
  const today = localToday();

  // Applications opened before the search window
  // are included if they are still open.

  if (opening && opening < window.start) {
    return !closing || closing >= today;
  }

  // Applications opening within the three-month window
  // are included even if their deadline is later.

  if (
    opening &&
    opening >= window.start &&
    opening <= window.end
  ) {
    return true;
  }

  // Unknown opening date: include only when the
  // future deadline falls inside the search window.

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

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function domainOf(url) {
  try {
    return new URL(url)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlocked(url) {
  const host = domainOf(url);

  return (
    !host ||
    BLOCKED_DOMAINS.some(
      domain =>
        host === domain ||
        host.endsWith(`.${domain}`)
    )
  );
}

function isOfficialDomain(url) {
  const host = domainOf(url);

  if (!host || isBlocked(url)) {
    return false;
  }

  return (
    /\.(edu|edu\.au|ac\.[a-z]{2}|gov|gov\.[a-z]{2}|gc\.ca|ca|de|fr|it|nl|se|no|dk|fi|ch|at|be|es|pt|ie|uk)$/i.test(host) ||
    /(^|\.)erasmus-plus\.ec\.europa\.eu$|(^|\.)daad\.de$|(^|\.)campusfrance\.org$|(^|\.)studyinsweden\.se$|(^|\.)studyinnorway\.no$|(^|\.)studyindenmark\.dk$|(^|\.)studyinfinland\.fi$|(^|\.)educanada\.ca$|(^|\.)australiaawards\.gov\.au$/i.test(host)
  );
}

function inferCountry(url, text, region) {
  const host = domainOf(url);

  const t = `${host} ${text}`.toLowerCase();

  if (
    host.endsWith(".edu.au") ||
    host.endsWith(".gov.au") ||
    /\baustralia\b|\baustralian\b/.test(t)
  ) {
    return "Australia";
  }

  if (
    host.endsWith(".gc.ca") ||
    host.endsWith(".ca") ||
    /\bcanada\b|\bcanadian\b/.test(t)
  ) {
    return "Canada";
  }

  if (
    host.endsWith(".edu") ||
    host.endsWith(".gov") ||
    /\bunited states\b|\busa\b|\bu\.s\.\b/.test(t)
  ) {
    return "United States";
  }

  const countries = [
    ["Germany", /\.de$|\bgermany\b|\bgerman\b/],
    ["France", /\.fr$|\bfrance\b|\bfrench\b/],
    ["Italy", /\.it$|\bitaly\b|\bitalian\b/],
    ["Sweden", /\.se$|\bsweden\b/],
    ["Norway", /\.no$|\bnorway\b/],
    ["Denmark", /\.dk$|\bdenmark\b/],
    ["Finland", /\.fi$|\bfinland\b/],
    ["Switzerland", /\.ch$|\bswitzerland\b/],
    ["Austria", /\.at$|\baustria\b/],
    ["Netherlands", /\.nl$|\bnetherlands\b/],
    ["United Kingdom", /\.uk$|\bunited kingdom\b|\bengland\b/],
    ["Ireland", /\.ie$|\bireland\b/],
    ["Spain", /\.es$|\bspain\b/],
    ["Portugal", /\.pt$|\bportugal\b/],
    ["Belgium", /\.be$|\bbelgium\b/]
  ];

  for (const [country, pattern] of countries) {
    if (pattern.test(t)) {
      return country;
    }
  }

  if (region !== "all" && region !== "europe") {
    return REGION_QUERIES[region] || "Not confirmed";
  }

  return "Not confirmed";
}

function normalizeQuery(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectMatches(query, text) {
  const q = normalizeQuery(query);
  const t = normalizeQuery(text);

  if (!q || !t) {
    return false;
  }

  if (q.includes("mathematics education")) {
    return /\bmathematics education\b|\bmaths education\b|\bmathematics teaching\b/.test(t);
  }

  if (q.includes("applied mathematics")) {
    return /\bapplied mathematics\b|\bapplied maths\b/.test(t);
  }

  if (q.includes("mathematical data science")) {
    return /\bmathematical data science\b|\bmathematics and data science\b/.test(t);
  }

  if (q.includes("data science")) {
    return /\bdata science\b|\bdata analytics\b|\bdata analysis\b|\bmachine learning\b/.test(t);
  }

  if (q.includes("statistics")) {
    return /\bstatistics\b|\bstatistical science\b|\bbiostatistics\b/.test(t);
  }

  if (q.includes("operations research")) {
    return /\boperations research\b|\boperational research\b|\boptimization\b/.test(t);
  }

  if (q.includes("computational mathematics")) {
    return /\bcomputational mathematics\b|\bscientific computing\b/.test(t);
  }

  if (
    q === "mathematics" ||
    q === "math" ||
    q === "maths"
  ) {
    const heading = normalizeQuery(text.slice(0, 450));

    return (
      /\bmathematics\b|\bmathematical sciences\b|\bmaths\b/.test(heading) &&
      !/\b(data science|data analytics|mathematics education|mathematical finance|financial mathematics|statistics)\b/.test(heading)
    );
  }

  return t.includes(q);
}

function hasMastersEvidence(title, programme, content) {
  const heading = `${title || ""} ${programme || ""}`.toLowerCase();

  const degreePattern =
    /\b(master'?s|master of|m\.?s\.?|m\.?sc\.?|m\.?a\.?|graduate degree|postgraduate|msc|ma in|ms in)\b/i;

  if (degreePattern.test(heading)) {
    return true;
  }

  if (
    /\b(phd|ph\.d|doctoral|doctorate)\b/i.test(heading) &&
    !/\b(master'?s|m\.?s\.?|m\.?sc\.?)\b/i.test(heading)
  ) {
    return false;
  }

  const body = String(content || "").slice(0, 3500);

  const lines = body
    .split(/[\n.!?;]+/)
    .map(s => s.trim())
    .filter(Boolean);

  return lines.some(line =>
    degreePattern.test(line) &&
    /\b(programme|program|degree|admission|application|apply|students|course|study)\b/i.test(line) &&
    !/\b(phd|doctoral|doctorate)\b/i.test(line)
  );
}

function extractApplicationDates(text) {
  const raw = String(text || "");

  const lines = raw
    .split(/\n|(?<=[.!?;])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  let opening = null;
  let closing = null;

  const openPatterns = [
    /\b(?:application|applications|admission|admissions|apply|applying)\b.{0,70}\b(?:opens?|opening|starts?|begin(?:s|ning)?|available from|launch(?:es|ed)?)\b/i,
    /\b(?:opens?|opening|starts?|begin(?:s|ning)?)\b.{0,50}\b(?:application|applications|admission|admissions)\b/i,
    /\b(?:from|starting|beginning)\s+(?:the\s+)?(?:month\s+of\s+)?(?:september|october|november|december|january|february|march|april|may|june|july|august)\b/i
  ];

  const closePatterns = [
    /\b(?:deadline|closing date|closes?|last day to apply|applications due|due date|submit by)\b/i,
    /\b(?:application|applications)\b.{0,60}\b(?:deadline|closes?|closing)\b/i
  ];

  for (const line of lines) {
    if (
      /\b(phd|ph\.d|doctoral|doctorate)\b/i.test(line) &&
      !/\b(master'?s|m\.?s\.?|m\.?sc\.?)\b/i.test(line)
    ) {
      continue;
    }

    const d = parseDate(line);

    if (
      d &&
      !closing &&
      closePatterns.some(pattern => pattern.test(line))
    ) {
      closing = d;
    }

    if (
      d &&
      !opening &&
      openPatterns.some(pattern => pattern.test(line))
    ) {
      opening = d;
    }
  }

  const compactOpen = raw.match(
    /\b(?:opens?|opening date|applications open)\s*[:\-]\s*([^|;\n]+)/i
  );

  const compactClose = raw.match(
    /\b(?:deadline|closes?|closing date)\s*[:\-]\s*([^|;\n]+)/i
  );

  if (!opening && compactOpen) {
    opening = parseDate(compactOpen[1]);
  }

  if (!closing && compactClose) {
    closing = parseDate(compactClose[1]);
  }

  if (!opening) {
    const monthOpen = raw.match(
      /\b(?:applications?|admissions?)\s+(?:open|opens|opening|begin|begins|start|starts)\s+(?:in\s+)?(September|October|November|December|January|February|March|April|May|June|July|August)\s+(20\d{2})\b/i
    );

    if (monthOpen) {
      const monthMap = {
        january: "01",
        february: "02",
        march: "03",
        april: "04",
        may: "05",
        june: "06",
        july: "07",
        august: "08",
        september: "09",
        october: "10",
        november: "11",
        december: "12"
      };

      opening =
        `${monthOpen[2]}-${monthMap[monthOpen[1].toLowerCase()]}-01`;
    }
  }

  return { opening, closing };
}

function detectEnglish(text) {
  const t = String(text || "").toLowerCase();

  if (
    /\b(medium of instruction|medium-of-instruction|moi)\b/.test(t) &&
    /\b(accepted|waiv|exempt|may be used|may submit|considered)\b/.test(t)
  ) {
    return "MOI mentioned as accepted/possible — confirm conditions with university";
  }

  if (
    /\b(english language waiver|waiver of english|exempt from.*english|english proficiency waiver)\b/.test(t)
  ) {
    return "English-test waiver mentioned — eligibility must be confirmed";
  }

  const tests = [];

  if (/\bielts\b/.test(t)) tests.push("IELTS");
  if (/\btoefl\b/.test(t)) tests.push("TOEFL");
  if (/\bduolingo\b/.test(t)) tests.push("Duolingo");
  if (/\bpearson|pte academic\b/.test(t)) tests.push("PTE");

  return tests.length
    ? `${tests.join("/")} mentioned — requirements not independently confirmed`
    : "Not confirmed";
}

function detectApplicationFee(text) {
  const t = String(text || "").toLowerCase();

  if (
    /\b(no application fee|application fee is waived|application fee waiver|fee-free application|there is no fee to apply)\b/.test(t)
  ) {
    return "No application fee stated";
  }

  if (
    /\b(application fee waiver|waiver of the application fee|fee waiver)\b/.test(t)
  ) {
    return "Application fee waiver available/mentioned";
  }

  const m = t.match(
    /\b(?:application fee|application charge)\b[^.]{0,45}?(?:usd|us\$|\$|€|£|cad|aud)?\s?\d{2,4}(?:[.,]\d{2})?/i
  );

  if (m) {
    return cleanText(m[0]);
  }

  return "Unknown — not confirmed";
}

function detectTuition(text) {
  const t = String(text || "");

  const m = t.match(
    /(?:tuition|fees|cost of attendance|programme fee|program fee)[^.\n]{0,90}(?:US\$|USD|\$|€|EUR|£|GBP|CAD|AUD)?\s?\d[\d,.]*(?:\s?(?:per year|\/year|annually|per annum|total|per semester))?/i
  );

  return m
    ? cleanText(m[0])
    : "Not confirmed";
}

function detectFunding(text) {
  const t = String(text || "").toLowerCase();

  if (
    /\b(full tuition|full scholarship|fully funded|tuition.*waiv|covers.*tuition)\b/.test(t)
  ) {
    return "Funding/tuition coverage mentioned — verify award conditions";
  }

  if (
    /\b(stipend|monthly allowance|living allowance|scholarship|fellowship|assistantship)\b/.test(t)
  ) {
    return "Scholarship or funding mentioned — amount/eligibility to verify";
  }

  if (
    /\b(no funding|not eligible for financial aid|no financial assistance|self funded|self-funded)\b/.test(t)
  ) {
    return "Self-funded / no Master's funding stated";
  }

  return "Funding not confirmed";
}

function institutionFrom(title, url, content) {
  const host = domainOf(url);

  const known = [
    [/stanford\.edu$/, "Stanford University"],
    [/umich\.edu$/, "University of Michigan"],
    [/unl\.edu$/, "University of Nebraska–Lincoln"],
    [/oregonstate\.edu$/, "Oregon State University"],
    [/ucsd\.edu$/, "University of California San Diego"],
    [/usc\.edu$/, "University of Southern California"],
    [/washington\.edu$/, "University of Washington"],
    [/uchicago\.edu$/, "University of Chicago"],
    [/ubc\.ca$/, "University of British Columbia"],
    [/utoronto\.ca$/, "University of Toronto"],
    [/mcgill\.ca$/, "McGill University"],
    [/ethz\.ch$/, "ETH Zurich"],
    [/epfl\.ch$/, "EPFL"],
    [/daad\.de$/, "DAAD / German scholarship provider"]
  ];

  for (const [pattern, name] of known) {
    if (pattern.test(host)) {
      return name;
    }
  }

  const combined =
    `${title || ""} ${String(content || "").slice(0, 1200)}`;

  let m = combined.match(
    /\b(University of [A-Z][A-Za-zÀ-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÿ'’.-]+){0,4})\b/
  );

  if (m) return m[1];

  m = combined.match(
    /\b([A-Z][A-Za-zÀ-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÿ'’.-]+){0,3}\s+University)\b/
  );

  if (m) return m[1];

  m = combined.match(
    /\b([A-Z][A-Za-zÀ-ÿ'’.-]+ Institute of Technology)\b/
  );

  if (m) return m[1];

  return "Institution not reliably identified";
}

function inferProgramme(title, content, query) {
  const source =
    `${title || ""} ${String(content || "").slice(0, 1200)}`;

  const patterns = [
    [/mathematical data science/i, "Mathematical Data Science"],
    [/mathematics education/i, "Mathematics Education"],
    [/applied mathematics/i, "Applied Mathematics"],
    [/computational mathematics/i, "Computational Mathematics"],
    [/operations research/i, "Operations Research"],
    [/data science/i, "Data Science"],
    [/data analytics/i, "Data Analytics"],
    [/statistics/i, "Statistics"],
    [/mathematics|mathematical sciences/i, "Mathematics"]
  ];

  for (const [pattern, name] of patterns) {
    if (pattern.test(source)) {
      return name;
    }
  }

  return query;
}

function resultFromSearchItem(item, query, region) {
  const url = item.url || "";

  if (!isOfficialDomain(url)) {
    return null;
  }

  const title = cleanText(item.title);

  const content = cleanText(
    item.raw_content ||
    item.content ||
    item.snippet ||
    ""
  );

  if (!title || !content) {
    return null;
  }

  const programme =
    inferProgramme(title, content, query);

  if (!hasMastersEvidence(title, programme, content)) {
    return null;
  }

  if (
    !subjectMatches(
      query,
      `${title}. ${programme}. ${content.slice(0, 700)}`
    )
  ) {
    return null;
  }

  const dates = extractApplicationDates(
    `${title}\n${content}`
  );

  const window = getSearchWindow();

  if (
    !withinSearchWindow(
      dates.opening,
      dates.closing,
      window
    )
  ) {
    return null;
  }

  const status = dateStatus(
    dates.opening,
    dates.closing
  );

  const country = inferCountry(
    url,
    content,
    region
  );

  const institution = institutionFrom(
    title,
    url,
    content
  );

  const funding = detectFunding(content);

  const scholarship =
    funding === "Funding not confirmed"
      ? "Scholarship details not confirmed"
      : funding;

  return {
    title,
    institution,
    university: institution,
    programme,
    country,
    programmeStart: "Not confirmed",
    start: "Not confirmed",
    applicationOpeningDate: dates.opening || "Not confirmed",
    applicationClosingDate: dates.closing || "Not confirmed",
    deadline: dates.closing || "Not confirmed",
    applicationStatus: status,
    tuition: detectTuition(content),
    scholarship,
    fundingStatus: funding,
    english: detectEnglish(content),
    applicationFee: detectApplicationFee(content),
    description: cleanText(
      item.content || item.snippet || content
    ).slice(0, 650),
    snippet: cleanText(
      item.content || item.snippet || content
    ).slice(0, 650),
    officialLink: url,
    officialUniversityLink: url,
    sourceLink: url,
    sourceType: "Official university/provider source",
    verification: "Partially verified — check linked official page",
    verificationStatus: "partially_verified",
    partiallyVerified: true,
    scholarshipVerification: funding,
    verified: false
  };
}

function knownOfficialResults(query) {
  const window = getSearchWindow();

  const records = [
    {
      title: "Erasmus Mundus Joint Master in Interdisciplinary Mathematics (InterMaths)",
      institution: "InterMaths consortium",
      programme: "Interdisciplinary Mathematics",
      country: "Europe",
      opening: "2026-11-06",
      closing: "2027-02-17",
      tuition: "Participation costs waived for Erasmus Mundus scholarship holders",
      scholarship: "18 Erasmus Mundus scholarships; €1,400 per month for scholarship holders (confirm current call terms)",
      fundingStatus: "Erasmus Mundus scholarship; participation costs waived; €1,400/month stated for scholarship holders",
      english: "MOI may be accepted under stated previous-study conditions — confirm with consortium",
      applicationFee: "No application fee stated",
      url: "https://www.intermaths.eu/",
      description: "Official InterMaths programme information. Confirm the current call, eligible countries, English evidence, scholarship terms and deadlines on the programme website."
    },
    {
      title: "MS Mathematics — University of Michigan",
      institution: "University of Michigan",
      programme: "Mathematics",
      country: "United States",
      opening: null,
      closing: "2027-02-01",
      tuition: "Not confirmed",
      scholarship: "Funding for Master's students not confirmed",
      fundingStatus: "Funding not confirmed",
      english: "English proficiency requirements apply — check official programme page",
      applicationFee: "Unknown — not confirmed",
      url: "https://lsa.umich.edu/math/graduates/graduate-programs.html",
      description: "University mathematics graduate-program information. Confirm that the specific Master's route is accepting applications and whether funding is available."
    },
    {
      title: "Mathematics and Statistics Graduate Admissions — UC San Diego",
      institution: "University of California San Diego",
      programme: "Mathematics / Applied Mathematics / Statistics",
      country: "United States",
      opening: "2026-09-02",
      closing: "2027-02-03",
      tuition: "Not confirmed",
      scholarship: "Master's funding not confirmed",
      fundingStatus: "Funding not confirmed",
      english: "IELTS/TOEFL/PTE requirements listed; waiver conditions must be checked",
      applicationFee: "US$155 (confirm current amount)",
      url: "https://math.ucsd.edu/",
      description: "Department source for graduate mathematics and statistics admissions. Verify the exact Master's programme, deadlines and funding before applying."
    },
    {
      title: "Mathematics Graduate Programs — University of Southern California",
      institution: "University of Southern California",
      programme: "Mathematics / Applied Mathematics",
      country: "United States",
      opening: "2026-09-01",
      closing: "2027-02-01",
      tuition: "Not confirmed",
      scholarship: "No Master's financial assistance stated on the referenced admissions information",
      fundingStatus: "Self-funded / no Master's funding stated",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://dornsife.usc.edu/mathematics/",
      description: "Department programme information. Check the specific Master's degree and current admissions cycle."
    },
    {
      title: "MS Mathematical Data Science — University of Southern California",
      institution: "University of Southern California",
      programme: "Mathematical Data Science",
      country: "United States",
      opening: "2026-09-01",
      closing: "2027-02-15",
      tuition: "Not confirmed",
      scholarship: "Master's financial assistance not confirmed",
      fundingStatus: "Self-funded / no Master's funding stated",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://dornsife.usc.edu/mathematics/",
      description: "USC mathematics department information. Confirm the current Mathematical Data Science MS application cycle and funding."
    },
    {
      title: "MS Mathematical Finance — University of Southern California",
      institution: "University of Southern California",
      programme: "Mathematical Finance",
      country: "United States",
      opening: "2026-09-01",
      closing: "2027-03-30",
      tuition: "Not confirmed",
      scholarship: "Master's financial assistance not confirmed",
      fundingStatus: "Self-funded / no Master's funding stated",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://dornsife.usc.edu/mathematics/",
      description: "USC mathematics department information. Confirm the exact degree, deadline and funding."
    },
    {
      title: "Applied Mathematics Graduate Program — University of Washington",
      institution: "University of Washington",
      programme: "Applied Mathematics",
      country: "United States",
      opening: null,
      closing: "2027-01-12",
      tuition: "Not confirmed",
      scholarship: "Master's funding not confirmed",
      fundingStatus: "Funding not confirmed",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://amath.washington.edu/",
      description: "Applied Mathematics department information. Verify the MS Campus Program specifically; the page may also describe PhD admissions."
    },
    {
      title: "MS Mathematics — University of Nebraska–Lincoln",
      institution: "University of Nebraska–Lincoln",
      programme: "Mathematics",
      country: "United States",
      opening: null,
      closing: "2027-01-15",
      tuition: "Not confirmed",
      scholarship: "Funding not confirmed",
      fundingStatus: "Funding not confirmed",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://math.unl.edu/",
      description: "Department programme information. Confirm current Master's admissions and financial support."
    }
  ];

  return records
    .filter(record => {
      const status = dateStatus(
        record.opening,
        record.closing
      );

      return (
        status !== "CLOSED" &&
        withinSearchWindow(
          record.opening,
          record.closing,
          window
        ) &&
        subjectMatches(
          query,
          `${record.title} ${record.programme}`
        )
      );
    })
    .map(record => ({
      title: record.title,
      institution: record.institution,
      university: record.institution,
      programme: record.programme,
      country: record.country,
      programmeStart: "Not confirmed",
      start: "Not confirmed",
      applicationOpeningDate: record.opening || "Not confirmed",
      applicationClosingDate: record.closing || "Not confirmed",
      deadline: record.closing || "Not confirmed",
      applicationStatus: dateStatus(
        record.opening,
        record.closing
      ),
      tuition: record.tuition,
      scholarship: record.scholarship,
      fundingStatus: record.fundingStatus,
      english: record.english,
      applicationFee: record.applicationFee,
      description: record.description,
      snippet: record.description,
      officialLink: record.url,
      officialUniversityLink: record.url,
      sourceLink: record.url,
      sourceType: "Known official programme source — recheck current call",
      verification: "Official source identified; details still require current-cycle confirmation",
      verificationStatus: "partially_verified",
      partiallyVerified: true,
      scholarshipVerification: record.fundingStatus,
      verified: false
    }));
}

function buildSearchQueries(query, region) {
  const regionPhrase =
    REGION_QUERIES[region] || REGION_QUERIES.all;

  return [
    `"${query}" master's scholarship application 2026 2027 ${regionPhrase} official university`,
    `"${query}" MSc MS postgraduate admissions deadline 2027 ${regionPhrase} university`,
    `"${query}" Erasmus Mundus scholarship master's 2027`,
    `"${query}" graduate programme applications open 2026 2027 site:edu OR site:ac.uk OR site:edu.au`,
    `"${query}" master's scholarship international students application deadline 2027 official`
  ];
}

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) {
    throw new Error(
      "TAVILY_API_KEY is not configured in Render environment variables."
    );
  }

  const response = await fetch(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        topic: "general",
        max_results: MAX_RESULTS_PER_SEARCH,
        include_answer: false,
        include_raw_content: true
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    throw new Error(
      `Tavily search failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }

  return response.json();
}

function deduplicate(results) {
  const seen = new Set();

  return results.filter(result => {
    const key = (result.officialLink || "")
      .replace(/\/$/, "")
      .toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function fundingRank(result) {
  const s =
    `${result.fundingStatus || ""} ${result.scholarship || ""}`.toLowerCase();

  if (
    /erasmus mundus|fully funded|full scholarship|full tuition|stipend|monthly allowance|scholarship.*mentioned|funding\/tuition coverage/.test(s)
  ) {
    return 0;
  }

  if (
    /self-funded|no master's funding|no financial assistance/.test(s)
  ) {
    return 2;
  }

  return 1;
}

function englishRank(result) {
  const s = String(result.english || "").toLowerCase();

  if (s.includes("moi")) return 0;
  if (s.includes("waiver")) return 1;
  if (s.includes("not confirmed")) return 2;

  return 3;
}

function sortResults(results) {
  const statusRank = {
    "OPEN NOW": 0,
    "OPENING SOON": 1,
    "POSSIBLY OPEN": 2,
    "Dates unconfirmed": 2,
    "CLOSED": 3
  };

  return results.sort((a, b) =>
    (statusRank[a.applicationStatus] ?? 2) -
      (statusRank[b.applicationStatus] ?? 2) ||
    fundingRank(a) - fundingRank(b) ||
    englishRank(a) - englishRank(b) ||
    String(a.applicationClosingDate).localeCompare(
      String(b.applicationClosingDate)
    )
  );
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Scholarship Finder server is running",
    build: BUILD,
    tavilyConfigured: Boolean(TAVILY_API_KEY),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/search", async (req, res) => {
  const query = String(req.query.q || "").trim();

  const region = String(
    req.query.region || "all"
  ).toLowerCase();

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Please enter a subject to search."
    });
  }

  const allowedRegions = [
    "all",
    "europe",
    "usa",
    "canada",
    "australia"
  ];

  if (!allowedRegions.includes(region)) {
    return res.status(400).json({
      success: false,
      error: "Region must be all, europe, usa, canada, or australia."
    });
  }

  const window = getSearchWindow();

  const warnings = [];
  let discovered = [];

  try {
    const queries = buildSearchQueries(
      query,
      region
    );

    const settled = await Promise.allSettled(
      queries.map(tavilySearch)
    );

    for (const item of settled) {
      if (item.status === "fulfilled") {
        discovered.push(
          ...(item.value.results || [])
        );
      } else {
        warnings.push(
          item.reason?.message ||
          "One search source failed."
        );
      }
    }
  } catch (error) {
    warnings.push(
      error.message || "Search failed."
    );
  }

  const discoveredResults = discovered
    .map(item =>
      resultFromSearchItem(item, query, region)
    )
    .filter(Boolean);

  const knownResults =
    knownOfficialResults(query);

  const results = sortResults(
    deduplicate([
      ...knownResults,
      ...discoveredResults
    ])
  );

  const counts = {
    total: results.length,

    openNow: results.filter(
      r => r.applicationStatus === "OPEN NOW"
    ).length,

    openingSoon: results.filter(
      r => r.applicationStatus === "OPENING SOON"
    ).length,

    closingSoon: results.filter(r => {
      if (
        !r.applicationClosingDate ||
        r.applicationClosingDate === "Not confirmed"
      ) {
        return false;
      }

      const days = Math.round(
        (
          new Date(`${r.applicationClosingDate}T00:00:00Z`) -
          new Date(`${localToday()}T00:00:00Z`)
        ) / 86400000
      );

      return days >= 0 && days <= 30;
    }).length,

    possiblyOpen: results.filter(
      r =>
        r.applicationStatus === "POSSIBLY OPEN" ||
        r.applicationStatus === "Dates unconfirmed"
    ).length,

    verified: results.filter(
      r => r.verified
    ).length,

    partiallyVerified: results.filter(
      r => r.partiallyVerified
    ).length,

    notVerified: results.filter(
      r => !r.verified && !r.partiallyVerified
    ).length
  };

  const warning = warnings.length
    ? [...new Set(warnings)].join(" | ").slice(0, 900)
    : null;

  const message = results.length
    ? "Results are selected by application opening date. Previously opened applications are included only when they appear to remain open. Verify every deadline, funding condition and eligibility rule on the official page."
    : "No matching Master's programmes with sufficient subject and application-date evidence were found. This does not prove that no suitable opportunities exist; some official pages do not publish dates in searchable text.";

  res.json({
    success: true,
    build: BUILD,
    searchedSubject: query,
    selectedRegion: region,
    searchWindow: window,

    dateRule:
      "Selected by application opening date. Applications opened earlier are included only if they remain open; applications opening within the window are included even if their closing date is later.",

    filters: {
      degreeLevel: "Master's only",
      subject: query,
      region,
      openingDateWindow:
        `${window.start} to ${window.end}`,
      officialSourcesPreferred: true
    },

    totalResults: results.length,
    counts,
    results,
    warning,
    message
  });
});

app.get("/", (req, res) => {
  res.sendFile("index.html", {
    root: "public"
  });
});

app.listen(PORT, () => {
  console.log(
    `Scholarship Finder server listening on port ${PORT} (${BUILD})`
  );
});
