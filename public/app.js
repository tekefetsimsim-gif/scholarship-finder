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
      Searching for scholarship opportunities...
    </div>
  `;

  resultCount.textContent = "Searching...";

  try {
    const params = new URLSearchParams();

    params.set("q", searchTerm);
    params.set("region", regionFilter.value);
    params.set("_", Date.now());

    const response = await fetch(`/api/search?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (jsonError) {
      throw new Error(
        "The server returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || `Search failed with status ${response.status}.`
      );
    }

    if (!data.success) {
      throw new Error(
        data.error || "Search failed."
      );
    }

    allResults = Array.isArray(data.results)
      ? data.results
      : [];

    lastSearchData = data;

    displayResults();

  } catch (error) {
    console.error("Scholarship search error:", error);

    resultsContainer.innerHTML = `
      <div class="error">
        <strong>Search unavailable</strong>

        <p>
          ${escapeHTML(error.message)}
        </p>

        <p>
          Please try again in a moment.
        </p>
      </div>
    `;

    resultCount.textContent = "Search failed.";
  }
}

function displayResults() {
  const results = filterResults(allResults);

  const data = lastSearchData || {};

  const searchWindow = data.searchWindow || {};
  const counts = data.counts || {};

  if (results.length === 0) {
    resultCount.textContent =
      "No opportunities match these filters.";

    resultsContainer.innerHTML = `
      <div class="welcome-card">
        <div class="icon">🔎</div>

        <h3>No matching results</h3>

        <p>
          Try changing the filters or searching another subject.
        </p>
      </div>
    `;

    return;
  }

  resultCount.innerHTML = `
    <strong>${results.length} opportunities displayed</strong>

    <br>

    Search window:
    ${escapeHTML(searchWindow.start || "Not available")}
    to
    ${escapeHTML(searchWindow.end || "Not available")}

    <br>

    Open now:
    ${counts.openNow || 0}

    · Opening soon:
    ${counts.openingSoon || 0}

    · Possibly open:
    ${counts.possiblyOpen || 0}
  `;

  resultsContainer.innerHTML = "";

  const notice = document.createElement("div");

  notice.className = "date-rule-notice";

  notice.textContent =
    "Results are selected by application opening date, not closing date. " +
    "Applications opened earlier may also appear if they remain open.";

  resultsContainer.appendChild(notice);

  results.forEach(result => {
    resultsContainer.appendChild(
      createScholarshipCard(result)
    );
  });
}

function filterResults(results) {
  let filtered = [...results];

  const english = englishFilter.value;
  const fee = applicationFeeFilter.value;
  const tuition = tuitionFilter.value;

  if (english === "moi") {
    filtered = filtered.filter(result =>
      /moi|medium of instruction/i.test(
        result.english || ""
      )
    );
  }

  if (english === "waiver") {
    filtered = filtered.filter(result =>
      /waiver/i.test(
        result.english || ""
      )
    );
  }

  if (english === "required") {
    filtered = filtered.filter(result =>
      /ielts|toefl/i.test(
        result.english || ""
      )
    );
  }

  if (fee === "free") {
    filtered = filtered.filter(result =>
      /no application fee/i.test(
        result.applicationFee || ""
      )
    );
  }

  if (fee === "waiver") {
    filtered = filtered.filter(result =>
      /fee waiver/i.test(
        result.applicationFee || ""
      )
    );
  }

  if (fee === "unknown") {
    filtered = filtered.filter(result =>
      /unknown|not confirmed/i.test(
        result.applicationFee || ""
      )
    );
  }

  if (fee === "required") {
    filtered = filtered.filter(result =>
      /application fee reported/i.test(
        result.applicationFee || ""
      )
    );
  }

  if (tuition === "scholarship") {
    filtered = filtered.filter(result =>
      /scholarship|funded|stipend|tuition waiver/i.test(
        result.scholarship || ""
      )
    );
  }

  if (tuition === "under5000") {
    filtered = filtered.filter(result =>
      hasConfirmedLowTuition(
        result.tuition || ""
      )
    );
  }

  filtered.sort((a, b) => {
    return englishRank(a) - englishRank(b);
  });

  return filtered;
}

function englishRank(result) {
  const value =
    (result.english || "").toLowerCase();

  if (
    /moi|medium of instruction/.test(value)
  ) {
    return 0;
  }

  if (/waiver/.test(value)) {
    return 1;
  }

  if (/ielts|toefl/.test(value)) {
    return 2;
  }

  return 3;
}

