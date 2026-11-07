
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

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3,
  may: 4, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11
};

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

function clean(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
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

function isBlocked(url, title = "") {
  const host = hostOf(url);

  const blocked = BLOCKED_DOMAINS.some(domain =>
    hostMatches(host, domain)
  );

  const genericTitle =
    /top\s+\d+|scholarship list|scholarships for|directory of|degree scholarships available|study options|how to apply for scholarships|best scholarships/i.test(title);

  return blocked || genericTitle;
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

  if (host.endsWith(".ca")) return "Canada";
  if (host.endsWith(".edu.au") || host.endsWith(".gov.au")) return "Australia";
  if (host.endsWith(".us")) return "USA";

  if (/\.(uk|de|fr|it|es|nl|be|ch|se|fi|no|dk|at|pl|pt|ie|cz|hu|gr|ee|lt|lv|si|sk|ro|bg|hr|is)$/.test(host)) {
    return "Europe";
  }

  if (host.endsWith(".edu")) return "USA";

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

  const known = INSTITUTIONS.find(item =>
    hostMatches(host, item.host)
  );

  if (known) {
    return {
      name: known.name,
      country: known.country
    };
  }

  const lower = text.toLowerCase();

  const aliases = [
    ["University of Chicago", "university of chicago", "USA"],
    ["University of Southern California", "university of southern california", "USA"],
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
    if (lower.includes(phrase)) {
      return { name, country };
    }
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
    return validDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
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
    /application deadline/i,
    /applications? deadline/i,
    /deadlines?/i,
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

  // Find several dates when an official page publishes multiple deadline rounds.
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

      if (
        date &&
        !deadlineDates.some(item => item.getTime() === date.getTime())
      ) {
        deadlineDates.push(date);
      }
    }
  }

  deadlineDates.sort((a, b) => a - b);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ));

  const futureDeadlines = deadlineDates.filter(date => date >= todayUTC);

  // If there are several rounds, use the next future round for status.
  // Display all identified rounds separately.
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
  return /call for applications.{0,40}(now )?open|applications are now open|applications are open|currently accepting applications|portal is open|apply now|accepting applications for|now accepting applications/i.test(
    String(text || "")
  );
}

function dateStatus(open, close, text, windowEnd) {
  const today = new Date();

  const startToday = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ));

  const endToday = new Date(startToday);
  endToday.setUTCDate(endToday.getUTCDate() + 30);

  if (close && close < startToday) return "CLOSED";

  if (open && open > windowEnd) return "Outside search window";

  if (open && open <= startToday && close && close >= startToday) {
    return close <= endToday
      ? "CLOSING SOON — deadline approaching"
      : "OPEN NOW";
  }

  if (open && open > startToday && open <= windowEnd) {
    return "OPENING SOON";
  }

  if (!open && close && close >= startToday && explicitOpenEvidence(text)) {
    return "Possibly open — opening date not confirmed";
  }

  if (open && open <= startToday && !close && explicitOpenEvidence(text)) {
    return "Possibly open — closing date not confirmed";
  }

  return "Dates unconfirmed";
}

function fundingFrom(text) {
  const t = String(text || "").toLowerCase();

  if (
    /no funding (?:is )?available|does not provide funding|students must self[- ]fund|self[- ]funded only|no scholarships? (?:are )?available/.test(t)
  ) {
    return {
      status: "Self-funded",
      detail: "The official page indicates that students must fund the programme themselves."
    };
  }

  const hasScholarship =
    /scholarship|scholarships|stipend|financial support|funding available|grant award|fellowship/.test(t);

  const hasTuitionCover =
    /participation costs.{0,50}(waived|covered|not charged)|tuition.{0,50}(covered|waived|fully funded)|tuition fees.{0,50}(covered|waived)|full scholarship|fully funded/.test(t);

  if (hasScholarship || hasTuitionCover) {
    const details = [];

    const count = String(text || "").match(
      /\b\d{1,3}\s+(?:full\s+)?(?:Erasmus Mundus )?scholarships?\b/i
    );

    const stipend = String(text || "").match(
      /€\s?1[,.]?400\s*(?:\/|per )?(?:month|monthly)/i
    );

    const amount = String(text || "").match(
      /[€$£]\s?\d[\d,.]*(?:\s?(?:per month|\/month|monthly|per year|\/year))?/i
    );

    if (count) details.push(count[0]);
    if (stipend) details.push("€1,400 per month");
    else if (amount) details.push("Amount mentioned: " + amount[0]);

    if (hasTuitionCover) {
      details.push("Programme participation costs or tuition stated as covered or waived");
    }

    return {
      status: hasTuitionCover && (stipend || /fully funded|full scholarship/.test(t))
        ? "Fully funded scholarship stated"
        : "Scholarship / funding mentioned — coverage needs confirmation",
      detail: details.length
        ? details.join("; ") + "."
        : "Scholarship or funding is mentioned; exact amount and coverage are not confirmed."
    };
  }

  return {
    status: "Funding not confirmed",
    detail: "No specific scholarship coverage was confirmed in the checked text."
  };
}

