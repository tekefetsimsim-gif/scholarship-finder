
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const BUILD = "query-aware-v8";
const SEARCH_MONTHS = 3;
const MAX_RESULTS_PER_SEARCH = 8;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

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
  "linkedin.com",
  "pinterest.com"
];

const INSTITUTIONS = [
  { domains: ["imperial.ac.uk"], name: "Imperial College London", country: "United Kingdom", region: "Europe" },
  { domains: ["ox.ac.uk"], name: "University of Oxford", country: "United Kingdom", region: "Europe" },
  { domains: ["lse.ac.uk"], name: "London School of Economics and Political Science", country: "United Kingdom", region: "Europe" },
  { domains: ["tc.columbia.edu", "columbia.edu"], name: "Columbia University", country: "United States", region: "USA" },
  { domains: ["uconn.edu"], name: "University of Connecticut", country: "United States", region: "USA" },
  { domains: ["usc.edu"], name: "University of Southern California", country: "United States", region: "USA" },
  { domains: ["ucsd.edu"], name: "University of California San Diego", country: "United States", region: "USA" },
  { domains: ["washington.edu"], name: "University of Washington", country: "United States", region: "USA" },
  { domains: ["umich.edu"], name: "University of Michigan", country: "United States", region: "USA" },
  { domains: ["unl.edu"], name: "University of Nebraska–Lincoln", country: "United States", region: "USA" },
  { domains: ["sps.cuny.edu", "cuny.edu"], name: "City University of New York", country: "United States", region: "USA" },
  { domains: ["ubc.ca"], name: "University of British Columbia", country: "Canada", region: "Canada" },
  { domains: ["utoronto.ca"], name: "University of Toronto", country: "Canada", region: "Canada" },
  { domains: ["mcgill.ca"], name: "McGill University", country: "Canada", region: "Canada" },
  { domains: ["ethz.ch"], name: "ETH Zurich", country: "Switzerland", region: "Europe" },
  { domains: ["epfl.ch"], name: "EPFL", country: "Switzerland", region: "Europe" },
  { domains: ["daad.de"], name: "German Academic Exchange Service (DAAD)", country: "Germany", region: "Europe" }
];

function localToday() {
  return new Date(
    Date.now() + 3 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);
}

