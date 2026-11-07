import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const BUILD = "query-aware-v7";
const TIME_ZONE = "Africa/Kampala";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const BLOCKED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "linkedin.com",
  "wikipedia.org",
  "reddit.com"
];

const REGION_DOMAINS = {
  europe: [
    ".ac.uk", ".edu", ".de", ".fr", ".it", ".nl", ".be",
    ".se", ".no", ".fi", ".dk", ".ch", ".at", ".es",
    ".pt", ".ie", ".pl", ".cz", ".hu", ".eu"
  ],
  usa: [".edu", ".gov"],
  canada: [".ca"],
  australia: [".edu.au", ".gov.au"]
};

const INSTITUTIONS = [
  {
    domains: ["imperial.ac.uk"],
    name: "Imperial College London",
    country: "United Kingdom",
    region: "Europe"
  },
  {
    domains: ["ox.ac.uk"],
    name: "University of Oxford",
    country: "United Kingdom",
    region: "Europe"
  },
  {
    domains: ["lse.ac.uk"],
    name: "London School of Economics and Political Science",
    country: "United Kingdom",
    region: "Europe"
  },
  {
    domains: ["tc.columbia.edu", "columbia.edu"],
    name: "Columbia University",
    country: "United States",
    region: "USA"
  },
  {
    domains: ["uconn.edu"],
    name: "University of Connecticut",
    country: "United States",
    region: "USA"
  },
  {
    domains: ["usc.edu", "rossier.usc.edu"],
    name: "University of Southern California",
    country: "United States",
    region: "USA"
  },
  {
    domains: ["ucsd.edu"],
    name: "University of California San Diego",
    country: "United States",
    region: "USA"
  },
  {
    domains: ["umich.edu"],
    name: "University of Michigan",
    country: "United States",
    region: "USA"
  },
  {
    domains: ["washington.edu"],
    name: "University of Washington",
    country: "United States",
    region: "USA"
  },
  {
    domains: ["unl.edu"],
    name: "University of Nebraska–Lincoln",
    country: "United States",
    region: "USA"
  },
  {
    domains: ["ubc.ca"],
    name: "University of British Columbia",
    country: "Canada",
    region: "Canada"
  },
  {
    domains: ["utoronto.ca"],
    name: "University of Toronto",
    country: "Canada",
    region: "Canada"
  },
  {
    domains: ["mcgill.ca"],
    name: "McGill University",
    country: "Canada",
    region: "Canada"
  },
  {
    domains: ["ethz.ch"],
    name: "ETH Zurich",
    country: "Switzerland",
    region: "Europe"
  },
  {
    domains: ["epfl.ch"],
    name: "École Polytechnique Fédérale de Lausanne",
    country: "Switzerland",
    region: "Europe"
  },
  {
    domains: ["daad.de"],
    name: "German Academic Exchange Service (DAAD)",
    country: "Germany",
    region: "Europe"
  }
];

function getUgandaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = {};
  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function addMonths(dateString, months) {
  const [year, month] = dateString.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  return first.toISOString().slice(0, 7);
}

