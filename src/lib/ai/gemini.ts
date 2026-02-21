/**
 * Gemini AI Client
 * Handles all Gemini API interactions for content generation
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;

export function getGemini() {
  if (!_genAI) {
    let apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");
    apiKey = apiKey.replace(/\\n/g, "").trim();
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

const DEFAULT_MODEL = "gemini-3.1-pro-preview";

let _modelOverride: string | null = null;
export function setModelOverride(model: string | null) {
  _modelOverride = model;
}

export interface GenerateTextResult {
  text: string;
  finishReason: string;
  promptTokens: number;
  outputTokens: number;
  truncated: boolean;
}

export async function generateText(
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<string> {
  const result = await generateTextWithMeta(prompt, systemPrompt, options);
  return result.text;
}

export async function generateTextWithMeta(
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<GenerateTextResult> {
  const genAI = getGemini();
  const modelName = options?.model || _modelOverride || DEFAULT_MODEL;
  const maxTokens = options?.maxTokens ?? 8192;
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: maxTokens,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason || "UNKNOWN";
  const usage = response.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  const truncated = finishReason === "MAX_TOKENS";

  if (truncated) {
    console.warn(`[gemini] ⚠️ Response truncated (MAX_TOKENS). Output: ${outputTokens}/${maxTokens} tokens, ~${text.split(/\s+/).length} words`);
  }
  if (finishReason === "SAFETY") {
    console.warn(`[gemini] ⚠️ Response blocked by safety filter. Output: ${text.length} chars`);
  }
  if (finishReason === "RECITATION") {
    console.warn(`[gemini] ⚠️ Response blocked by recitation filter. Output: ${text.length} chars`);
  }

  return { text, finishReason, promptTokens, outputTokens, truncated };
}

export async function generateJSON<T>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const text = await generateText(
    prompt + "\n\nRespond with valid JSON only. No markdown code blocks.",
    systemPrompt,
    { temperature: 0.3 }
  );

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as T;
}
