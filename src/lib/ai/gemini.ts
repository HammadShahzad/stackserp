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
    // Remove accidental \n or whitespace from env var
    apiKey = apiKey.replace(/\\n/g, "").trim();
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

export async function generateText(
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 8192,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
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
