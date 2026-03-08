const maxAttempts = 7;

const guessInput = document.getElementById('guessInput');
const guessBtn = document.getElementById('guessBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');
const attemptCount = document.getElementById('attemptCount');
const winsCount = document.getElementById('winsCount');
const lossesCount = document.getElementById('lossesCount');
const attemptList = document.getElementById('attemptList');

let targetNumber = generateRandomNumber();
let attempts = 0;
let wins = 0;
let losses = 0;
let gameOver = false;

function generateRandomNumber() {
  return Math.floor(Math.random() * 99) + 1;
}

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.classList.remove('error', 'success');

  if (type) {
    statusMessage.classList.add(type);
  }
}

function addAttemptToList(guess, hint) {
  const item = document.createElement('li');
  item.textContent = `Attempt ${attempts}: ${guess} (${hint})`;
  attemptList.appendChild(item);
}

function updateStats() {
  attemptCount.textContent = `${attempts} / ${maxAttempts}`;
  winsCount.textContent = `${wins}`;
  lossesCount.textContent = `${losses}`;
}

function endGame() {
  gameOver = true;
  guessBtn.disabled = true;
  guessBtn.classList.add('hidden');
  resetBtn.classList.remove('hidden');
  guessInput.disabled = true;
}

function handleGuess() {
  if (gameOver) {
    return;
  }

  const value = Number(guessInput.value);

  if (!Number.isInteger(value) || value < 1) {
    setStatus('Please enter a whole number between 1 and 99.', 'error');
    return;
  }

  if (value > 99) {
    setStatus('Error: your guess cannot be higher than 99.', 'error');
    return;
  }

  attempts += 1;

  if (value === targetNumber) {
    addAttemptToList(value, 'Correct');
    setStatus(`Great job! You guessed ${targetNumber} in ${attempts} attempt(s).`, 'success');
    wins += 1;
    updateStats();
    endGame();
    return;
  }

  const hint = value > targetNumber ? 'Too high' : 'Too low';
  addAttemptToList(value, hint);
  setStatus(`Your last guess was ${hint.toLowerCase()}.`);

  if (attempts >= maxAttempts) {
    losses += 1;
    updateStats();
    setStatus(`You Lost. The random number was ${targetNumber}.`, 'error');
    endGame();
    return;
  }

  updateStats();
  guessInput.value = '';
  guessInput.focus();
}

function resetGame() {
  targetNumber = generateRandomNumber();
  attempts = 0;
  gameOver = false;

  attemptList.innerHTML = '';
  guessInput.value = '';
  guessInput.disabled = false;
  guessBtn.disabled = false;
  guessBtn.classList.remove('hidden');
  resetBtn.classList.add('hidden');

  setStatus('New game started. Enter a number from 1 to 99.');
  updateStats();
  guessInput.focus();
}

guessBtn.addEventListener('click', handleGuess);
resetBtn.addEventListener('click', resetGame);

guessInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    handleGuess();
  }
});

updateStats();
