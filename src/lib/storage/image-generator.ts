/**
 * AI Image Generation Pipeline
 * Gemini 2.0 Flash (creative prompt) → Imagen 4.0 → Sharp → WebP → Backblaze B2
 *
 * Two-step pipeline:
 *   1. Gemini generates a detailed, creative, style-specific image prompt
 *   2. Imagen renders it (fast model for batch jobs, full model for manual regen)
 *
 * Rate limits (Gemini API, per project):
 *   Free tier:  ~10-50 RPD for imagen-4.0-generate-001
 *   Tier 1:     ~70-200 RPD (billing linked)
 *   RPM:        ~10-20 RPM (varies by tier)
 */
import sharp from "sharp";
import { uploadToB2 } from "./backblaze";

const IMAGEN_FAST_MODEL = "imagen-4.0-fast-generate-001";
const IMAGEN_FULL_MODEL = process.env.IMAGEN_MODEL || "imagen-4.0-generate-001";
const GEMINI_PROMPT_MODEL = "gemini-2.0-flash";

const IMAGE_STYLES = [
  "flat vector illustration with bold colors and clean geometric shapes",
  "isometric 3D render with soft pastel palette and depth shadows",
  "cinematic photorealistic scene with dramatic studio lighting",
  "modern minimalist line art with a single vivid accent color",
  "editorial illustration with geometric abstract elements and bold typography feel",
  "watercolor painting style with vibrant ink washes and organic shapes",
  "retro vintage poster style with muted earth tones and grain texture",
  "collage-style mixed media with layered paper textures and cut-out shapes",
];

/**
 * Use Gemini to generate a rich, creative Imagen prompt from a raw topic/keyword.
 * Falls back to the original prompt if Gemini fails.
 */
async function buildCreativePrompt(
  rawPrompt: string,
  keyword: string,
  niche: string,
  apiKey: string
): Promise<string> {
  const style = IMAGE_STYLES[Math.floor(Math.random() * IMAGE_STYLES.length)];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_PROMPT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create 1 unique, creative image generation prompt for a blog hero image about "${keyword}" in the ${niche} industry.

CRITICAL RULES:
- DO NOT use generic "desk with laptop" or "office workspace" scenes — be specific and creative
- Visually represent the EXACT topic using metaphors, symbols, or creative conceptual scenes
- Art style: ${style}
- No text, no words, no letters, no watermarks anywhere in the image
- Make it eye-catching, specific, and memorable — not generic stock photo imagery
- Aspect ratio: 16:9 landscape, wide composition

Blog context: ${rawPrompt.slice(0, 300)}

Output ONLY a single JSON array with 1 string, example: ["detailed prompt here"]`,
            }],
          }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 300 },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini prompt generation failed: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed[0] && typeof parsed[0] === "string") {
        console.log(`[Image] Creative prompt generated (style: ${style.split(" ").slice(0, 3).join(" ")}…)`);
        return parsed[0];
      }
    }
  } catch (err) {
    console.warn("[Image] Gemini prompt generation failed, using fallback prompt:", err);
  }
  // Fallback: use the original prompt with style appended
  return `${rawPrompt} ${style}. No text or words in the image.`;
}

export async function generateBlogImage(
  prompt: string,
  slug: string,
  websiteId: string,
  overlayText?: string,
  keyword?: string,
  niche?: string,
  /** "fast" for batch/automated jobs (default); "high" for manual regeneration */
  quality: "fast" | "high" = "fast",
): Promise<string> {
  let apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");
  apiKey = apiKey.replace(/\\n/g, "").trim();

  const model = quality === "high" ? IMAGEN_FULL_MODEL : IMAGEN_FAST_MODEL;

  // Step 1: Use Gemini to craft a creative, detailed image prompt
  const creativePrompt = await buildCreativePrompt(
    prompt,
    keyword || slug.replace(/-/g, " "),
    niche || "business",
    apiKey,
  );

  const imageBytes = await generateWithImagen(creativePrompt, apiKey, 3, model);

  let processed = await sharp(imageBytes)
    .resize(1200, 630, {
      fit: "cover",
      position: "center",
    })
    .toBuffer();

  if (overlayText) {
    processed = await addTextOverlay(processed, overlayText);
  }

  processed = await sharp(processed).webp({ quality: 92 }).toBuffer();

  const key = `${websiteId}/blog-images/${slug}-featured.webp`;
  const url = await uploadToB2(processed, key, "image/webp");

  return url;
}

async function addTextOverlay(imageBuffer: Buffer, text: string): Promise<Buffer> {
  const width = 1200;
  const height = 630;
  const maxCharsPerLine = 30;
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  const displayLines = lines.slice(0, 3);
  const fontSize = displayLines.length > 2 ? 40 : 48;
  const lineHeight = fontSize * 1.3;
  const totalTextHeight = displayLines.length * lineHeight;
  const boxPadding = 30;
  const boxHeight = totalTextHeight + boxPadding * 2;
  const boxY = height - boxHeight - 40;

  const escapedLines = displayLines.map(l =>
    l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  );

  const textElements = escapedLines.map((line, i) => {
    const y = boxY + boxPadding + fontSize + i * lineHeight;
    return `<text x="${width / 2}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" filter="url(#shadow)">${line}</text>`;
  }).join("");

  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}">
      <defs>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.8)" />
        </filter>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,0,0,0)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.7)" />
        </linearGradient>
      </defs>
      <rect x="0" y="${boxY - 20}" width="${width}" height="${height - boxY + 20}" fill="url(#grad)" />
      ${textElements}
    </svg>
  `);

  return sharp(imageBuffer)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .toBuffer();
}

