const QUESTION_VALUE = 10;
const correctIcon = "img/correct.svg";
const wrongIcon = "img/wrong.svg";

const q10Choices = ["Cheyenne", "Casper", "Laramie", "Gillette"];

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

function setFeedback(questionId, isCorrect, extra = "") {
  const container = document.getElementById(`feedback-${questionId}`);
  const icon = isCorrect ? correctIcon : wrongIcon;
  container.innerHTML = `${isCorrect ? "Correct" : "Incorrect"}${
    extra ? `: ${extra}` : ""
  } <img src="${icon}" alt="${isCorrect ? "correct answer" : "incorrect answer"}">`;
  container.classList.toggle("text-success", isCorrect);
  container.classList.toggle("text-danger", !isCorrect);
}

function renderQ10() {
  const holder = document.getElementById("q10-options");
  holder.innerHTML = "";
  const randomized = shuffle([...q10Choices]);

  randomized.forEach((choice, index) => {
    const id = `q10-opt-${index}`;
    const wrapper = document.createElement("div");
    wrapper.className = "form-check";
    wrapper.innerHTML = `
      <input class="form-check-input" type="radio" name="q10" id="${id}" value="${choice}">
      <label class="form-check-label" for="${id}">${choice}</label>
    `;
    holder.appendChild(wrapper);
  });
}

function incrementAttempts() {
  const key = "us-geo-quiz-attempts";
  const current = Number(localStorage.getItem(key) || "0") + 1;
  localStorage.setItem(key, String(current));
  document.getElementById("attempt-counter").textContent = `Total times taken: ${current}`;
}

function displayAttempts() {
  const current = Number(localStorage.getItem("us-geo-quiz-attempts") || "0");
  document.getElementById("attempt-counter").textContent = `Total times taken: ${current}`;
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

function gradeQuiz(event) {
  event.preventDefault();
  let totalScore = 0;

  const answers = {
    q1: document.querySelector('input[name="q1"]:checked')?.value || "",
    q2: document.querySelector('input[name="q2"]:checked')?.value || "",
    q3: document.querySelector('input[name="q3"]:checked')?.value || "",
    q4: document.querySelector('input[name="q4"]:checked')?.value || "",
    q5: document.querySelector('input[name="q5"]:checked')?.value || "",
    q6: document.getElementById("q6-input").value,
    q7: document.getElementById("q7-input").value,
    q8: document.getElementById("q8-select").value,
    q9: [...document.querySelectorAll('input[name="q9"]:checked')]
      .map((box) => box.value)
      .sort()
      .join(","),
    q10: document.querySelector('input[name="q10"]:checked')?.value || "",
  };

  const expectedQ9 = "Connecticut,Maine,Massachusetts,New Hampshire,Rhode Island,Vermont";

  const checks = {
    q1: answers.q1 === "Sacramento",
    q2: answers.q2 === "Hawaii",
    q3: answers.q3 === "Colorado River",
    q4: answers.q4 === "Mount McKinley (Denali)",
    q5: answers.q5 === "Texas",
    q6: normalize(answers.q6) === "austin",
    q7: answers.q7 === "4",
    q8: answers.q8 === "Pacific",
    q9: answers.q9 === expectedQ9,
    q10: answers.q10 === "Cheyenne",
  };

  Object.entries(checks).forEach(([question, passed]) => {
    if (passed) totalScore += QUESTION_VALUE;
    setFeedback(question, passed);
  });

  document.getElementById("total-score").textContent = `${totalScore} / 100`;

  const congrats = document.getElementById("congrats-message");
  congrats.textContent =
    totalScore > 80
      ? "Great job! You scored above 80 points! 🎉"
      : "";

  incrementAttempts();
}

function resetQuiz() {
  document.querySelectorAll(".feedback").forEach((box) => {
    box.textContent = "";
    box.classList.remove("text-success", "text-danger");
  });
  document.getElementById("total-score").textContent = "0 / 100";
  document.getElementById("congrats-message").textContent = "";
  renderQ10();
}

document.addEventListener("DOMContentLoaded", () => {
  renderQ10();
  displayAttempts();
  initAnimatedBackground();

  document.getElementById("quiz-form").addEventListener("submit", gradeQuiz);
  document.getElementById("quiz-form").addEventListener("reset", () => {
    setTimeout(resetQuiz, 0);
  });
});
