import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const TODAY = new Date();

const SUBJECTS = [
  "Mathematics",
  "Mathematics Education",
  "Applied Mathematics",
  "Statistics",
  "Data Science",
  "Data Analytics",
  "Mathematical Data Science",
  "Computational Mathematics",
  "Operations Research",
  "Artificial Intelligence",
  "Machine Learning"
];

const COUNTRY_ALIASES = {
  "united states": "USA",
  "united states of america": "USA",
  "usa": "USA",
  "u.s.a": "USA",
  "u.s.": "USA",
  "america": "USA",

  "canada": "Canada",

  "australia": "Australia",

  "united kingdom": "Europe",
  "uk": "Europe",
  "england": "Europe",
  "scotland": "Europe",
  "wales": "Europe",
  "ireland": "Europe",
  "germany": "Europe",
  "france": "Europe",
  "italy": "Europe",
  "spain": "Europe",
  "portugal": "Europe",
  "netherlands": "Europe",
  "belgium": "Europe",
  "switzerland": "Europe",
  "austria": "Europe",
  "sweden": "Europe",
  "finland": "Europe",
  "norway": "Europe",
  "denmark": "Europe",
  "poland": "Europe",
  "czech republic": "Europe",
  "czechia": "Europe",
  "hungary": "Europe",
  "greece": "Europe",
  "romania": "Europe",
  "bulgaria": "Europe",
  "croatia": "Europe",
  "slovenia": "Europe",
  "slovakia": "Europe",
  "estonia": "Europe",
  "latvia": "Europe",
  "lithuania": "Europe",
  "luxembourg": "Europe",
  "malta": "Europe",
  "cyprus": "Europe",
  "iceland": "Europe",
  "europe": "Europe",
  "european union": "Europe",
  "eu": "Europe"
};

const DOMAIN_COUNTRY = {
  ".us": "USA",
  ".ca": "Canada",
  ".au": "Australia",

  ".uk": "Europe",
  ".ie": "Europe",
  ".de": "Europe",
  ".fr": "Europe",
  ".it": "Europe",
  ".es": "Europe",
  ".pt": "Europe",
  ".nl": "Europe",
  ".be": "Europe",
  ".ch": "Europe",
  ".at": "Europe",
  ".se": "Europe",
  ".fi": "Europe",
  ".no": "Europe",
  ".dk": "Europe",
  ".pl": "Europe",
  ".cz": "Europe",
  ".hu": "Europe",
  ".gr": "Europe",
  ".ro": "Europe",
  ".bg": "Europe",
  ".hr": "Europe",
  ".si": "Europe",
  ".sk": "Europe",
  ".ee": "Europe",
  ".lv": "Europe",
  ".lt": "Europe",
  ".lu": "Europe",
  ".mt": "Europe",
  ".cy": "Europe",
  ".is": "Europe"
};

const KNOWN_INSTITUTIONS = [
  {
    name: "University of Michigan",
    patterns: ["university of michigan", "lsa.umich.edu", "umich.edu"]
  },
  {
    name: "University of Oxford",
    patterns: ["university of oxford", "ox.ac.uk"]
  },
  {
    name: "University of Cambridge",
    patterns: ["university of cambridge", "cam.ac.uk"]
  },
  {
    name: "ETH Zurich",
    patterns: ["eth zurich", "ethz.ch"]
  },
  {
    name: "EPFL",
    patterns: ["epfl", "epfl.ch"]
  },
  {
    name: "University of Toronto",
    patterns: ["university of toronto", "utoronto.ca"]
  },
  {
    name: "University of British Columbia",
    patterns: ["university of british columbia", "ubc.ca"]
  },
  {
    name: "McGill University",
    patterns: ["mcgill university", "mcgill.ca"]
  },
  {
    name: "University of Melbourne",
    patterns: ["university of melbourne", "unimelb.edu.au"]
  },
  {
    name: "University of Sydney",
    patterns: ["university of sydney", "sydney.edu.au"]
  },
  {
    name: "University of Amsterdam",
    patterns: ["university of amsterdam", "uva.nl"]
  },
  {
    name: "KU Leuven",
    patterns: ["ku leuven", "kuleuven.be"]
  },
  {
    name: "Technical University of Munich",
    patterns: ["technical university of munich", "tum.de"]
  },
  {
    name: "University of Bonn",
    patterns: ["university of bonn", "uni-bonn.de"]
  },
  {
    name: "University of Helsinki",
    patterns: ["university of helsinki", "helsinki.fi"]
  }
];