function getSearchWindow() {
  const today = localToday();
  const [year, month] = today.split("-").map(Number);

  const start =
    `${year}-${String(month).padStart(2, "0")}-01`;

  // Current month plus the next two months.
  const endDate = new Date(
    Date.UTC(year, month - 1 + SEARCH_MONTHS, 0)
  );

  return {
    start,
    end: endDate.toISOString().slice(0, 10)
  };
}

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function domainOf(url = "") {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlocked(url) {
  const host = domainOf(url);

  return !host || BLOCKED_DOMAINS.some(
    domain => host === domain || host.endsWith(`.${domain}`)
  );
}

function isOfficialDomain(url) {
  const host = domainOf(url);

  if (!host || isBlocked(url)) return false;

  if (INSTITUTIONS.some(item =>
    item.domains.some(domain =>
      host === domain || host.endsWith(`.${domain}`)
    )
  )) {
    return true;
  }

  return (
    /\.(edu|edu\.au|ac\.[a-z]{2}|gov|gov\.[a-z]{2}|gc\.ca|ca|de|fr|it|nl|se|no|dk|fi|ch|at|be|es|pt|ie|uk)$/i.test(host) ||
    /(^|\.)erasmus-plus\.ec\.europa\.eu$|(^|\.)daad\.de$|(^|\.)campusfrance\.org$|(^|\.)educanada\.ca$|(^|\.)australiaawards\.gov\.au$/i.test(host)
  );
}

function getInstitution(url, title = "", content = "") {
  const host = domainOf(url);

  const known = INSTITUTIONS.find(item =>
    item.domains.some(domain =>
      host === domain || host.endsWith(`.${domain}`)
    )
  );

  if (known) return known;

  const text = `${title} ${content.slice(0, 1200)} ${host}`.toLowerCase();

  const patterns = [
    [/university of connecticut|\buconn\b/, "University of Connecticut", "United States", "USA"],
    [/columbia university/, "Columbia University", "United States", "USA"],
    [/university of oxford/, "University of Oxford", "United Kingdom", "Europe"],
    [/imperial college london/, "Imperial College London", "United Kingdom", "Europe"],
    [/london school of economics|\blse\b/, "London School of Economics and Political Science", "United Kingdom", "Europe"],
    [/city university of new york|\bcuny\b/, "City University of New York", "United States", "USA"]
  ];

  for (const [pattern, name, country, region] of patterns) {
    if (pattern.test(text)) return { name, country, region };
  }

  const countryPatterns = [
    ["Germany", /\.de$|\bgermany\b/i, "Europe"],
    ["France", /\.fr$|\bfrance\b/i, "Europe"],
    ["Italy", /\.it$|\bitaly\b/i, "Europe"],
    ["Sweden", /\.se$|\bsweden\b/i, "Europe"],
    ["Norway", /\.no$|\bnorway\b/i, "Europe"],
    ["Denmark", /\.dk$|\bdenmark\b/i, "Europe"],
    ["Finland", /\.fi$|\bfinland\b/i, "Europe"],
    ["Switzerland", /\.ch$|\bswitzerland\b/i, "Europe"],
    ["Austria", /\.at$|\baustria\b/i, "Europe"],
    ["Netherlands", /\.nl$|\bnetherlands\b/i, "Europe"],
    ["United Kingdom", /\.uk$|\bunited kingdom\b|\bengland\b/i, "Europe"],
    ["Ireland", /\.ie$|\bireland\b/i, "Europe"],
    ["Spain", /\.es$|\bspain\b/i, "Europe"],
    ["Portugal", /\.pt$|\bportugal\b/i, "Europe"],
    ["Belgium", /\.be$|\bbelgium\b/i, "Europe"],
    ["Australia", /\.edu\.au$|\.gov\.au$|\baustralia\b/i, "Australia"],
    ["Canada", /\.ca$|\bcanada\b/i, "Canada"],
    ["United States", /\.edu$|\.gov$|\bunited states\b|\busa\b/i, "USA"]
  ];

  for (const [country, pattern, region] of countryPatterns) {
    if (pattern.test(text)) {
      return {
        name: "Institution not reliably identified",
        country,
        region
      };
    }
  }

  return {
    name: "Institution not reliably identified",
    country: "Not confirmed",
    region: "Not confirmed"
  };
}

function matchesRegion(result, region) {
  if (region === "all") return true;

  return String(result.region || "").toLowerCase() === region;
}

function normalizeQuery(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectType(query) {
  const q = normalizeQuery(query);

  if (/mathematics education|math education|mathematics teaching/.test(q)) return "mathematics-education";
  if (/mathematical data science|data science|data analytics/.test(q)) return "data-science";
  if (/applied mathematics|applied maths/.test(q)) return "applied-mathematics";
  if (/statistics|statistical science/.test(q)) return "statistics";
  if (/computational mathematics/.test(q)) return "computational-mathematics";
  if (/operations research|operational research/.test(q)) return "operations-research";
  if (/artificial intelligence|machine learning/.test(q)) return "ai-machine-learning";

  return "mathematics";
}

function subjectMatches(query, title, programme, content = "") {
  const subject = subjectType(query);

  // The page title and programme name are strongest evidence.
  // The page content is retained as supporting evidence, not discarded.
  const heading = normalizeQuery(`${title} ${programme}`);
  const body = normalizeQuery(content.slice(0, 5000));
  const combined = `${heading} ${body}`;

  const rules = {
    "mathematics-education": /\bmathematics education\b|\bmaths education\b|\bmathematics teaching\b|\bteaching mathematics\b/,
    "data-science": /\bdata science\b|\bdata analytics\b|\bmathematical data science\b/,
    "applied-mathematics": /\bapplied mathematics\b|\bapplied maths\b|\bapplied and computational mathematics\b/,
    statistics: /\bstatistics\b|\bstatistical science\b|\bmathematical statistics\b/,
    "computational-mathematics": /\bcomputational mathematics\b|\bscientific computing\b/,
    "operations-research": /\boperations research\b|\boperational research\b/,
    "ai-machine-learning": /\bartificial intelligence\b|\bmachine learning\b/,
    mathematics: /\bmathematics\b|\bmathematical sciences\b|\bmaths\b/
  };

  if (!rules[subject].test(combined)) return false;

  // For general Mathematics searches, do not return unrelated specialist degrees.
  if (subject === "mathematics") {
    if (/\bmathematics education\b|\bdata science\b|\bdata analytics\b|\bmathematical finance\b|\bstatistics\b/.test(heading)) {
      return false;
    }
  }

  return true;
}

function hasMastersEvidence(title, programme, content) {
  const heading = `${title} ${programme}`.toLowerCase();

  const degreePattern =
    /\b(master'?s|master of|master in|msc|m\.sc|m\.s|ms |ma |m\.a|mres|mphil|graduate degree|postgraduate)\b/i;

  if (degreePattern.test(heading)) return true;

  if (/\b(phd|ph\.d|doctoral|doctorate)\b/i.test(heading)) {
    return false;
  }

  const lines = String(content || "")
    .split(/\n|(?<=[.!?;])\s+/)
    .map(line => line.trim())
    .filter(Boolean);

  return lines.some(line =>
    degreePattern.test(line) &&
    /\b(programme|program|degree|admission|application|apply|students|course|study|campus)\b/i.test(line) &&
    !/\b(phd|doctoral|doctorate)\b/i.test(line)
  );
}

function inferProgramme(title, content, query) {
  const heading = cleanText(title);
  const body = cleanText(content);

  // Prefer the actual programme title.
  const titlePatterns = [
    [/mathematical data science/i, "Mathematical Data Science"],
    [/mathematics education/i, "Mathematics Education"],
    [/applied mathematics/i, "Applied Mathematics"],
    [/computational mathematics/i, "Computational Mathematics"],
    [/operations research/i, "Operations Research"],
    [/data science/i, "Data Science"],
    [/data analytics/i, "Data Analytics"],
    [/mathematical sciences/i, "Mathematical Sciences"],
    [/\bstatistics\b/i, "Statistics"],
    [/\bmathematics\b/i, "Mathematics"]
  ];

  for (const [pattern, name] of titlePatterns) {
    if (pattern.test(heading)) {
      if (/graduate admissions|graduate program|graduate programme/i.test(heading)) {
        return `${name} — Master's route needs confirmation`;
      }
      return name;
    }
  }

  // Only use body text when a Master's route is explicitly connected to the subject.
  const bodyLines = body.split(/\n|(?<=[.!?;])\s+/);

  for (const line of bodyLines) {
    if (
      /\b(ms campus|master of|master in|master's in|msc in|ms in)\b/i.test(line) &&
      /\b(applied mathematics|mathematics education|data science|mathematical sciences|statistics|mathematics)\b/i.test(line)
    ) {
      const found = titlePatterns.find(([pattern]) => pattern.test(line));
      if (found) return found[1];
    }
  }

  return cleanText(query);
}

function parseDate(value) {
  if (!value) return null;

  const s = String(value).replace(/,/g, " ").replace(/\s+/g, " ").trim();

  let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);

  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  const months = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12"
  };

  m = s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i);

  if (m) {
    return `${m[3]}-${months[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  }

  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[,]?\s+(20\d{2})\b/i);

  if (m) {
    return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  }

  return null;
}

const DATE_PATTERN = String.raw`(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}|(?:\d{1,2})(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}|20\d{2}-\d{1,2}-\d{1,2}`;

function extractApplicationDates(content) {
  const result = {
    opening: null,
    priorityDeadline: null,
    scholarshipDeadline: null,
    closing: null,
    programmeStart: null,
    rollingAdmissions: false,
    tentativeClosing: false,
    evidence: []
  };

  const text = String(content || "").replace(/\r/g, "\n");

  const labels = [
    {
      type: "priorityDeadline",
      regex: new RegExp(String.raw`\b(priority deadline|priority application deadline|early consideration deadline)\s*[:\-–]?\s*(${DATE_PATTERN})`, "gi")
    },
    {
      type: "scholarshipDeadline",
      regex: new RegExp(String.raw`\b(scholarship deadline|funding deadline|financial aid deadline|scholarship consideration deadline|award consideration deadline)\s*[:\-–]?\s*(${DATE_PATTERN})`, "gi")
    },
    {
      type: "opening",
      regex: new RegExp(String.raw`\b(application opening date|applications open|application opens|opens for applications|application period begins|application window opens)\s*[:\-–]?\s*(${DATE_PATTERN})`, "gi")
    },
    {
      type: "programmeStart",
      regex: new RegExp(String.raw`\b(programme start|program start|course begins|classes begin|semester begins|term begins|intake begins)\s*[:\-–]?\s*(${DATE_PATTERN})`, "gi")
    },
    {
      type: "closing",
      regex: new RegExp(String.raw`\b(final application deadline|final deadline|regular deadline|application deadline|applications close|application closes|tentative application closes|closing date|deadline to apply|last day to apply)\s*[:\-–]?\s*(${DATE_PATTERN})`, "gi")
    }
  ];

  for (const item of labels) {
    for (const match of text.matchAll(item.regex)) {
      const date = parseDate(match[2]);
      if (!date) continue;

      if (item.type === "closing" && /tentative/i.test(match[1])) {
        result.tentativeClosing = true;
      }

      if (!result[item.type]) {
        result[item.type] = date;
      }

      result.evidence.push(match[0].slice(0, 220));
    }
  }

  // Process individual lines as a fallback, without treating every date
  // appearing near the word "deadline" as the final deadline.
  const lines = text.split(/\n|(?<=[.!?;])\s+/).map(x => x.trim()).filter(Boolean);

  for (const line of lines) {
    if (/rolling admissions|rolling basis|until spaces are filled|until all places are filled|applications accepted throughout the year/i.test(line)) {
      result.rollingAdmissions = true;
      result.evidence.push(line.slice(0, 220));
    }

    if (!result.closing && /\b(final deadline|final application deadline|regular deadline|application deadline|applications close|application closes|tentative application closes|closing date|deadline to apply)\b/i.test(line)) {
      const date = parseDate(line);
      if (date) {
        result.closing = date;
        result.tentativeClosing ||= /tentative/i.test(line);
        result.evidence.push(line.slice(0, 220));
      }
    }

    if (!result.priorityDeadline && /\bpriority deadline\b/i.test(line)) {
      const date = parseDate(line);
      if (date) result.priorityDeadline = date;
    }

    if (!result.scholarshipDeadline && /\b(scholarship deadline|funding deadline|scholarship consideration)\b/i.test(line)) {
      const date = parseDate(line);
      if (date) result.scholarshipDeadline = date;
    }

    if (!result.opening && /\b(application opens|applications open|opening date|opens for applications)\b/i.test(line)) {
      const date = parseDate(line);
      if (date) result.opening = date;
    }

    if (!result.programmeStart && /\b(programme start|program start|course begins|semester begins|intake begins)\b/i.test(line)) {
      const date = parseDate(line);
      if (date) result.programmeStart = date;
    }
  }

  return result;
}

function dateStatus(dates) {
  const today = localToday();

  if (dates.closing && dates.closing < today) return "CLOSED";

  if (dates.opening && dates.opening > today) return "OPENING SOON";

  if (dates.opening && dates.opening <= today && dates.closing && dates.closing >= today) {
    return "OPEN NOW";
  }

  if (
    dates.rollingAdmissions &&
    (!dates.closing || dates.closing >= today) &&
    (!dates.opening || dates.opening <= today)
  ) {
    return "OPEN NOW";
  }

  if (dates.opening || dates.closing || dates.priorityDeadline || dates.scholarshipDeadline) {
    return "POSSIBLY OPEN";
  }

  return "DATES UNCONFIRMED";
}

function withinSearchWindow(dates, window, allowUndated = false) {
  const today = localToday();

  if (dates.closing && dates.closing < today) return false;

  if (dates.opening) {
    // Previously opened applications remain eligible if they have not closed.
    if (dates.opening < window.start) {
      return !dates.closing || dates.closing >= today;
    }

    return dates.opening <= window.end;
  }

  const relevantDates = [
    dates.closing,
    dates.priorityDeadline,
    dates.scholarshipDeadline
  ].filter(Boolean);

  if (relevantDates.some(date => date >= window.start && date <= window.end)) {
    return true;
  }

  return allowUndated;
}

function detectEnglish(text) {
  const t = String(text || "").toLowerCase();

  const moi =
    /\b(medium of instruction|medium-of-instruction|english medium|previous degree taught in english)\b/.test(t);

  const waiver =
    /\b(english language waiver|waiver of english|exempt from.*english|english proficiency waiver|waive.*ielts|waive.*toefl)\b/.test(t);

  const tests = [];
  if (/\bielts\b/.test(t)) tests.push("IELTS");
  if (/\btoefl\b/.test(t)) tests.push("TOEFL");
  if (/\bduolingo\b/.test(t)) tests.push("Duolingo");
  if (/\bpearson|pte academic\b/.test(t)) tests.push("PTE");

  if (moi) return "English-medium evidence mentioned; acceptance must be confirmed";
  if (waiver) return "English-test waiver mentioned; conditions must be confirmed";

  return tests.length
    ? `${tests.join("/")} mentioned — requirements need confirmation`
    : "Not confirmed";
}

function detectApplicationFee(text) {
  const t = String(text || "").toLowerCase();

  if (/\b(no application fee|application is free|free to apply|there is no application fee|does not charge an application fee|fee-free application)\b/.test(t)) {
    return "No application fee";
  }

  if (/\b(application fee waiver|waiver of the application fee|fee waiver)\b/.test(t)) {
    return "Fee waiver available";
  }

  const match = t.match(
    /\b(?:application fee|application charge)\b[^.\n]{0,70}?(?:usd|us\$|\$|€|£|cad|aud)?\s?\d{2,4}(?:[.,]\d{2})?/i
  );

  return match ? cleanText(match[0]) : "Unknown — not confirmed";
}

function detectTuition(text) {
  const lines = String(text || "").split(/\n|(?<=[.!?])\s+/);

  const line = lines.find(item =>
    /\b(tuition|annual fee|programme fee|program fee|course fee|international fee|home fee|total fee)\b/i.test(item) &&
    /[$£€]\s?\d|USD|EUR|GBP|CAD|AUD|\d{1,3}(?:,\d{3})/.test(item)
  );

  return line ? cleanText(line).slice(0, 240) : "Not confirmed";
}

function detectFunding(text) {
  const lines = String(text || "").split(/\n|(?<=[.!?])\s+/);

  // Application fee waivers are deliberately excluded from scholarship evidence.
  const relevant = lines.filter(line =>
    /\b(scholarship|fellowship|stipend|living allowance|monthly allowance|assistantship|grant|tuition scholarship|tuition waiver|fully funded|full funding)\b/i.test(line) &&
    !/\b(application fee waiver|fee waiver|application charge waiver)\b/i.test(line)
  );

  const joined = relevant.join(" ").toLowerCase();

  if (/fully funded|full scholarship|full tuition|100% tuition|full funding/.test(joined)) {
    return {
      summary: "Full funding language mentioned — eligibility and coverage must be confirmed",
      evidence: relevant.slice(0, 3).map(x => cleanText(x).slice(0, 220))
    };
  }

  if (/tuition waiver|tuition fees.*waived|waived.*tuition/.test(joined)) {
    return {
      summary: "Tuition waiver mentioned — exact coverage must be confirmed",
      evidence: relevant.slice(0, 3).map(x => cleanText(x).slice(0, 220))
    };
  }

  if (/stipend|living allowance|monthly allowance/.test(joined)) {
    return {
      summary: "Stipend or living allowance mentioned — amount and eligibility must be confirmed",
      evidence: relevant.slice(0, 3).map(x => cleanText(x).slice(0, 220))
    };
  }

  if (relevant.length) {
    return {
      summary: "Scholarship or funding mentioned — exact coverage not confirmed",
      evidence: relevant.slice(0, 3).map(x => cleanText(x).slice(0, 220))
    };
  }

  return {
    summary: "Scholarship coverage not confirmed",
    evidence: []
  };
}

function resultFromSearchItem(item, query, region) {
  const url = item.url || "";

  if (!isOfficialDomain(url)) return null;

  const title = cleanText(item.title || "");
  const content = cleanText(
    `${item.raw_content || ""} ${item.content || ""} ${item.snippet || ""}`
  );

  if (!title || !content) return null;

  const programme = inferProgramme(title, content, query);

  if (!hasMastersEvidence(title, programme, content)) return null;

  if (!subjectMatches(query, title, programme, content)) return null;

  const dates = extractApplicationDates(`${title}\n${content}`);
  const window = getSearchWindow();

  if (!withinSearchWindow(dates, window)) return null;

  const institution = getInstitution(url, title, content);

  const result = {
    title,
    institution: institution.name,
    university: institution.name,
    programme,
    country: institution.country,
    region: institution.region,

    programmeStart: dates.programmeStart || "Not confirmed",
    start: dates.programmeStart || "Not confirmed",

    applicationOpeningDate: dates.opening || "Not confirmed",
    applicationClosingDate: dates.closing || "Not confirmed",
    deadline: dates.closing || "Not confirmed",

    priorityDeadline: dates.priorityDeadline || "Not confirmed",
    scholarshipDeadline: dates.scholarshipDeadline || "Not confirmed",
    tentativeDeadline: dates.tentativeClosing,

    applicationStatus: dateStatus(dates),

    tuition: detectTuition(content),

    scholarship: detectFunding(content).summary,
    fundingStatus: detectFunding(content).summary,
    fundingEvidence: detectFunding(content).evidence,

    english: detectEnglish(content),
    applicationFee: detectApplicationFee(content),

    description: cleanText(item.content || item.snippet || content).slice(0, 650),
    snippet: cleanText(item.content || item.snippet || content).slice(0, 650),

    officialLink: url,
    officialUniversityLink: url,
    sourceLink: url,
    sourceType: "Official university/provider source",

    dateEvidence: dates.evidence,
    verification: "Partially verified — check the linked official page",
    verificationStatus: "partially_verified",
    partiallyVerified: true,
    verified: false
  };

  if (!matchesRegion(result, region)) return null;

  return result;
}

// These records preserve useful discoveries from v6 and include the
// three specific programmes identified in the user's v7 tests.
// Unknown dates are deliberately left unknown rather than invented.

function knownOfficialResults(query) {
  const window = getSearchWindow();

  const records = [
    {
      title: "Erasmus Mundus Joint Master in Interdisciplinary Mathematics (InterMaths)",
      institution: "InterMaths consortium",
      programme: "Interdisciplinary Mathematics",
      country: "Not confirmed",
      region: "Europe",
      opening: "2026-11-06",
      closing: "2027-02-17",
      priority: null,
      scholarshipDeadline: null,
      tuition: "Participation costs waived for Erasmus Mundus scholarship holders",
      scholarship: "18 Erasmus Mundus scholarships; €1,400 per month stated for scholarship holders — confirm current call terms",
      english: "MOI may be accepted under stated previous-study conditions — confirm with consortium",
      applicationFee: "Unknown — not confirmed",
      url: "https://www.intermaths.eu/",
      description: "InterMaths Erasmus Mundus programme. Confirm the current call, eligibility, scholarship terms and deadlines on the official programme website."
    },
    {
      title: "Mathematics Education MS — Columbia University",
      institution: "Columbia University",
      programme: "Mathematics Education MS",
      country: "United States",
      region: "USA",
      opening: null,
      closing: null,
      priority: null,
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Scholarship coverage not confirmed",
      english: "Not confirmed",
      applicationFee: "Unknown — not confirmed",
      url: "https://www.tc.columbia.edu/mathematics-science-and-technology/mathematics-education/degrees--requirements/mathematics-education-ms",
      description: "Official Teachers College programme page for the Mathematics Education MS. Current application dates, tuition, funding and English requirements need confirmation."
    },
    {
      title: "MS Mathematics — University of Michigan",
      institution: "University of Michigan",
      programme: "Mathematics",
      country: "United States",
      region: "USA",
      opening: null,
      closing: "2027-02-01",
      priority: null,
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Master's funding not confirmed",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://lsa.umich.edu/math/graduates/graduate-programs.html",
      description: "University mathematics graduate-program information. Confirm that the specific Master's route is accepting applications."
    },
    {
      title: "Mathematics and Statistics Graduate Admissions — UC San Diego",
      institution: "University of California San Diego",
      programme: "Mathematics / Applied Mathematics / Statistics",
      country: "United States",
      region: "USA",
      opening: "2026-09-02",
      closing: "2027-02-03",
      priority: null,
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Master's funding not confirmed",
      english: "IELTS/TOEFL/PTE requirements listed; waiver conditions need checking",
      applicationFee: "US$155 — confirm current amount",
      url: "https://math.ucsd.edu/",
      description: "Department source for graduate mathematics and statistics admissions. Verify the exact Master's programme and current deadline."
    },
    {
      title: "Mathematics Graduate Programs — University of Southern California",
      institution: "University of Southern California",
      programme: "Mathematics / Applied Mathematics",
      country: "United States",
      region: "USA",
      opening: "2026-09-01",
      closing: "2027-02-01",
      priority: null,
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "No Master's financial assistance stated on the referenced admissions information",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://dornsife.usc.edu/mathematics/",
      description: "Department programme information. Confirm the specific Master's degree and current admissions cycle."
    },
    {
      title: "MS Mathematical Data Science — University of Southern California",
      institution: "University of Southern California",
      programme: "Mathematical Data Science",
      country: "United States",
      region: "USA",
      opening: "2026-09-01",
      closing: "2027-02-15",
      priority: null,
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Master's financial assistance not confirmed",
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
      region: "USA",
      opening: "2026-09-01",
      closing: "2027-03-30",
      priority: null,
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Master's financial assistance not confirmed",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://dornsife.usc.edu/mathematics/",
      description: "USC mathematics department information. Confirm the exact degree, deadline and funding."
    },
    {
      title: "MS Campus Program — Applied Mathematics Graduate Admissions",
      institution: "University of Washington",
      programme: "Applied Mathematics MS — Campus",
      country: "United States",
      region: "USA",
      opening: null,
      closing: "2027-01-12",
      priority: "2026-12-01",
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Master's funding not confirmed",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Departmental fee waiver may be available; this is not a scholarship",
      url: "https://amath.washington.edu/graduate-admissions",
      description: "University of Washington Applied Mathematics admissions page. The MS Campus Program lists a December 1 priority deadline and January 12 final deadline. PhD deadlines are separate."
    },
    {
      title: "MS Mathematics — University of Nebraska–Lincoln",
      institution: "University of Nebraska–Lincoln",
      programme: "Mathematics",
      country: "United States",
      region: "USA",
      opening: null,
      closing: "2027-01-15",
      priority: null,
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Funding not confirmed",
      english: "English proficiency requirements apply — check waiver rules",
      applicationFee: "Unknown — not confirmed",
      url: "https://math.unl.edu/",
      description: "Department programme information. Confirm current Master's admissions and financial support."
    },
    {
      title: "MS Data Science — UC San Diego",
      institution: "University of California San Diego",
      programme: "Master of Science in Data Science",
      country: "United States",
      region: "USA",
      opening: null,
      closing: "2026-12-02",
      priority: null,
      scholarshipDeadline: null,
      tentative: true,
      tuition: "Not confirmed",
      scholarship: "Scholarship coverage not confirmed",
      english: "English proficiency and waiver conditions need confirmation",
      applicationFee: "Fee waiver information available; actual application fee needs confirmation",
      url: "https://datascience.ucsd.edu/graduate/graduate-admissions",
      description: "UC San Diego Data Science graduate admissions page says the Fall 2027 cohort application is open and lists a tentative December 2, 2026 closing date. Confirm the MS application route and date."
    },
    {
      title: "Master of Science in Data Science — CUNY School of Professional Studies",
      institution: "City University of New York",
      programme: "Master of Science in Data Science",
      country: "United States",
      region: "USA",
      opening: null,
      closing: "2026-12-03",
      priority: "2026-11-05",
      scholarshipDeadline: null,
      tuition: "Not confirmed",
      scholarship: "Scholarship coverage not confirmed",
      english: "Not confirmed",
      applicationFee: "No application fee stated on the referenced page",
      url: "https://sps.cuny.edu/academics/graduate/master-science-data-science-ms",
      description: "CUNY SPS Data Science MS. Spring 2027 priority deadline is November 5, 2026; regular deadline is December 3, 2026."
    }
  ];

  const subject = subjectType(query);

  return records
    .filter(record => {
      const text = `${record.title} ${record.programme}`;

      if (!subjectMatches(query, text, record.programme, "")) {
        return false;
      }

      const dates = {
        opening: record.opening,
        closing: record.closing,
        priorityDeadline: record.priority,
        scholarshipDeadline: record.scholarshipDeadline
      };

      // The Columbia page is retained as a relevant lead, but dates are unconfirmed.
      const allowUndated = record.institution === "Columbia University";

      return withinSearchWindow(dates, window, allowUndated);
    })
    .map(record => {
      const dates = {
        opening: record.opening,
        closing: record.closing,
        priorityDeadline: record.priority,
        scholarshipDeadline: record.scholarshipDeadline,
        rollingAdmissions: false
      };

      return {
        title: record.title,
        institution: record.institution,
        university: record.institution,
        programme: record.programme,
        country: record.country,
        region: record.region,

        programmeStart: "Not confirmed",
        start: "Not confirmed",

        applicationOpeningDate: record.opening || "Not confirmed",
        applicationClosingDate: record.closing || "Not confirmed",
        deadline: record.closing || "Not confirmed",

        priorityDeadline: record.priority || "Not confirmed",
        scholarshipDeadline: record.scholarshipDeadline || "Not confirmed",
        tentativeDeadline: Boolean(record.tentative),

        applicationStatus: dateStatus(dates),

        tuition: record.tuition,
        scholarship: record.scholarship,
        fundingStatus: record.scholarship,
        english: record.english,
        applicationFee: record.applicationFee,

        description: record.description,
        snippet: record.description,

        officialLink: record.url,
        officialUniversityLink: record.url,
        sourceLink: record.url,
        sourceType: "Known official programme source — current details require confirmation",

        verification: "Partially verified — confirm current programme details on the official page",
        verificationStatus: "partially_verified",
        partiallyVerified: true,
        verified: false
      };
    });
}

function buildSearchQueries(query, region) {
  const regionPhrase = REGION_QUERIES[region] || REGION_QUERIES.all;

  return [
    `"${query}" master's scholarship application 2026 2027 ${regionPhrase} official university`,
    `"${query}" MSc MS postgraduate admissions deadline 2027 ${regionPhrase} university`,
    `"${query}" Erasmus Mundus scholarship master's 2027`,
    `"${query}" graduate programme applications open 2026 2027 official university`,
    `"${query}" master's scholarship international students application deadline 2027 official`
  ];
}

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured in Render environment variables.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      topic: "general",
      max_results: MAX_RESULTS_PER_SEARCH,
      include_answer: false,
      include_raw_content: true
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Tavily search failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return response.json();
}

