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

const TAVILY_URL = "https://api.tavily.com/search";

const DESTINATIONS = {
  europe: [
    "Europe", "Germany", "France", "Italy", "Switzerland",
    "Netherlands", "Sweden", "Norway", "Finland", "Denmark",
    "Belgium", "Austria", "Spain", "Portugal", "Ireland",
    "United Kingdom", "Poland", "Czech Republic", "Hungary",
    "Estonia", "Latvia", "Lithuania", "Greece", "Romania"
  ],
  usa: ["United States", "USA", "United States of America"],
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
    end: end.toISOString().slice(0, 10)
  };
}

function getDestinations(region) {
  if (region === "all") {
    return [
      "Europe",
      "United States",
      "Canada",
      "Australia"
    ];
  }

  return DESTINATIONS[region] || [
    "Europe",
    "United States",
    "Canada",
    "Australia"
  ];
}

function buildQueries(subject, region, window) {
  const destinations = getDestinations(region).join(", ");

  const subjectText = subject || 
    "Mathematics, Mathematics Education, Applied Mathematics, Statistics, Data Science, Data Analytics, Computational Mathematics, Operations Research and Mathematical Sciences";

  const period = `application deadlines between ${window.start} and ${window.end}`;

  return [
    {
      type: "official university opportunities",
      query:
        `Official university Master's scholarships and funded programmes in ${subjectText}. ` +
        `Destinations: ${destinations}. International students. ` +
        `${period}. Include tuition fees, application fees and English language requirements where available.`
    },
    {
      type: "government and major scholarships",
      query:
        `Government scholarships and fully funded Master's scholarships in ` +
        `${subjectText} for international students in ${destinations}. ` +
        `${period}. Include eligibility for international applicants and official application pages.`
    },
    {
      type: "European scholarship programmes",
      query:
        `Erasmus Mundus Joint Masters, DAAD and other European Master's scholarships ` +
        `in ${subjectText}. International applicants. ${period}. Official programme websites.`
    },
    {
      type: "English language alternatives",
      query:
        `Master's scholarships in ${subjectText} in ${destinations} accepting ` +
        `Medium of Instruction certificates, English-taught previous degrees, or English waivers. ` +
        `Also include programmes requiring IELTS or TOEFL. ${period}.`
    },
    {
      type: "application fees and tuition",
      query:
        `International Master's scholarships in ${subjectText} in ${destinations}. ` +
        `Find official information about application fees, application fee waivers, ` +
        `annual tuition fees and scholarship coverage. ${period}.`
    }
  ];
}

