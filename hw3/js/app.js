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
const presetButtons = [...document.querySelectorAll(".preset-chip")];
const liveCard = document.getElementById("live-card");
const liveHeading = document.getElementById("live-heading");
const liveDetail = document.getElementById("live-detail");

const oneDayMs = 24 * 60 * 60 * 1000;
const oneHourMs = 60 * 60 * 1000;
const defaultEndDate = new Date();
const defaultStartDate = new Date(defaultEndDate.getTime() - (7 * oneDayMs));
const itemsPerPage = 6;
const batchLimit = 2000;

let map;
let markerLayer;
let activeFeatureId = "";
let allFeatures = [];
let currentPage = 1;
let activeQuery = null;
let startPicker = null;
let endPicker = null;
let liveFeature = null;
let liveMarker = null;

const featureIndex = new Map();

function formatDateInput(date) {
  return date.toISOString().split("T")[0];
}

function shouldUseCompactDatepicker() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function parseDateValue(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Boolean(parseDateValue(value));
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
  return Math.max(4, Math.min(15, (magnitude || 0) * 1.8));
}

function buildSearchParams(startDate, endDate, minMagnitude) {
  const params = new URLSearchParams();
  params.set("format", "geojson");
  params.set("starttime", startDate);
  params.set("endtime", endDate);
  params.set("minmagnitude", String(minMagnitude));
  params.set("orderby", "time");
  params.set("eventtype", "earthquake");
  return params;
}

function formatMagnitude(value) {
  return typeof value === "number" ? value.toFixed(1) : "N/A";
}

function getPageForFeature(featureId) {
  const index = allFeatures.findIndex((feature) => feature.id === featureId);
  if (index === -1) {
    return 1;
  }

  return Math.floor(index / itemsPerPage) + 1;
}

function clearResults() {
  resultsList.innerHTML = "";
  featureIndex.clear();
  activeFeatureId = "";
  allFeatures = [];
  currentPage = 1;
  activeQuery = null;
  pagination.classList.add("hidden");

  if (markerLayer) {
    markerLayer.clearLayers();
  }
}

function syncDateBounds() {
  const today = formatDateInput(defaultEndDate);

  startDateInput.max = endDateInput.value || today;
  endDateInput.min = startDateInput.value || "";
  endDateInput.max = today;

  if (startPicker) {
    startPicker.set("maxDate", endDateInput.value || today);
  }

  if (endPicker) {
    endPicker.set("minDate", startDateInput.value || null);
    endPicker.set("maxDate", today);
  }
}

function setPresetState(days) {
  presetButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.rangeDays) === days);
  });
}

function applyDateRange(days) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - ((days - 1) * oneDayMs));
  const formattedStartDate = formatDateInput(startDate);
  const formattedEndDate = formatDateInput(endDate);

  if (startPicker) {
    startPicker.setDate(formattedStartDate, true);
  } else {
    startDateInput.value = formattedStartDate;
  }

  if (endPicker) {
    endPicker.setDate(formattedEndDate, true);
  } else {
    endDateInput.value = formattedEndDate;
  }

  syncDateBounds();
  setPresetState(days);
}

function validateForm() {
  const startDate = startDateInput.value.trim();
  const endDate = endDateInput.value.trim();
  const minMagnitude = Number(minMagnitudeInput.value);

  if (!isValidDateValue(startDate) || !isValidDateValue(endDate) || Number.isNaN(minMagnitudeInput.valueAsNumber)) {
    return "Please complete all form fields with valid values.";
  }

  if (minMagnitude < 0 || minMagnitude > 10) {
    return "Minimum magnitude must be between 0 and 10.";
  }

  if (startDate > endDate) {
    return "Start date must be earlier than or equal to the end date.";
  }

  const rangeDays = (parseDateValue(endDate) - parseDateValue(startDate)) / oneDayMs;
  if (rangeDays > 365) {
    return "Please keep the search range to 365 days or less.";
  }

  return "";
}

function buildPopup(feature) {
  const { mag, place, time } = feature.properties;

  return `
    <div>
      <p class="popup-title">M ${formatMagnitude(mag)} • ${place || "Unknown location"}</p>
      <p class="popup-copy">${formatEventTime(time)}</p>
    </div>
  `;
}

function setActiveFeature(featureId) {
  activeFeatureId = featureId;

  featureIndex.forEach(({ item, marker, feature }) => {
    const isActive = feature.id === featureId;

    if (item) {
      item.classList.toggle("active", isActive);
    }

    marker.setStyle({
      radius: isActive ? getMarkerRadius(feature.properties.mag) + 2 : getMarkerRadius(feature.properties.mag),
      weight: isActive ? 3 : 1.5,
      fillOpacity: isActive ? 0.98 : 0.82,
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
      <div class="magnitude-badge">${formatMagnitude(mag)}</div>
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

    setActiveFeature(feature.id);
  });

  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveFeature(feature.id);
    }
  });

  return item;
}

