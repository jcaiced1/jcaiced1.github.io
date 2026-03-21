const API_BASE = 'https://csumb.space/api';

const fallbackStates = [
  { usps: 'CA', name: 'California' },
  { usps: 'NY', name: 'New York' },
  { usps: 'TX', name: 'Texas' },
  { usps: 'FL', name: 'Florida' },
  { usps: 'WA', name: 'Washington' }
];

const fallbackCounties = {
  ca: ['Monterey', 'Los Angeles', 'Orange', 'San Diego', 'San Francisco'],
  ny: ['Albany', 'Kings', 'Queens', 'Monroe', 'Suffolk'],
  tx: ['Travis', 'Dallas', 'Harris', 'Bexar', 'Tarrant'],
  fl: ['Miami-Dade', 'Orange', 'Duval', 'Hillsborough', 'Palm Beach'],
  wa: ['King', 'Pierce', 'Snohomish', 'Spokane', 'Clark']
};

const fallbackZipInfo = {
  '93955': { city: 'Seaside', latitude: '36.6116', longitude: '-121.8511' },
  '95014': { city: 'Cupertino', latitude: '37.3197', longitude: '-122.0418' },
  '10001': { city: 'New York', latitude: '40.7506', longitude: '-73.9972' },
  '73301': { city: 'Austin', latitude: '30.3072', longitude: '-97.7560' }
};

const zipInput = document.getElementById('zip');
const cityInput = document.getElementById('city');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const stateSelect = document.getElementById('state');
const countySelect = document.getElementById('county');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const form = document.getElementById('signup-form');

const zipMessage = document.getElementById('zip-message');
const usernameMessage = document.getElementById('username-message');
const passwordSuggestion = document.getElementById('password-suggestion');
const passwordMessage = document.getElementById('password-message');
const formMessage = document.getElementById('form-message');
const backgroundVideo = document.querySelector('.background-video');

let usernameAvailable = false;
let suggestedPasswordLoaded = false;