function deduplicate(results) {
  const seen = new Set();

  return results.filter(result => {
    const key = String(result.officialLink || "")
      .replace(/\/+$/, "")
      .split("?")[0]
      .toLowerCase();

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function fundingRank(result) {
  const text = `${result.fundingStatus || ""} ${result.scholarship || ""}`.toLowerCase();

  if (/fully funded|full scholarship|full tuition|stipend|monthly allowance|erasmus mundus/.test(text)) return 0;
  if (/self-funded|no master's funding|no financial assistance/.test(text)) return 2;

  return 1;
}

function englishRank(result) {
  const text = String(result.english || "").toLowerCase();

  if (text.includes("moi")) return 0;
  if (text.includes("waiver")) return 1;
  if (text.includes("not confirmed")) return 2;

  return 3;
}

function sortResults(results) {
  const statusRank = {
    "OPEN NOW": 0,
    "OPENING SOON": 1,
    "POSSIBLY OPEN": 2,
    "DATES UNCONFIRMED": 3,
    "CLOSED": 4
  };

  return results.sort((a, b) =>
    (statusRank[a.applicationStatus] ?? 3) -
    (statusRank[b.applicationStatus] ?? 3) ||
    fundingRank(a) - fundingRank(b) ||
    englishRank(a) - englishRank(b) ||
    String(a.applicationClosingDate).localeCompare(String(b.applicationClosingDate))
  );
}

function buildCounts(results) {
  return {
    total: results.length,
    openNow: results.filter(r => r.applicationStatus === "OPEN NOW").length,
    openingSoon: results.filter(r => r.applicationStatus === "OPENING SOON").length,
    closingSoon: results.filter(r => {
      const date = r.applicationClosingDate;
      if (!date || date === "Not confirmed") return false;

      const days = Math.round(
        (new Date(`${date}T00:00:00Z`) - new Date(`${localToday()}T00:00:00Z`)) / 86400000
      );

      return days >= 0 && days <= 30;
    }).length,
    possiblyOpen: results.filter(r => r.applicationStatus === "POSSIBLY OPEN").length,
    datesUnconfirmed: results.filter(r => r.applicationStatus === "DATES UNCONFIRMED").length,
    verified: results.filter(r => r.verified).length,
    partiallyVerified: results.filter(r => r.partiallyVerified).length,
    notVerified: results.filter(r => !r.verified && !r.partiallyVerified).length
  };
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
  const query = cleanText(req.query.q || "Mathematics");
  const region = cleanText(req.query.region || "all").toLowerCase();

  if (query.length < 2 || query.length > 80) {
    return res.status(400).json({
      success: false,
      message: "Please enter a subject between 2 and 80 characters."
    });
  }

  const allowedRegions = ["all", "europe", "usa", "canada", "australia"];

  if (!allowedRegions.includes(region)) {
    return res.status(400).json({
      success: false,
      message: "Region must be all, europe, usa, canada, or australia."
    });
  }

  const window = getSearchWindow();
  const warnings = [];

  let discovered = [];

  try {
    const queries = buildSearchQueries(query, region);

    const settled = await Promise.allSettled(
      queries.map(tavilySearch)
    );

    for (const item of settled) {
      if (item.status === "fulfilled") {
        discovered.push(...(item.value.results || []));
      } else {
        warnings.push(item.reason?.message || "One search source failed.");
      }
    }
  } catch (error) {
    warnings.push(error.message || "Search failed.");
  }

  const discoveredResults = discovered
    .map(item => resultFromSearchItem(item, query, region))
    .filter(Boolean);

  const knownResults = knownOfficialResults(query)
    .filter(result => matchesRegion(result, region));

  const results = sortResults(
    deduplicate([...knownResults, ...discoveredResults])
  );

  const counts = buildCounts(results);

  const warning = warnings.length
    ? [...new Set(warnings)].join(" | ").slice(0, 900)
    : "Search results are leads, not guarantees. Confirm dates, funding, tuition, English requirements and application fees on the official programme page.";

  const message = results.length
    ? "Results include known programme records and newly discovered official pages. Confirm all details on the official source before applying."
    : "No matching Master's programmes with sufficient subject and date evidence were found. This does not prove that no suitable opportunities exist.";

  return res.json({
    success: true,
    build: BUILD,
    searchedSubject: query,
    selectedRegion: region,
    searchWindow: window,

    dateRule: "Selected by application opening date. Previously opened applications are included only if they may remain active. Priority and scholarship deadlines are displayed separately from the final application deadline.",

    filters: {
      degreeLevel: "Master's only",
      subject: query,
      region,
      openingDateWindow: `${window.start} to ${window.end}`,
      officialSourcesPreferred: true
    },

    totalResults: results.length,
    counts,
    verified: counts.verified,
    partiallyVerified: counts.partiallyVerified,
    results,
    warning,
    message
  });
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`Scholarship Finder ${BUILD} running on port ${PORT}`);
});