function hasConfirmedLowTuition(value) {
  const text = value.toLowerCase();

  const matches = text.match(
    /(?:usd|us\$|\$)\s*([0-9,]+(?:\.\d+)?)/g
  );

  if (!matches) {
    return false;
  }

  return matches.some(match => {
    const number = Number(
      match.replace(/[^0-9.]/g, "")
    );

    return number > 0 && number < 5000;
  });
}

function createScholarshipCard(result) {
  const card =
    document.createElement("article");

  card.className =
    "scholarship-card";

  const status =
    result.applicationStatus ||
    "Application dates not confirmed";

  let statusClass =
    "status-unknown";

  if (
    status.startsWith("OPEN NOW")
  ) {
    statusClass =
      "status-open";
  } else if (
    status === "OPENING SOON"
  ) {
    statusClass =
      "status-upcoming";
  } else if (
    status.startsWith("CLOSED")
  ) {
    statusClass =
      "status-closed";
  }

  card.innerHTML = `
    <div class="card-top">

      <span class="country">
        ${escapeHTML(
          result.country ||
          "Country not confirmed"
        )}
      </span>

      <span class="fee-status">
        ${escapeHTML(
          result.applicationFee ||
          "Fee unknown"
        )}
      </span>

    </div>

    <div class="application-status ${statusClass}">
      ${escapeHTML(status)}
    </div>

    <h3>
      ${escapeHTML(
        result.programme ||
        "Programme name unavailable"
      )}
    </h3>

    <p class="university">
      Source:
      ${escapeHTML(
        result.university ||
        "Not identified"
      )}
    </p>

    <div class="details">

      <div>
        <strong>Application opens</strong>

        <span>
          ${escapeHTML(
            result.applicationOpeningDate ||
            "Not confirmed"
          )}
        </span>
      </div>

      <div>
        <strong>Application closes</strong>

        <span>
          ${escapeHTML(
            result.applicationClosingDate ||
            result.deadline ||
            "Not confirmed"
          )}
        </span>
      </div>

      <div>
        <strong>Programme start</strong>

        <span>
          ${escapeHTML(
            result.start ||
            "Not confirmed"
          )}
        </span>
      </div>

      <div>
        <strong>Tuition</strong>

        <span>
          ${escapeHTML(
            result.tuition ||
            "Not confirmed"
          )}
        </span>
      </div>

      <div>
        <strong>Scholarship coverage</strong>

        <span>
          ${escapeHTML(
            result.scholarship ||
            "Not confirmed"
          )}
        </span>
      </div>

      <div>
        <strong>English requirement</strong>

        <span>
          ${escapeHTML(
            result.english ||
            "Not confirmed"
          )}
        </span>
      </div>

      <div>
        <strong>Application fee</strong>

        <span>
          ${escapeHTML(
            result.applicationFee ||
            "Not confirmed"
          )}
        </span>
      </div>

      <div>
        <strong>Source classification</strong>

        <span>
          ${escapeHTML(
            result.sourceType ||
            "Not confirmed"
          )}
        </span>
      </div>

    </div>

    <p class="description">
      ${escapeHTML(
        result.description ||
        "No description available."
      )}
    </p>

    <p class="verification">
      ${escapeHTML(
        result.verification ||
        "Check the source page before applying."
      )}
    </p>

    ${
      result.sourceLink
        ? `
          <div class="card-actions">

            <a
              href="${safeURL(result.sourceLink)}"
              target="_blank"
              rel="noopener noreferrer"
              class="official-link"
            >
              Open source page
            </a>

          </div>
        `
        : ""
    }
  `;

  return card;
}

function safeURL(url) {
  try {
    const parsed =
      new URL(url);

    if (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    ) {
      return escapeAttribute(
        parsed.href
      );
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

function escapeAttribute(value) {
  return escapeHTML(value)
    .replaceAll("`", "&#096;");
}

searchButton.addEventListener(
  "click",
  () => {
    searchScholarships(
      searchInput.value
    );
  }
);

searchInput.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      searchScholarships(
        searchInput.value
      );
    }
  }
);

document
  .querySelectorAll(
    ".quick-filters button"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const query =
          button.dataset.query;

        searchInput.value =
          query;

        searchScholarships(
          query
        );
      }
    );
  });

[
  englishFilter,
  applicationFeeFilter,
  tuitionFilter
].forEach(filter => {

  filter.addEventListener(
    "change",
    () => {

      if (lastSearchData) {
        displayResults();
      }

    }
  );

});

regionFilter.addEventListener(
  "change",
  () => {

    if (
      searchInput.value.trim()
    ) {
      searchScholarships(
        searchInput.value
      );
    }

  }
);
