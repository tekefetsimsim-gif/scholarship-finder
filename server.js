import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const BLOCKED_DOMAINS = [
  "facebook.com", "instagram.com", "reddit.com", "tiktok.com",
  "youtube.com", "linkedin.com", "x.com", "twitter.com",
  "letzstudy.com", "leverageedu.com", "yocket.com",
  "scholarshiproar.com", "opportunitiesforafricans.com",
  "scholars4dev.com", "mastersportal.com", "scholarshipportal.com",
  "studyportals.com", "findamasters.com"
];

const DIRECTORY_DOMAINS = [
  ...BLOCKED_DOMAINS, "studyabroad.shiksha.com", "educations.com"
];

const TRUSTED_PROGRAMME_DOMAINS = [
  "intermaths.eu", "erasmus-plus.ec.europa.eu", "erasmusmundus.eu"
];

const COUNTRY_WORDS = {
  "united states": "USA",
  "united states of america": "USA",
  "usa": "USA",
  "canada": "Canada",
  "australia": "Australia",
  "united kingdom": "Europe",
  "uk": "Europe",
  "england": "Europe",
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
  "europe": "Europe",
  "erasmus mundus": "Europe"
};

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
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url = "") {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalUrl(url = "") {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`
      .toLowerCase()
      .replace(/\/+$/, "");
  } catch {
    return url.toLowerCase();
  }
}

function isBlocked(url, title = "") {
  const host = hostOf(url);

  return DIRECTORY_DOMAINS.some(
    domain => host === domain || host.endsWith("." + domain)
  ) || /top\s+\d+|without ielts|study options|how to prove|how can you|scholarship list|guide to/i.test(title);
}

function isOfficialHost(url) {
  const host = hostOf(url);

  if (!host || isBlocked(url)) return false;

  if (
    TRUSTED_PROGRAMME_DOMAINS.some(
      domain => host === domain || host.endsWith("." + domain)
    )
  ) {
    return true;
  }

  return /\.(edu|ac\.[a-z]{2}|edu\.[a-z]{2}|gov\.[a-z]{2})$/.test(host) ||
    /\.(de|fr|it|es|nl|be|ch|se|fi|no|dk|at|pl|pt|ie|cz|hu|gr|ee|lt|lv|si|sk|ro|bg|hr|is)$/.test(host);
}

function parseDate(text) {
  if (!text) return null;

  let match = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);

  if (match) {
    return new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ));
  }

  const months = Object.keys(MONTHS).join("|");

  match = text.toLowerCase().match(
    new RegExp(`\\b(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(20\\d{2})\\b`)
  );

  if (match) {
    return new Date(Date.UTC(
      Number(match[3]),
      MONTHS[match[1]],
      Number(match[2])
    ));
  }

  match = text.toLowerCase().match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})\\s+(20\\d{2})\\b`)
  );

  if (match) {
    return new Date(Date.UTC(
      Number(match[3]),
      MONTHS[match[2]],
      Number(match[1])
    ));
  }

  return null;
}

function findDate(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const date = parseDate(match[1]);
      if (date) return date;
    }
  }

  return null;
}

function extractDates(text) {
  const open = findDate(text, [
    /applications?\s+(?:open|opens|opening)\s*(?:on|from|:)?\s*([^.;|]{3,65})/i,
    /application\s+opening\s+date\s*(?:is|:)?\s*([^.;|]{3,65})/i,
    /open(?:ing)?\s+date\s*(?:is|:)?\s*([^.;|]{3,65})/i
  ]);

  const close = findDate(text, [
    /application\s+deadline\s*(?:is|:)?\s*([^.;|]{3,65})/i,
    /applications?\s+(?:close|closes|closing)\s*(?:on|:)?\s*([^.;|]{3,65})/i,
    /deadline\s*(?:is|:)?\s*([^.;|]{3,65})/i,
    /apply\s+by\s*([^.;|]{3,65})/i
  ]);

  return { open, close };
}