function englishFrom(text) {
  const t = String(text || "").toLowerCase();

  if (/medium of instruction|\bmoi\b|english as (?:the )?medium of instruction/.test(t)) {
    return "MOI / English-medium evidence mentioned";
  }

  if (/english.{0,35}(?:waiver|exempt)|(?:ielts|toefl).{0,25}(?:waiver|exempt)|waiver.{0,25}(?:ielts|toefl)/.test(t)) {
    return "English-test waiver possible";
  }

  if (/ielts|toefl|pte academic|cambridge english/.test(t)) {
    return "IELTS/TOEFL or other English test mentioned";
  }

  return "Not confirmed";
}

function feeFrom(text) {
  const t = String(text || "").toLowerCase();

  if (
    /no (?:application|applicant) fee|free to apply|application (?:process|is) (?:is )?free|won't charge you any fee to take part in the application/i.test(t)
  ) {
    return "No application fee";
  }

  if (/application fee waiver|fee waiver available|waive the application fee|eligible for an application fee waiver/.test(t)) {
    return "Fee waiver available";
  }

  const match = String(text || "").match(
    /application fee[^$€£\d]{0,25}([$€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp|cad|aud))/i
  );

  if (match) {
    return "Application fee required: " + match[1];
  }

  if (/application fee.{0,35}(?:required|must pay|is \$|is €)/i.test(t)) {
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
    /scholarship directory|browse scholarships|all scholarships|degree scholarships available|top \d+|list of \d+|how to find scholarships|study abroad guide/.test(titleText)
  ) {
    return false;
  }

  const hasProgrammeSignal =
    /admission|apply|application|programme|program|degree|master|call for applications|curriculum/.test(titleText);

  return hasProgrammeSignal;
}

function programmeName(title, url) {
  if (hostMatches(hostOf(url), "intermaths.eu")) {
    return "InterMaths Erasmus Mundus Joint Master";
  }

  return clean(title)
    .replace(/^(apply for|apply to|admissions?:|applications? for)\s+/i, "")
    .replace(/\s*[|–—-]\s*(official|admissions|apply now).*$/i, "")
    .trim();
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

function programmeKey(result) {
  if (hostMatches(hostOf(result.sourceLink), "intermaths.eu")) {
    return "intermaths-erasmus-mundus-joint-master";
  }

  return (result.programme + " " + result.institution)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatResult(item) {
  const title = clean(item.title || "");
  const description = clean(item.content || "");
  const combined = title + ". " + description;

  const details = institutionFrom(
    item.url,
    title + " " + description
  );

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

function windowStartDate() {
  const now = new Date();

  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1
  ));
}

function windowEndDate() {
  const now = new Date();

  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 3,
    0
  ));
}

function dateInWindowOrPreviouslyOpen(result) {
  const open = result.applicationOpeningDate
    ? new Date(result.applicationOpeningDate + "T00:00:00Z")
    : null;

  const closeText = result.applicationClosingDate || "";

  const close = /^\d{4}-\d{2}-\d{2}$/.test(closeText)
    ? new Date(closeText + "T00:00:00Z")
    : null;

  const today = new Date();

  const startToday = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ));

  const end = windowEndDate();

  if (close && close < startToday) return false;
  if (open && open > end) return false;

  if (open && open < windowStartDate() && (!close || close >= startToday)) {
    return true;
  }

  if (open && open >= windowStartDate() && open <= end) {
    return true;
  }

  return !open && Boolean(result._officialExplicitOpen);
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

