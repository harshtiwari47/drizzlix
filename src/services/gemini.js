import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API with the key from environment variables
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function createUserError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function extractRetryDelaySeconds(raw = "") {
  const text = String(raw || "");
  const retryInfoMatch = text.match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s?/i);
  if (retryInfoMatch) {
    return Math.max(1, Math.ceil(Number(retryInfoMatch[1])));
  }
  const retryDelayMatch = text.match(/"retryDelay"\s*:\s*"([0-9]+)s"/i);
  if (retryDelayMatch) {
    return Math.max(1, Number(retryDelayMatch[1]));
  }
  return null;
}

function mapGeminiError(error, { isFile = false } = {}) {
  const knownUserCodes = new Set([
    "MALFORMED_JSON",
    "MALFORMED_OUTPUT",
    "INVALID_KEY",
    "MODEL_UNAVAILABLE",
    "TIMEOUT",
    "QUOTA_EXCEEDED",
    "NETWORK_ERROR",
    "GEMINI_UNKNOWN",
    "FILE_MISSING",
    "FILE_TOO_LARGE",
    "FILE_TYPE_UNSUPPORTED",
    "QUIZ_EMPTY_SOURCE",
    "EMPTY_CARD",
  ]);

  if (error?.code === "MALFORMED_JSON") {
    return createUserError(
      "MALFORMED_OUTPUT",
      isFile
        ? "The file was uploaded, but Gemini returned malformed card data. Try again or shorten instructions."
        : "Gemini returned malformed card data. Try again, simplify the prompt, or switch model.",
    );
  }

  if (typeof error?.code === "string" && knownUserCodes.has(error.code)) {
    return error;
  }

  const status = Number(error?.status || error?.cause?.status || 0);
  const msg = String(error?.message || "").toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    msg.includes("api key") ||
    msg.includes("unauthorized") ||
    msg.includes("permission denied")
  ) {
    return createUserError(
      "INVALID_KEY",
      "Invalid or unauthorized Gemini API key. Please verify your key and permissions.",
    );
  }

  if (
    status === 404 ||
    (msg.includes("model") &&
      (msg.includes("not found") || msg.includes("unavailable")))
  ) {
    return createUserError(
      "MODEL_UNAVAILABLE",
      "Selected Gemini model is unavailable right now. Try another model and retry.",
    );
  }

  if (
    status === 408 ||
    status === 504 ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("deadline exceeded")
  ) {
    return createUserError(
      "TIMEOUT",
      "Gemini request timed out. Please retry with a shorter prompt/file instructions.",
    );
  }

  if (
    status === 429 ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    const retrySeconds = extractRetryDelaySeconds(error?.message);
    return createUserError(
      "QUOTA_EXCEEDED",
      retrySeconds
        ? `AI quota reached. Please retry in about ${retrySeconds}s.`
        : "AI generation limit reached. Please try again later.",
    );
  }

  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("econn") ||
    msg.includes("enotfound")
  ) {
    return createUserError(
      "NETWORK_ERROR",
      "Network issue while contacting Gemini. Check your internet and try again.",
    );
  }

  return createUserError(
    "GEMINI_UNKNOWN",
    `Gemini request failed. ${error?.message || "Please try again."}`,
  );
}

function parseFlashcardsJson(rawJson) {
  const tryParse = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const direct = tryParse(rawJson);
  if (direct) return direct;

  // Recovery path for LaTeX-like text where single backslashes break JSON parsing.
  const escapeRepaired = rawJson.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
  const escaped = tryParse(escapeRepaired);
  if (escaped) return escaped;

  // Recovery path for model outputs that accidentally leave trailing commas.
  const trailingCommaRepaired = escapeRepaired.replace(/,\s*([}\]])/g, "$1");
  const trailingCommaFixed = tryParse(trailingCommaRepaired);
  if (trailingCommaFixed) return trailingCommaFixed;

  const malformed = new Error(
    "AI response format issue: model returned invalid JSON.",
  );
  malformed.code = "MALFORMED_JSON";
  throw malformed;
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function clearArrayBuffer(arrayBuffer) {
  if (!arrayBuffer) return;
  try {
    const bytes = new Uint8Array(arrayBuffer);
    bytes.fill(0);
  } catch (err) {
    console.warn("Unable to clear upload buffer from memory.", err);
  }
}

function normalizeModelMarkdownArtifacts(text = "") {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");

  const lines = normalized.split("\n");
  let inCodeFence = false;

  const cleaned = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      return line;
    }

    if (inCodeFence) return line;

    // Keep math-heavy lines intact to avoid damaging LaTeX escapes.
    const seemsLatex = line.includes("$") || /\\[a-zA-Z]+/.test(line);
    if (seemsLatex) {
      return line;
    }

    // Remove accidental model artifacts like sentence-ending backslashes.
    return line.replace(/(^|[^\\])\\\s*$/, "$1").replace(/[ \t]+$/, "");
  });

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function sanitizeGeneratedCards(parsedData) {
  const cards = Array.isArray(parsedData) ? parsedData : [];
  const safeCards = [];
  for (const card of cards) {
    const cleanFront = normalizeModelMarkdownArtifacts(String(card?.front || ""));
    const cleanBack = normalizeModelMarkdownArtifacts(String(card?.back || ""));
    safeCards.push({
      ...card,
      front: cleanFront,
      back: cleanBack,
    });
  }
  return safeCards;
}