const DIRECTORY_DOMAINS = [
  "mastersportal.com",
  "bachelorsportal.com",
  "scholarshipportal.com",
  "studyportals.com",
  "findamasters.com",
  "scholarshiproar.com",
  "opportunitiesforafricans.com",
  "scholars4dev.com",
  "leverageedu.com",
  "yocket.com"
];

const PROGRAMME_DOMAINS = [
  "intermaths.eu",
  "erasmus-plus.ec.europa.eu",
  "erasmusmundus.eu"
];

function cleanText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/<[^>]*>/g, " ")
    .trim();
}

function normalizeUrl(url = "") {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`
      .toLowerCase()
      .replace(/\/+$/, "");
  } catch {
    return String(url).toLowerCase().trim();
  }
}

function hostnameOf(url = "") {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  );
}

function addMonths(date, months) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate()
    )
  );
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function formatDateReadable(date) {
  if (!date || Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function parseDateValue(value) {
  if (!value) return null;

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate()
      )
    );
  }

  return null;
}

function monthNameToNumber(month) {
  const months = {
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

  return months[String(month).toLowerCase()];
}

function parseHumanDate(text) {
  if (!text) return null;

  const value = text.toLowerCase();

  // 2027-02-01
  let match = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);

  if (match) {
    return new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    );
  }

  // February 1, 2027
  match = value.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/
  );

  if (match) {
    return new Date(
      Date.UTC(
        Number(match[3]),
        monthNameToNumber(match[1]),
        Number(match[2])
      )
    );
  }

  // 1 February 2027
  match = value.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/
  );

  if (match) {
    return new Date(
      Date.UTC(
        Number(match[3]),
        monthNameToNumber(match[2]),
        Number(match[1])
      )
    );
  }

  return null;
}

function extractDateNearLabels(text) {
  const clean = cleanText(text);

  const openingPatterns = [
    /applications?\s+(?:open|opens|opening|start)\s*(?:on|:)?\s*([^.;|]{3,50})/i,
    /application\s+opening\s+date\s*(?:is|:)?\s*([^.;|]{3,50})/i,
    /application\s+opens\s*(?:on|:)?\s*([^.;|]{3,50})/i,
    /applications?\s+open\s+from\s*([^.;|]{3,50})/i,
    /open(?:ing)?\s+date\s*(?:is|:)?\s*([^.;|]{3,50})/i,
    /application\s+period\s*(?:is|:)?\s*([^.;|]{3,80})/i
  ];

  const closingPatterns = [
    /applications?\s+(?:close|closes|closing)\s*(?:on|:)?\s*([^.;|]{3,50})/i,
    /application\s+deadline\s*(?:is|:)?\s*([^.;|]{3,60})/i,
    /deadline\s*(?:is|:)?\s*([^.;|]{3,60})/i,
    /apply\s+by\s*([^.;|]{3,60})/i,
    /last\s+date\s+(?:to\s+apply|for\s+application)\s*(?:is|:)?\s*([^.;|]{3,60})/i
  ];

  let openingDate = null;
  let closingDate = null;

  for (const pattern of openingPatterns) {
    const match = clean.match(pattern);

    if (match) {
      const date = parseHumanDate(match[1]);

      if (date) {
        openingDate = date;
        break;
      }
    }
  }

  for (const pattern of closingPatterns) {
    const match = clean.match(pattern);

    if (match) {
      const date = parseHumanDate(match[1]);

      if (date) {
        closingDate = date;
        break;
      }
    }
  }

  // Fall back to finding dates after keywords in nearby text.
  if (!openingDate) {
    const index = clean.toLowerCase().search(
      /application|admission|apply|opening/
    );

    if (index >= 0) {
      const nearby = clean.slice(index, index + 300);
      openingDate = parseHumanDate(nearby);
    }
  }

  if (!closingDate) {
    const index = clean.toLowerCase().search(
      /deadline|close|closing|apply by|last date/
    );

    if (index >= 0) {
      const nearby = clean.slice(index, index + 300);
      closingDate = parseHumanDate(nearby);
    }
  }

  return {
    openingDate,
    closingDate
  };
}

function hasExplicitOpenLanguage(text) {
  const lower = cleanText(text).toLowerCase();

  const patterns = [
    "applications are open",
    "application is open",
    "applications open now",
    "apply now",
    "currently accepting applications",
    "now accepting applications",
    "the call is open",
    "call for applications is open",
    "applications are currently open",
    "admissions are open"
  ];

  return patterns.some((p) => lower.includes(p));
}

function getApplicationStatus(openingDate, closingDate, text, windowEnd) {
  const today = startOfMonth(TODAY);
  const currentDay = new Date(
    Date.UTC(
      TODAY.getUTCFullYear(),
      TODAY.getUTCMonth(),
      TODAY.getUTCDate()
    )
  );

  if (closingDate && closingDate < currentDay) {
    return "CLOSED";
  }

  if (openingDate && openingDate > windowEnd) {
    return "OPENING SOON — outside current search window";
  }

  if (
    openingDate &&
    openingDate <= currentDay &&
    (!closingDate || closingDate >= currentDay)
  ) {
    if (
      closingDate &&
      closingDate <= addMonths(currentDay, 1)
    ) {
      return "CLOSING SOON — deadline approaching";
    }

    return "OPEN NOW";
  }

  if (
    openingDate &&
    openingDate > currentDay &&
    openingDate <= windowEnd
  ) {
    return "OPENING SOON";
  }

  if (!openingDate && closingDate && closingDate >= currentDay) {
    if (hasExplicitOpenLanguage(text)) {
      if (closingDate <= addMonths(currentDay, 1)) {
        return "CLOSING SOON — deadline approaching";
      }

      return "OPEN NOW — opening date not confirmed";
    }

    return "Possibly open — opening date not confirmed";
  }

  if (!openingDate && !closingDate && hasExplicitOpenLanguage(text)) {
    return "Possibly open — dates not fully confirmed";
  }

  return "Dates unconfirmed";
}

function isWithinSearchRule(openingDate, closingDate, status, windowStart, windowEnd) {
  const currentDay = new Date(
    Date.UTC(
      TODAY.getUTCFullYear(),
      TODAY.getUTCMonth(),
      TODAY.getUTCDate()
    )
  );

  // Known opening date inside the requested three-month window.
  if (
    openingDate &&
    openingDate >= windowStart &&
    openingDate <= windowEnd
  ) {
    return true;
  }

  // Already opened and still open today.
  if (
    openingDate &&
    openingDate < windowStart &&
    (!closingDate || closingDate >= currentDay)
  ) {
    return true;
  }

  // No opening date, but a future deadline or explicit open language.
  if (
    !openingDate &&
    (
      (closingDate && closingDate >= currentDay) ||
      hasExplicitOpenLanguage(status)
    )
  ) {
    return true;
  }

  // Unknown dates are kept as discovery leads so the user can inspect them.
  if (!openingDate && !closingDate) {
    return true;
  }

  return false;
}

function detectCountry(text, url) {
  const lower = `${cleanText(text)} ${url}`.toLowerCase();

  // Check explicit country names first.
  const countryEntries = Object.entries(COUNTRY_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, country] of countryEntries) {
    const regex = new RegExp(
      `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );

    if (regex.test(lower)) {
      return country;
    }
  }

  const hostname = hostnameOf(url);

  for (const [suffix, country] of Object.entries(DOMAIN_COUNTRY)) {
    if (hostname.endsWith(suffix)) {
      return country;
    }
  }

  if (
    lower.includes("erasmus mundus") ||
    lower.includes("erasmus+") ||
    lower.includes("european master's") ||
    lower.includes("european master")
  ) {
    return "Europe";
  }

  return "Not confirmed";
}