function dateString(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function countryFrom(text, url) {
  const lower = `${text} ${url}`.toLowerCase();

  for (const [word, country] of Object.entries(COUNTRY_WORDS)) {
    if (lower.includes(word)) return country;
  }

  const host = hostOf(url);

  if (host.endsWith(".ca")) return "Canada";
  if (host.endsWith(".au")) return "Australia";
  if (host.endsWith(".us")) return "USA";

  if (/\.(uk|de|fr|it|es|nl|be|ch|se|fi|no|dk|at|pl|pt|ie)$/.test(host)) {
    return "Europe";
  }

  return "Not confirmed";
}

function institutionFrom(text) {
  const known = [
    ["University of Michigan", /university of michigan|umich\.edu/i],
    ["University of Oxford", /university of oxford|ox\.ac\.uk/i],
    ["University of Cambridge", /university of cambridge|cam\.ac\.uk/i],
    ["ETH Zurich", /eth zurich|ethz\.ch/i],
    ["EPFL", /\bepfl\b/i],
    ["University of Toronto", /university of toronto|utoronto\.ca/i],
    ["University of British Columbia", /university of british columbia|ubc\.ca/i],
    ["McGill University", /mcgill university|mcgill\.ca/i],
    ["University of Melbourne", /university of melbourne|unimelb\.edu\.au/i],
    ["University of Sydney", /university of sydney|sydney\.edu\.au/i]
  ];

  for (const [name, pattern] of known) {
    if (pattern.test(text)) return name;
  }

  const match = text.match(
    /\b(?:University of [A-Z][A-Za-z&' -]{2,55}|[A-Z][A-Za-z&' -]{2,45} University)\b/
  );

  return match ? clean(match[0]) : "Institution not confirmed";
}

function fundingFrom(text) {
  const t = text.toLowerCase();

  if (/self[- ]funded|students must pay tuition|no funding is available|does not provide funding|no financial support/.test(t)) {
    return {
      status: "Self-funded",
      detail: "Self-funded; confirm tuition and funding terms on the official page."
    };
  }

  if (/fully funded|full scholarship|full funding|tuition.{0,35}(covered|waived)|participation costs are covered|tuition and living expenses|monthly stipend|stipend of/.test(t)) {
    return {
      status: "Fully funded / scholarship available",
      detail: "Funding is mentioned; confirm exact coverage and eligibility on the official page."
    };
  }

  if (/partial scholarship|partial funding|tuition waiver|fee waiver|scholarship covers part/.test(t)) {
    return {
      status: "Tuition waiver / partial funding",
      detail: "Partial funding or a waiver is mentioned; confirm exact coverage."
    };
  }

  return {
    status: "Funding not confirmed",
    detail: "Funding not confirmed"
  };
}

function englishFrom(text) {
  const t = text.toLowerCase();

  if (/medium of instruction|\bmoi\b|english as medium of instruction/.test(t)) {
    return "MOI / English-medium evidence mentioned";
  }

  if (/english.{0,30}waiver|ielts waiver|toefl waiver|exempt from english/.test(t)) {
    return "English-test waiver possible";
  }

  if (/ielts|toefl|pte academic|cambridge english/.test(t)) {
    return "IELTS/TOEFL or other English test mentioned";
  }

  return "Not confirmed";
}

function feeFrom(text) {
  const t = text.toLowerCase();

  if (/no application fee|free to apply|application is free/.test(t)) {
    return "No application fee";
  }

  if (/application fee waiver|fee waiver available|waive the application fee/.test(t)) {
    return "Fee waiver available";
  }

  const match = t.match(
    /application fee[^$€£\d]{0,20}([$€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp|cad|aud))/i
  );

  if (match) {
    return `Application fee required: ${match[1]}`;
  }

  if (/application fee/.test(t)) {
    return "Application fee mentioned — amount not confirmed";
  }

  return "Unknown — not confirmed";
}

function isSpecificMasters(title, content) {
  const t = `${title} ${content}`.toLowerCase();

  const hasMasters =
    /\b(master|masters|msc|m\.sc|m\.s\.|ms degree|graduate degree|postgraduate)\b/.test(t);

  const hasSubject =
    /mathemat|statistic|data science|data analytics|computational|operations research|machine learning|artificial intelligence/.test(t);

  const generic =
    /without ielts|top \d+|study options|how to apply|how can you prove|scholarship list|best scholarships/.test(title.toLowerCase());

  return hasMasters && hasSubject && !generic;
}

function dateStatus(open, close, text, windowEnd) {
  const now = new Date();

  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));

  if (close && close < today) return "CLOSED";

  if (open && open > windowEnd) return "Outside search window";

  if (open && open <= today && close && close >= today) {
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 30);

    return close <= soon
      ? "CLOSING SOON — deadline approaching"
      : "OPEN NOW";
  }

  if (open && open <= today && !close) {
    return /applications are open|apply now|currently accepting applications|call is open/i.test(text)
      ? "Possibly open — closing date not confirmed"
      : "Dates unconfirmed";
  }

  if (open && open > today && open <= windowEnd) {
    return "OPENING SOON";
  }

  if (!open && close && close >= today) {
    return /applications are open|apply now|currently accepting applications|call is open/i.test(text)
      ? "Possibly open — opening date not confirmed"
      : "Dates unconfirmed";
  }

  return "Dates unconfirmed";
}

