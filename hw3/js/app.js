const searchForm = document.getElementById("search-form");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const minMagnitudeInput = document.getElementById("min-magnitude");
const formMessage = document.getElementById("form-message");
const searchButton = document.getElementById("search-button");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const resultsGrid = document.getElementById("results-grid");
const resultsSummary = document.getElementById("results-summary");

const oneDayMs = 24 * 60 * 60 * 1000;
const defaultEndDate = new Date();
const defaultStartDate = new Date(defaultEndDate.getTime() - (14 * oneDayMs));

function formatDateInput(date) {
  return date.toISOString().split("T")[0];
}

function formatEventTime(timestamp) {
  return new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function setMessage(message, type = "") {
  formMessage.textContent = message;
  formMessage.className = "form-message";

  if (type) {
    formMessage.classList.add(type);
  }
}

function toggleLoading(isLoading) {
  loadingState.classList.toggle("hidden", !isLoading);
  searchButton.disabled = isLoading;
}

function clearResults() {
  resultsGrid.innerHTML = "";
}

function validateForm() {
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  const minMagnitude = Number(minMagnitudeInput.value);

  if (!startDate || !endDate || Number.isNaN(minMagnitudeInput.valueAsNumber)) {
    return "Please complete all form fields.";
  }

  if (minMagnitude < 0 || minMagnitude > 10) {
    return "Minimum magnitude must be between 0 and 10.";
  }

  if (startDate > endDate) {
    return "Start date must be earlier than or equal to the end date.";
  }

  const rangeDays = (new Date(endDate) - new Date(startDate)) / oneDayMs;
  if (rangeDays > 365) {
    return "Please keep the search range to 365 days or less.";
  }

  return "";
}

function buildCard(feature) {
  const { mag, place, time, url } = feature.properties;
  const depth = feature.geometry.coordinates[2];
  const card = document.createElement("article");
  card.className = "quake-card";
  card.innerHTML = `
    <div class="magnitude-pill">Magnitude ${mag ?? "N/A"}</div>
    <h3 class="result-location">${place || "Unknown location"}</h3>
    <p class="result-time">${formatEventTime(time)}</p>
    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Depth</span>
        ${typeof depth === "number" ? `${depth.toFixed(1)} km` : "Not available"}
      </div>
      <div class="meta-item">
        <span class="meta-label">Coordinates</span>
        ${feature.geometry.coordinates[1].toFixed(2)}, ${feature.geometry.coordinates[0].toFixed(2)}
      </div>
    </div>
    <a class="result-link" href="${url}" target="_blank" rel="noreferrer">View on USGS</a>
  `;

  return card;
}

function renderResults(features, startDate, endDate, minMagnitude) {
  clearResults();

  if (!features.length) {
    emptyState.classList.remove("hidden");
    resultsSummary.textContent = `No earthquakes matched ${startDate} to ${endDate} at magnitude ${minMagnitude}+`;
    return;
  }

  emptyState.classList.add("hidden");
  resultsSummary.textContent = `Showing ${features.length} earthquakes from ${startDate} to ${endDate} with magnitude ${minMagnitude}+`;

  features.forEach((feature) => {
    resultsGrid.appendChild(buildCard(feature));
  });
}

async function fetchEarthquakes(startDate, endDate, minMagnitude) {
  const endpoint = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  endpoint.searchParams.set("format", "geojson");
  endpoint.searchParams.set("starttime", startDate);
  endpoint.searchParams.set("endtime", endDate);
  endpoint.searchParams.set("minmagnitude", String(minMagnitude));
  endpoint.searchParams.set("orderby", "magnitude");
  endpoint.searchParams.set("limit", "12");

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`USGS request failed with status ${response.status}.`);
  }

  return response.json();
}

async function handleSearch(event) {
  event.preventDefault();

  const validationError = validateForm();
  if (validationError) {
    setMessage(validationError, "error");
    return;
  }

  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  const minMagnitude = Number(minMagnitudeInput.value).toFixed(1);

  setMessage("Fetching earthquake data...", "success");
  toggleLoading(true);
  emptyState.classList.add("hidden");
  clearResults();

  try {
    const data = await fetchEarthquakes(startDate, endDate, minMagnitude);
    const features = data.features || [];
    renderResults(features, startDate, endDate, minMagnitude);
    setMessage(`Loaded ${features.length} earthquake records.`, "success");
  } catch (error) {
    emptyState.classList.remove("hidden");
    resultsSummary.textContent = "Unable to load earthquake data right now.";
    setMessage(error.message, "error");
  } finally {
    toggleLoading(false);
  }
}

function initDefaults() {
  endDateInput.value = formatDateInput(defaultEndDate);
  startDateInput.value = formatDateInput(defaultStartDate);
}

initDefaults();
searchForm.addEventListener("submit", handleSearch);
