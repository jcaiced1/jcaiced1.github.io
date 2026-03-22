const searchForm = document.getElementById("search-form");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const minMagnitudeInput = document.getElementById("min-magnitude");
const formMessage = document.getElementById("form-message");
const searchButton = document.getElementById("search-button");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const resultsList = document.getElementById("results-list");
const resultsSummary = document.getElementById("results-summary");
const pagination = document.getElementById("results-pagination");
const prevPageButton = document.getElementById("prev-page");
const nextPageButton = document.getElementById("next-page");
const pageIndicator = document.getElementById("page-indicator");

const oneDayMs = 24 * 60 * 60 * 1000;
const defaultEndDate = new Date();
const defaultStartDate = new Date(defaultEndDate.getTime() - (14 * oneDayMs));
const itemsPerPage = 6;

let map;
let markerLayer;
let activeFeatureId = "";
const featureIndex = new Map();
let allFeatures = [];
let currentPage = 1;

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

function getMagnitudeColor(magnitude) {
  if (magnitude >= 6) {
    return "#cb4b16";
  }

  if (magnitude >= 5) {
    return "#e97a1f";
  }

  if (magnitude >= 4) {
    return "#f59e0b";
  }

  return "#f5b942";
}

function getMarkerRadius(magnitude) {
  return Math.max(6, Math.min(20, (magnitude || 0) * 2.2));
}

function clearResults() {
  resultsList.innerHTML = "";
  featureIndex.clear();
  activeFeatureId = "";
  allFeatures = [];
  currentPage = 1;
  pagination.classList.add("hidden");

  if (markerLayer) {
    markerLayer.clearLayers();
  }
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

function buildPopup(feature) {
  const { mag, place, time } = feature.properties;

  return `
    <div>
      <p class="popup-title">M ${mag ?? "N/A"} • ${place || "Unknown location"}</p>
      <p class="popup-copy">${formatEventTime(time)}</p>
    </div>
  `;
}

function setActiveFeature(featureId, shouldPan = false) {
  activeFeatureId = featureId;

  featureIndex.forEach(({ item, marker, feature }) => {
    const isActive = feature.id === featureId;
    if (item) {
      item.classList.toggle("active", isActive);
    }

    marker.setStyle({
      weight: isActive ? 3 : 1.5,
      fillOpacity: isActive ? 0.95 : 0.82,
    });

    if (isActive) {
      if (item) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      marker.openPopup();
    }
  });
}

function buildListItem(feature) {
  const [longitude, latitude, depth] = feature.geometry.coordinates;
  const { mag, place, time, url } = feature.properties;
  const item = document.createElement("article");
  item.className = "quake-item";
  item.tabIndex = 0;
  item.dataset.featureId = feature.id;
  item.innerHTML = `
    <div class="quake-topline">
      <div>
        <h3 class="quake-location">${place || "Unknown location"}</h3>
        <p class="quake-time">${formatEventTime(time)}</p>
      </div>
      <div class="magnitude-badge">${mag ?? "N/A"}</div>
    </div>
    <div class="quake-meta-row">
      <span class="quake-meta">Depth ${typeof depth === "number" ? `${depth.toFixed(1)} km` : "N/A"}</span>
      <span class="quake-meta">Lat ${latitude.toFixed(2)}</span>
      <span class="quake-meta">Lng ${longitude.toFixed(2)}</span>
    </div>
    <a class="quake-link" href="${url}" target="_blank" rel="noreferrer">View USGS event</a>
  `;

  item.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      return;
    }

    setActiveFeature(feature.id, true);
  });
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveFeature(feature.id, true);
    }
  });

  return item;
}

function addFeatureToMap(feature, item) {
  const [longitude, latitude] = feature.geometry.coordinates;
  const magnitude = feature.properties.mag || 0;

  const marker = L.circleMarker([latitude, longitude], {
    radius: getMarkerRadius(magnitude),
    color: "#ffffff",
    weight: 1.5,
    fillColor: getMagnitudeColor(magnitude),
    fillOpacity: 0.82,
  });

  marker.bindPopup(buildPopup(feature));
  marker.addTo(markerLayer);

  marker.on("click", () => {
    setActiveFeature(feature.id, false);
  });

  featureIndex.set(feature.id, { feature, item, marker });
}

