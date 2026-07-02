const QUIZ_SECONDS = 15;
const RESULT_DELAY_MS = 1100;

const state = {
  questions: [],
  currentIndex: 0,
  correctCount: 0,
  answered: false,
  secondsLeft: QUIZ_SECONDS,
  timer: null
};

const startPanel = document.querySelector("#startPanel");
const quizPanel = document.querySelector("#quizPanel");
const scorePanel = document.querySelector("#scorePanel");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const startMeta = document.querySelector("#startMeta");
const progressLabel = document.querySelector("#progressLabel");
const timerBadge = document.querySelector("#timerBadge");
const timerFill = document.querySelector("#timerFill");
const questionText = document.querySelector("#questionText");
const answerGrid = document.querySelector("#answerGrid");
const resultStamp = document.querySelector("#resultStamp");
const resultSymbol = document.querySelector("#resultSymbol");
const resultText = document.querySelector("#resultText");
const scoreNumber = document.querySelector("#scoreNumber");
const scoreDetail = document.querySelector("#scoreDetail");

async function fetchQuestions() {
  const response = await fetch("/api/questions", { cache: "no-store" });
  if (!response.ok) throw new Error("문제를 불러오지 못했습니다.");
  const data = await response.json();
  return data.questions || [];
}

async function setup() {
  try {
    state.questions = await fetchQuestions();
    startMeta.textContent = `총 ${state.questions.length}문제 · 문제당 ${QUIZ_SECONDS}초`;
    startButton.disabled = state.questions.length === 0;
    if (state.questions.length === 0) {
      startMeta.textContent = "등록된 문제가 없습니다. 관리자 화면에서 문제를 등록해주세요.";
    }
  } catch (error) {
    startMeta.textContent = error.message;
  }
}

function showOnly(panel) {
  [startPanel, quizPanel, scorePanel].forEach((item) => item.classList.add("hidden"));
  panel.classList.remove("hidden");
}

function startQuiz() {
  state.currentIndex = 0;
  state.correctCount = 0;
  showOnly(quizPanel);
  renderQuestion();
}

function renderQuestion() {
  clearInterval(state.timer);
  state.answered = false;
  state.secondsLeft = QUIZ_SECONDS;
  resultStamp.classList.add("hidden");

  const question = state.questions[state.currentIndex];
  progressLabel.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
  questionText.textContent = question.prompt;
  answerGrid.innerHTML = "";

  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.textContent = choice;
    button.addEventListener("click", () => submitAnswer(index, button));
    answerGrid.appendChild(button);
  });

  updateTimer();
  state.timer = setInterval(() => {
    state.secondsLeft -= 1;
    updateTimer();
    if (state.secondsLeft <= 0) {
      markAnswered(false);
    }
  }, 1000);
}

function updateTimer() {
  timerBadge.textContent = String(state.secondsLeft);
  timerFill.style.transform = `scaleX(${state.secondsLeft / QUIZ_SECONDS})`;
  timerBadge.classList.toggle("danger", state.secondsLeft <= 5);
}

async function submitAnswer(answer, selectedButton) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timer);
  disableAnswers();
  selectedButton.classList.add("selected");

  const question = state.questions[state.currentIndex];
  const submittedAnswer = question.type === "ox" ? answer === 0 : answer;
  try {
    const response = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: question.id, answer: submittedAnswer })
    });
    const data = await response.json();
    markAnswered(Boolean(data.correct));
  } catch {
    markAnswered(false);
  }
}

function disableAnswers() {
  answerGrid.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });
}

function markAnswered(correct) {
  if (!state.answered) {
    state.answered = true;
    clearInterval(state.timer);
    disableAnswers();
  }

  if (correct) state.correctCount += 1;
  resultStamp.classList.toggle("correct", correct);
  resultStamp.classList.toggle("wrong", !correct);
  resultSymbol.textContent = correct ? "O" : "X";
  resultText.textContent = correct ? "정답입니다" : "오답입니다";
  resultStamp.classList.remove("hidden");

  setTimeout(nextQuestion, RESULT_DELAY_MS);
}

function nextQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex >= state.questions.length) {
    showScore();
    return;
  }
  renderQuestion();
}

function showScore() {
  clearInterval(state.timer);
  const total = state.questions.length;
  const score = total ? Math.round((state.correctCount / total) * 100) : 0;
  scoreNumber.textContent = `${score}점`;
  scoreDetail.textContent = `정답 ${state.correctCount}개 / 총 ${total}문제`;
  showOnly(scorePanel);
}

startButton.addEventListener("click", startQuiz);
restartButton.addEventListener("click", async () => {
  await setup();
  showOnly(startPanel);
});

setup();
