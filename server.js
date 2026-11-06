import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DESTINATIONS = {
  europe: [
    "Germany", "France", "Italy", "Switzerland",
    "Netherlands", "Sweden", "Norway", "Finland",
    "Denmark", "Belgium", "Austria", "Spain",
    "Portugal", "Ireland", "United Kingdom",
    "Poland", "Czech Republic", "Hungary",
    "Estonia", "Latvia", "Lithuania", "Greece",
    "Romania"
  ],
  usa: ["United States"],
  canada: ["Canada"],
  australia: ["Australia"]
};

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
    end: end.toISOString().slice(0, 10),
    today: now.toISOString().slice(0, 10)
  };
}

function getDestinations(region) {
  if (region === "all") {
    return ["Europe", "United States", "Canada", "Australia"];
  }

  return DESTINATIONS[region] || [];
}

function buildQueries(subject, region, window) {
  const destinations = getDestinations(region).join(", ");

  const subjects = subject ||
    "Mathematics, Mathematics Education, Applied Mathematics, Statistics, Data Science, Data Analytics, Computational Mathematics and Operations Research";

  const dateRule =
    `Find applications opening between ${window.start} and ${window.end}. ` +
    `Also include applications that opened earlier and remain open on ${window.today}. ` +
    `Do not exclude opportunities because their closing date is after ${window.end}.`;

  return [
    {
      type: "Official university Master's programmes",
      query:
        `Official university Master's programmes and scholarships in ${subjects}. ` +
        `Study destinations: ${destinations}. International applicants. ` +
        `Find application opening dates, closing dates, tuition and application fees. ` +
        dateRule
    },
    {
      type: "Government scholarships",
      query:
        `Official government-funded Master's scholarships in ${subjects} ` +
        `for international students in ${destinations}. ` +
        `Find opening dates, eligibility, scholarship amounts and deadlines. ` +
        dateRule
    },
    {
      type: "Erasmus Mundus and European scholarships",
      query:
        `Official Erasmus Mundus Joint Masters, DAAD and European university ` +
        `scholarships in ${subjects}. Find 2027 application opening dates, ` +
        `funding and international eligibility. ${dateRule}`
    },
    {
      type: "English language requirements",
      query:
        `Official Master's admission pages in ${subjects} in ${destinations}. ` +
        `Find acceptance of Medium of Instruction certificates, English waivers, ` +
        `IELTS and TOEFL requirements. ${dateRule}`
    },
    {
      type: "Application fees and tuition",
      query:
        `Official university and scholarship provider pages for Master's ` +
        `programmes in ${subjects} in ${destinations}. Find application fees, ` +
        `fee waivers, tuition and scholarship coverage. ${dateRule}`
    }
  ];
}

