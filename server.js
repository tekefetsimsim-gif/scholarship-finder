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

const PUBLIC_FOLDER = path.join(__dirname, "public");

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_FOLDER));


// Calculate the current month and following two months
function getSearchWindow() {
  const now = new Date();

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0)
  );

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}


// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Scholarship Finder server is running",
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY)
  });
});


// Search scholarships using Tavily
app.get("/api/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    const region = String(req.query.region || "all");
    const english = String(req.query.english || "all");
    const applicationFee = String(
      req.query.applicationFee || "all"
    );
    const tuition = String(req.query.tuition || "all");

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Please enter a subject or programme."
      });
    }

    if (!process.env.TAVILY_API_KEY) {
      return res.status(503).json({
        success: false,
        error: "The search provider has not been configured yet."
      });
    }

    const allowedRegions = [
      "all",
      "Europe",
      "USA",
      "Canada",
      "Australia"
    ];

    if (!allowedRegions.includes(region)) {
      return res.status(400).json({
        success: false,
        error: "Invalid region selected."
      });
    }

    const window = getSearchWindow();

    const regionText =
      region === "all"
        ? "Europe OR United States OR Canada OR Australia"
        : region;

    const searchQuery = `
      Master's degree scholarships and university admissions
      in ${query}
      for international students
      in ${regionText}.
      Include university scholarships, government scholarships,
      fully funded and partially funded opportunities.
      Find official university pages with application deadlines
      between ${window.start} and ${window.end}.
      Include tuition fees, scholarship coverage,
      application fees and English language requirements
      where available.
    `.replace(/\s+/g, " ").trim();

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 45000);

    let response;

    try {
      response = await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: searchQuery,
            search_depth: "advanced",
            topic: "general",
            max_results: 10,
            include_answer: false,
            include_raw_content: false
          }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error(
        "Tavily returned status:",
        response.status
      );

      return res.status(502).json({
        success: false,
        error: "The scholarship search provider returned an error."
      });
    }

    const data = await response.json();

    const results = (data.results || []).map(item => {
      let hostname = "";

      try {
        hostname = new URL(item.url).hostname;
      } catch {
        hostname = "";
      }

      return {
        title: item.title || "Untitled search result",

        university: hostname || "Source not identified",

        programme: query,

        country:
          region === "all"
            ? "Check source"
            : region,

        start: "Not confirmed",

        deadline: "Not confirmed",

        tuition: "Not confirmed",

        scholarship: "Check official source",

        english: "Not confirmed",

        applicationFee: "Not confirmed",

        snippet: item.content || "",

        officialLink: item.url || "",

        sourceLink: item.url || "",

        verification: "Unverified search result"
      };
    });

    res.json({
      success: true,
      query,
      searchWindow: window,
      filters: {
        region,
        english,
        applicationFee,
        tuition
      },
      totalResults: results.length,
      results,
      notice:
        "These are discovery results, not verified scholarship listings. Check official university pages before relying on deadlines, fees or eligibility."
    });

  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      success: false,
      error:
        error.name === "AbortError"
          ? "The search took too long. Please try again."
          : "An unexpected search error occurred."
    });
  }
});


// Handle unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found."
  });
});


// Serve website
app.use((req, res) => {
  res.sendFile(
    path.join(PUBLIC_FOLDER, "index.html")
  );
});


// Start server
app.listen(PORT, () => {
  console.log(
    `Scholarship Finder running on port ${PORT}`
  );
});