async function tavily(endpoint, body) {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const response = await fetch(`https://api.tavily.com/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      ...body
    })
  });

  if (!response.ok) {
    throw new Error(
      `Tavily ${endpoint} failed (${response.status}): ${(await response.text()).slice(0, 250)}`
    );
  }

  return response.json();
}

async function searchWeb(query, depth = "basic", max = 6) {
  return tavily("search", {
    query,
    search_depth: depth,
    max_results: max,
    include_answer: false,
    include_raw_content: true
  });
}

function matchScore(programme, title, content) {
  const terms = clean(programme)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(word =>
      word.length > 3 &&
      !["master", "masters", "programme", "program", "university", "admission"].includes(word)
    );

  if (!terms.length) return 0;

  const hay = `${title} ${content}`.toLowerCase();

  return terms.filter(word => hay.includes(word)).length / terms.length;
}

async function verifyOfficial(result) {
  const institution =
    result.institution !== "Institution not confirmed"
      ? result.institution
      : "";

  const query = `"${result.programme}" ${institution} official university programme admissions`;

  const candidates = [];

  if (isOfficialHost(result.sourceLink)) {
    candidates.push({
      title: result.programme,
      url: result.sourceLink,
      content: result.description || ""
    });
  }

  try {
    const found = await searchWeb(query, "basic", 5);

    for (const item of found.results || []) {
      if (isOfficialHost(item.url)) {
        candidates.push({
          title: clean(item.title),
          url: item.url,
          content: clean(item.content)
        });
      }
    }
  } catch (error) {
    console.warn("Official search error:", error.message);
  }

  const unique = [
    ...new Map(candidates.map(item => [normalUrl(item.url), item])).values()
  ];

  unique.sort((a, b) =>
    matchScore(result.programme, b.title, b.content) -
    matchScore(result.programme, a.title, a.content)
  );

  const chosen = unique.find(
    item => matchScore(result.programme, item.title, item.content) >= 0.25
  );

  if (!chosen) {
    return {
      verificationStatus: "Not verified",
      officialUniversityLink: null,
      verification: "No sufficiently matching official university or programme-provider page was found. Treat this result as unverified."
    };
  }

  let officialContent = chosen.content || "";

  try {
    const extracted = await tavily("extract", {
      urls: [chosen.url],
      extract_depth: "basic",
      format: "text"
    });

    if (extracted.results?.[0]?.raw_content) {
      officialContent = clean(extracted.results[0].raw_content);
    }
  } catch (error) {
    console.warn("Official page extraction error:", error.message);
  }

  const score = matchScore(
    result.programme,
    chosen.title,
    officialContent
  );

  if (score < 0.25) {
    return {
      verificationStatus: "Partially verified",
      officialUniversityLink: chosen.url,
      verification: "An official-looking institution page was found, but the programme match could not be fully confirmed."
    };
  }

  const dates = extractDates(officialContent);
  const funding = fundingFrom(officialContent);

  return {
    verificationStatus: "Verified",
    officialUniversityLink: chosen.url,
    officialPageTitle: chosen.title,
    verification: "The programme was matched against an official university or programme-provider page. Details are confirmed only where that page provides supporting information.",
    officialEvidence: {
      opening: dateString(dates.open),
      closing: dateString(dates.close),
      fundingStatus: funding.status,
      scholarship: funding.detail,
      english: englishFrom(officialContent),
      applicationFee: feeFrom(officialContent)
    }
  };
}

function regionFor(country) {
  return ["Europe", "USA", "Canada", "Australia"].includes(country)
    ? country
    : "Other";
}

function formatResult(item) {
  const title = clean(item.title || "");
  const description = clean(item.content || "");
  const combined = `${title}. ${description}`;

  const dates = extractDates(combined);
  const country = countryFrom(combined, item.url);
  const funding = fundingFrom(combined);
  const institution = institutionFrom(combined);

  return {
    title,
    programme: title,
    university: institution,
    institution,
    country,
    region: regionFor(country),

    applicationOpeningDate: dateString(dates.open),
    applicationClosingDate: dateString(dates.close),
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
      ? "Potential official institution/programme source"
      : "Discovery source — not an official page",

    sourceLink: item.url,
    officialLink: null,
    officialUniversityLink: null,

    verificationStatus: "Not checked",
    description: description || "No description supplied by search provider.",
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

    const start = windowStartDate();
    const end = windowEndDate();

    const startText = dateString(start);
    const endText = dateString(end);

    const queries = [
      `"${subject}" master's scholarship application admissions ${startText} ${endText} Europe USA Canada Australia`,
      `"${subject}" MSc official university admissions scholarship funding 2027`,
      `"${subject}" Erasmus Mundus joint master scholarship`,
      `"${subject}" master's programme application opening date university`
    ];

    const gathered = [];
    const failedSearches = [];

    for (const query of queries) {
      try {
        const data = await searchWeb(query, "advanced", 8);

        for (const item of data.results || []) {
          if (isBlocked(item.url || "", item.title || "")) {
            continue;
          }

          if (!isSpecificMasters(item.title || "", item.content || "")) {
            continue;
          }

          const result = formatResult(item);

          if (
            selectedRegion !== "all" &&
            result.region !== selectedRegion
          ) {
            continue;
          }

          if (
            result.applicationStatus === "CLOSED" ||
            result.applicationStatus === "Outside search window"
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

    const deduped = [
      ...new Map(
        gathered.map(result => [normalUrl(result.sourceLink), result])
      ).values()
    ];

    deduped.sort((a, b) => {
      const rank = status => {
        if (status.includes("Fully funded")) return 0;
        if (status.includes("partial")) return 1;
        if (status.includes("Self-funded")) return 3;
        return 2;
      };

      return rank(a.fundingStatus) - rank(b.fundingStatus);
    });

    // Verify a limited shortlist to control search credits and response time.
    const shortlist = deduped.slice(0, 8);
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

        if (
          evidence.fundingStatus &&
          evidence.fundingStatus !== "Funding not confirmed"
        ) {
          result.fundingStatus = evidence.fundingStatus;
        }

        if (evidence.scholarship) {
          result.scholarship = evidence.scholarship;
        }

        if (
          evidence.english &&
          evidence.english !== "Not confirmed"
        ) {
          result.english = evidence.english;
        }

        if (
          evidence.applicationFee &&
          !evidence.applicationFee.startsWith("Unknown")
        ) {
          result.applicationFee = evidence.applicationFee;
        }

        // Recalculate status after official dates replace discovery dates.
        const officialOpen = evidence.opening
          ? new Date(`${evidence.opening}T00:00:00Z`)
          : result.applicationOpeningDate
            ? new Date(`${result.applicationOpeningDate}T00:00:00Z`)
            : null;

        const officialClose = evidence.closing
          ? new Date(`${evidence.closing}T00:00:00Z`)
          : result.applicationClosingDate
            ? new Date(`${result.applicationClosingDate}T00:00:00Z`)
            : null;

        result.applicationStatus = dateStatus(
          officialOpen,
          officialClose,
          result.description,
          end
        );
      }

      results.push(result);
    }

    const counts = {
      total: results.length,
      openNow: results.filter(result =>
        result.applicationStatus.startsWith("OPEN NOW")
      ).length,
      openingSoon: results.filter(result =>
        result.applicationStatus === "OPENING SOON"
      ).length,
      closingSoon: results.filter(result =>
        result.applicationStatus.startsWith("CLOSING SOON")
      ).length,
      possiblyOpen: results.filter(result =>
        result.applicationStatus.startsWith("Possibly open")
      ).length,
      verified: results.filter(result =>
        result.verificationStatus === "Verified"
      ).length,
      partiallyVerified: results.filter(result =>
        result.verificationStatus === "Partially verified"
      ).length,
      notVerified: results.filter(result =>
        result.verificationStatus === "Not verified"
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
      dateRule: "Selected by application opening date; previously opened applications are included only when evidence indicates they remain open.",
      totalResults: results.length,
      counts,
      failedSearches,
      notice: "Official links are checked separately. A verified programme page does not automatically verify scholarship availability or personal eligibility.",
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
  console.log(`Scholarship Finder server running on port ${PORT}`);
});