function addFeatureToMap(feature) {
  const [longitude, latitude] = feature.geometry.coordinates;
  const magnitude = feature.properties.mag || 0;

  const marker = L.circleMarker([latitude, longitude], {
    radius: getMarkerRadius(magnitude),
    color: "#fff5e6",
    weight: 1.5,
    fillColor: getMagnitudeColor(magnitude),
    fillOpacity: 0.82,
  });

  marker.bindPopup(buildPopup(feature));
  marker.addTo(markerLayer);
  marker.on("click", () => {
    const targetPage = getPageForFeature(feature.id);
    if (targetPage !== currentPage) {
      renderPage(targetPage);
    }
    setActiveFeature(feature.id);
  });

  featureIndex.set(feature.id, { feature, item: null, marker });
}

function updateResultsSummary() {
  if (!activeQuery) {
    resultsSummary.textContent = "Run a search to populate the map and list.";
    return;
  }

  if (!allFeatures.length) {
    resultsSummary.textContent = `No earthquakes matched ${activeQuery.startDate} to ${activeQuery.endDate} at magnitude ${activeQuery.minMagnitude}+`;
    pageIndicator.textContent = "Page 1 of 1";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(allFeatures.length / itemsPerPage));
  const firstItem = ((currentPage - 1) * itemsPerPage) + 1;
  const lastItem = Math.min(currentPage * itemsPerPage, allFeatures.length);
  resultsSummary.textContent = `Showing ${firstItem}-${lastItem} of ${allFeatures.length} earthquakes from ${activeQuery.startDate} to ${activeQuery.endDate} at magnitude ${activeQuery.minMagnitude}+`;
  pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
}

function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(allFeatures.length / itemsPerPage));
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
  pagination.classList.toggle("hidden", allFeatures.length <= itemsPerPage);
  updateResultsSummary();
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

    const item = buildListItem(feature);
    entry.item = item;
    resultsList.appendChild(item);
  });

  featureIndex.forEach((entry) => {
    if (!entry.item) {
      return;
    }

    entry.item.classList.toggle("active", entry.feature.id === activeFeatureId);
  });

  updatePagination();

  const pageHasActiveFeature = pageFeatures.some((feature) => feature.id === activeFeatureId);
  if (!pageHasActiveFeature && pageFeatures.length) {
    setActiveFeature(pageFeatures[0].id);
  }
}

function renderMap(features) {
  const bounds = [];

  features.forEach((feature) => {
    addFeatureToMap(feature);
    const [longitude, latitude] = feature.geometry.coordinates;
    bounds.push([latitude, longitude]);
  });

  if (!map || !bounds.length) {
    return;
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 2);
    return;
  }

  map.fitBounds(bounds, {
    padding: [30, 30],
    maxZoom: 2,
  });

  if (liveFeature) {
    attachLiveMarker();
  }
}

function renderResults(features, queryDetails) {
  clearResults();
  activeQuery = queryDetails;

  if (!features.length) {
    emptyState.classList.remove("hidden");
    updateResultsSummary();
    if (map) {
      map.setView([20, 0], 2);
    }
    return;
  }

  emptyState.classList.add("hidden");
  allFeatures = features;
  renderMap(features);
  renderPage(1);
  setActiveFeature(features[0].id);
}

async function fetchEarthquakeCount(startDate, endDate, minMagnitude) {
  const endpoint = new URL("https://earthquake.usgs.gov/fdsnws/event/1/count");
  const params = buildSearchParams(startDate, endDate, minMagnitude);
  params.set("format", "geojson");
  endpoint.search = params.toString();
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`USGS count request failed with status ${response.status}.`);
  }

  const data = await response.json();
  return Number(data.count || 0);
}

async function fetchEarthquakeBatch(startDate, endDate, minMagnitude, offset, limit) {
  const endpoint = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  const params = buildSearchParams(startDate, endDate, minMagnitude);
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  endpoint.search = params.toString();

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`USGS data request failed with status ${response.status}.`);
  }

  return response.json();
}

async function fetchAllEarthquakes(startDate, endDate, minMagnitude) {
  const totalCount = await fetchEarthquakeCount(startDate, endDate, minMagnitude);

  if (!totalCount) {
    return [];
  }

  const features = [];

  for (let offset = 1; offset <= totalCount; offset += batchLimit) {
    const currentLimit = Math.min(batchLimit, totalCount - features.length);
    setMessage(`Fetching earthquake data... ${features.length}/${totalCount}`, "success");

    const batch = await fetchEarthquakeBatch(startDate, endDate, minMagnitude, offset, currentLimit);
    features.push(...(batch.features || []));
  }

  return features;
}

async function fetchLatestEarthquake() {
  const endpoint = new URL("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson");
  endpoint.searchParams.set("t", String(Date.now()));

  const response = await fetch(endpoint, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`USGS live feed failed with status ${response.status}.`);
  }

  const data = await response.json();
  return data.features?.[0] || null;
}