function setMessage(element, text = '', type = '') {
  element.textContent = text;
  element.className = element.id === 'form-message' ? 'form-message' : 'helper-text';
  if (text && type) element.classList.add(type);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function populateStates(states) {
  stateSelect.innerHTML = '<option value="">Select a state</option>';
  states
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((state) => {
      const option = document.createElement('option');
      option.value = state.usps.toLowerCase();
      option.textContent = state.name;
      stateSelect.appendChild(option);
    });
}

function populateCounties(counties) {
  countySelect.innerHTML = '<option value="">Select County</option>';
  counties.forEach((county) => {
    const option = document.createElement('option');
    option.value = county;
    option.textContent = county;
    countySelect.appendChild(option);
  });
}

async function loadStates() {
  try {
    const data = await getJson(`${API_BASE}/allStatesAPI.php`);
    const states = Array.isArray(data) ? data : data.states || [];
    if (!states.length) throw new Error('No states returned');
    populateStates(states.map((state) => ({ usps: state.usps || state.abbreviation, name: state.state || state.name })));
  } catch (error) {
    populateStates(fallbackStates);
    setMessage(formMessage, 'Live states API is unavailable right now, so fallback data is being used.', 'warning');
  }
}

async function lookupZip() {
  const zip = zipInput.value.trim();
  cityInput.value = '';
  latitudeInput.value = '';
  longitudeInput.value = '';

  if (zip.length !== 5 || !/^\d{5}$/.test(zip)) {
    setMessage(zipMessage, 'Enter a valid 5-digit ZIP code.', 'warning');
    return;
  }

  try {
    const data = await getJson(`${API_BASE}/cityInfoAPI.php?zip=${zip}`);
    const record = Array.isArray(data) ? data[0] : data;
    if (!record || (!record.city && !record.latitude)) throw new Error('ZIP not found');

    cityInput.value = record.city || '';
    latitudeInput.value = record.latitude || '';
    longitudeInput.value = record.longitude || '';
    setMessage(zipMessage, 'ZIP code found and location details were loaded.', 'success');
  } catch (error) {
    const fallback = fallbackZipInfo[zip];
    if (fallback) {
      cityInput.value = fallback.city;
      latitudeInput.value = fallback.latitude;
      longitudeInput.value = fallback.longitude;
      setMessage(zipMessage, 'Fallback ZIP data loaded.', 'warning');
    } else {
      setMessage(zipMessage, 'Zip code not found.', 'error');
    }
  }
}

async function loadCounties() {
  const state = stateSelect.value;
  countySelect.innerHTML = '<option value="">Loading counties...</option>';

  if (!state) {
    countySelect.innerHTML = '<option value="">Select a state first</option>';
    return;
  }

  try {
    const data = await getJson(`${API_BASE}/countyListAPI.php?state=${state}`);
    const counties = Array.isArray(data) ? data : data.counties || [];
    if (!counties.length) throw new Error('No counties returned');
    populateCounties(counties.map((county) => county.county || county.name || county));
  } catch (error) {
    populateCounties(fallbackCounties[state] || []);
    setMessage(formMessage, 'County API could not be reached, so fallback county data is being shown.', 'warning');
  }
}

async function checkUsername() {
  const username = usernameInput.value.trim();
  usernameAvailable = false;

  if (username.length < 3) {
    setMessage(usernameMessage, 'Use at least 3 characters for your username.', 'warning');
    return;
  }

  try {
    const data = await getJson(`${API_BASE}/usernamesAPI.php?username=${encodeURIComponent(username)}`);
    const available = typeof data === 'object'
      ? (data.available ?? (data.status === 'available') ?? (data.username === 'available'))
      : data === true;
    usernameAvailable = Boolean(available);
  } catch (error) {
    usernameAvailable = !['admin', 'root', 'test', 'guest', 'student'].includes(username.toLowerCase());
  }

  setMessage(
    usernameMessage,
    usernameAvailable ? 'Username is available.' : 'Username is already taken.',
    usernameAvailable ? 'success' : 'error'
  );
}

async function suggestPassword() {
  if (suggestedPasswordLoaded) return;
  suggestedPasswordLoaded = true;

  try {
    const data = await getJson(`${API_BASE}/suggestedPassword.php?length=12`);
    const suggestion = data.password || data.suggestedPassword || data;
    setMessage(passwordSuggestion, `Suggested password: ${suggestion}`, 'success');
  } catch (error) {
    const fallback = `Study${new Date().getFullYear()}!`;
    setMessage(passwordSuggestion, `Suggested password: ${fallback}`, 'warning');
  }
}

function validatePasswords() {
  const password = passwordInput.value;
  const confirmPassword = passwordConfirmInput.value;

  if (!password && !confirmPassword) {
    setMessage(passwordMessage, '');
    return false;
  }

  if (password.length < 6) {
    setMessage(passwordMessage, 'Password must be at least 6 characters long.', 'error');
    return false;
  }

  if (confirmPassword && password !== confirmPassword) {
    setMessage(passwordMessage, 'Passwords must match.', 'error');
    return false;
  }

  if (confirmPassword && password === confirmPassword) {
    setMessage(passwordMessage, 'Passwords match.', 'success');
  } else {
    setMessage(passwordMessage, 'Retype your password to confirm it.', 'warning');
  }

  return password.length >= 6 && password === confirmPassword;
}

function handleSubmit(event) {
  event.preventDefault();
  validatePasswords();

  const requiredFieldsComplete = form.reportValidity();
  const hasZipDetails = Boolean(cityInput.value && latitudeInput.value && longitudeInput.value);

  if (!requiredFieldsComplete) {
    setMessage(formMessage, 'Please complete all required fields.', 'error');
    return;
  }

  if (!hasZipDetails) {
    setMessage(formMessage, 'Please enter a valid ZIP code before submitting.', 'error');
    return;
  }

  if (!usernameAvailable) {
    setMessage(formMessage, 'Please choose an available username.', 'error');
    return;
  }

  if (!validatePasswords()) {
    setMessage(formMessage, 'Please fix the password validation errors.', 'error');
    return;
  }

  const params = new URLSearchParams({ username: usernameInput.value.trim() });
  window.location.href = `welcome.html?${params.toString()}`;
}

function tryPlayBackgroundVideo() {
  if (!backgroundVideo) return;

  backgroundVideo.muted = true;
  backgroundVideo.defaultMuted = true;

  const playAttempt = backgroundVideo.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }
}

zipInput.addEventListener('change', lookupZip);
stateSelect.addEventListener('change', loadCounties);
usernameInput.addEventListener('change', checkUsername);
passwordInput.addEventListener('click', suggestPassword);
passwordInput.addEventListener('input', validatePasswords);
passwordConfirmInput.addEventListener('input', validatePasswords);
form.addEventListener('submit', handleSubmit);

if (backgroundVideo) {
  backgroundVideo.addEventListener('loadeddata', tryPlayBackgroundVideo);
  window.addEventListener('pageshow', tryPlayBackgroundVideo);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tryPlayBackgroundVideo();
  });
  document.addEventListener('touchstart', tryPlayBackgroundVideo, { passive: true });
}

tryPlayBackgroundVideo();
loadStates();
