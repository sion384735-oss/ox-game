const fs = require("fs/promises");
const path = require("path");

const root = path.join(__dirname, "..");
const questionsPath = path.join(root, "data", "questions.json");
const settingsPath = path.join(root, "data", "settings.json");
const stylesPath = path.join(root, "public", "styles.css");
const outputPath = path.join(root, "offline-quiz.html");

const defaultSettings = {
  startKicker: "사회적경제",
  quizTitle: "퀴즈 게임",
  startMessage: "총 {count}문제 · 문제당 {seconds}초",
  startBackgroundImage: "",
  startBackgroundDim: 12,
  backgroundColor: "#f4f7f8",
  buttonColor: "#007f7a",
  textColor: "#17212b",
  correctColor: "#1f9d55",
  wrongColor: "#d83a34",
  finalKicker: "FINISH",
  finalMessage: "MISSION COMPLETE",
  finalBackgroundImage: "",
  finalBackgroundDim: 12,
  timeLimitSeconds: 15,
  fireworksEnabled: true
};

function escapeScriptJson(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMessage(template, values) {
  return String(template || "")
    .replace(/\{count\}/g, String(values.count))
    .replace(/\{seconds\}/g, String(values.seconds));
}

async function loadSettings() {
  try {
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    return {
      ...defaultSettings,
      ...settings,
      timeLimitSeconds: Number(settings.timeLimitSeconds || defaultSettings.timeLimitSeconds),
      startBackgroundDim: Number(settings.startBackgroundDim ?? defaultSettings.startBackgroundDim),
      finalBackgroundDim: Number(settings.finalBackgroundDim ?? defaultSettings.finalBackgroundDim),
      fireworksEnabled:
        settings.fireworksEnabled === undefined ? defaultSettings.fireworksEnabled : Boolean(settings.fireworksEnabled)
    };
  } catch {
    return { ...defaultSettings };
  }
}

async function main() {
  const questions = JSON.parse(await fs.readFile(questionsPath, "utf8"));
  const settings = await loadSettings();
  const styles = await fs.readFile(stylesPath, "utf8");
  const startMessage = formatMessage(settings.startMessage, {
    count: questions.length,
    seconds: settings.timeLimitSeconds
  });

  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>사회적경제 퀴즈 오프라인</title>
    <style>
${styles}
    </style>
  </head>
  <body class="participant-page">
    <main class="quiz-shell" id="app">
      <section class="start-panel" id="startPanel">
        <div class="hero-content-panel">
          <div class="brand-block">
            <p class="kicker" id="startKicker">${escapeHtml(settings.startKicker)}</p>
            <h1 id="quizTitle">${escapeHtml(settings.quizTitle)}</h1>
            <p class="start-meta" id="startMeta">${escapeHtml(startMessage)}</p>
          </div>
          <button class="primary-action xl" id="startButton">시작하기</button>
        </div>
      </section>

      <section class="quiz-panel hidden" id="quizPanel" aria-live="polite">
        <header class="quiz-topbar">
          <div>
            <p class="kicker">문제</p>
            <strong id="progressLabel">1 / 1</strong>
          </div>
          <div class="timer-badge" id="timerBadge">${settings.timeLimitSeconds}</div>
        </header>

        <div class="timer-track" aria-hidden="true">
          <div class="timer-fill" id="timerFill"></div>
        </div>

        <article class="question-area">
          <h2 id="questionText"></h2>
          <div class="answer-grid" id="answerGrid"></div>
        </article>

        <div class="result-stamp hidden" id="resultStamp">
          <span id="resultSymbol">O</span>
          <strong id="resultText">정답입니다</strong>
        </div>
      </section>

      <section class="complete-panel hidden" id="completePanel">
        <div class="fireworks" id="fireworks" aria-hidden="true"></div>
        <div class="hero-content-panel">
          <p class="kicker" id="finalKicker">${escapeHtml(settings.finalKicker)}</p>
          <h2 class="mission-title" id="finalMessage">${escapeHtml(settings.finalMessage)}</h2>
          <button class="primary-action xl" id="restartButton">다시 시작</button>
        </div>
      </section>
    </main>

<script>
const OFFLINE_QUESTIONS = ${escapeScriptJson(questions)};
const OFFLINE_SETTINGS = ${escapeScriptJson(settings)};
const RESULT_DELAY_MS = 1100;

const state = {
  questions: OFFLINE_QUESTIONS,
  settings: OFFLINE_SETTINGS,
  currentIndex: 0,
  answered: false,
  secondsLeft: OFFLINE_SETTINGS.timeLimitSeconds,
  timer: null
};

const startPanel = document.querySelector("#startPanel");
const quizPanel = document.querySelector("#quizPanel");
const completePanel = document.querySelector("#completePanel");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const startKicker = document.querySelector("#startKicker");
const quizTitle = document.querySelector("#quizTitle");
const startMeta = document.querySelector("#startMeta");
const progressLabel = document.querySelector("#progressLabel");
const timerBadge = document.querySelector("#timerBadge");
const timerFill = document.querySelector("#timerFill");
const questionArea = document.querySelector(".question-area");
const questionText = document.querySelector("#questionText");
const answerGrid = document.querySelector("#answerGrid");
const resultStamp = document.querySelector("#resultStamp");
const resultSymbol = document.querySelector("#resultSymbol");
const resultText = document.querySelector("#resultText");
const fireworks = document.querySelector("#fireworks");
const finalKicker = document.querySelector("#finalKicker");
const finalMessage = document.querySelector("#finalMessage");

function formatMessage(template, values) {
  return String(template || "")
    .replace(/\\{count\\}/g, String(values.count))
    .replace(/\\{seconds\\}/g, String(values.seconds));
}

function applySettings() {
  const settings = state.settings;
  startKicker.textContent = settings.startKicker;
  quizTitle.textContent = settings.quizTitle;
  startMeta.textContent = formatMessage(settings.startMessage, {
    count: state.questions.length,
    seconds: settings.timeLimitSeconds
  });
  finalKicker.textContent = settings.finalKicker;
  finalMessage.textContent = settings.finalMessage;
  document.documentElement.style.setProperty("--participant-background", settings.backgroundColor);
  document.documentElement.style.setProperty("--start-background-image", cssImage(settings.startBackgroundImage));
  document.documentElement.style.setProperty("--start-background-overlay", dimOverlay(settings.startBackgroundImage, settings.startBackgroundDim));
  document.documentElement.style.setProperty("--final-background-image", cssImage(settings.finalBackgroundImage));
  document.documentElement.style.setProperty("--final-background-overlay", dimOverlay(settings.finalBackgroundImage, settings.finalBackgroundDim));
  document.documentElement.style.setProperty("--ink", settings.textColor);
  document.documentElement.style.setProperty("--teal", settings.buttonColor);
  document.documentElement.style.setProperty("--teal-dark", shadeColor(settings.buttonColor, -18));
  document.documentElement.style.setProperty("--green", settings.correctColor);
  document.documentElement.style.setProperty("--red", settings.wrongColor);
}

function cssImage(value) {
  return value ? \`url("\${value}")\` : "none";
}

function dimOverlay(image, amount) {
  if (!image) return "none";
  const opacity = Math.max(0, Math.min(80, Number(amount) || 0)) / 100;
  return \`linear-gradient(rgba(0,0,0,\${opacity}), rgba(0,0,0,\${opacity}))\`;
}

function shadeColor(hex, percent) {
  const value = hex.replace("#", "");
  const amount = Math.round((percent / 100) * 255);
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16);
    return Math.max(0, Math.min(255, channel + amount)).toString(16).padStart(2, "0");
  });
  return \`#\${channels.join("")}\`;
}

function showOnly(panel) {
  [startPanel, quizPanel, completePanel].forEach((item) => item.classList.add("hidden"));
  panel.classList.remove("hidden");
}

function startQuiz() {
  state.currentIndex = 0;
  clearFireworks();
  showOnly(quizPanel);
  renderQuestion();
}

function renderQuestion() {
  clearInterval(state.timer);
  state.answered = false;
  state.secondsLeft = state.settings.timeLimitSeconds;
  resultStamp.classList.add("hidden");

  const question = state.questions[state.currentIndex];
  questionArea.classList.toggle("long-question", question.prompt.length > 90);
  progressLabel.textContent = \`\${state.currentIndex + 1} / \${state.questions.length}\`;
  questionText.textContent = question.prompt;
  answerGrid.innerHTML = "";

  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.classList.toggle("long-answer", String(choice).length > 20);
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
  timerFill.style.transform = \`scaleX(\${state.secondsLeft / state.settings.timeLimitSeconds})\`;
  timerBadge.classList.toggle("danger", state.secondsLeft <= 5);
}

function submitAnswer(answer, selectedButton) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timer);
  disableAnswers();
  selectedButton.classList.add("selected");

  const question = state.questions[state.currentIndex];
  const submittedAnswer = question.type === "ox" ? answer === 0 : answer;
  markAnswered(submittedAnswer === question.answer);
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

  resultStamp.classList.toggle("correct", correct);
  resultStamp.classList.toggle("wrong", !correct);
  resultSymbol.textContent = correct ? "O" : "X";
  resultText.textContent = correct ? "정답입니다" : "다시 도전!";
  resultStamp.classList.remove("hidden");

  setTimeout(() => {
    if (correct) {
      nextQuestion();
      return;
    }
    renderQuestion();
  }, RESULT_DELAY_MS);
}

function nextQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex >= state.questions.length) {
    showComplete();
    return;
  }
  renderQuestion();
}

function showComplete() {
  clearInterval(state.timer);
  showOnly(completePanel);
  if (state.settings.fireworksEnabled) launchFireworks();
}

function clearFireworks() {
  fireworks.innerHTML = "";
}

function launchFireworks() {
  clearFireworks();
  const colors = ["#f1b735", "#e95d46", "#1f9d55", "#007f7a", "#3f7be8", "#d8479f"];
  for (let burst = 0; burst < 9; burst += 1) {
    setTimeout(() => {
      createBurst(18 + Math.random() * 64, 14 + Math.random() * 46, colors);
    }, burst * 220);
  }
}

function createBurst(left, top, colors) {
  const count = 24;
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * index) / count;
    const distance = 90 + Math.random() * 130;
    spark.className = "spark";
    spark.style.left = \`\${left}%\`;
    spark.style.top = \`\${top}%\`;
    spark.style.setProperty("--x", \`\${Math.cos(angle) * distance}px\`);
    spark.style.setProperty("--y", \`\${Math.sin(angle) * distance}px\`);
    spark.style.setProperty("--color", colors[index % colors.length]);
    spark.addEventListener("animationend", () => spark.remove());
    fireworks.appendChild(spark);
  }
}

applySettings();
startButton.addEventListener("click", startQuiz);
restartButton.addEventListener("click", () => {
  clearFireworks();
  showOnly(startPanel);
});
    </script>
  </body>
</html>
`;

  await fs.writeFile(outputPath, html, "utf8");
  console.log(`Created ${path.relative(root, outputPath)} with ${questions.length} questions.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
