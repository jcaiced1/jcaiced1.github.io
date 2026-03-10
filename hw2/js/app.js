const QUESTION_VALUE = 10;
const correctIcon = "img/correct.svg";
const wrongIcon = "img/wrong.svg";
const attemptStorageKey = "us-geo-quiz-attempts";

const q10Choices = ["Cheyenne", "Casper", "Laramie", "Gillette"];
const expectedQ9 = [
  "Connecticut",
  "Maine",
  "Massachusetts",
  "New Hampshire",
  "Rhode Island",
  "Vermont",
];

const questionOrder = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];

const answerCheckers = {
  q1: (value) => value === "Sacramento",
  q2: (value) => value === "Hawaii",
  q3: (value) => value === "Colorado River",
  q4: (value) => value === "Mount McKinley (Denali)",
  q5: (value) => value === "Texas",
  q6: (value) => normalize(value) === "austin",
  q7: (value) => value === "4",
  q8: (value) => value === "Pacific",
  q9: (value) => arraysMatch(value, expectedQ9),
  q10: (value) => value === "Cheyenne",
};

const correctAnswers = {
  q1: "Sacramento",
  q2: "Hawaii",
  q3: "Colorado River",
  q4: "Mount McKinley (Denali)",
  q5: "Texas",
  q6: "Austin",
  q7: "4",
  q8: "Pacific",
  q9: expectedQ9,
  q10: "Cheyenne",
};

