/**
 * AI Image Generation Pipeline
 * Imagen 4.0 → Sharp resize → WebP → Backblaze B2
 */
import sharp from "sharp";
import { uploadToB2 } from "./backblaze";

export async function generateBlogImage(
  prompt: string,
  slug: string,
  websiteId: string,
  overlayText?: string
): Promise<string> {
  let apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");
  apiKey = apiKey.replace(/\\n/g, "").trim();

  const imageBytes = await generateWithImagen(prompt, apiKey);

  let processed = await sharp(imageBytes)
    .resize(1200, 630, {
      fit: "cover",
      position: "center",
    })
    .toBuffer();

  if (overlayText) {
    processed = await addTextOverlay(processed, overlayText);
  }

  processed = await sharp(processed).webp({ quality: 85 }).toBuffer();

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

async function generateWithImagen(prompt: string, apiKey: string): Promise<Buffer> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          safetyFilterLevel: "block_some",
          personGeneration: "allow_adult",
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Imagen API error: ${err}`);
  }

  const data = await response.json();
  const base64 = data.predictions?.[0]?.bytesBase64Encoded;

  if (!base64) {
    throw new Error("No image data returned from Imagen");
  }

  return Buffer.from(base64, "base64");
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