async function refreshLiveEarthquake() {
  try {
    const latest = await fetchLatestEarthquake();

    if (!latest) {
      liveFeature = null;
      if (liveMarker && map) {
        map.removeLayer(liveMarker);
        liveMarker = null;
      }
      liveHeading.textContent = "No earthquake reported in the last hour";
      liveDetail.textContent = "This live block checks the most recent USGS event from the past hour.";
      return;
    }

    liveFeature = latest;
    const magnitude = formatMagnitude(latest.properties.mag);
    const location = latest.properties.place || "Unknown location";
    liveHeading.textContent = `M ${magnitude} • ${location}`;
    liveDetail.textContent = `${formatEventTime(latest.properties.time)} • latest event from the USGS past-hour feed`;
    attachLiveMarker();
  } catch (error) {
    liveHeading.textContent = "Live feed unavailable right now";
    liveDetail.textContent = error.message;
  }
}

function attachLiveMarker() {
  if (!map || !liveFeature) {
    return;
  }

  if (liveMarker) {
    map.removeLayer(liveMarker);
  }

  const [longitude, latitude] = liveFeature.geometry.coordinates;
  const magnitude = liveFeature.properties.mag || 0;

  liveMarker = L.circleMarker([latitude, longitude], {
    radius: getMarkerRadius(magnitude) + 3,
    color: "#fff7e8",
    weight: 3,
    fillColor: "#ff7a18",
    fillOpacity: 0.95,
  });

  liveMarker.bindPopup(buildPopup(liveFeature));
  liveMarker.addTo(map);
}

function focusLiveEarthquake() {
  if (!liveFeature || !map) {
    return;
  }

  const targetPage = getPageForFeature(liveFeature.id);
  if (featureIndex.has(liveFeature.id) && targetPage !== currentPage) {
    renderPage(targetPage);
  }

  if (featureIndex.has(liveFeature.id)) {
    setActiveFeature(liveFeature.id);
  } else if (liveMarker) {
    const [longitude, latitude] = liveFeature.geometry.coordinates;
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 3), {
      duration: 0.7,
    });
    liveMarker.openPopup();
  }
}

async function handleSearch(event) {
  event.preventDefault();

  const validationError = validateForm();
  if (validationError) {
    setMessage(validationError, "error");
    return;
  }

  const startDate = startDateInput.value.trim();
  const endDate = endDateInput.value.trim();
  const minMagnitude = Number(minMagnitudeInput.value).toFixed(1);

  toggleLoading(true);
  setMessage("Fetching earthquake data...", "success");

  try {
    const features = await fetchAllEarthquakes(startDate, endDate, minMagnitude);
    renderResults(features, { startDate, endDate, minMagnitude });
    setMessage(`Loaded ${features.length} earthquake records.`, "success");
  } catch (error) {
    if (!allFeatures.length) {
      clearResults();
      emptyState.classList.remove("hidden");
      updateResultsSummary();
    }

    setMessage(error.message, "error");
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

  const latitudeBounds = [[-85, -100000], [85, 100000]];

  map = L.map("map", {
    worldCopyJump: true,
    minZoom: 2,
    maxBounds: latitudeBounds,
    maxBoundsViscosity: 1.0,
  }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

function initDatePickers() {
  const today = formatDateInput(defaultEndDate);
  const useCompactDatepicker = shouldUseCompactDatepicker();

  if (typeof flatpickr !== "undefined") {
    startPicker = flatpickr(startDateInput, {
      altInput: !useCompactDatepicker,
      altFormat: "F j, Y",
      dateFormat: "Y-m-d",
      defaultDate: formatDateInput(defaultStartDate),
      maxDate: today,
      onChange: () => {
        syncDateBounds();
        setPresetState(0);
      },
    });

    endPicker = flatpickr(endDateInput, {
      altInput: !useCompactDatepicker,
      altFormat: "F j, Y",
      dateFormat: "Y-m-d",
      defaultDate: formatDateInput(defaultEndDate),
      maxDate: today,
      onChange: () => {
        syncDateBounds();
        setPresetState(0);
      },
    });
  } else {
    startDateInput.value = formatDateInput(defaultStartDate);
    endDateInput.value = formatDateInput(defaultEndDate);
  }

  syncDateBounds();
}

function initDefaults() {
  initDatePickers();
  applyDateRange(7);
}

function runInitialSearch() {
  handleSearch({
    preventDefault() {},
  });
}

initMap();
initDefaults();
updateResultsSummary();
refreshLiveEarthquake();
runInitialSearch();

searchForm.addEventListener("submit", handleSearch);
prevPageButton.addEventListener("click", () => {
  renderPage(currentPage - 1);
});
nextPageButton.addEventListener("click", () => {
  renderPage(currentPage + 1);
});

startDateInput.addEventListener("change", () => {
  syncDateBounds();
  setPresetState(0);
});

endDateInput.addEventListener("change", () => {
  syncDateBounds();
  setPresetState(0);
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyDateRange(Number(button.dataset.rangeDays));
  });
});

liveCard.addEventListener("click", focusLiveEarthquake);

window.setInterval(refreshLiveEarthquake, oneHourMs / 60);
