const state = {
  questions: [],
  settings: null,
  type: "ox",
  oxAnswer: true,
  editingId: null
};

const DEFAULT_SETTINGS = {
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

const loginPanel = document.querySelector("#loginPanel");
const adminWorkspace = document.querySelector("#adminWorkspace");
const loginForm = document.querySelector("#loginForm");
const passwordInput = document.querySelector("#passwordInput");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const questionForm = document.querySelector("#questionForm");
const promptInput = document.querySelector("#promptInput");
const oxFields = document.querySelector("#oxFields");
const choiceFields = document.querySelector("#choiceFields");
const formMessage = document.querySelector("#formMessage");
const bulkInput = document.querySelector("#bulkInput");
const bulkImportButton = document.querySelector("#bulkImportButton");
const bulkMessage = document.querySelector("#bulkMessage");
const questionList = document.querySelector("#questionList");
const questionCount = document.querySelector("#questionCount");
const editorTitle = document.querySelector("#editorTitle");
const saveQuestionButton = document.querySelector("#saveQuestionButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const designForm = document.querySelector("#designForm");
const settingStartKicker = document.querySelector("#settingStartKicker");
const settingQuizTitle = document.querySelector("#settingQuizTitle");
const settingStartMessage = document.querySelector("#settingStartMessage");
const settingStartBackgroundImage = document.querySelector("#settingStartBackgroundImage");
const clearStartBackgroundButton = document.querySelector("#clearStartBackgroundButton");
const startBackgroundStatus = document.querySelector("#startBackgroundStatus");
const settingStartBackgroundDim = document.querySelector("#settingStartBackgroundDim");
const startBackgroundDimValue = document.querySelector("#startBackgroundDimValue");
const settingBackgroundColor = document.querySelector("#settingBackgroundColor");
const settingButtonColor = document.querySelector("#settingButtonColor");
const settingTextColor = document.querySelector("#settingTextColor");
const settingCorrectColor = document.querySelector("#settingCorrectColor");
const settingWrongColor = document.querySelector("#settingWrongColor");
const settingTimeLimit = document.querySelector("#settingTimeLimit");
const settingFinalKicker = document.querySelector("#settingFinalKicker");
const settingFinalMessage = document.querySelector("#settingFinalMessage");
const settingFinalBackgroundImage = document.querySelector("#settingFinalBackgroundImage");
const clearFinalBackgroundButton = document.querySelector("#clearFinalBackgroundButton");
const finalBackgroundStatus = document.querySelector("#finalBackgroundStatus");
const settingFinalBackgroundDim = document.querySelector("#settingFinalBackgroundDim");
const finalBackgroundDimValue = document.querySelector("#finalBackgroundDimValue");
const settingFireworks = document.querySelector("#settingFireworks");
const designMessage = document.querySelector("#designMessage");

function showLogin() {
  loginPanel.classList.remove("hidden");
  adminWorkspace.classList.add("hidden");
}

function showWorkspace() {
  loginPanel.classList.add("hidden");
  adminWorkspace.classList.remove("hidden");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

async function boot() {
  const me = await api("/api/admin/me");
  if (me.authenticated) {
    showWorkspace();
    await Promise.all([loadQuestions(), loadSettings()]);
  } else {
    showLogin();
  }
}

async function loadQuestions() {
  const data = await api("/api/admin/questions");
  state.questions = data.questions || [];
  renderList();
}

async function loadSettings() {
  const data = await api("/api/admin/settings");
  state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  renderSettingsForm();
}

function renderSettingsForm() {
  const settings = state.settings || DEFAULT_SETTINGS;
  settingStartKicker.value = settings.startKicker;
  settingQuizTitle.value = settings.quizTitle;
  settingStartMessage.value = settings.startMessage;
  settingStartBackgroundImage.value = "";
  startBackgroundStatus.textContent = settings.startBackgroundImage ? "사진 등록됨" : "등록된 사진 없음";
  settingStartBackgroundDim.value = Number(settings.startBackgroundDim ?? DEFAULT_SETTINGS.startBackgroundDim);
  startBackgroundDimValue.textContent = `${settingStartBackgroundDim.value}%`;
  settingBackgroundColor.value = settings.backgroundColor;
  settingButtonColor.value = settings.buttonColor;
  settingTextColor.value = settings.textColor;
  settingCorrectColor.value = settings.correctColor;
  settingWrongColor.value = settings.wrongColor;
  settingTimeLimit.value = settings.timeLimitSeconds;
  settingFinalKicker.value = settings.finalKicker;
  settingFinalMessage.value = settings.finalMessage;
  settingFinalBackgroundImage.value = "";
  finalBackgroundStatus.textContent = settings.finalBackgroundImage ? "사진 등록됨" : "등록된 사진 없음";
  settingFinalBackgroundDim.value = Number(settings.finalBackgroundDim ?? DEFAULT_SETTINGS.finalBackgroundDim);
  finalBackgroundDimValue.textContent = `${settingFinalBackgroundDim.value}%`;
  settingFireworks.checked = Boolean(settings.fireworksEnabled);
}

function collectSettingsPayload() {
  return {
    startKicker: settingStartKicker.value.trim(),
    quizTitle: settingQuizTitle.value.trim(),
    startMessage: settingStartMessage.value.trim(),
    startBackgroundImage: state.settings?.startBackgroundImage || "",
    startBackgroundDim: Number(settingStartBackgroundDim.value),
    backgroundColor: settingBackgroundColor.value,
    buttonColor: settingButtonColor.value,
    textColor: settingTextColor.value,
    correctColor: settingCorrectColor.value,
    wrongColor: settingWrongColor.value,
    finalKicker: settingFinalKicker.value.trim(),
    finalMessage: settingFinalMessage.value.trim(),
    finalBackgroundImage: state.settings?.finalBackgroundImage || "",
    finalBackgroundDim: Number(settingFinalBackgroundDim.value),
    timeLimitSeconds: Number(settingTimeLimit.value),
    fireworksEnabled: settingFireworks.checked
  };
}

async function setBackgroundImage(kind, file) {
  if (!file) return;
  designMessage.textContent = "사진을 처리하는 중입니다.";
  try {
    const dataUrl = await resizeImage(file);
    if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
    if (kind === "start") {
      state.settings.startBackgroundImage = dataUrl;
      startBackgroundStatus.textContent = "새 사진 선택됨";
    } else {
      state.settings.finalBackgroundImage = dataUrl;
      finalBackgroundStatus.textContent = "새 사진 선택됨";
    }
    designMessage.textContent = "사진을 선택했습니다. 디자인 저장을 눌러야 반영됩니다.";
  } catch (error) {
    designMessage.textContent = error.message;
  }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 선택할 수 있습니다."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("사진 형식을 확인해주세요."));
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        if (dataUrl.length > 6 * 1024 * 1024) {
          reject(new Error("사진이 너무 큽니다. 더 작은 사진을 선택해주세요."));
          return;
        }
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setType(type) {
  state.type = type;
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === type);
  });
  oxFields.classList.toggle("hidden", type !== "ox");
  choiceFields.classList.toggle("hidden", type !== "choice");
}

function setOxAnswer(value) {
  state.oxAnswer = value;
  document.querySelectorAll("[data-ox]").forEach((button) => {
    button.classList.toggle("active", button.dataset.ox === String(value));
  });
}

function getChoiceInputs() {
  return [...choiceFields.querySelectorAll(".choice-row")].map((row) => ({
    radio: row.querySelector("input[type='radio']"),
    input: row.querySelector("input[type='text']")
  }));
}

function collectPayload() {
  const prompt = promptInput.value.trim();
  if (state.type === "ox") {
    return { type: "ox", prompt, answer: state.oxAnswer };
  }

  const rows = getChoiceInputs();
  const choices = rows.map((row) => row.input.value.trim()).filter(Boolean);
  const selectedOriginalIndex = Number(document.querySelector("input[name='choiceAnswer']:checked")?.value || 0);
  const selectedText = rows[selectedOriginalIndex]?.input.value.trim();
  const answer = choices.findIndex((choice) => choice === selectedText);

  return { type: "choice", prompt, choices, answer };
}

function resetForm() {
  state.editingId = null;
  state.type = "ox";
  state.oxAnswer = true;
  questionForm.reset();
  setType("ox");
  setOxAnswer(true);
  editorTitle.textContent = "문제 등록";
  saveQuestionButton.textContent = "등록";
  cancelEditButton.classList.add("hidden");
  formMessage.textContent = "";
  getChoiceInputs().forEach((row, index) => {
    row.input.value = "";
    row.radio.checked = index === 0;
  });
}

function editQuestion(question) {
  state.editingId = question.id;
  promptInput.value = question.prompt;
  setType(question.type);
  editorTitle.textContent = "문제 수정";
  saveQuestionButton.textContent = "수정 저장";
  cancelEditButton.classList.remove("hidden");
  formMessage.textContent = "";

  if (question.type === "ox") {
    setOxAnswer(Boolean(question.answer));
  } else {
    getChoiceInputs().forEach((row, index) => {
      row.input.value = question.choices[index] || "";
      row.radio.checked = index === question.answer;
    });
  }

  promptInput.focus();
}

async function deleteQuestion(question) {
  const ok = window.confirm("이 문제를 삭제할까요?");
  if (!ok) return;
  await api(`/api/admin/questions/${encodeURIComponent(question.id)}`, { method: "DELETE" });
  await loadQuestions();
  if (state.editingId === question.id) resetForm();
}

function renderList() {
  questionCount.textContent = `${state.questions.length}개`;
  questionList.innerHTML = "";

  if (!state.questions.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "등록된 문제가 없습니다.";
    questionList.appendChild(empty);
    return;
  }

  state.questions.forEach((question, index) => {
    const item = document.createElement("article");
    item.className = "question-item";

    const meta = document.createElement("div");
    meta.className = "question-meta";
    meta.innerHTML = `<span>${index + 1}</span><strong>${question.type === "ox" ? "OX" : "객관식"}</strong>`;

    const body = document.createElement("div");
    body.className = "question-item-body";

    const prompt = document.createElement("p");
    prompt.textContent = question.prompt;

    const answer = document.createElement("small");
    answer.textContent =
      question.type === "ox"
        ? `정답: ${question.answer ? "O" : "X"}`
        : `정답: ${question.answer + 1}. ${question.choices[question.answer] || ""}`;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "secondary-action small";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => editQuestion(question));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-action small";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => deleteQuestion(question));

    actions.append(editButton, deleteButton);
    body.append(prompt, answer, actions);
    item.append(meta, body);
    questionList.appendChild(item);
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: passwordInput.value })
    });
    passwordInput.value = "";
    showWorkspace();
    await Promise.all([loadQuestions(), loadSettings()]);
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  showLogin();
});