function getFlashcardSystemPrompt() {
  return `You are a world-class cognitive science AI specializing in generating hyper-optimized flashcards.
Given a topic, document, or image, you must generate a highly comprehensive set of flashcards (between 10 and 20 nodes depending on complexity) to fully map the concept.
Each flashcard must have a concise 'front' (the concept, question, or term) and an accurate 'back' (the explanation or answer).

Guidelines for the 'back' field:
- Use simple Markdown for better readability (bullet points for lists, bold for emphasis, etc.).
- Use inline code blocks for technical terms or snippets.
- Use LaTeX for mathematical formulas and scientific notation.
  - Inline formulas: Use $...$ (e.g., $E=mc^2$).
  - Block formulas: Use $$...$$ on a new line (e.g., $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$).
- JSON escaping is mandatory: every backslash in output text must be escaped as \\\\.
- Example: a JSON-safe inline formula should look like "$\\\\alpha + \\\\beta$".
- Keep the structure clean and professional. Avoid excessive markdown unless it adds clarity.

Return your response STRICTLY as a raw JSON array of objects. Do not include markdown wrapping (like \`\`\`json) or any other text.
Format MUST be:
[
  { "front": "Concept Name", "back": "Detailed explanation..." },
  { "front": "Concept Name 2", "back": "Detailed explanation 2..." }
]`;
}