function getSearchWindow() {
  const today = getUgandaDate();
  const [year, month] = today.split("-").map(Number);

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = addMonths(start, 3);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(endYear, endMonthNumber, 0))
    .getUTCDate();

  return {
    start,
    end: `${endYear}-${String(endMonthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  };
}

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getDomain(url = "") {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlocked(url) {
  const domain = getDomain(url);
  return BLOCKED_DOMAINS.some(
    blocked => domain === blocked || domain.endsWith(`.${blocked}`)
  );
}

function isOfficialDomain(url = "") {
  const domain = getDomain(url);

  if (!domain || isBlocked(url)) return false;

  if (INSTITUTIONS.some(item =>
    item.domains.some(d => domain === d || domain.endsWith(`.${d}`))
  )) {
    return true;
  }

  return (
    domain.endsWith(".edu") ||
    domain.endsWith(".edu.au") ||
    domain.endsWith(".ca") ||
    domain.endsWith(".ac.uk") ||
    domain.endsWith(".gov") ||
    domain.endsWith(".gov.au") ||
    domain.endsWith(".de") ||
    domain.endsWith(".fr") ||
    domain.endsWith(".it") ||
    domain.endsWith(".nl") ||
    domain.endsWith(".ch") ||
    domain.endsWith(".se") ||
    domain.endsWith(".no") ||
    domain.endsWith(".fi") ||
    domain.endsWith(".dk") ||
    domain.endsWith(".eu")
  );
}

function getInstitution(url, title = "") {
  const domain = getDomain(url);

  const known = INSTITUTIONS.find(item =>
    item.domains.some(d => domain === d || domain.endsWith(`.${d}`))
  );

  if (known) return known;

  const text = `${title} ${domain}`.toLowerCase();

  const patterns = [
    {
      pattern: /university of oxford/,
      name: "University of Oxford",
      country: "United Kingdom",
      region: "Europe"
    },
    {
      pattern: /imperial college london/,
      name: "Imperial College London",
      country: "United Kingdom",
      region: "Europe"
    },
    {
      pattern: /london school of economics|\blse\b/,
      name: "London School of Economics and Political Science",
      country: "United Kingdom",
      region: "Europe"
    },
    {
      pattern: /university of connecticut|\buconn\b/,
      name: "University of Connecticut",
      country: "United States",
      region: "USA"
    },
    {
      pattern: /columbia university/,
      name: "Columbia University",
      country: "United States",
      region: "USA"
    }
  ];

  return patterns.find(item => item.pattern.test(text)) || {
    name: "Institution not reliably identified",
    country: "Not confirmed",
    region: "Not confirmed"
  };
}

function matchesRegion(result, requestedRegion) {
  if (!requestedRegion || requestedRegion === "all") return true;

  const region = String(result.region || "").toLowerCase();
  const country = String(result.country || "").toLowerCase();

  if (requestedRegion === "europe") return region === "europe";
  if (requestedRegion === "usa") {
    return region === "usa" || country === "united states";
  }
  if (requestedRegion === "canada") return region === "canada";
  if (requestedRegion === "australia") return region === "australia";

  return true;
}

function normaliseSubject(query) {
  const q = cleanText(query).toLowerCase();

  if (/mathematics education|math education|mathematics teaching/.test(q)) {
    return "mathematics-education";
  }
  if (/data science|data analytics|mathematical data science/.test(q)) {
    return "data-science";
  }
  if (/applied mathematics|applied maths/.test(q)) {
    return "applied-mathematics";
  }
  if (/statistics|statistical science/.test(q)) {
    return "statistics";
  }
  if (/computational mathematics/.test(q)) {
    return "computational-mathematics";
  }
  if (/operations research|operational research/.test(q)) {
    return "operations-research";
  }
  if (/artificial intelligence|\bai\b|machine learning/.test(q)) {
    return "ai-machine-learning";
  }

  return "mathematics";
}

function subjectMatches(title, programme, query) {
  const text = `${title} ${programme}`.toLowerCase();
  const subject = normaliseSubject(query);

  const rules = {
    "mathematics-education": [
      /mathematics education/,
      /math education/,
      /mathematics teaching/,
      /teaching mathematics/
    ],
    "data-science": [
      /data science/,
      /data analytics/,
      /mathematical data science/,
      /data[- ]driven science/
    ],
    "applied-mathematics": [
      /applied mathematics/,
      /applied maths/,
      /applied and computational mathematics/
    ],
    statistics: [
      /\bstatistics\b/,
      /\bstatistical science\b/,
      /mathematical statistics/
    ],
    "computational-mathematics": [
      /computational mathematics/,
      /computational and applied mathematics/
    ],
    "operations-research": [
      /operations research/,
      /operational research/
    ],
    "ai-machine-learning": [
      /artificial intelligence/,
      /machine learning/,
      /\bai\b/
    ],
    mathematics: [
      /\bmathematics\b/,
      /\bmathematical sciences\b/,
      /\bmaths\b/
    ]
  };

  const matched = rules[subject]?.some(pattern => pattern.test(text)) || false;

  if (!matched) return false;

  // Do not let a general Mathematics search return unrelated specialist degrees.
  if (subject === "mathematics") {
    if (/mathematics education|data science|mathematical finance|statistics/.test(text)) {
      return false;
    }
  }

  return true;
}

function hasMastersEvidence(title, content) {
  const titleText = title.toLowerCase();
  const text = `${title} ${content}`.toLowerCase();

  const titleEvidence =
    /\b(msc|m\.sc|master|masters|master's|ms|m\.s|ma|m\.a|meng|mres|mphil)\b/.test(titleText);

  const explicitDegree =
    /\b(master of|master in|master's in|msc in|ms in|m\.sc\. in|m\.s\. in|graduate degree)\b/.test(text);

  const levelEvidence =
    /\b(postgraduate taught|postgraduate master's|graduate master's|master degree|master programme|master program)\b/.test(text);

  const phdOnly =
    /\b(phd|doctoral|doctor of philosophy)\b/.test(titleText) &&
    !titleEvidence;

  return !phdOnly && (titleEvidence || explicitDegree || levelEvidence);
}

function inferProgramme(title) {
  const text = cleanText(title);

  const match = text.match(
    /\b(MSc|M\.Sc\.|MS|M\.S\.|MA|M\.A\.|MRes|MPhil|Master(?:'s)?(?: of| in)?)[^|–—-]{0,100}/i
  );

  if (match) return match[0].trim();

  return text || "Master's programme — exact title not confirmed";
}

function parseDateValue(value) {
  if (!value) return null;

  const text = value.trim();

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }

  const monthNames = {
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

  let match = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i
  );

  if (match) {
    const month = monthNames[match[1].toLowerCase()];
    return `${match[3]}-${month}-${String(match[2]).padStart(2, "0")}`;
  }

  match = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[,]?\s+(20\d{2})\b/i
  );

  if (match) {
    const month = monthNames[match[2].toLowerCase()];
    return `${match[3]}-${month}-${String(match[1]).padStart(2, "0")}`;
  }

  return null;
}

function extractDates(content) {
  const result = {
    applicationOpeningDate: null,
    priorityDeadline: null,
    scholarshipDeadline: null,
    applicationClosingDate: null,
    programmeStartDate: null,
    rollingAdmissions: false,
    dateEvidence: []
  };

  const text = cleanText(content);
  const sentences = text
    .split(/(?<=[.!?])\s+|[|•\n]/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const dateMatches = [
      ...sentence.matchAll(
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}\b/gi
      ),
      ...sentence.matchAll(
        /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/gi
      ),
      ...sentence.matchAll(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g)
    ];

    const dates = [...new Set(
      dateMatches.map(match => parseDateValue(match[0])).filter(Boolean)
    )];

    if (/rolling admissions|rolling basis|until all places are filled|until spaces are filled|applications accepted throughout the year/i.test(sentence)) {
      result.rollingAdmissions = true;
      result.dateEvidence.push(sentence.slice(0, 240));
    }

    if (!dates.length) continue;

    const lower = sentence.toLowerCase();

    for (const date of dates) {
      if (
        /programme start|program start|course begins|course start|commences|semester begins|term begins|intake begins|academic year begins/i.test(lower)
      ) {
        result.programmeStartDate ||= date;
        continue;
      }

      if (
        /scholarship deadline|funding deadline|financial aid deadline|scholarship consideration|funding consideration|award consideration/i.test(lower)
      ) {
        result.scholarshipDeadline ||= date;
        result.dateEvidence.push(sentence.slice(0, 240));
        continue;
      }

      if (
        /priority deadline|priority application|early consideration|early application|priority consideration/i.test(lower)
      ) {
        result.priorityDeadline ||= date;
        result.dateEvidence.push(sentence.slice(0, 240));
        continue;
      }

      if (
        /application opens|applications open|opens for applications|opening date|applications begin|apply from|application period begins|application window opens/i.test(lower)
      ) {
        result.applicationOpeningDate ||= date;
        result.dateEvidence.push(sentence.slice(0, 240));
        continue;
      }

      if (
        /final deadline|final application deadline|application deadline|applications close|application closes|closing date|deadline to apply|last date to apply|submit.*by|must apply by/i.test(lower)
      ) {
        result.applicationClosingDate ||= date;
        result.dateEvidence.push(sentence.slice(0, 240));
      }
    }
  }

  return result;
}

function dateStatus(dates) {
  const today = getUgandaDate();
  const opening = dates.applicationOpeningDate;
  const closing = dates.applicationClosingDate;

  if (closing && closing < today) return "CLOSED";

  if (opening && opening > today) return "OPENING SOON";

  if (opening && opening <= today && closing && closing >= today) {
    return "OPEN NOW";
  }

  if (
    dates.rollingAdmissions &&
    (!closing || closing >= today) &&
    (!opening || opening <= today)
  ) {
    return "OPEN NOW";
  }

  if (opening && opening <= today && !closing) {
    return "POSSIBLY OPEN";
  }

  if (!opening && closing && closing >= today) {
    return "POSSIBLY OPEN";
  }

  if (dates.priorityDeadline || dates.scholarshipDeadline) {
    return "POSSIBLY OPEN";
  }

  return "DATES UNCONFIRMED";
}

function withinSearchWindow(dates, window) {
  const today = getUgandaDate();
  const opening = dates.applicationOpeningDate;
  const closing = dates.applicationClosingDate;

  if (closing && closing < today) return false;

  if (opening) {
    // Already-open applications can remain relevant even if they opened before this window.
    if (opening <= window.end && (!closing || closing >= today)) return true;
    return false;
  }

  // If the opening date is not confirmed, include only where a real application
  // deadline or relevant priority/scholarship deadline falls in the search window.
  const relevantDates = [
    closing,
    dates.priorityDeadline,
    dates.scholarshipDeadline
  ].filter(Boolean);

  return relevantDates.some(date => date >= window.start && date <= window.end);
}

function detectEnglish(content) {
  const text = cleanText(content).toLowerCase();

  const moi =
    /medium of instruction|previous degree taught in english|degree was taught in english|entirely in english|instruction was in english|english[- ]medium/.test(text);

  const waiver =
    /english language waiver|waiver of english|may be exempt|exemption from.*english|english proficiency.*waived|waive.*ielts|waive.*toefl/.test(text);

  const tests = [];
  if (/\bielts\b/.test(text)) tests.push("IELTS");
  if (/\btoefl\b/.test(text)) tests.push("TOEFL");
  if (/\bpte\b/.test(text)) tests.push("PTE");
  if (/\bduolingo\b/.test(text)) tests.push("Duolingo");

  let status = "Not confirmed";

  if (moi) status = "English-medium evidence mentioned; acceptance must be confirmed";
  else if (waiver) status = "Possible English-test waiver; conditions must be checked";
  else if (tests.length) status = `${tests.join(", ")} mentioned`;

  return {
    status,
    moiAccepted: false,
    moiMentioned: moi,
    waiverMentioned: waiver,
    testsMentioned: tests
  };
}

function detectApplicationFee(content) {
  const text = cleanText(content).toLowerCase();

  if (
    /no application fee|application is free|free to apply|there is no application fee|does not charge an application fee|without an application fee/.test(text)
  ) {
    return {
      status: "No application fee",
      amount: null
    };
  }

  if (/application fee waiver|waiver of the application fee|fee waiver/.test(text)) {
    return {
      status: "Fee waiver available",
      amount: null
    };
  }

  const match = text.match(
    /application fee[^.]{0,80}?(?:\$|£|€|cad\s?|aud\s?)(\d{2,4}(?:\.\d{1,2})?)/i
  );

  if (match) {
    return {
      status: "Fee required — amount mentioned",
      amount: match[0].trim()
    };
  }

  return {
    status: "Unknown — not confirmed",
    amount: null
  };
}

function detectTuition(content) {
  const text = cleanText(content);
  const lines = text.split(/(?<=[.!?])\s+|[|•]/);

  const relevant = lines.find(line =>
    /tuition|annual fee|programme fee|program fee|course fee|international fee|home fee|total fee/i.test(line) &&
    /[$£€]\s?\d|USD|EUR|GBP|CAD|AUD|\d{1,3}(?:,\d{3})/.test(line)
  );

  return relevant ? relevant.slice(0, 240) : "Not confirmed";
}

function detectFunding(content) {
  const text = cleanText(content);
  const lower = text.toLowerCase();

  const lines = text.split(/(?<=[.!?])\s+|[|•]/);
  const relevant = lines.filter(line =>
    /scholarship|funding|stipend|tuition waiver|fee waiver|financial support|assistantship|grant|fellowship/i.test(line)
  );

  const hasFundingEvidence = relevant.length > 0;

  let summary = "Scholarship coverage not confirmed";

  if (/fully funded|full scholarship|full tuition|100% tuition|full funding/.test(lower)) {
    summary = "Full funding language found — eligibility and coverage need confirmation";
  } else if (/tuition waiver|tuition fees.*waived|waived.*tuition/.test(lower)) {
    summary = "Tuition waiver mentioned — exact coverage needs confirmation";
  } else if (/stipend|monthly allowance|per month|living allowance/.test(lower)) {
    summary = "Stipend or living allowance mentioned — amount and eligibility need confirmation";
  } else if (hasFundingEvidence) {
    summary = "Funding information mentioned — exact coverage not confirmed";
  }

  return {
    summary,
    evidence: relevant.slice(0, 3).map(line => line.slice(0, 220))
  };
}

function inferProgrammeStart(content, dates) {
  if (dates.programmeStartDate) return dates.programmeStartDate;

  const text = cleanText(content);
  const match = text.match(
    /(?:programme|program|course|classes)\s+(?:starts?|begins?|commences?)\s+(?:in\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}/i
  );

  return match ? match[0] : "Not confirmed";
}

function buildSearchQueries(query) {
  const subject = cleanText(query);

  return [
    `"${subject}" master's scholarship 2027 applications official university`,
    `"${subject}" MSc master's admissions 2027 application deadline university`,
    `"${subject}" master's fully funded scholarship Europe 2027 official`,
    `"${subject}" master's scholarship Canada USA Australia 2027 official`,
    `"${subject}" postgraduate master's application opening date 2027 official`
  ];
}

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured in Render.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      topic: "general",
      max_results: 8,
      include_answer: false,
      include_raw_content: true
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Search provider returned ${response.status}: ${message.slice(0, 300)}`);
  }

  return response.json();
}

function resultFromSearchItem(item, query) {
  const title = cleanText(item.title || "");
  const url = item.url || "";
  const content = cleanText(
    `${item.content || ""} ${item.raw_content || ""}`
  );

  if (!title || !url || !content || isBlocked(url)) return null;

  const programme = inferProgramme(title);

  if (!hasMastersEvidence(title, content)) return null;
  if (!subjectMatches(title, programme, query)) return null;

  const institution = getInstitution(url, title);
  const dates = extractDates(content);
  const status = dateStatus(dates);
  const window = getSearchWindow();

  if (!withinSearchWindow(dates, window)) return null;

  const english = detectEnglish(content);
  const fee = detectApplicationFee(content);
  const funding = detectFunding(content);

  const official = isOfficialDomain(url);

  const verification = official
    ? "Partially verified — official-domain source; key details still need checking"
    : "Unverified — third-party source; confirm on the official university page";

  return {
    id: url,
    university: institution.name,
    institution: institution.name,
    programme,
    programmeTitle: title,
    subject: cleanText(query),
    country: institution.country,
    region: institution.region,
    sourceType: official ? "Official institution/provider domain" : "Third-party source",
    officialSource: official,
    officialLink: url,
    sourceLink: url,

    applicationOpeningDate: dates.applicationOpeningDate,
    openingDate: dates.applicationOpeningDate || "Not confirmed",

    priorityDeadline: dates.priorityDeadline,
    scholarshipDeadline: dates.scholarshipDeadline,

    applicationClosingDate: dates.applicationClosingDate,
    finalDeadline: dates.applicationClosingDate,
    closingDate: dates.applicationClosingDate || "Not confirmed",

    programmeStartDate: inferProgrammeStart(content, dates),

    status,
    dateEvidence: dates.dateEvidence,
    rollingAdmissions: dates.rollingAdmissions,

    tuition: detectTuition(content),
    tuitionFee: detectTuition(content),

    scholarship: funding.summary,
    scholarshipCoverage: funding.summary,
    fundingEvidence: funding.evidence,

    englishStatus: english.status,
    english,
    applicationFeeStatus: fee.status,
    applicationFee: fee.amount || fee.status,

    verification,
    verified: false,
    partiallyVerified: true,

    summary: cleanText(item.content || "").slice(0, 500)
  };
}

function deduplicate(results) {
  const seen = new Set();
  const output = [];

  for (const result of results) {
    const key = result.officialLink
      .toLowerCase()
      .replace(/\/+$/, "")
      .split("?")[0];

    if (seen.has(key)) continue;

    seen.add(key);
    output.push(result);
  }

  return output;
}

function sortResults(results) {
  const statusOrder = {
    "OPEN NOW": 1,
    "OPENING SOON": 2,
    "POSSIBLY OPEN": 3,
    "DATES UNCONFIRMED": 4,
    "CLOSED": 5
  };

  return results.sort((a, b) => {
    const statusDifference =
      (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);

    if (statusDifference !== 0) return statusDifference;

    const fundingA = /full funding|full scholarship|tuition waiver|stipend/i.test(a.scholarship) ? 1 : 0;
    const fundingB = /full funding|full scholarship|tuition waiver|stipend/i.test(b.scholarship) ? 1 : 0;

    if (fundingA !== fundingB) return fundingB - fundingA;

    const englishA = a.english?.moiMentioned || a.english?.waiverMentioned ? 1 : 0;
    const englishB = b.english?.moiMentioned || b.english?.waiverMentioned ? 1 : 0;

    return englishB - englishA;
  });
}

function buildCounts(results) {
  return {
    total: results.length,
    openNow: results.filter(r => r.status === "OPEN NOW").length,
    openingSoon: results.filter(r => r.status === "OPENING SOON").length,
    closingSoon: results.filter(r => {
      if (!r.applicationClosingDate) return false;

      const today = new Date(`${getUgandaDate()}T00:00:00Z`);
      const deadline = new Date(`${r.applicationClosingDate}T00:00:00Z`);
      const days = Math.ceil((deadline - today) / 86400000);

      return days >= 0 && days <= 14;
    }).length,
    possiblyOpen: results.filter(r => r.status === "POSSIBLY OPEN").length,
    datesUnconfirmed: results.filter(r => r.status === "DATES UNCONFIRMED").length,
    verified: results.filter(r => r.verified).length,
    partiallyVerified: results.filter(r => r.partiallyVerified).length
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
  const requestedRegion = cleanText(req.query.region || "all").toLowerCase();

  if (query.length < 2 || query.length > 80) {
    return res.status(400).json({
      success: false,
      message: "Please enter a subject between 2 and 80 characters."
    });
  }

  const allowedRegions = ["all", "europe", "usa", "canada", "australia"];

  if (!allowedRegions.includes(requestedRegion)) {
    return res.status(400).json({
      success: false,
      message: "Invalid region selected."
    });
  }

  const window = getSearchWindow();

  try {
    const queries = buildSearchQueries(query);

    const searchResponses = await Promise.all(
      queries.map(searchQuery => tavilySearch(searchQuery))
    );

    const rawItems = searchResponses.flatMap(response =>
      Array.isArray(response.results) ? response.results : []
    );

    let results = rawItems
      .map(item => resultFromSearchItem(item, query))
      .filter(Boolean);

    results = deduplicate(results);
    results = results.filter(result =>
      matchesRegion(result, requestedRegion)
    );

    results = sortResults(results);

    const counts = buildCounts(results);

    return res.json({
      success: true,
      build: BUILD,
      searchedSubject: query,
      selectedRegion: requestedRegion,
      searchWindow: window,
      dateRule: "Selected by application opening date. Earlier openings are included only when the application may still be active. Priority and scholarship deadlines are displayed separately from the final application deadline.",
      totalResults: results.length,
      counts,
      verified: counts.verified,
      partiallyVerified: counts.partiallyVerified,
      results,
      warning: "Search results are leads, not a guarantee of eligibility or availability. Confirm each programme's dates, funding, tuition, English-language rules and application fee on its official page before applying.",
      message: results.length
        ? "Search completed. Check each official source carefully because some details may not be published or may require confirmation."
        : "No matching Master's programmes were found in this search. Try a related subject or check the official university websites."
    });
  } catch (error) {
    console.error("Scholarship search error:", error);

    return res.status(500).json({
      success: false,
      build: BUILD,
      message: "The scholarship search could not be completed.",
      error: error.message,
      tavilyConfigured: Boolean(TAVILY_API_KEY)
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`Scholarship Finder ${BUILD} running on port ${PORT}`);
});