document.querySelectorAll("[data-type]").forEach((button) => {
  button.addEventListener("click", () => setType(button.dataset.type));
});

document.querySelectorAll("[data-ox]").forEach((button) => {
  button.addEventListener("click", () => setOxAnswer(button.dataset.ox === "true"));
});

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  const payload = collectPayload();

  try {
    if (state.editingId) {
      await api(`/api/admin/questions/${encodeURIComponent(state.editingId)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      formMessage.textContent = "수정했습니다.";
    } else {
      await api("/api/admin/questions", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      formMessage.textContent = "등록했습니다.";
    }
    resetForm();
    await loadQuestions();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

cancelEditButton.addEventListener("click", resetForm);

designForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  designMessage.textContent = "";
  try {
    const data = await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(collectSettingsPayload())
    });
    state.settings = data.settings;
    renderSettingsForm();
    designMessage.textContent = "디자인 설정을 저장했습니다.";
  } catch (error) {
    designMessage.textContent = error.message;
  }
});

settingStartBackgroundImage.addEventListener("change", () => {
  setBackgroundImage("start", settingStartBackgroundImage.files[0]);
});

settingFinalBackgroundImage.addEventListener("change", () => {
  setBackgroundImage("final", settingFinalBackgroundImage.files[0]);
});

clearStartBackgroundButton.addEventListener("click", () => {
  if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
  state.settings.startBackgroundImage = "";
  settingStartBackgroundImage.value = "";
  startBackgroundStatus.textContent = "삭제 예정";
  designMessage.textContent = "디자인 저장을 누르면 시작 배경 사진이 삭제됩니다.";
});

clearFinalBackgroundButton.addEventListener("click", () => {
  if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
  state.settings.finalBackgroundImage = "";
  settingFinalBackgroundImage.value = "";
  finalBackgroundStatus.textContent = "삭제 예정";
  designMessage.textContent = "디자인 저장을 누르면 마지막 배경 사진이 삭제됩니다.";
});

settingStartBackgroundDim.addEventListener("input", () => {
  startBackgroundDimValue.textContent = `${settingStartBackgroundDim.value}%`;
});

settingFinalBackgroundDim.addEventListener("input", () => {
  finalBackgroundDimValue.textContent = `${settingFinalBackgroundDim.value}%`;
});

bulkImportButton.addEventListener("click", async () => {
  bulkMessage.textContent = "";
  try {
    const result = await api("/api/admin/import", {
      method: "POST",
      body: JSON.stringify({ text: bulkInput.value })
    });
    const suffix = result.errors?.length ? ` 일부 제외: ${result.errors.join(" / ")}` : "";
    bulkMessage.textContent = `${result.imported}개 문제를 등록했습니다.${suffix}`;
    await loadQuestions();
  } catch (error) {
    bulkMessage.textContent = error.message;
  }
});

boot().catch((error) => {
  loginMessage.textContent = error.message;
  showLogin();
});
