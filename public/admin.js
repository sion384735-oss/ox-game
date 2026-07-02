const state = {
  questions: [],
  type: "ox",
  oxAnswer: true,
  editingId: null
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
    await loadQuestions();
  } else {
    showLogin();
  }
}

async function loadQuestions() {
  const data = await api("/api/admin/questions");
  state.questions = data.questions || [];
  renderList();
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
    await loadQuestions();
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