async function generateWithImagen(
  prompt: string,
  apiKey: string,
  retries = 3,
  model = IMAGEN_FAST_MODEL,
): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            personGeneration: "allow_adult",
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`[Imagen ${model}] attempt ${attempt}/${retries} — ${response.status}:`, err);
        lastError = new Error(`Imagen API error (${response.status}): ${err}`);

        if (response.status === 429) {
          // Rate limited — back off aggressively (RPM limit is 10-20)
          const backoff = Math.min(attempt * 8000, 30000);
          console.warn(`[Imagen] Rate limited, waiting ${backoff / 1000}s before retry…`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        if (response.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 5000));
          continue;
        }
        throw lastError;
      }

      const data = await response.json();
      const base64 = data.predictions?.[0]?.bytesBase64Encoded;

      if (!base64) {
        console.error(`[Imagen] attempt ${attempt}/${retries} — no image data:`, JSON.stringify(data).slice(0, 500));
        lastError = new Error("No image data returned from Imagen");
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }

      return Buffer.from(base64, "base64");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        console.warn(`[Imagen] attempt ${attempt} failed, retrying in ${attempt * 5}s…`);
        await new Promise((r) => setTimeout(r, attempt * 5000));
      }
    }
  }

  throw lastError || new Error("Image generation failed after all retries");
}

/**
 * Generate a smaller inline/section image (800x450, no text overlay)
 */
export async function generateInlineImage(
  prompt: string,
  slug: string,
  index: number,
  websiteId: string
): Promise<string> {
  let apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");
  apiKey = apiKey.replace(/\\n/g, "").trim();

  const imageBytes = await generateWithImagen(prompt, apiKey);

  const processed = await sharp(imageBytes)
    .resize(800, 450, { fit: "cover", position: "center" })
    .webp({ quality: 90 })
    .toBuffer();

  const key = `${websiteId}/blog-images/${slug}-inline-${index}.webp`;
  return uploadToB2(processed, key, "image/webp");
}

/**
 * Generate and upload a thumbnail version too (400x225)
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  slug: string,
  websiteId: string
): Promise<string> {
  const thumbnail = await sharp(imageBuffer)
    .resize(400, 225, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();

  const key = `${websiteId}/blog-images/${slug}-thumb.webp`;
  return uploadToB2(thumbnail, key, "image/webp");
}
