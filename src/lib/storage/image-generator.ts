/**
 * AI Image Generation Pipeline
 * Imagen 3.0 → Sharp resize → WebP → Backblaze B2
 */
import sharp from "sharp";
import { uploadToB2 } from "./backblaze";

export async function generateBlogImage(
  prompt: string,
  slug: string,
  websiteId: string
): Promise<string> {
  let apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");
  apiKey = apiKey.replace(/\\n/g, "").trim();

  // Generate image with Imagen 3.0
  const imageBytes = await generateWithImagen(prompt, apiKey);

  // Process with Sharp: resize to 1200x630 (OG image size) and convert to WebP
  const processed = await sharp(imageBytes)
    .resize(1200, 630, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 85 })
    .toBuffer();

  // Upload to Backblaze B2
  const key = `${websiteId}/blog-images/${slug}-featured.webp`;
  const url = await uploadToB2(processed, key, "image/webp");

  return url;
}

async function generateWithImagen(prompt: string, apiKey: string): Promise<Buffer> {
  // Imagen 3.0 via Vertex AI / Generative Language API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
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
