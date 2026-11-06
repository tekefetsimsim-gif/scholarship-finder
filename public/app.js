const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultsContainer = document.getElementById("resultsContainer");
const resultCount = document.getElementById("resultCount");

const regionFilter = document.getElementById("region");
const englishFilter = document.getElementById("english");
const applicationFeeFilter = document.getElementById("applicationFee");
const tuitionFilter = document.getElementById("tuition");

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
    const params = new URLSearchParams({
      q: searchTerm,
      region: regionFilter.value,
      english: englishFilter.value,
      applicationFee: applicationFeeFilter.value,
      tuition: tuitionFilter.value
    });

    const response = await fetch(`/api/search?${params}`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Search failed.");
    }

    displayResults(data);

  } catch (error) {
    console.error(error);

    resultsContainer.innerHTML = `
      <div class="error">
        <strong>Search unavailable</strong>
        <p>
          ${escapeHTML(error.message)}
        </p>
      </div>
    `;

    resultCount.textContent = "Search failed.";
  }
}


function displayResults(data) {

  if (data.results && data.results.length > 0) {

    resultCount.textContent =
      `${data.results.length} opportunities found`;

    resultsContainer.innerHTML = "";

    data.results.forEach(result => {
      resultsContainer.appendChild(createScholarshipCard(result));
    });

    return;
  }

  resultCount.textContent =
    "No verified opportunities found yet.";

  resultsContainer.innerHTML = `
    <div class="welcome-card">

      <div class="icon">🔎</div>

      <h3>No results yet</h3>

      <p>
        We couldn't find matching opportunities from the
        connected sources.
      </p>

    </div>
  `;
}


function createScholarshipCard(result) {

  const card = document.createElement("article");

  card.className = "scholarship-card";

  card.innerHTML = `
    <div class="card-top">

      <span class="country">
        ${escapeHTML(result.country || "Country not confirmed")}
      </span>

      <span class="fee-status">
        ${escapeHTML(result.applicationFee || "Fee unknown")}
      </span>

    </div>

    <h3>
      ${escapeHTML(result.programme || "Programme name unavailable")}
    </h3>

    <p class="university">
      ${escapeHTML(result.university || "University not confirmed")}
    </p>

    <div class="details">

      <div>
        <strong>Programme start</strong>
        <span>
          ${escapeHTML(result.start || "Not confirmed")}
        </span>
      </div>

      <div>
        <strong>Deadline</strong>
        <span>
          ${escapeHTML(result.deadline || "Not confirmed")}
        </span>
      </div>

      <div>
        <strong>Tuition</strong>
        <span>
          ${escapeHTML(result.tuition || "Not confirmed")}
        </span>
      </div>

      <div>
        <strong>Scholarship</strong>
        <span>
          ${escapeHTML(result.scholarship || "Not confirmed")}
        </span>
      </div>

      <div>
        <strong>English requirement</strong>
        <span>
          ${escapeHTML(result.english || "Not confirmed")}
        </span>
      </div>

      <div>
        <strong>Application fee</strong>
        <span>
          ${escapeHTML(result.applicationFee || "Not confirmed")}
        </span>
      </div>

    </div>

    <div class="card-actions">

      ${
        result.officialLink
          ? `
            <a
              href="${escapeAttribute(result.officialLink)}"
              target="_blank"
              rel="noopener noreferrer"
              class="official-link"
            >
              Official website
            </a>
          `
          : ""
      }

      ${
        result.sourceLink
          ? `
            <a
              href="${escapeAttribute(result.sourceLink)}"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link"
            >
              Source
            </a>
          `
          : ""
      }

    </div>
  `;

  return card;
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


searchButton.addEventListener("click", () => {
  searchScholarships(searchInput.value);
});


searchInput.addEventListener("keydown", event => {

  if (event.key === "Enter") {
    searchScholarships(searchInput.value);
  }

});


document.querySelectorAll(".quick-filters button")
  .forEach(button => {

    button.addEventListener("click", () => {

      const query = button.dataset.query;

      searchInput.value = query;

      searchScholarships(query);

    });

  });


[
  regionFilter,
  englishFilter,
  applicationFeeFilter,
  tuitionFilter
].forEach(filter => {

  filter.addEventListener("change", () => {

    if (searchInput.value.trim()) {
      searchScholarships(searchInput.value);
    }

  });

});