const quizState = {
  currentIndex: 0,
  results: {},
  attemptRecorded: false,
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function arraysMatch(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((item, index) => item === sortedRight[index]);
}

function getQuestionSection(questionId) {
  return document.querySelector(`.question-card[data-question="${questionId}"]`);
}

function getAnswer(questionId) {
  switch (questionId) {
    case "q1":
    case "q2":
    case "q3":
    case "q4":
    case "q5":
    case "q10":
      return document.querySelector(`input[name="${questionId}"]:checked`)?.value || "";
    case "q6":
      return document.getElementById("q6-input").value.trim();
    case "q7":
      return document.getElementById("q7-input").value.trim();
    case "q8":
      return document.getElementById("q8-select").value;
    case "q9":
      return [...document.querySelectorAll('input[name="q9"]:checked')]
        .map((box) => box.value)
        .sort();
    default:
      return "";
  }
}

function setFeedback(questionId, isCorrect, details) {
  const container = document.getElementById(`feedback-${questionId}`);
  const icon = isCorrect ? correctIcon : wrongIcon;

  container.innerHTML = `${isCorrect ? "Correct" : "Incorrect"}${details ? `: ${details}` : ""} <img src="${icon}" alt="${isCorrect ? "correct answer" : "incorrect answer"}">`;
  container.classList.toggle("text-success", isCorrect);
  container.classList.toggle("text-danger", !isCorrect);
}

function markCorrectChoices(questionId, userAnswer) {
  const section = getQuestionSection(questionId);
  const optionCards = section.querySelectorAll(".option-card");
  optionCards.forEach((card) => {
    card.classList.add("option-locked");
    card.classList.remove("correct-answer", "incorrect-answer");
  });

  if (["q1", "q2", "q3", "q4", "q5", "q10"].includes(questionId)) {
    optionCards.forEach((card) => {
      const input = card.querySelector("input");
      if (input.value === correctAnswers[questionId]) {
        card.classList.add("correct-answer");
      } else if (input.checked && userAnswer !== correctAnswers[questionId]) {
        card.classList.add("incorrect-answer");
      }
    });
  }

  if (questionId === "q9") {
    optionCards.forEach((card) => {
      const input = card.querySelector("input");
      if (expectedQ9.includes(input.value)) {
        card.classList.add("correct-answer");
      } else if (input.checked) {
        card.classList.add("incorrect-answer");
      }
    });
  }
}

function disableQuestionInputs(questionId) {
  const section = getQuestionSection(questionId);
  section.querySelectorAll("input, select, button.check-btn").forEach((element) => {
    element.disabled = true;
  });
}

function formatCorrectAnswer(questionId) {
  if (questionId === "q9") {
    return `<span class="text-success">Correct answers: ${correctAnswers[questionId].join(", ")}</span>`;
  }

  return `<span class="text-success">Correct answer: ${correctAnswers[questionId]}</span>`;
}

function gradeQuestion(questionId) {
  if (quizState.results[questionId]) {
    return;
  }

  const userAnswer = getAnswer(questionId);
  const isCorrect = answerCheckers[questionId](userAnswer);
  const score = isCorrect ? QUESTION_VALUE : 0;

  quizState.results[questionId] = {
    isCorrect,
    score,
  };

  if (["q1", "q2", "q3", "q4", "q5", "q9", "q10"].includes(questionId)) {
    markCorrectChoices(questionId, userAnswer);
  }

  if (["q6", "q7", "q8"].includes(questionId)) {
    const inputId = questionId === "q6" ? "q6-input" : questionId === "q7" ? "q7-input" : "q8-select";
    const field = document.getElementById(inputId);
    field.classList.toggle("border-success", isCorrect);
    field.classList.toggle("border-danger", !isCorrect);
  }

  setFeedback(questionId, isCorrect, isCorrect ? "" : formatCorrectAnswer(questionId));
  disableQuestionInputs(questionId);

  const section = getQuestionSection(questionId);
  section.querySelector(".next-btn").disabled = false;
}

function updateProgress(index) {
  const progressText = document.getElementById("progress-text");
  const progressBar = document.getElementById("progress-bar");
  const percentage = ((index + 1) / questionOrder.length) * 100;

  progressText.textContent = `Question ${index + 1} of ${questionOrder.length}`;
  progressBar.style.width = `${percentage}%`;
  progressBar.setAttribute("aria-valuenow", String(percentage));
}

function showQuestion(index) {
  document.querySelectorAll(".question-card").forEach((card, cardIndex) => {
    card.classList.toggle("active", cardIndex === index);
  });

  quizState.currentIndex = index;
  updateProgress(index);
}

function showResults() {
  const totalScore = questionOrder.reduce((sum, questionId) => {
    return sum + (quizState.results[questionId]?.score || 0);
  }, 0);

  document.getElementById("quiz-form").classList.add("d-none");
  document.querySelector(".quiz-progress").classList.add("d-none");
  document.getElementById("results-panel").classList.remove("d-none");
  document.getElementById("total-score").textContent = `${totalScore} / 100`;
  document.getElementById("congrats-message").textContent =
    totalScore > 80 ? "Great job! You scored above 80 points!" : "";

  if (!quizState.attemptRecorded) {
    incrementAttempts();
    quizState.attemptRecorded = true;
  }
}

function incrementAttempts() {
  const current = Number(localStorage.getItem(attemptStorageKey) || "0") + 1;
  localStorage.setItem(attemptStorageKey, String(current));
  document.getElementById("attempt-counter").textContent = `Total times taken: ${current}`;
}

function displayAttempts() {
  const current = Number(localStorage.getItem(attemptStorageKey) || "0");
  document.getElementById("attempt-counter").textContent = `Total times taken: ${current}`;
}

function renderQ10() {
  const holder = document.getElementById("q10-options");
  holder.innerHTML = "";
  const randomized = shuffle([...q10Choices]);

  randomized.forEach((choice, index) => {
    const id = `q10-opt-${index}`;
    const wrapper = document.createElement("div");
    wrapper.className = "form-check option-card";
    wrapper.innerHTML = `
      <input class="form-check-input" type="radio" name="q10" id="${id}" value="${choice}">
      <label class="form-check-label" for="${id}">${choice}</label>
    `;
    holder.appendChild(wrapper);
  });
}

function initAnimatedBackground() {
  if (typeof window.VANTA === "undefined" || typeof window.THREE === "undefined") {
    return;
  }

  window.VANTA.BIRDS({
    el: "#vanta-bg",
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200.0,
    minWidth: 200.0,
    scale: 1.0,
    scaleMobile: 1.0,
    backgroundAlpha: 0.0,
    color1: 0x68a0ff,
    color2: 0xa3d5ff,
    birdSize: 1.1,
    speedLimit: 4.0,
    separation: 30.0,
  });
}

function resetQuiz() {
  quizState.currentIndex = 0;
  quizState.results = {};
  quizState.attemptRecorded = false;

  document.getElementById("quiz-form").classList.remove("d-none");
  document.querySelector(".quiz-progress").classList.remove("d-none");
  document.getElementById("results-panel").classList.add("d-none");

  document.querySelectorAll(".feedback").forEach((box) => {
    box.textContent = "";
    box.classList.remove("text-success", "text-danger");
  });

  document.querySelectorAll(".option-card").forEach((card) => {
    card.classList.remove("correct-answer", "incorrect-answer", "option-locked");
  });

  document.querySelectorAll("input, select").forEach((element) => {
    element.disabled = false;
    element.classList.remove("border-success");
    element.classList.remove("border-danger");
  });

  document.querySelectorAll(".check-btn").forEach((button) => {
    button.disabled = false;
  });

  document.querySelectorAll(".next-btn").forEach((button) => {
    button.disabled = true;
  });

  document.getElementById("total-score").textContent = "0 / 100";
  document.getElementById("congrats-message").textContent = "";

  renderQ10();
  showQuestion(0);
}

function handleQuizClick(event) {
  const optionCard = event.target.closest(".option-card");
  if (optionCard && !event.target.closest("label, input")) {
    const input = optionCard.querySelector('input[type="radio"], input[type="checkbox"]');
    if (input && !input.disabled) {
      input.click();
    }
    return;
  }

  const checkButton = event.target.closest(".check-btn");
  if (checkButton) {
    gradeQuestion(checkButton.dataset.question);
    return;
  }

  const nextButton = event.target.closest(".next-btn");
  if (!nextButton || nextButton.disabled) {
    return;
  }

  if (nextButton.dataset.next === "summary") {
    showResults();
    return;
  }

  showQuestion(Number(nextButton.dataset.next));
}

document.addEventListener("DOMContentLoaded", () => {
  renderQ10();
  displayAttempts();
  initAnimatedBackground();
  showQuestion(0);

  const form = document.getElementById("quiz-form");
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("click", handleQuizClick);
  form.addEventListener("reset", () => {
    setTimeout(resetQuiz, 0);
  });
});
