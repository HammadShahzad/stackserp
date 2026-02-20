/**
 * Generic Webhook CMS Integration
 * POST a blog post payload to any URL (Webflow, custom CMS, Zapier, Make, etc.)
 */
import crypto from "crypto";

export interface WebhookConfig {
  webhookUrl: string;
  webhookSecret?: string;  // Used for HMAC signature in X-StackSerp-Signature header
}

export interface WebhookPostPayload {
  id: string;
  title: string;
  slug: string;
  content: string;       // Markdown
  contentHtml?: string;  // HTML version
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  featuredImage?: string;
  tags?: string[];
  category?: string;
  status: string;
  publishedAt?: string;
  wordCount?: number;
  readingTime?: number;
  websiteId: string;
  websiteDomain: string;
  brandName: string;
}

export async function sendWebhook(
  payload: WebhookPostPayload,
  config: WebhookConfig
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify({
    event: "post.published",
    timestamp: new Date().toISOString(),
    post: payload,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "StackSerp/1.0",
    "X-StackSerp-Event": "post.published",
    "X-StackSerp-Post-Id": payload.id,
  };

  // HMAC signature if secret provided
  if (config.webhookSecret) {
    const sig = crypto
      .createHmac("sha256", config.webhookSecret)
      .update(body)
      .digest("hex");
    headers["X-StackSerp-Signature"] = `sha256=${sig}`;
  }

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });

    return { success: res.ok, statusCode: res.status };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Webhook failed" };
  }
}