async function tavilySearch(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "advanced",
          topic: "general",
          max_results: 8,
          include_answer: false,
          include_raw_content: false
        }),
        signal: controller.signal
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        data?.error ||
        `Tavily error ${response.status}`
      );
    }

    return Array.isArray(data.results) ? data.results : [];

  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";

    return parsed.toString()
      .replace(/\/$/, "")
      .toLowerCase();

  } catch {
    return String(url || "").toLowerCase();
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function classifySource(url) {
  const domain = getDomain(url);

  const directories = [
    "hotcoursesabroad.com",
    "topuniversities.com",
    "mastersportal.com",
    "wemakescholars.com",
    "scholarships360.org",
    "applykite.com",
    "yocket.com",
    "leverageedu.com",
    "scholarshiptab.com"
  ];

  if (directories.some(d =>
    domain === d || domain.endsWith("." + d)
  )) {
    return "Scholarship directory or information website";
  }

  if (
    domain.endsWith(".edu") ||
    domain.endsWith(".edu.au") ||
    domain.endsWith(".ac.uk") ||
    domain.endsWith(".gov") ||
    domain.endsWith(".gov.au") ||
    domain.endsWith(".gc.ca") ||
    domain.endsWith(".europa.eu") ||
    domain.endsWith(".daad.de")
  ) {
    return "Potential official institution or government source";
  }

  return "Other source — official status not confirmed";
}

function getCountry(text, url) {
  const value = text.toLowerCase();
  const domain = getDomain(url);

  const patterns = [
    [/\b(?:study in|studying in|located in|university in|campus in|programme in|program in)\s+(?:the )?united states\b|\busa\b/, "United States"],
    [/\b(?:study in|studying in|located in|university in|campus in|programme in|program in)\s+canada\b/, "Canada"],
    [/\b(?:study in|studying in|located in|university in|campus in|programme in|program in)\s+australia\b/, "Australia"]
  ];

  for (const [pattern, country] of patterns) {
    if (pattern.test(value)) return country;
  }

  const europeanCountries = [
    "Germany", "France", "Italy", "Switzerland",
    "Netherlands", "Sweden", "Norway", "Finland",
    "Denmark", "Belgium", "Austria", "Spain",
    "Portugal", "Ireland", "United Kingdom",
    "Poland", "Czech Republic", "Hungary",
    "Estonia", "Latvia", "Lithuania", "Greece",
    "Romania"
  ];

  for (const country of europeanCountries) {
    const pattern = new RegExp(
      `(?:study in|studying in|located in|university in|campus in) ${country.toLowerCase()}`,
      "i"
    );

    if (pattern.test(value)) return country;
  }

  if (domain.endsWith(".edu.au") || domain.endsWith(".gov.au")) {
    return "Australia";
  }

  if (domain.endsWith(".gc.ca")) return "Canada";
  if (domain.endsWith(".ac.uk")) return "United Kingdom";
  if (domain.endsWith(".de")) return "Germany";
  if (domain.endsWith(".it")) return "Italy";
  if (domain.endsWith(".fr")) return "France";
  if (domain.endsWith(".ch")) return "Switzerland";

  return "Not identified";
}

function getRegion(country) {
  if (country === "United States") return "USA";
  if (country === "Canada") return "Canada";
  if (country === "Australia") return "Australia";

  if (country !== "Not identified") return "Europe";

  return "Not identified";
}

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

function parseDate(text) {
  const value = cleanText(text).toLowerCase();

  const patterns = [
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i,
    /\b(20\d{2})-(\d{2})-(\d{2})\b/
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (!match) continue;

    let year;
    let month;
    let day;

    if (/^\d{4}-/.test(match[0])) {
      year = Number(match[1]);
      month = Number(match[2]) - 1;
      day = Number(match[3]);

    } else if (/^\d/.test(match[1])) {
      day = Number(match[1]);
      month = MONTHS[match[2]];
      year = Number(match[3]);

    } else {
      month = MONTHS[match[1]];
      day = Number(match[2]);
      year = Number(match[3]);
    }

    const date = new Date(Date.UTC(year, month, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month &&
      date.getUTCDate() === day
    ) {
      return date.toISOString().slice(0, 10);
    }
  }

  return null;
}

function extractDateNearLabels(text, labels) {
  const value = cleanText(text);

  for (const label of labels) {
    const index = value.toLowerCase().indexOf(label);

    if (index === -1) continue;

    const nearby = value.slice(
      index,
      index + 140
    );

    const date = parseDate(nearby);

    if (date) return date;
  }

  return null;
}

function extractOpeningDate(text) {
  return extractDateNearLabels(text, [
    "application opens",
    "applications open",
    "opening date",
    "application opening",
    "applications begin",
    "application starts",
    "opens on",
    "application form opens",
    "call opens"
  ]);
}

function extractClosingDate(text) {
  return extractDateNearLabels(text, [
    "application deadline",
    "deadline",
    "applications close",
    "closing date",
    "apply by",
    "last date to apply",
    "submission deadline",
    "scholarship deadline"
  ]);
}

function getApplicationStatus(openDate, closeDate, window) {
  const today = window.today;

  if (closeDate && closeDate < today) {
    return "CLOSED — deadline has passed";
  }

  if (
    openDate &&
    openDate > today &&
    openDate <= window.end
  ) {
    return "OPENING SOON";
  }

  if (
    openDate &&
    openDate <= today &&
    (!closeDate || closeDate >= today)
  ) {
    return "OPEN NOW — verify on official page";
  }

  if (!openDate && closeDate && closeDate >= today) {
    return "Possibly open — opening date not confirmed";
  }

  return "Application dates not confirmed";
}

function getApplicationFee(text) {
  const value = text.toLowerCase();

  if (/no application fee|application is free|free application|without application fee|no fee to apply/.test(value)) {
    return "No application fee reported — verify";
  }

  if (/application fee waiver|waiver of the application fee|fee waiver available/.test(value)) {
    return "Fee waiver reported — check eligibility";
  }

  if (/application fee|required application fee|application fee of|pay an application fee/.test(value)) {
    return "Application fee reported — amount needs verification";
  }

  return "Unknown — not confirmed";
}

function getEnglishStatus(text) {
  const value = text.toLowerCase();

  if (/medium of instruction|moi certificate|medium-of-instruction|english language waiver|waiver of english|previous degree taught in english/.test(value)) {
    return "MOI or English waiver mentioned — verify";
  }

  if (/ielts|toefl/.test(value)) {
    return "IELTS/TOEFL mentioned — check exact requirement";
  }

  return "Not confirmed";
}

function getTuition(text) {
  const matches = text.match(
    /(?:tuition|fees|cost)[^.!?]{0,100}/gi
  );

  return matches
    ? matches.slice(0, 2).join(" | ")
    : "Not confirmed";
}

function getScholarship(text) {
  const matches = text.match(
    /(?:scholarship|funding|stipend|fully funded|tuition waiver)[^.!?]{0,140}/gi
  );

  return matches
    ? matches.slice(0, 3).join(" | ")
    : "Scholarship details not confirmed";
}

function scoreResult(item, sourceType) {
  const text = (
    (item.title || "") + " " +
    (item.content || "") + " " +
    (item.url || "")
  ).toLowerCase();

  let score = 0;

  if (/master|master's|msc|m\.sc|ma degree/.test(text)) score += 5;
  if (/scholarship|funded|funding|stipend/.test(text)) score += 4;
  if (/mathematics|statistics|data science|analytics/.test(text)) score += 5;
  if (/international students|international applicants/.test(text)) score += 2;
  if (/application opens|applications open|opening date/.test(text)) score += 3;
  if (/phd|doctoral|undergraduate|bachelor's only/.test(text)) score -= 5;

  if (sourceType.startsWith("Potential official")) score += 2;
  if (sourceType.startsWith("Scholarship directory")) score -= 2;

  return score;
}

function createResult(item, searchType, window) {
  const title = cleanText(item.title);
  const content = cleanText(item.content);
  const url = cleanText(item.url);

  const combined = `${title}. ${content}`;

  const sourceType = classifySource(url);
  const country = getCountry(combined, url);

  const openingDate = extractOpeningDate(combined);
  const closingDate = extractClosingDate(combined);

  const status = getApplicationStatus(
    openingDate,
    closingDate,
    window
  );

  return {
    programme: title || "Programme title not identified",
    university: getDomain(url) || "Source not identified",
    country,
    region: getRegion(country),

    start: "Not confirmed",

    applicationOpeningDate: openingDate || "Not confirmed",
    applicationClosingDate: closingDate || "Not confirmed",
    deadline: closingDate || "Not confirmed",

    applicationStatus: status,

    tuition: getTuition(combined),
    scholarship: getScholarship(combined),
    english: getEnglishStatus(combined),
    applicationFee: getApplicationFee(combined),

    officialLink: url,
    sourceLink: url,

    sourceType,
    description: content,
    searchCategory: searchType,

    verification: "Unverified — check the linked page",

    expired: status.startsWith("CLOSED"),

    relevanceScore: scoreResult(item, sourceType)
  };
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
    if (!process.env.TAVILY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Tavily API key is missing."
      });
    }

    const subject = cleanText(req.query.q || "");

    const regionInput = cleanText(
      req.query.region || "all"
    ).toLowerCase();

    const regionAliases = {
      "all destinations": "all",
      "europe": "europe",
      "europe only": "europe",
      "usa": "usa",
      "united states": "usa",
      "canada": "canada",
      "australia": "australia"
    };

    const region = regionAliases[regionInput] || regionInput;

    const allowedRegions = [
      "all", "europe", "usa", "canada", "australia"
    ];

    if (!allowedRegions.includes(region)) {
      return res.status(400).json({
        success: false,
        error: "Invalid destination selection."
      });
    }

    if (subject.length > 200) {
      return res.status(400).json({
        success: false,
        error: "Search subject is too long."
      });
    }

    const window = getSearchWindow();
    const queries = buildQueries(subject, region, window);

    const responses = await Promise.all(
      queries.map(async (search) => {
        try {
          const results = await tavilySearch(search.query);

          return results.map(item => ({
            item,
            searchType: search.type
          }));

        } catch (error) {
          return [{
            error: error.message,
            searchType: search.type
          }];
        }
      })
    );

    const entries = responses.flat();

    const successful = entries.filter(
      entry => entry.item
    );

    const failedSearches = entries
      .filter(entry => entry.error)
      .map(entry => ({
        category: entry.searchType,
        error: entry.error
      }));

    const unique = new Map();

    for (const entry of successful) {
      const result = createResult(
        entry.item,
        entry.searchType,
        window
      );

      const key = normaliseUrl(result.sourceLink);

      if (!key) continue;

      const previous = unique.get(key);

      if (
        !previous ||
        result.relevanceScore > previous.relevanceScore
      ) {
        unique.set(key, result);
      }
    }

    let results = Array.from(unique.values());

    if (region !== "all") {
      const allowedCountries = getDestinations(region)
        .map(country => country.toLowerCase());

      results = results.filter(result => {
        if (result.country === "Not identified") {
          return true;
        }

        return allowedCountries.includes(
          result.country.toLowerCase()
        );
      });
    }

    const active = results.filter(
      result => !result.expired
    );

    const closed = results.filter(
      result => result.expired
    );

    active.sort((a, b) => {
      const rank = result => {
        if (result.applicationStatus.startsWith("OPEN NOW")) return 0;
        if (result.applicationStatus === "OPENING SOON") return 1;
        if (result.applicationStatus.startsWith("Possibly open")) return 2;
        return 3;
      };

      return rank(a) - rank(b) ||
        b.relevanceScore - a.relevanceScore;
    });

    closed.sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    );

    results = [...active, ...closed];

    res.json({
      success: true,

      totalResults: results.length,

      searchWindow: {
        start: window.start,
        end: window.end
      },

      dateRule:
        "Based on application opening date, not closing date. " +
        "Earlier-opening applications still open today are also included.",

      selectedRegion: region,

      searchedSubject:
        subject || "Mathematics and data-related fields",

      searchCategories: queries.map(
        query => query.type
      ),

      counts: {
        openNow: results.filter(
          r => r.applicationStatus.startsWith("OPEN NOW")
        ).length,

        openingSoon: results.filter(
          r => r.applicationStatus === "OPENING SOON"
        ).length,

        possiblyOpen: results.filter(
          r => r.applicationStatus.startsWith("Possibly open")
        ).length,

        datesUnconfirmed: results.filter(
          r => r.applicationStatus === "Application dates not confirmed"
        ).length,

        closed: closed.length
      },

      failedSearches,

      notice:
        "These are discovery leads, not verified scholarship offers. " +
        "Check official pages for opening dates, deadlines, eligibility, " +
        "fees, tuition and English requirements. Unknown details are not assumed.",

      results
    });

  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      success: false,
      error: "The search could not be completed.",
      details: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Page not found"
  });
});

app.listen(PORT, () => {
  console.log(
    `Scholarship Finder running on port ${PORT}`
  );
});
