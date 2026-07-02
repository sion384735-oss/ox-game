const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "3847";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const MAX_BODY_BYTES = 1024 * 1024;

const sessions = new Map();

const defaultQuestions = [
  {
    id: "q_social_enterprise",
    type: "ox",
    prompt: "사회적기업은 사회적 목적을 추구하면서 영업활동을 하는 기업이다.",
    choices: ["O", "X"],
    answer: true
  },
  {
    id: "q_coop_owner",
    type: "choice",
    prompt: "협동조합에서 가장 기본이 되는 운영 원칙은 무엇인가요?",
    choices: [
      "조합원의 민주적 운영",
      "한 사람이 모든 결정을 하는 구조",
      "투자금이 많은 사람이 더 많은 표를 갖는 구조",
      "단기 이익만 우선하는 운영"
    ],
    answer: 0
  },
  {
    id: "q_village_company",
    type: "ox",
    prompt: "마을기업은 지역 주민이 지역 자원을 활용해 지역 문제 해결과 소득 창출을 함께 추구할 수 있다.",
    choices: ["O", "X"],
    answer: true
  },
  {
    id: "q_social_economy_goal",
    type: "choice",
    prompt: "사회적경제가 중요하게 여기는 가치와 가장 가까운 것은 무엇인가요?",
    choices: ["공동체와 상생", "독점과 배제", "무조건적인 가격 인상", "지역과 무관한 단기 투기"],
    answer: 0
  },
  {
    id: "q_profit",
    type: "ox",
    prompt: "사회적경제 조직은 수익을 낼 수 없고, 항상 무료로만 운영해야 한다.",
    choices: ["O", "X"],
    answer: false
  }
];

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(QUESTIONS_FILE);
  } catch {
    await saveQuestions(defaultQuestions);
  }
}

async function loadQuestions() {
  await ensureDataFile();
  const text = await fs.readFile(QUESTIONS_FILE, "utf8");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

async function saveQuestions(questions) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${QUESTIONS_FILE}.tmp`;
  await fs.writeFile(tmpFile, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
  await fs.rename(tmpFile, QUESTIONS_FILE);
}

function publicQuestion(question) {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    choices: question.choices
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(message);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function getSession(req) {
  const token = parseCookies(req).quiz_admin_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  if (getSession(req)) return true;
  sendJson(res, 401, { error: "로그인이 필요합니다." });
  return false;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `quiz_admin_session=${encodeURIComponent(
      token
    )}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "quiz_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw Object.assign(new Error("요청 데이터가 너무 큽니다."), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON 형식이 올바르지 않습니다."), { statusCode: 400 });
  }
}

function normalizeOxAnswer(value) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["o", "true", "1", "yes", "y", "맞음", "정답", "참"].includes(text)) return true;
  if (["x", "false", "0", "no", "n", "틀림", "오답", "거짓"].includes(text)) return false;
  return null;
}

function validateQuestion(input) {
  const type = input.type === "ox" ? "ox" : input.type === "choice" ? "choice" : null;
  const prompt = String(input.prompt || "").trim();
  if (!type) return { error: "문제 유형을 선택해주세요." };
  if (!prompt) return { error: "문제 내용을 입력해주세요." };

  if (type === "ox") {
    const answer = normalizeOxAnswer(input.answer);
    if (answer === null) return { error: "OX 문제의 정답은 O 또는 X로 입력해주세요." };
    return {
      question: {
        id: input.id || createId(),
        type,
        prompt,
        choices: ["O", "X"],
        answer
      }
    };
  }

  const choices = Array.isArray(input.choices)
    ? input.choices.map((choice) => String(choice || "").trim()).filter(Boolean)
    : [];
  const answer = Number(input.answer);

  if (choices.length < 2) return { error: "객관식은 보기를 2개 이상 입력해주세요." };
  if (!Number.isInteger(answer) || answer < 0 || answer >= choices.length) {
    return { error: "객관식 정답 번호가 올바르지 않습니다." };
  }

  return {
    question: {
      id: input.id || createId(),
      type,
      prompt,
      choices,
      answer
    }
  };
}