function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(allFeatures.length / itemsPerPage));
  pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
  pagination.classList.toggle("hidden", allFeatures.length <= itemsPerPage);
}

function renderPage(pageNumber) {
  resultsList.innerHTML = "";

  if (!allFeatures.length) {
    updatePagination();
    return;
  }

  const totalPages = Math.ceil(allFeatures.length / itemsPerPage);
  currentPage = Math.min(Math.max(pageNumber, 1), totalPages);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageFeatures = allFeatures.slice(startIndex, startIndex + itemsPerPage);

  pageFeatures.forEach((feature) => {
    const entry = featureIndex.get(feature.id);
    if (!entry) {
      return;
    }

    entry.item = buildListItem(feature);
    resultsList.appendChild(entry.item);
  });

  featureIndex.forEach((entry) => {
    const item = resultsList.querySelector(`[data-feature-id="${entry.feature.id}"]`);
    if (item) {
      entry.item = item;
      item.classList.toggle("active", entry.feature.id === activeFeatureId);
    } else {
      entry.item = null;
    }
  });

  updatePagination();

  const pageHasActiveFeature = pageFeatures.some((feature) => feature.id === activeFeatureId);
  if (!pageHasActiveFeature && pageFeatures.length) {
    setActiveFeature(pageFeatures[0].id, false);
  }
}

function renderMap(features) {
  const bounds = [];

  features.forEach((feature) => {
    addFeatureToMap(feature, null);
    const [longitude, latitude] = feature.geometry.coordinates;
    bounds.push([latitude, longitude]);
  });

  if (bounds.length === 1) {
    if (map) {
      map.setView(bounds[0], 2);
    }
    return;
  }

  if (map) {
    map.fitBounds(bounds, {
      padding: [30, 30],
      maxZoom: 2,
    });
  }
}

function renderResults(features, startDate, endDate, minMagnitude) {
  clearResults();

  if (!features.length) {
    emptyState.classList.remove("hidden");
    resultsSummary.textContent = `No earthquakes matched ${startDate} to ${endDate} at magnitude ${minMagnitude}+`;
    if (map) {
      map.setView([20, 0], 2);
    }
    return;
  }

  emptyState.classList.add("hidden");
  resultsSummary.textContent = `Showing ${features.length} earthquakes from ${startDate} to ${endDate} with magnitude ${minMagnitude}+`;
  allFeatures = features;
  renderMap(features);
  renderPage(1);
  setActiveFeature(features[0].id, false);
}

async function fetchEarthquakes(startDate, endDate, minMagnitude) {
  const endpoint = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  endpoint.searchParams.set("format", "geojson");
  endpoint.searchParams.set("starttime", startDate);
  endpoint.searchParams.set("endtime", endDate);
  endpoint.searchParams.set("minmagnitude", String(minMagnitude));
  endpoint.searchParams.set("orderby", "time");
  endpoint.searchParams.set("limit", "30");

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
    clearResults();
    emptyState.classList.remove("hidden");
    resultsSummary.textContent = "Unable to load earthquake data right now.";
    setMessage(error.message, "error");
    if (map) {
      map.setView([20, 0], 2);
    }
  } finally {
    toggleLoading(false);
  }
}

function initMap() {
  if (typeof L === "undefined") {
    resultsSummary.textContent = "Map library could not be loaded.";
    setMessage("The map could not be initialized. Check your internet connection.", "error");
    return;
  }

  map = L.map("map", {
    worldCopyJump: true,
    minZoom: 2,
  }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

function initDefaults() {
  endDateInput.value = formatDateInput(defaultEndDate);
  startDateInput.value = formatDateInput(defaultStartDate);
}

initMap();
initDefaults();
searchForm.addEventListener("submit", handleSearch);
prevPageButton.addEventListener("click", () => {
  renderPage(currentPage - 1);
});
nextPageButton.addEventListener("click", () => {
  renderPage(currentPage + 1);
});
