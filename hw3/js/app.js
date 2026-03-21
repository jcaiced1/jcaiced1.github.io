const searchForm = document.getElementById("search-form");
const nameInput = document.getElementById("name-input");
const statusSelect = document.getElementById("status-select");
const speciesInput = document.getElementById("species-input");
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
const statusBadge = document.getElementById("status-badge");
const characterSpecies = document.getElementById("character-species");
const characterGender = document.getElementById("character-gender");
const characterOrigin = document.getElementById("character-origin");
const characterLocation = document.getElementById("character-location");
const characterEpisodes = document.getElementById("character-episodes");
const characterId = document.getElementById("character-id");
const characterViewer = document.getElementById("character-viewer");
const viewerCaption = document.getElementById("viewer-caption");

const embeds = {
  rick: {
    src: "https://sketchfab.com/models/1a6d20d377d04929a6e5d14fb787e6b3/embed",
    caption: "3D showcase using a Rick Sanchez Sketchfab model.",
  },
  morty: {
    src: "https://sketchfab.com/models/e2c69b5e1bdb4fdfb4132e0709ce1765/embed",
    caption: "3D showcase using a Morty Sketchfab model.",
  },
};

let currentCharacters = [];

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
  const trimmedName = nameInput.value.trim();
  const trimmedSpecies = speciesInput.value.trim();

  if (!trimmedName) {
    return "Please enter a character name.";
  }

  if (trimmedName.length < 2) {
    return "Character name must contain at least 2 characters.";
  }

  if (trimmedSpecies && trimmedSpecies.length < 2) {
    return "Species must be at least 2 characters when provided.";
  }

  return "";
}

function buildQueryUrl() {
  const endpoint = new URL("https://rickandmortyapi.com/api/character/");
  endpoint.searchParams.set("name", nameInput.value.trim());

  if (statusSelect.value) {
    endpoint.searchParams.set("status", statusSelect.value);
  }

  if (speciesInput.value.trim()) {
    endpoint.searchParams.set("species", speciesInput.value.trim());
  }

  return endpoint;
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

function getViewerForCharacter(character) {
  const name = character.name.toLowerCase();

  if (name.includes("morty")) {
    return embeds.morty;
  }

  return embeds.rick;
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
  const viewer = getViewerForCharacter(character);

  detailEmpty.classList.add("hidden");
  detailContent.classList.remove("hidden");

  characterImage.src = character.image;
  characterImage.alt = `${character.name} portrait`;
  detailName.textContent = character.name;
  characterTagline.textContent = `${character.status} ${character.species}${character.type ? ` • ${character.type}` : ""}`;
  statusBadge.textContent = character.status;
  statusBadge.className = `status-badge ${getStatusClass(character.status)}`;
  characterSpecies.textContent = character.species || "Unknown";
  characterGender.textContent = character.gender || "Unknown";
  characterOrigin.textContent = character.origin?.name || "Unknown";
  characterLocation.textContent = character.location?.name || "Unknown";
  characterEpisodes.textContent = String(character.episode.length);
  characterId.textContent = String(character.id);
  characterViewer.src = viewer.src;
  viewerCaption.textContent = viewer.caption;
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
  const response = await fetch(buildQueryUrl());

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

function initDefaults() {
  nameInput.value = "rick";
  speciesInput.value = "";
  statusSelect.value = "";
}

initDefaults();
searchForm.addEventListener("submit", handleSearch);
searchForm.requestSubmit();