export async function generateFlashcards(
  prompt,
  modelName = "gemini-2.5-flash",
  options = {},
) {
  const onPhaseChange =
    typeof options?.onPhaseChange === "function" ? options.onPhaseChange : null;
  const shouldCancel =
    typeof options?.shouldCancel === "function" ? options.shouldCancel : null;
  const emitPhase = (phase) => {
    if (onPhaseChange) onPhaseChange(phase);
  };
  const throwIfCancelled = () => {
    if (shouldCancel && shouldCancel()) {
      throw new Error("Generation cancelled");
    }
  };

  if (!apiKey || apiKey === "your_api_key_here") {
    throw createUserError(
      "INVALID_KEY",
      "Gemini API key is missing or invalid. Please add a valid key in .env.local.",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Using gemini-2.5-flash which is the authorized model for this API key
  const model = genAI.getGenerativeModel({ model: modelName });

  const systemPrompt = getFlashcardSystemPrompt();

  try {
    emitPhase("Generating");
    throwIfCancelled();

    const result = await model.generateContent(
      `${systemPrompt}\n\nTopic: ${prompt}`,
    );

    emitPhase("Parsing");
    throwIfCancelled();

    const responseText = result.response.text();

    // Extract only the JSON array from the response (finds the first '[' and last ']')
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(
        "Cognitive Synthesis Failed: No valid data vector found in response.",
      );
    }
    const cleanedText = jsonMatch[0];

    const parsedData = parseFlashcardsJson(cleanedText);
    const sanitizedCards = await sanitizeGeneratedCards(parsedData);

    // Validate output structure
    return sanitizedCards.map((card, index) => ({
      id: Date.now() + index,
      front: card.front || "Synthesis Error",
      back: card.back || "Failed to extract cognitive node data.",
    }));
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw mapGeminiError(error, { isFile: false });
  }
}

export async function generateFlashcardsFromFile(
  file,
  instructions = "",
  modelName = "gemini-2.5-flash",
  options = {},
) {
  const onPhaseChange =
    typeof options?.onPhaseChange === "function" ? options.onPhaseChange : null;
  const shouldCancel =
    typeof options?.shouldCancel === "function" ? options.shouldCancel : null;
  const emitPhase = (phase) => {
    if (onPhaseChange) onPhaseChange(phase);
  };
  const throwIfCancelled = () => {
    if (shouldCancel && shouldCancel()) {
      throw new Error("Generation cancelled");
    }
  };

  if (!apiKey || apiKey === "your_api_key_here") {
    throw createUserError(
      "INVALID_KEY",
      "Gemini API key is missing or invalid. Please add a valid key in .env.local.",
    );
  }

  if (!file) {
    throw createUserError(
      "FILE_MISSING",
      "No file selected. Please upload one PDF or image.",
    );
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) {
    throw createUserError(
      "UNSUPPORTED_FILE",
      "Unsupported file type. Please upload one PDF or image file.",
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw createUserError(
      "FILE_TOO_LARGE",
      "File is too large. Upload a file up to 20MB.",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const systemPrompt = getFlashcardSystemPrompt();

  let arrayBuffer;
  let base64Data = "";

  const instructionText = String(instructions || "").trim();
  const userPrompt = [
    "Generate 10 to 20 high-quality flashcards from the uploaded file.",
    instructionText
      ? `Additional user instructions: ${instructionText}`
      : "No additional user instructions.",
  ].join("\n");

  try {
    emitPhase("Uploading");
    throwIfCancelled();

    arrayBuffer = await file.arrayBuffer();

    emitPhase("Parsing");
    throwIfCancelled();

    base64Data = arrayBufferToBase64(arrayBuffer);

    emitPhase("Generating");
    throwIfCancelled();

    const result = await model.generateContent([
      `${systemPrompt}\n\n${userPrompt}`,
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      },
    ]);

    emitPhase("Parsing");
    throwIfCancelled();

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(
        "Cognitive Synthesis Failed: No valid data vector found in response.",
      );
    }

    const parsedData = parseFlashcardsJson(jsonMatch[0]);
    const sanitizedCards = await sanitizeGeneratedCards(parsedData);
    return sanitizedCards.map((card, index) => ({
      id: Date.now() + index,
      front: card.front || "Synthesis Error",
      back: card.back || "Failed to extract cognitive node data.",
    }));
  } catch (error) {
    console.error("Gemini File API Error:", error);
    throw mapGeminiError(error, { isFile: true });
  } finally {
    clearArrayBuffer(arrayBuffer);
    base64Data = "";
  }
}

export async function generateLineQuizzes(
  text,
  modelName = "gemini-2.5-flash",
) {
  if (!apiKey || apiKey === "your_api_key_here") {
    throw createUserError(
      "INVALID_KEY",
      "VITE_GEMINI_API_KEY is missing or invalid. Please add your real key to the .env.local file.",
    );
  }

  const normalized = String(text || "").trim();
  if (!normalized) {
    throw createUserError(
      "QUIZ_EMPTY_SOURCE",
      "No source text provided for quiz generation.",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are an expert quiz generator.
Given the study text, create short quizzes line-by-line.

Rules:
- Generate 1 quiz item for each meaningful line.
- If lines are too long, split into sensible sentence chunks first.
- Each item must include:
  - line: original line/chunk (shortened if needed)
  - question: clear recall question
  - answer: concise correct answer
- Keep questions practical and not vague.
- Return STRICT raw JSON array only.

Output format:
[
  { "line": "...", "question": "...", "answer": "..." }
]`;

  try {
    const result = await model.generateContent(
      `${prompt}\n\nStudy text:\n${normalized}`,
    );
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw createUserError(
        "MALFORMED_OUTPUT",
        "AI returned invalid quiz format. Please retry.",
      );
    }

    const parsed = parseFlashcardsJson(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      throw createUserError(
        "MALFORMED_OUTPUT",
        "AI returned invalid quiz format. Please retry.",
      );
    }

    return parsed
      .map((item, index) => ({
        id: `${Date.now()}-${index}`,
        line: item?.line || `Line ${index + 1}`,
        question: item?.question || "No question generated.",
        answer: item?.answer || "No answer generated.",
      }))
      .filter((item) => item.question && item.answer);
  } catch (error) {
    console.error("Gemini Quiz Error:", error);
    throw mapGeminiError(error, { isFile: false });
  }
}

export async function rephraseFlashcard(
  card,
  tone = "clear and concise",
  modelName = "gemini-2.5-flash",
) {
  if (!apiKey || apiKey === "your_api_key_here") {
    throw createUserError(
      "INVALID_KEY",
      "Gemini API key is missing or invalid. Please add a valid key in .env.local.",
    );
  }

  const front = String(card?.front || "").trim();
  const back = String(card?.back || "").trim();
  if (!front && !back) {
    throw createUserError("EMPTY_CARD", "Card is empty. Nothing to rephrase.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are rewriting one flashcard.
Goal: Keep meaning exactly the same, but rewrite in the requested tone.

Rules:
- Preserve technical correctness.
- Preserve markdown and formulas where useful.
- Keep the front short and question-like.
- Keep the back structured and readable.
- Do not add unrelated examples or extra sections.
- Return STRICT raw JSON only with keys: front, back.

Tone: ${tone}

Input flashcard:
${JSON.stringify({ front, back })}

Output format:
{ "front": "...", "back": "..." }`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw createUserError(
        "MALFORMED_JSON",
        "Gemini returned invalid rephrase data.",
      );
    }

    const parsed = parseFlashcardsJson(objectMatch[0]);
    const cleanFront = normalizeModelMarkdownArtifacts(String(parsed?.front || front));
    const cleanBack = normalizeModelMarkdownArtifacts(String(parsed?.back || back));
    return {
      front: cleanFront,
      back: cleanBack,
      failedImageUrls: Array.isArray(card?.failedImageUrls)
        ? card.failedImageUrls.map((u) => String(u)).filter(Boolean)
        : [],
    };
  } catch (error) {
    console.error("Gemini Rephrase Error:", error);
    throw mapGeminiError(error, { isFile: false });
  }
}
