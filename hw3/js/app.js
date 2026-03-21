const searchForm = document.getElementById("search-form");
const nameSelect = document.getElementById("name-select");
const statusSelect = document.getElementById("status-select");
const speciesSelect = document.getElementById("species-select");
const searchButton = document.getElementById("search-button");
const formMessage = document.getElementById("form-message");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const resultsList = document.getElementById("results-list");
const resultsSummary = document.getElementById("results-summary");
const detailEmpty = document.getElementById("detail-empty");
const detailContent = document.getElementById("detail-content");
const characterImage = document.getElementById("character-image");
const detailName = document.getElementById("character-name");
const characterTagline = document.getElementById("character-tagline");
const characterDescription = document.getElementById("character-description");
const statusBadge = document.getElementById("status-badge");
const characterSpecies = document.getElementById("character-species");
const characterGender = document.getElementById("character-gender");
const characterOrigin = document.getElementById("character-origin");
const characterLocation = document.getElementById("character-location");
const characterEpisodes = document.getElementById("character-episodes");
const characterType = document.getElementById("character-type");
const characterCreated = document.getElementById("character-created");
const characterId = document.getElementById("character-id");

let currentCharacters = [];
let catalogCharacters = [];
const nameFilters = new Map();

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
  resultsList.innerHTML = "";
  currentCharacters = [];
}

function validateForm() {
  if (!nameSelect.value) {
    return "Please choose a character from the dropdown.";
  }

  return "";
}

function getStatusClass(status) {
  const normalized = status.toLowerCase();

  if (normalized === "alive") {
    return "alive";
  }

  if (normalized === "dead") {
    return "dead";
  }

  return "unknown";
}

function formatCreatedDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildDescription(character) {
  const typeText = character.type ? ` with the subtype ${character.type}` : "";
  return `${character.name} is a ${character.status.toLowerCase()} ${character.species.toLowerCase()}${typeText}. The API shows this character comes from ${character.origin.name}, was last seen in ${character.location.name}, and appears in ${character.episode.length} episode${character.episode.length === 1 ? "" : "s"}.`;
}

function formatLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function populateSelect(select, values, placeholder, selectedValue = "") {
  select.innerHTML = `<option value="">${placeholder}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    if (value === selectedValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function populateConstrainedSelect(select, values, fallbackLabel, preferredValue = "") {
  select.innerHTML = "";

  if (values.length === 1) {
    const option = document.createElement("option");
    option.value = values[0];
    option.textContent = formatLabel(values[0]);
    option.selected = true;
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = fallbackLabel;
  select.appendChild(placeholderOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = formatLabel(value);
    if (value === preferredValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  select.disabled = false;
}

async function fetchCatalog() {
  const firstResponse = await fetch("https://rickandmortyapi.com/api/character/");
  if (!firstResponse.ok) {
    throw new Error(`Catalog request failed with status ${firstResponse.status}.`);
  }

  const firstPage = await firstResponse.json();
  const pages = firstPage.info.pages;
  const pageRequests = [];

  for (let page = 2; page <= pages; page += 1) {
    pageRequests.push(fetch(`https://rickandmortyapi.com/api/character/?page=${page}`).then((response) => response.json()));
  }

  const remainingPages = await Promise.all(pageRequests);
  const characters = [
    ...firstPage.results,
    ...remainingPages.flatMap((page) => page.results || []),
  ];
  catalogCharacters = characters;

  const names = [...new Set(characters.map((character) => character.name))].sort((left, right) => {
    return left.localeCompare(right);
  });

  names.forEach((name) => {
    const matchingCharacters = characters.filter((character) => character.name === name);
    const statuses = [...new Set(matchingCharacters.map((character) => character.status.toLowerCase()))].sort();
    const species = [...new Set(matchingCharacters.map((character) => character.species.toLowerCase()))].sort();
    nameFilters.set(name, { statuses, species });
  });

  populateSelect(nameSelect, names, "Select a character");
}

function updateDependentFilters(selectedName, preferredStatus = "", preferredSpecies = "") {
  const selectedFilterSet = nameFilters.get(selectedName);

  if (!selectedFilterSet) {
    statusSelect.innerHTML = '<option value="">Select a character first</option>';
    speciesSelect.innerHTML = '<option value="">Select a character first</option>';
    statusSelect.disabled = true;
    speciesSelect.disabled = true;
    return;
  }

  populateConstrainedSelect(statusSelect, selectedFilterSet.statuses, "Any available status", preferredStatus);
  populateConstrainedSelect(speciesSelect, selectedFilterSet.species, "Any available species", preferredSpecies);
}