async function searchWeb(query, max = 6) {
  return tavily("search", {
    query,
    search_depth: "advanced",
    max_results: max,
    include_answer: false,
    include_raw_content: true
  });
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
          (clean(item.title) + " " + clean(item.content))
            .toLowerCase()
            .includes(result.institution.toLowerCase());

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
      officialUniversityLink: null,
      verification: "No sufficiently matching official university or programme-provider page was found. This discovery result is not verified."
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
  const funding = fundingFrom(officialContent);
  const fee = feeFrom(officialContent);

  const officialInstitution = institutionFrom(
    chosen.url,
    chosen.title + " " + fullText
  );

  const sameInstitution =
    result.institution === "Institution not confirmed" ||
    officialInstitution.name === result.institution ||
    (
      result.programme.includes("InterMaths") &&
      hostMatches(chosen.host, "intermaths.eu")
    );

  if (!sameInstitution) {
    return {
      verificationStatus: "Not verified",
      officialUniversityLink: null,
      verification: "A page from a different institution was found and rejected as a programme match."
    };
  }

  const score = titleSimilarity(
    result.programme,
    chosen.title + " " + fullText
  );

  if (!result.programme.includes("InterMaths") && score < 0.45) {
    return {
      verificationStatus: "Partially verified",
      officialUniversityLink: chosen.url,
      verification: "An official institution page was found, but the exact programme title could not be matched confidently."
    };
  }

  let closing = dateString(dates.close);

  if (dates.multipleDeadlines.length > 1) {
    closing = "Multiple deadlines: " + dates.multipleDeadlines.join(", ");
  }

  return {
    verificationStatus: "Verified",
    officialUniversityLink: chosen.url,
    officialPageTitle: chosen.title,

    verification: "The named programme/provider page was checked. Only details explicitly present on this official page are treated as confirmed.",

    officialEvidence: {
      opening: dateString(dates.open),
      closing,
      nextDeadline: dateString(dates.close),
      fundingStatus: funding.status,
      scholarship: funding.detail,
      english: englishFrom(fullText),
      applicationFee: fee,
      explicitOpen: explicitOpenEvidence(fullText),
      officialText: fullText.slice(0, 12000)
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
      '"' + subject + '" master scholarship application opening deadline official university Europe USA Canada Australia',
      '"' + subject + '" MSc MS master admissions 2027 official university application',
      '"' + subject + '" Erasmus Mundus joint master scholarship application 2027',
      '"' + subject + '" master programme scholarship funding call for applications 2027'
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

          if (
            !isRelevantProgramme(
              item.title || "",
              item.content || "",
              item.url
            )
          ) {
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

    const shortlist = uniqueResults.slice(0, 8);
    const results = [];

    for (const result of shortlist) {
      const verification = await verifyOfficial(result);

      Object.assign(result, verification);

      if (verification.officialEvidence) {
        const evidence = verification.officialEvidence;

        if (evidence.opening) {
          result.applicationOpeningDate = evidence.opening;
        }

        if (evidence.closing) {
          result.applicationClosingDate = evidence.closing;
        }

        if (evidence.fundingStatus !== "Funding not confirmed") {
          result.fundingStatus = evidence.fundingStatus;
          result.scholarship = evidence.scholarship;
        }

        if (evidence.english !== "Not confirmed") {
          result.english = evidence.english;
        }

        if (evidence.applicationFee !== "Unknown — not confirmed") {
          result.applicationFee = evidence.applicationFee;
        }

        result._officialExplicitOpen = evidence.explicitOpen;

        const open = evidence.opening
          ? new Date(evidence.opening + "T00:00:00Z")
          : null;

        const close = evidence.nextDeadline
          ? new Date(evidence.nextDeadline + "T00:00:00Z")
          : null;

        result.applicationStatus = dateStatus(
          open,
          close,
          evidence.explicitOpen
            ? "Applications are now open"
            : evidence.officialText,
          end
        );
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

      results.push(result);
    }

    const counts = {
      total: results.length,

      openNow: results.filter(item =>
        item.applicationStatus.startsWith("OPEN NOW")
      ).length,

      openingSoon: results.filter(item =>
        item.applicationStatus.startsWith("OPENING SOON")
      ).length,

      closingSoon: results.filter(item =>
        item.applicationStatus.startsWith("CLOSING SOON")
      ).length,

      possiblyOpen: results.filter(item =>
        item.applicationStatus.startsWith("Possibly open")
      ).length,

      verified: results.filter(item =>
        item.verificationStatus === "Verified"
      ).length,

      partiallyVerified: results.filter(item =>
        item.verificationStatus === "Partially verified"
      ).length,

      notVerified: results.filter(item =>
        item.verificationStatus === "Not verified"
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

      dateRule: "Results are selected by application opening date. Applications opened before the window are included only when the official page indicates they remain open. Applications opening inside the window remain eligible even when their deadline is later.",

      totalResults: results.length,
      counts,
      failedSearches,

      notice: "A verified programme page does not automatically prove scholarship availability, admission eligibility, or personal eligibility. Unknown details are left unconfirmed rather than guessed.",

      results
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
