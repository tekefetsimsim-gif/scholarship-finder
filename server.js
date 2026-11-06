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

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.static(PUBLIC_FOLDER));


// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Scholarship Finder server is running",
    timestamp: new Date().toISOString()
  });
});


// Scholarship search endpoint
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

    // Live scholarship search will be connected here.
    // No sample or unverified scholarships are returned.

    return res.json({
      success: true,
      query,
      filters: {
        region,
        english,
        applicationFee,
        tuition
      },
      results: [],
      message:
        "The search interface is ready. A live scholarship data provider still needs to be connected."
    });

  } catch (error) {
    console.error("Scholarship search error:", error);

    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred during the search."
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


// Serve the website
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