function setActiveCharacter(characterIdValue) {
  currentCharacters.forEach((character) => {
    const item = document.querySelector(`[data-character-id="${character.id}"]`);
    if (!item) {
      return;
    }

    const isActive = character.id === characterIdValue;
    item.classList.toggle("active", isActive);

    if (isActive) {
      renderCharacterDetail(character);
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function renderCharacterDetail(character) {
  detailEmpty.classList.add("hidden");
  detailContent.classList.remove("hidden");

  characterImage.src = character.image;
  characterImage.alt = `${character.name} portrait`;
  detailName.textContent = character.name;
  characterTagline.textContent = `${character.status} ${character.species}${character.type ? ` • ${character.type}` : ""}`;
  characterDescription.textContent = buildDescription(character);
  statusBadge.textContent = character.status;
  statusBadge.className = `status-badge ${getStatusClass(character.status)}`;
  characterSpecies.textContent = character.species || "Unknown";
  characterGender.textContent = character.gender || "Unknown";
  characterOrigin.textContent = character.origin?.name || "Unknown";
  characterLocation.textContent = character.location?.name || "Unknown";
  characterEpisodes.textContent = String(character.episode.length);
  characterType.textContent = character.type || "No subtype listed";
  characterCreated.textContent = formatCreatedDate(character.created);
  characterId.textContent = String(character.id);
}

function buildCharacterItem(character) {
  const item = document.createElement("article");
  item.className = "character-item";
  item.dataset.characterId = String(character.id);
  item.tabIndex = 0;
  item.innerHTML = `
    <img class="character-thumb" src="${character.image}" alt="${character.name}">
    <div>
      <h3 class="character-item-name">${character.name}</h3>
      <p class="character-meta">${character.status} • ${character.species} • ${character.gender}</p>
    </div>
  `;

  const activate = () => {
    setActiveCharacter(character.id);
  };

  item.addEventListener("click", activate);
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });

  return item;
}

function renderResults(characters) {
  clearResults();

  if (!characters.length) {
    emptyState.classList.remove("hidden");
    detailEmpty.classList.remove("hidden");
    detailContent.classList.add("hidden");
    resultsSummary.textContent = "No characters matched your filters.";
    return;
  }

  emptyState.classList.add("hidden");
  resultsSummary.textContent = `Showing ${characters.length} matching characters.`;
  currentCharacters = characters;

  characters.forEach((character) => {
    resultsList.appendChild(buildCharacterItem(character));
  });

  setActiveCharacter(characters[0].id);
}

async function fetchCharacters() {
  const endpoint = new URL("https://rickandmortyapi.com/api/character/");
  endpoint.searchParams.set("name", nameSelect.value);

  if (statusSelect.value) {
    endpoint.searchParams.set("status", statusSelect.value);
  }

  if (speciesSelect.value) {
    endpoint.searchParams.set("species", speciesSelect.value);
  }

  const response = await fetch(endpoint);

  if (response.status === 404) {
    return { results: [] };
  }

  if (!response.ok) {
    throw new Error(`Rick and Morty API request failed with status ${response.status}.`);
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

  setMessage("Searching the multiverse...", "success");
  toggleLoading(true);
  emptyState.classList.add("hidden");

  try {
    const data = await fetchCharacters();
    const characters = data.results || [];
    renderResults(characters);
    setMessage(`Loaded ${characters.length} character records.`, "success");
  } catch (error) {
    clearResults();
    emptyState.classList.remove("hidden");
    detailEmpty.classList.remove("hidden");
    detailContent.classList.add("hidden");
    resultsSummary.textContent = "Unable to load character data right now.";
    setMessage(error.message, "error");
  } finally {
    toggleLoading(false);
  }
}

function chooseRandomName() {
  const names = [...nameFilters.keys()];
  return names[Math.floor(Math.random() * names.length)] || "";
}

async function init() {
  toggleLoading(true);
  setMessage("Loading available character and species options...", "success");

  try {
    await fetchCatalog();
    const randomName = chooseRandomName();
    nameSelect.value = randomName;
    updateDependentFilters(randomName);
    setMessage("Dropdown options loaded. Showing a random character.", "success");
    searchForm.requestSubmit();
  } catch (error) {
    setMessage(error.message, "error");
    populateSelect(nameSelect, [], "Unable to load characters");
    populateSelect(speciesSelect, [], "Unable to load species");
    statusSelect.disabled = true;
    speciesSelect.disabled = true;
  } finally {
    toggleLoading(false);
  }
}

searchForm.addEventListener("submit", handleSearch);
nameSelect.addEventListener("change", () => {
  updateDependentFilters(nameSelect.value, statusSelect.value, speciesSelect.value);
  if (nameSelect.value) {
    searchForm.requestSubmit();
  }
});
statusSelect.addEventListener("change", () => {
  if (nameSelect.value) {
    searchForm.requestSubmit();
  }
});
speciesSelect.addEventListener("change", () => {
  if (nameSelect.value) {
    searchForm.requestSubmit();
  }
});
init();
