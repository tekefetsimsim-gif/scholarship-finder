const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultsContainer = document.getElementById("resultsContainer");
const resultCount = document.getElementById("resultCount");

const regionFilter = document.getElementById("region");
const englishFilter = document.getElementById("english");
const applicationFeeFilter = document.getElementById("applicationFee");
const tuitionFilter = document.getElementById("tuition");

let allResults = [];
let lastSearchData = null;

async function searchScholarships(query) {
  const searchTerm = query.trim();

  if (!searchTerm) {
    resultCount.textContent = "Please enter a subject or programme.";
    return;
  }

  resultsContainer.innerHTML = `
    <div class="loading">
      Searching for programmes and checking official university pages...
    </div>
  `;

  resultCount.textContent = "Searching and verifying official sources...";

  try {
    const params = new URLSearchParams({
      q: searchTerm,
      region: regionFilter.value,
      _: Date.now()
    });

    const response = await fetch(`/api/search?${params}`, {
      method: "GET",
      cache: "no-store"
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Search failed (${response.status}).`);
    }

    allResults = Array.isArray(data.results) ? data.results : [];
    lastSearchData = data;

    displayResults();

  } catch (error) {
    console.error("Search error:", error);

    resultsContainer.innerHTML = `
      <div class="error">
        <strong>Search unavailable</strong>
        <p>${escapeHTML(error.message)}</p>
        <p>Please try again shortly.</p>
      </div>
    `;

    resultCount.textContent = "Search failed.";
  }
}

function displayResults() {
  const results = filterResults(allResults);
  const data = lastSearchData || {};
  const counts = data.counts || {};
  const window = data.searchWindow || {};

  resultCount.innerHTML = `
    <strong>${results.length} opportunities displayed</strong><br>
    Search window: ${escapeHTML(window.start || "Not available")}
    to ${escapeHTML(window.end || "Not available")}<br>
    Verified official pages: ${counts.verified || 0}
    · Partially verified: ${counts.partiallyVerified || 0}
    · Not verified: ${counts.notVerified || 0}
  `;

  resultsContainer.innerHTML = "";

  const notice = document.createElement("div");
  notice.className = "date-rule-notice";

  notice.textContent =
    "Results are selected by application opening date, not closing date. Official university/programme links are checked separately from discovery sources. Funding and eligibility must still be confirmed on the official page.";

  resultsContainer.appendChild(notice);

  if (!results.length) {
    const empty = document.createElement("div");

    empty.className = "welcome-card";

    empty.innerHTML = `
      <h3>No matching opportunities found</h3>
      <p>Try another subject or change the filters.</p>
    `;

    resultsContainer.appendChild(empty);
    return;
  }

  results.forEach(result => {
    resultsContainer.appendChild(createCard(result));
  });
}

function filterResults(results) {
  let filtered = [...results];

  const english = englishFilter.value;
  const fee = applicationFeeFilter.value;
  const tuition = tuitionFilter.value;

  if (english === "moi") {
    filtered = filtered.filter(result =>
      /moi|medium of instruction/i.test(result.english || "")
    );
  }

  if (english === "waiver") {
    filtered = filtered.filter(result =>
      /waiver/i.test(result.english || "")
    );
  }

  if (english === "required") {
    filtered = filtered.filter(result =>
      /ielts|toefl/i.test(result.english || "")
    );
  }

  if (fee === "free") {
    filtered = filtered.filter(result =>
      /no application fee/i.test(result.applicationFee || "")
    );
  }

  if (fee === "waiver") {
    filtered = filtered.filter(result =>
      /fee waiver/i.test(result.applicationFee || "")
    );
  }

  if (fee === "unknown") {
    filtered = filtered.filter(result =>
      /unknown|not confirmed/i.test(result.applicationFee || "")
    );
  }

  if (fee === "required") {
    filtered = filtered.filter(result =>
      /application fee required|fee mentioned/i.test(result.applicationFee || "")
    );
  }

  if (tuition === "scholarship") {
    filtered = filtered.filter(result =>
      /fully funded|partial|scholarship|waiver/i.test(result.fundingStatus || "")
    );
  }

  if (tuition === "under5000") {
    filtered = filtered.filter(result =>
      hasConfirmedLowTuition(result.tuition || "")
    );
  }

  filtered.sort((a, b) => englishRank(a) - englishRank(b));

  return filtered;
}

function englishRank(result) {
  const value = (result.english || "").toLowerCase();

  if (/moi|medium of instruction/.test(value)) return 0;
  if (/waiver/.test(value)) return 1;
  if (/ielts|toefl/.test(value)) return 2;

  return 3;
}

function hasConfirmedLowTuition(value) {
  const matches = value.match(/(?:usd|us\$|\$)\s*([0-9,]+(?:\.\d+)?)/gi);

  if (!matches) return false;

  return matches.some(match => {
    const amount = Number(match.replace(/[^0-9.]/g, ""));

    return amount > 0 && amount < 5000;
  });
}

function createCard(result) {
  const card = document.createElement("article");

  card.className = "scholarship-card";

  const status = result.applicationStatus || "Dates unconfirmed";

  let statusClass = "status-unknown";

  if (status.startsWith("OPEN NOW")) {
    statusClass = "status-open";
  } else if (
    status.startsWith("OPENING SOON") ||
    status.startsWith("CLOSING SOON")
  ) {
    statusClass = "status-upcoming";
  } else if (status.startsWith("CLOSED")) {
    statusClass = "status-closed";
  }

  const verification = result.verificationStatus || "Not checked";

  const verifyClass =
    verification === "Verified"
      ? "verified"
      : verification === "Partially verified"
        ? "partially-verified"
        : "not-verified";

  card.innerHTML = `
    <div class="card-top">
      <span class="country">
        ${escapeHTML(result.country || "Country not confirmed")}
      </span>

      <span class="fee-status">
        ${escapeHTML(result.applicationFee || "Fee unknown")}
      </span>
    </div>

    <div class="application-status ${statusClass}">
      ${escapeHTML(status)}
    </div>

    <h3>
      ${escapeHTML(result.programme || result.title || "Programme name unavailable")}
    </h3>

    <p class="university">
      University / institution:
      ${escapeHTML(result.institution || result.university || "Not identified")}
    </p>

    <p class="verification-status ${verifyClass}">
      Official-page check:
      <strong>${escapeHTML(verification)}</strong>
    </p>

    <div class="details">
      <div>
        <strong>Application opens</strong>
        <span>${escapeHTML(result.applicationOpeningDate || "Not confirmed")}</span>
      </div>

      <div>
        <strong>Application closes</strong>
        <span>${escapeHTML(result.applicationClosingDate || "Not confirmed")}</span>
      </div>

      <div>
        <strong>Programme start</strong>
        <span>${escapeHTML(result.programmeStart || result.start || "Not confirmed")}</span>
      </div>

      <div>
        <strong>Tuition</strong>
        <span>${escapeHTML(result.tuition || "Not confirmed")}</span>
      </div>

      <div>
        <strong>Funding category</strong>
        <span>${escapeHTML(result.fundingStatus || "Funding not confirmed")}</span>
      </div>

      <div>
        <strong>Scholarship coverage</strong>
        <span>${escapeHTML(result.scholarship || "Not confirmed")}</span>
      </div>

      <div>
        <strong>English requirement</strong>
        <span>${escapeHTML(result.english || "Not confirmed")}</span>
      </div>

      <div>
        <strong>Application fee</strong>
        <span>${escapeHTML(result.applicationFee || "Not confirmed")}</span>
      </div>
    </div>

    <p class="description">
      ${escapeHTML(result.description || "No description available.")}
    </p>

    <p class="verification">
      ${escapeHTML(result.verification || "Check the official source before applying.")}
    </p>

    <div class="card-actions">
      ${
        result.officialUniversityLink
          ? `
            <a
              href="${safeURL(result.officialUniversityLink)}"
              target="_blank"
              rel="noopener noreferrer"
              class="official-link"
            >
              Official university/programme website
            </a>
          `
          : `
            <span class="verification">
              Official university link not confirmed
            </span>
          `
      }

      ${
        result.sourceLink
          ? `
            <a
              href="${safeURL(result.sourceLink)}"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link"
            >
              Original discovery source
            </a>
          `
          : ""
      }
    </div>
  `;

  return card;
}

function safeURL(value) {
  try {
    const url = new URL(value);

    if (["https:", "http:"].includes(url.protocol)) {
      return escapeHTML(url.href);
    }

    return "#";

  } catch {
    return "#";
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

searchButton.addEventListener("click", () => {
  searchScholarships(searchInput.value);
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    searchScholarships(searchInput.value);
  }
});

document.querySelectorAll(".quick-filters button").forEach(button => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;
    searchScholarships(searchInput.value);
  });
});

[englishFilter, applicationFeeFilter, tuitionFilter].forEach(filter => {
  filter.addEventListener("change", () => {
    if (lastSearchData) {
      displayResults();
    }
  });
});

regionFilter.addEventListener("change", () => {
  if (searchInput.value.trim()) {
    searchScholarships(searchInput.value);
  }
});