function createId() {
  return `q_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function parseBulkImport(text) {
  const blocks = String(text || "")
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  blocks.forEach((block, index) => {
    const lines = block
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

    const typeLine = lines.find((line) => /^(ox|o\/x|객관식|선택형)$/i.test(line));
    const choiceLines = lines
      .map((line) => line.match(/^(\d+)[.)\s]+(.+)$/))
      .filter(Boolean)
      .map((match) => ({ number: Number(match[1]), text: match[2].trim() }));
    const answerLine = lines.find((line) => /^(정답|답|answer|a)\s*[:：]/i.test(line));
    const promptLine = lines.find((line) => /^(문제|질문|q)\s*[:：]/i.test(line));

    const type =
      typeLine && /^객관식|선택형$/i.test(typeLine)
        ? "choice"
        : typeLine && /^(ox|o\/x)$/i.test(typeLine)
          ? "ox"
          : choiceLines.length
            ? "choice"
            : "ox";

    const prompt = promptLine
      ? promptLine.replace(/^(문제|질문|q)\s*[:：]\s*/i, "").trim()
      : lines
          .filter((line) => line !== typeLine)
          .filter((line) => !/^(정답|답|answer|a)\s*[:：]/i.test(line))
          .filter((line) => !/^(\d+)[.)\s]+(.+)$/.test(line))
          .join(" ")
          .trim();

    const rawAnswer = answerLine
      ? answerLine.replace(/^(정답|답|answer|a)\s*[:：]\s*/i, "").trim()
      : "";

    if (type === "choice") {
      const sortedChoices = choiceLines.sort((a, b) => a.number - b.number);
      const choices = sortedChoices.map((choice) => choice.text);
      const answerNumber = Number(String(rawAnswer).match(/\d+/)?.[0]);
      const answer = answerNumber - 1;
      const result = validateQuestion({ type, prompt, choices, answer });
      if (result.error) errors.push(`${index + 1}번째 문제: ${result.error}`);
      else questions.push(result.question);
      return;
    }

    const result = validateQuestion({ type, prompt, answer: rawAnswer });
    if (result.error) errors.push(`${index + 1}번째 문제: ${result.error}`);
    else questions.push(result.question);
  });

  return { questions, errors };
}

function isCorrect(question, answer) {
  if (!question) return false;
  if (question.type === "ox") {
    const normalized = normalizeOxAnswer(answer);
    return normalized !== null && normalized === question.answer;
  }
  if (question.type === "choice") {
    return Number(answer) === question.answer;
  }
  return false;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/questions") {
    const questions = await loadQuestions();
    sendJson(res, 200, { questions: questions.map(publicQuestion) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/check") {
    const body = await readJsonBody(req);
    const questions = await loadQuestions();
    const question = questions.find((item) => item.id === body.id);
    sendJson(res, 200, { correct: isCorrect(question, body.answer) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/me") {
    sendJson(res, 200, { authenticated: Boolean(getSession(req)) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const body = await readJsonBody(req);
    if (!safeEqual(body.password || "", ADMIN_PASSWORD)) {
      sendJson(res, 401, { error: "비밀번호가 올바르지 않습니다." });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    setSessionCookie(res, token);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    const token = parseCookies(req).quiz_admin_session;
    if (token) sessions.delete(token);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname.startsWith("/api/admin/") && !requireAdmin(req, res)) return;

  if (req.method === "GET" && pathname === "/api/admin/questions") {
    sendJson(res, 200, { questions: await loadQuestions() });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/questions") {
    const body = await readJsonBody(req);
    const result = validateQuestion(body);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
      return;
    }
    const questions = await loadQuestions();
    questions.push(result.question);
    await saveQuestions(questions);
    sendJson(res, 201, { question: result.question });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/import") {
    const body = await readJsonBody(req);
    const parsed = parseBulkImport(body.text || "");
    if (!parsed.questions.length) {
      sendJson(res, 400, { error: parsed.errors[0] || "등록할 수 있는 문제가 없습니다." });
      return;
    }
    const questions = await loadQuestions();
    await saveQuestions([...questions, ...parsed.questions]);
    sendJson(res, 200, { imported: parsed.questions.length, errors: parsed.errors });
    return;
  }

  const questionMatch = pathname.match(/^\/api\/admin\/questions\/([^/]+)$/);
  if (questionMatch) {
    const id = decodeURIComponent(questionMatch[1]);
    const questions = await loadQuestions();
    const index = questions.findIndex((question) => question.id === id);

    if (index === -1) {
      sendJson(res, 404, { error: "문제를 찾을 수 없습니다." });
      return;
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const result = validateQuestion({ ...body, id });
      if (result.error) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      questions[index] = result.question;
      await saveQuestions(questions);
      sendJson(res, 200, { question: result.question });
      return;
    }

    if (req.method === "DELETE") {
      const [deleted] = questions.splice(index, 1);
      await saveQuestions(questions);
      sendJson(res, 200, { question: deleted });
      return;
    }
  }

  sendJson(res, 404, { error: "요청한 API를 찾을 수 없습니다." });
}

async function serveStatic(req, res, pathname) {
  const routePath = pathname === "/" ? "/index.html" : pathname === "/admin" ? "/admin.html" : pathname;
  const normalized = path.normalize(routePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml"
      }[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    sendJson(res, statusCode, { error: error.message || "서버 오류가 발생했습니다." });
  }
}

function getLocalAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((network) => network && network.family === "IPv4" && !network.internal)
    .map((network) => network.address);
}

ensureDataFile().then(() => {
  http.createServer(handleRequest).listen(PORT, "0.0.0.0", () => {
    console.log(`사회적경제 퀴즈 서버가 실행 중입니다.`);
    console.log(`참가자 화면: http://localhost:${PORT}`);
    console.log(`관리자 화면: http://localhost:${PORT}/admin`);
    getLocalAddresses().forEach((address) => {
      console.log(`같은 와이파이 접속 예시: http://${address}:${PORT}`);
    });
    console.log(`관리자 기본 비밀번호: ${ADMIN_PASSWORD}`);
  });
});