function detectInstitution(text, url) {
  const lower = `${cleanText(text)} ${url}`.toLowerCase();

  for (const institution of KNOWN_INSTITUTIONS) {
    if (
      institution.patterns.some((pattern) =>
        lower.includes(pattern.toLowerCase())
      )
    ) {
      return institution.name;
    }
  }

  // Common patterns.
  let match = text.match(
    /\b(University of [A-Z][A-Za-z&' -]+(?:University)?)/i
  );

  if (match) {
    return cleanText(match[1]);
  }

  match = text.match(
    /\b([A-Z][A-Za-z&' -]+ University)\b/
  );

  if (match) {
    return cleanText(match[1]);
  }

  return "Institution not confirmed";
}

function detectEnglish(text) {
  const lower = cleanText(text).toLowerCase();

  const moi =
    lower.includes("medium of instruction") ||
    lower.includes("moi accepted") ||
    lower.includes("english as medium of instruction") ||
    lower.includes("proof of english") && lower.includes("medium");

  const waiver =
    lower.includes("english waiver") ||
    lower.includes("english proficiency waiver") ||
    lower.includes("ielts waiver") ||
    lower.includes("toefl waiver") ||
    lower.includes("may be waived") ||
    lower.includes("exempt from english");

  const ielts =
    lower.includes("ielts") ||
    lower.includes("toefl") ||
    lower.includes("pte academic") ||
    lower.includes("cambridge english");

  if (moi) {
    return "MOI / English-medium evidence mentioned";
  }

  if (waiver) {
    return "English-test waiver possible";
  }

  if (ielts) {
    return "IELTS/TOEFL or other English test mentioned";
  }

  return "Not confirmed";
}

function detectApplicationFee(text) {
  const lower = cleanText(text).toLowerCase();

  if (
    lower.includes("no application fee") ||
    lower.includes("no application fees") ||
    lower.includes("there is no application fee") ||
    lower.includes("free to apply") ||
    lower.includes("application is free")
  ) {
    return {
      status: "No application fee",
      amount: null
    };
  }

  if (
    lower.includes("application fee waiver") ||
    lower.includes("fee waiver available") ||
    lower.includes("application fee may be waived") ||
    lower.includes("waive the application fee")
  ) {
    return {
      status: "Fee waiver available",
      amount: null
    };
  }

  const feeMatch = lower.match(
    /application fee[^$€£\d]{0,20}([$€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp|cad|aud))/i
  );

  if (feeMatch) {
    return {
      status: "Application fee required",
      amount: feeMatch[1]
    };
  }

  if (
    lower.includes("application fee") &&
    !lower.includes("no application fee")
  ) {
    return {
      status: "Application fee mentioned — check exact amount",
      amount: null
    };
  }

  return {
    status: "Unknown — not confirmed",
    amount: null
  };
}

function detectFunding(text) {
  const lower = cleanText(text).toLowerCase();

  const fullyFundedPatterns = [
    "fully funded",
    "full scholarship",
    "full funding",
    "fully-funded",
    "full tuition scholarship",
    "tuition fees are covered",
    "tuition fee is covered",
    "tuition is covered",
    "tuition costs are covered",
    "tuition and living expenses",
    "tuition and stipend",
    "monthly stipend",
    "monthly scholarship",
    "stipend of",
    "scholarship recipients do not pay",
    "participation costs are covered"
  ];

  const partialPatterns = [
    "partial scholarship",
    "partial funding",
    "partial tuition",
    "tuition waiver",
    "fee waiver",
    "scholarship covers part",
    "up to $",
    "up to €",
    "up to £",
    "financial support may be available",
    "funding may be available"
  ];

  const selfFundedPatterns = [
    "self-funded",
    "self funded",
    "students are responsible for tuition",
    "students must pay tuition",
    "no funding is available",
    "no financial support",
    "does not provide funding",
    "does not offer funding",
    "not funded",
    "without funding",
    "funding is not provided"
  ];

  if (selfFundedPatterns.some((p) => lower.includes(p))) {
    return {
      status: "Self-funded",
      scholarship: "No programme funding confirmed — self-funded"
    };
  }

  if (fullyFundedPatterns.some((p) => lower.includes(p))) {
    return {
      status: "Fully funded / scholarship available",
      scholarship: extractFundingEvidence(text)
    };
  }

  if (partialPatterns.some((p) => lower.includes(p))) {
    return {
      status: "Tuition waiver / partial funding",
      scholarship: extractFundingEvidence(text)
    };
  }

  return {
    status: "Funding not confirmed",
    scholarship: "Funding not confirmed"
  };
}

function extractFundingEvidence(text) {
  const clean = cleanText(text);

  const patterns = [
    /(?:fully funded|full scholarship|full funding)[^.!?]{0,180}[.!?]/i,
    /(?:monthly stipend|monthly scholarship|stipend of)[^.!?]{0,180}[.!?]/i,
    /(?:tuition.{0,40}(?:covered|waived))[^.!?]{0,180}[.!?]/i,
    /(?:scholarship.{0,50}(?:covers|provides|includes))[^.!?]{0,180}[.!?]/i
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "Scholarship/funding mentioned — check official source for exact coverage";
}

function detectTuition(text) {
  const clean = cleanText(text);

  const patterns = [
    /tuition[^.!?]{0,120}([$€£]\s?\d[\d,]*(?:\.\d+)?[^.!?]*)/i,
    /fees?[^.!?]{0,120}([$€£]\s?\d[\d,]*(?:\.\d+)?[^.!?]*)/i,
    /cost[^.!?]{0,120}([$€£]\s?\d[\d,]*(?:\.\d+)?[^.!?]*)/i
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "Not confirmed";
}

function detectProgrammeStart(text) {
  const clean = cleanText(text);

  const patterns = [
    /(?:programme|program|course|degree|studies)[^.!?]{0,80}(?:starts?|begin)[^.!?]{0,80}/i,
    /(?:starting|starts?)\s+(?:in|on)\s+(?:september|october|january|february|march|april|may|june|july|august)/i
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "Not confirmed";
}

function classifySource(url) {
  const host = hostnameOf(url);

  if (!host) {
    return "Other source — official status not confirmed";
  }

  if (
    PROGRAMME_DOMAINS.some((domain) => host.includes(domain))
  ) {
    return "Potential official programme source";
  }

  if (
    DIRECTORY_DOMAINS.some((domain) => host.includes(domain))
  ) {
    return "Scholarship directory or information website";
  }

  if (
    host.endsWith(".edu") ||
    host.includes(".edu.") ||
    host.endsWith(".ac.uk") ||
    host.endsWith(".ac.au") ||
    host.endsWith(".ac.nz")
  ) {
    return "Potential official institution source";
  }

  return "Other source — official status not confirmed";
}

function detectRegion(country) {
  if (
    country === "Europe" ||
    country === "USA" ||
    country === "Canada" ||
    country === "Australia"
  ) {
    return country;
  }

  return "Other";
}

function extractSubject(title, text, searchedSubject) {
  const combined = `${title} ${text}`.toLowerCase();

  const matches = SUBJECTS.filter((subject) =>
    combined.includes(subject.toLowerCase())
  );

  if (matches.length > 0) {
    return matches[0];
  }

  return searchedSubject;
}

function isRelevantResult(title, content, searchedSubject) {
  const text = `${title} ${content}`.toLowerCase();

  const master'sTerms = [
    "master",
    "msc",
    "m.sc",
    "ms ",
    "m.s.",
    "graduate",
    "postgraduate",
    "ma ",
    "m.a."
  ];

  const subjectTerms = [
    "mathematics",
    "statistics",
    "data science",
    "data analytics",
    "mathematical",
    "computational",
    "operations research",
    "machine learning",
    "artificial intelligence"
  ];

  const hasMasters = master'sTerms.some((term) => text.includes(term));
  const hasSubject = subjectTerms.some((term) => text.includes(term));

  return hasMasters && hasSubject;
}

function buildSearchQueries(subject, region, windowStart, windowEnd) {
  const regionText =
    region === "all"
      ? "Europe OR USA OR Canada OR Australia"
      : region;

  const start = formatDate(windowStart);
  const end = formatDate(windowEnd);

  return [
    `"${subject}" master's scholarship application opens ${start} ${end} ${regionText}`,
    `"${subject}" MSc scholarship "application deadline" ${regionText}`,
    `"${subject}" master's "applications are open" scholarship ${regionText}`,
    `"${subject}" Erasmus Mundus scholarship master's ${regionText}`,
    `"${subject}" graduate scholarship tuition funding ${regionText}`
  ];
}

async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 8,
      include_answer: false,
      include_raw_content: true
    })
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Tavily request failed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  return response.json();
}

function makeResult(item, searchedSubject, windowStart, windowEnd) {
  const title = cleanText(item.title || "");
  const content = cleanText(
    `${item.content || ""} ${item.raw_content || ""}`
  );

  const url = item.url || "";

  const combinedText = `${title} ${content}`;

  const dates = extractDateNearLabels(combinedText);

  const status = getApplicationStatus(
    dates.openingDate,
    dates.closingDate,
    combinedText,
    windowEnd
  );

  const country = detectCountry(combinedText, url);
  const region = detectRegion(country);
  const institution = detectInstitution(combinedText, url);

  const funding = detectFunding(combinedText);
  const applicationFee = detectApplicationFee(combinedText);

  const includeByDateRule = isWithinSearchRule(
    dates.openingDate,
    dates.closingDate,
    combinedText,
    windowStart,
    windowEnd
  );

  return {
    id: normalizeUrl(url),

    title,

    university: institution,

    institution,

    programme: title,

    subject: extractSubject(
      title,
      content,
      searchedSubject
    ),

    country,

    region,

    applicationOpeningDate: formatDateReadable(
      dates.openingDate
    ),

    applicationClosingDate: formatDateReadable(
      dates.closingDate
    ),

    applicationStatus: status,

    programmeStart: detectProgrammeStart(combinedText),

    tuition: detectTuition(combinedText),

    fundingStatus: funding.status,

    scholarship: funding.scholarship,

    english: detectEnglish(combinedText),

    applicationFee: applicationFee.status,

    applicationFeeAmount: applicationFee.amount,

    sourceType: classifySource(url),

    officialLink: url,

    sourceLink: url,

    description:
      cleanText(item.content || "") ||
      "Programme information found in search results.",

    verification:
      "Search result information is not independently verified. Check the official programme/university page before applying.",

    includeByDateRule,

    searchRelevance: item.score ?? null
  };
}

function deduplicateResults(results) {
  const map = new Map();

  for (const result of results) {
    const key =
      result.id ||
      `${result.institution}-${result.title}-${result.country}`
        .toLowerCase();

    const existing = map.get(key);

    if (!existing) {
      map.set(key, result);
      continue;
    }

    // Prefer results with actual dates.
    const existingDateCount =
      Number(Boolean(existing.applicationOpeningDate)) +
      Number(Boolean(existing.applicationClosingDate));

    const newDateCount =
      Number(Boolean(result.applicationOpeningDate)) +
      Number(Boolean(result.applicationClosingDate));

    if (newDateCount > existingDateCount) {
      map.set(key, result);
    }
  }

  return Array.from(map.values());
}

function sortResults(results) {
  const fundingRank = {
    "Fully funded / scholarship available": 1,
    "Tuition waiver / partial funding": 2,
    "Funding not confirmed": 3,
    "Self-funded": 4
  };

  const englishRank = {
    "MOI / English-medium evidence mentioned": 1,
    "English-test waiver possible": 2,
    "IELTS/TOEFL or other English test mentioned": 3,
    "Not confirmed": 4
  };

  const statusRank = {
    "OPEN NOW": 1,
    "CLOSING SOON — deadline approaching": 2,
    "OPEN NOW — opening date not confirmed": 2,
    "OPENING SOON": 3,
    "Possibly open — opening date not confirmed": 4,
    "Possibly open — dates not fully confirmed": 4,
    "Dates unconfirmed": 5,
    "CLOSED": 6
  };

  return [...results].sort((a, b) => {
    const aFunding = fundingRank[a.fundingStatus] || 5;
    const bFunding = fundingRank[b.fundingStatus] || 5;

    if (aFunding !== bFunding) {
      return aFunding - bFunding;
    }

    const aEnglish = englishRank[a.english] || 5;
    const bEnglish = englishRank[b.english] || 5;

    if (aEnglish !== bEnglish) {
      return aEnglish - bEnglish;
    }

    const aStatus = statusRank[a.applicationStatus] || 5;
    const bStatus = statusRank[b.applicationStatus] || 5;

    if (aStatus !== bStatus) {
      return aStatus - bStatus;
    }

    return (b.searchRelevance || 0) - (a.searchRelevance || 0);
  });
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
    const subject = cleanText(req.query.q || "Mathematics");
    const selectedRegion = cleanText(
      req.query.region || "all"
    );

    const windowStart = startOfMonth(TODAY);
    const windowEnd = endOfMonth(addMonths(TODAY, 2));

    const queries = buildSearchQueries(
      subject,
      selectedRegion,
      windowStart,
      windowEnd
    );

    const allResults = [];
    const failedSearches = [];

    for (const query of queries) {
      try {
        const data = await tavilySearch(query);

        const results = Array.isArray(data.results)
          ? data.results
          : [];

        for (const item of results) {
          try {
            if (
              !isRelevantResult(
                item.title || "",
                item.content || "",
                subject
              )
            ) {
              continue;
            }

            const result = makeResult(
              item,
              subject,
              windowStart,
              windowEnd
            );

            if (selectedRegion !== "all") {
              if (result.region !== selectedRegion) {
                continue;
              }
            }

            allResults.push(result);
          } catch (error) {
            console.error(
              "Could not process search result:",
              error.message
            );
          }
        }
      } catch (error) {
        failedSearches.push({
          query,
          error: error.message
        });
      }
    }

    let results = deduplicateResults(allResults);

    // Remove results that are definitely outside the search rule.
    results = results.filter((result) => {
      if (result.applicationStatus === "CLOSED") {
        return false;
      }

      if (
        result.applicationOpeningDate &&
        result.applicationOpeningDate > formatDate(windowEnd)
      ) {
        return false;
      }

      return result.includeByDateRule !== false;
    });

    results = sortResults(results);

    const counts = {
      total: results.length,

      openNow: results.filter((r) =>
        r.applicationStatus.startsWith("OPEN NOW")
      ).length,

      closingSoon: results.filter((r) =>
        r.applicationStatus.startsWith("CLOSING SOON")
      ).length,

      openingSoon: results.filter((r) =>
        r.applicationStatus === "OPENING SOON"
      ).length,

      possiblyOpen: results.filter((r) =>
        r.applicationStatus.startsWith("Possibly open")
      ).length,

      datesUnconfirmed: results.filter((r) =>
        r.applicationStatus === "Dates unconfirmed"
      ).length,

      fullyFunded: results.filter((r) =>
        r.fundingStatus ===
        "Fully funded / scholarship available"
      ).length,

      partialFunding: results.filter((r) =>
        r.fundingStatus ===
        "Tuition waiver / partial funding"
      ).length,

      selfFunded: results.filter((r) =>
        r.fundingStatus === "Self-funded"
      ).length,

      fundingUnknown: results.filter((r) =>
        r.fundingStatus === "Funding not confirmed"
      ).length
    };

    res.json({
      success: true,

      searchedSubject: subject,

      selectedRegion,

      searchWindow: {
        start: formatDate(windowStart),
        end: formatDate(windowEnd)
      },

      dateRule:
        "Based on application opening date, not closing date. Applications opened earlier are also included if they remain open.",

      fundingRule:
        "Funding is classified separately as fully funded, partial/tuition waiver, self-funded, or not confirmed. Search-result evidence is not treated as final verification.",

      totalResults: results.length,

      counts,

      failedSearches,

      notice:
        "Dates, funding, English requirements and application fees are extracted from search-result information and must be checked on the official programme/university page before applying.",

      results
    });
  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile("index.html", {
    root: "public"
  });
});

app.listen(PORT, () => {
  console.log(`Scholarship Finder server running on port ${PORT}`);
});