async function tavilySearch(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(TAVILY_URL, {
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
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        data?.error ||
        `Tavily returned HTTP ${response.status}`
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
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(url || "").toLowerCase();
  }
}

function getCountry(text) {
  const value = text.toLowerCase();

  const countries = [
    "United States", "USA", "Canada", "Australia",
    "Germany", "France", "Italy", "Switzerland",
    "Netherlands", "Sweden", "Norway", "Finland",
    "Denmark", "Belgium", "Austria", "Spain",
    "Portugal", "Ireland", "United Kingdom",
    "Poland", "Czech Republic", "Hungary",
    "Estonia", "Latvia", "Lithuania", "Greece",
    "Romania"
  ];

  for (const country of countries) {
    if (value.includes(country.toLowerCase())) {
      return country;
    }
  }

  return "Not identified";
}

function getRegion(country) {
  if (["United States", "USA"].includes(country)) {
    return "USA";
  }

  if (country === "Canada") return "Canada";
  if (country === "Australia") return "Australia";

  if (
    country !== "Not identified" &&
    country !== "United States"
  ) {
    return "Europe";
  }

  return "Not identified";
}

function getApplicationFee(text) {
  const value = text.toLowerCase();

  if (
    /no application fee|application is free|free application|without application fee|no fee to apply/.test(value)
  ) {
    return "No application fee reported — verify on official page";
  }

  if (
    /application fee waiver|waiver of the application fee|fee waiver available/.test(value)
  ) {
    return "Fee waiver reported — check eligibility";
  }

  if (
    /application fee|required application fee|application fee of|pay an application fee/.test(value)
  ) {
    return "Application fee reported — amount needs verification";
  }

  return "Unknown — not confirmed";
}

function getEnglishStatus(text) {
  const value = text.toLowerCase();

  if (
    /medium of instruction|moI certificate|medium-of-instruction|english language waiver|waiver of english|previous degree taught in english/.test(value)
  ) {
    return "MOI or English waiver mentioned — verify";
  }

  if (
    /ielts|toefl/.test(value)
  ) {
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

function getDeadline(text) {
  const value = text.toLowerCase();

  const patterns = [
    /(?:application deadline|deadline|apply by|applications close|closing date)[^.!?]{0,100}/gi
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      return matches.slice(0, 2).join(" | ");
    }
  }

  return "Not confirmed";
}

function isClearlyExpired(deadlineText) {
  const value = deadlineText.toLowerCase();

  const dateMatch = value.match(
    /\b(?:deadline|apply by|applications close|closing date)[^.!?]*?(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d{2})/i
  );

  if (!dateMatch) return false;

  const parsed = new Date(dateMatch[1]);

  if (Number.isNaN(parsed.getTime())) return false;

  return parsed < new Date();
}

function scoreResult(item) {
  const text = (
    item.title + " " +
    item.content + " " +
    item.url
  ).toLowerCase();

  let score = 0;

  if (/master|master's|msc|m\.sc|ma degree/.test(text)) score += 5;
  if (/scholarship|funded|funding|stipend/.test(text)) score += 4;
  if (/mathematics|statistics|data science|analytics/.test(text)) score += 5;
  if (/international students|international applicants/.test(text)) score += 2;
  if (/application deadline|apply by|closing date/.test(text)) score += 2;
  if (/ielts|toefl|medium of instruction/.test(text)) score += 1;

  if (/phd|doctoral|undergraduate|bachelor's only/.test(text)) score -= 5;

  return score;
}

function createResult(item, searchType) {
  const title = cleanText(item.title);
  const content = cleanText(item.content);
  const url = cleanText(item.url);
  const combined = `${title} ${content}`;

  let host = "Source not identified";

  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Keep fallback.
  }

  const country = getCountry(`${combined} ${url}`);
  const deadline = getDeadline(combined);

  return {
    programme: title || "Programme title not identified",
    university: host,
    country,
    region: getRegion(country),
    start: "Not confirmed",
    deadline,
    tuition: getTuition(combined),
    scholarship: getScholarship(combined),
    english: getEnglishStatus(combined),
    applicationFee: getApplicationFee(combined),
    officialLink: url,
    sourceLink: url,
    description: content,
    searchCategory: searchType,
    verification: "Unverified search result",
    expired: isClearlyExpired(deadline),
    relevanceScore: scoreResult(item)
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
        error: "Tavily API key is missing. Add TAVILY_API_KEY in Render environment variables."
      });
    }

    const subject = cleanText(req.query.q || "");
    const region = cleanText(req.query.region || "all").toLowerCase();

    const allowedRegions = ["all", "europe", "usa", "canada", "australia"];

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

    const searchResponses = await Promise.all(
      queries.map(async (search) => {
        try {
          const results = await tavilySearch(search.query);

          return results.map((item) => ({
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

    const successfulResults = searchResponses
      .flat()
      .filter((entry) => entry.item);

    const failedSearches = searchResponses
      .flat()
      .filter((entry) => entry.error)
      .map((entry) => ({
        category: entry.searchType,
        error: entry.error
      }));

    const unique = new Map();

    for (const entry of successfulResults) {
      const result = createResult(
        entry.item,
        entry.searchType
      );

      const key = normaliseUrl(result.sourceLink);

      if (!key || unique.has(key)) continue;

      unique.set(key, result);
    }

    let results = Array.from(unique.values());

    // Remove results that are clearly outside the selected region.
    if (region !== "all") {
      const allowedCountries = getDestinations(region)
        .map((country) => country.toLowerCase());

      results = results.filter((result) => {
        if (result.country === "Not identified") return true;

        return allowedCountries.some((country) =>
          result.country.toLowerCase().includes(country)
        );
      });
    }

    // Clearly expired deadlines are moved to the bottom,
    // rather than silently deleting potentially useful pages.
    results.sort((a, b) => {
      if (a.expired !== b.expired) {
        return a.expired ? 1 : -1;
      }

      return b.relevanceScore - a.relevanceScore;
    });

    res.json({
      success: true,
      totalResults: results.length,
      searchWindow: window,
      selectedRegion: region,
      searchedSubject: subject || "Mathematics and data-related fields",
      searchCategories: queries.map((query) => query.type),
      failedSearches,
      notice:
        "These are discovery leads, not verified scholarship offers. " +
        "Check the official university or scholarship provider page before applying. " +
        "Unknown information is not assumed or invented.",
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
  console.log(`Scholarship Finder running on port ${PORT}`);
});
