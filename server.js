import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Scholarship Finder server is running"
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q || "";

    if (!query.trim()) {
      return res.status(400).json({
        error: "Please enter a search term."
      });
    }

    res.json({
      success: true,
      query,
      message:
        "Search service is ready. Live scholarship searching will be connected next."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Search failed."
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`Scholarship Finder running on port ${PORT}`);
});
