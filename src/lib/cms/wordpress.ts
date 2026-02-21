/**
 * WordPress REST API Integration
 * Supports two modes:
 *  1. Application Passwords (WP 5.6+) — no plugin required
 *  2. StackSerp Plugin — uses X-StackSerp-Key header and custom endpoint
 *
 * Mode is detected by cmsApiKey prefix:
 *  - "plugin:<key>" → Plugin mode
 *  - base64(username:::appPassword) → App-password mode
 */
import { marked } from "marked";

/**
 * Decode stored cmsApiKey into connection details.
 * Returns { mode, siteUrl, username, appPassword, pluginApiKey }
 */
export function decodeWordPressConfig(cmsApiUrl: string, cmsApiKey: string): WordPressConfig & { mode: "app-password" | "plugin" } {
  const base = (cmsApiUrl || "").replace(/\/$/, "");
  if (cmsApiKey.startsWith("plugin:")) {
    return {
      mode: "plugin",
      siteUrl: base,
      username: "",
      appPassword: "",
      pluginApiKey: cmsApiKey.slice("plugin:".length),
    };
  }
  // base64 encoded "username:::appPassword"
  try {
    const decoded = Buffer.from(cmsApiKey, "base64").toString("utf-8");
    const sep = decoded.indexOf(":::");
    if (sep !== -1) {
      return {
        mode: "app-password",
        siteUrl: base,
        username: decoded.slice(0, sep),
        appPassword: decoded.slice(sep + 3),
      };
    }
  } catch { /* fall through */ }
  return { mode: "app-password", siteUrl: base, username: "", appPassword: "" };
}

export interface WordPressConfig {
  siteUrl: string;         // e.g. https://mysite.com
  username: string;        // WordPress username (app-password mode)
  appPassword: string;     // Application Password (app-password mode)
  pluginApiKey?: string;   // StackSerp plugin API key (plugin mode)
  defaultStatus?: "draft" | "publish";
  defaultCategoryId?: number;
}

export interface WordPressPostPayload {
  title: string;
  content: string;          // HTML or Markdown (WP accepts both)
  excerpt?: string;
  slug?: string;
  status?: "draft" | "publish" | "pending" | "private";
  featuredImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  tags?: string[];
  category?: string;
}

export interface WordPressPostResult {
  success: boolean;
  wpPostId?: number;
  wpPostUrl?: string;
  wpEditUrl?: string;
  error?: string;
}

export interface WordPressConnectionResult {
  success: boolean;
  siteName?: string;
  siteUrl?: string;
  wpVersion?: string;
  userName?: string;
  error?: string;
}

function getAuthHeader(username: string, appPassword: string): string {
  const credentials = `${username}:${appPassword.replace(/\s/g, "")}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "").trim();
}

/**
 * Test if the WordPress credentials work
 */
export async function testWordPressConnection(
  config: WordPressConfig
): Promise<WordPressConnectionResult> {
  const base = normalizeUrl(config.siteUrl);
  const auth = getAuthHeader(config.username, config.appPassword);

  try {
    // Test auth by hitting /wp-json/wp/v2/users/me
    const [siteRes, userRes] = await Promise.all([
      fetch(`${base}/wp-json`, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`${base}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    if (!userRes.ok) {
      if (userRes.status === 401 || userRes.status === 403) {
        return {
          success: false,
          error:
            "Authentication failed. Check your username and Application Password.",
        };
      }
      return {
        success: false,
        error: `WordPress returned ${userRes.status}. Make sure the REST API is enabled.`,
      };
    }

    const user = await userRes.json();
    let siteName = base;
    let wpVersion: string | undefined;

    if (siteRes.ok) {
      const site = await siteRes.json();
      siteName = site.name || base;
      wpVersion = site.namespaces?.includes("wp/v2") ? site.url : undefined;
    }

    return {
      success: true,
      siteName,
      siteUrl: base,
      wpVersion,
      userName: user.name,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("fetch")) {
      return {
        success: false,
        error: `Cannot reach ${base}. Check the URL and make sure the site is online.`,
      };
    }
    return { success: false, error: msg };
  }
}

/**
 * Upload a featured image to WordPress Media Library
 * Returns the WordPress media attachment ID
 */
async function uploadFeaturedImage(
  imageUrl: string,
  postTitle: string,
  config: WordPressConfig
): Promise<number | null> {
  const base = normalizeUrl(config.siteUrl);
  const auth = getAuthHeader(config.username, config.appPassword);

  try {
    // Download image from its URL (runs server-side so no CORS issues)
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!imgRes.ok) {
      console.error(`[WP image] Failed to download from ${imageUrl}: HTTP ${imgRes.status}`);
      return null;
    }

    // Determine content type — fall back based on URL extension if missing
    let contentType = imgRes.headers.get("content-type") || "";
    if (!contentType || contentType === "application/octet-stream") {
      const lower = imageUrl.toLowerCase();
      if (lower.includes(".png")) contentType = "image/png";
      else if (lower.includes(".webp")) contentType = "image/webp";
      else if (lower.includes(".gif")) contentType = "image/gif";
      else contentType = "image/jpeg";
    }
    // Strip quality params like ";q=0.9"
    contentType = contentType.split(";")[0].trim();

    const ext = contentType === "image/png" ? "png"
      : contentType === "image/webp" ? "webp"
      : contentType === "image/gif" ? "gif"
      : "jpg";

    const slug = postTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const filename = `${slug}.${ext}`;
    const buffer = await imgRes.arrayBuffer();

    // Upload to WordPress media library
    const uploadRes = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": contentType,
      },
      body: buffer,
      signal: AbortSignal.timeout(45000),
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text().catch(() => "");
      console.error(`[WP image] Media upload failed: HTTP ${uploadRes.status} — ${errBody.slice(0, 300)}`);
      return null;
    }

    const media = await uploadRes.json();

    // Set alt text on the uploaded image
    if (media.id) {
      fetch(`${base}/wp-json/wp/v2/media/${media.id}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ alt_text: postTitle }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    }

    return media.id ?? null;
  } catch (err) {
    console.error("[WP image] uploadFeaturedImage threw:", err);
    return null;
  }
}

/**
 * Ensure WordPress tags exist and return their IDs
 */
async function ensureTags(
  tags: string[],
  config: WordPressConfig
): Promise<number[]> {
  const base = normalizeUrl(config.siteUrl);
  const auth = getAuthHeader(config.username, config.appPassword);
  const ids: number[] = [];

  for (const tag of tags.slice(0, 10)) {
    try {
      // Search for existing tag
      const searchRes = await fetch(
        `${base}/wp-json/wp/v2/tags?search=${encodeURIComponent(tag)}&per_page=1`,
        { headers: { Authorization: auth }, signal: AbortSignal.timeout(5000) }
      );
      if (searchRes.ok) {
        const results = await searchRes.json();
        if (results.length > 0) {
          ids.push(results[0].id);
          continue;
        }
      }

      // Create tag if not found
      const createRes = await fetch(`${base}/wp-json/wp/v2/tags`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: tag }),
        signal: AbortSignal.timeout(5000),
      });

      if (createRes.ok) {
        const created = await createRes.json();
        ids.push(created.id);
      }
    } catch {
      // skip this tag
    }
  }

  return ids;
}

/**
 * Convert markdown to clean HTML for WordPress using the `marked` library.
 * Also strips the inline TOC section (## Table of Contents … first H2) that
 * StackSerp injects for its own reader view — WordPress generates its own TOC.
 */
/**
 * Convert a heading text to a URL-safe anchor slug — matches the same
 * algorithm the AI uses when generating TOC links so anchors resolve.
 */
function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, "")   // strip markdown inline markers
    .replace(/[^\w\s-]/g, "")     // remove non-word chars (punctuation, colons, etc.)
    .trim()
    .replace(/\s+/g, "-")         // spaces → hyphens
    .replace(/-+/g, "-");         // collapse double-hyphens
}

export function markdownToHtml(markdown: string): string {
  // Strip any wrapping code fence (```markdown, ```plaintext, ```, etc.)
  const stripped = markdown
    .replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  // Keep the TOC in the content — headings now have id attributes so the
  // anchor links will work. Just ensure the TOC heading itself won't conflict.
  const withoutToc = stripped;

  // Custom renderer: add id to headings, wrap tables for responsive scroll
  const renderer = new marked.Renderer();

  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    const id = headingSlug(text);
    // Strip any inline markdown from heading text (bold, links, etc.)
    const cleanText = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "");
    return `<h${depth} id="${id}">${cleanText}</h${depth}>\n`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer.table = (token: any) => {
    // Render the table normally via a fresh renderer, then wrap for responsive scroll
    const defaultRenderer = new marked.Renderer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableHtml = (defaultRenderer as any).table(token);
    return `<div style="overflow-x:auto;margin:1.5em 0">${tableHtml}</div>\n`;
  };

  const html = marked.parse(withoutToc, {
    gfm: true,
    breaks: false,
    renderer,
  }) as string;

  return html;
}

/**
 * Push a blog post to WordPress
 */
export async function pushToWordPress(
  post: WordPressPostPayload,
  config: WordPressConfig
): Promise<WordPressPostResult> {
  const base = normalizeUrl(config.siteUrl);
  const auth = getAuthHeader(config.username, config.appPassword);

  try {
    // Convert markdown to HTML
    const htmlContent = markdownToHtml(post.content);

    // Upload featured image
    let featuredMediaId: number | undefined;
    if (post.featuredImageUrl) {
      const mediaId = await uploadFeaturedImage(
        post.featuredImageUrl,
        post.title,
        config
      );
      if (mediaId) featuredMediaId = mediaId;
    }

    // Ensure tags exist
    let tagIds: number[] = [];
    if (post.tags && post.tags.length > 0) {
      tagIds = await ensureTags(post.tags, config);
    }

    // Build post payload
    const payload: Record<string, unknown> = {
      title: post.title,
      content: htmlContent,
      status: post.status || config.defaultStatus || "draft",
      excerpt: post.excerpt || "",
      slug: post.slug || undefined,
      tags: tagIds,
    };

    if (featuredMediaId) {
      payload.featured_media = featuredMediaId;
    }

    if (config.defaultCategoryId) {
      payload.categories = [config.defaultCategoryId];
    }

    // Add Yoast SEO meta if fields provided (Yoast plugin required)
    if (post.metaTitle || post.metaDescription || post.focusKeyword) {
      payload.meta = {
        ...(post.metaTitle && { _yoast_wpseo_title: post.metaTitle }),
        ...(post.metaDescription && {
          _yoast_wpseo_metadesc: post.metaDescription,
        }),
        ...(post.focusKeyword && {
          _yoast_wpseo_focuskw: post.focusKeyword,
        }),
      };
    }

    const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        success: false,
        error:
          errBody.message ||
          `WordPress returned ${res.status}: ${res.statusText}`,
      };
    }

    const wpPost = await res.json();

    return {
      success: true,
      wpPostId: wpPost.id,
      wpPostUrl: wpPost.link,
      wpEditUrl: `${base}/wp-admin/post.php?post=${wpPost.id}&action=edit`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Supported plugin namespaces — tries stackserp first, falls back to blogforge.
 * This supports both the StackSerp Connector and legacy BlogForge Connector plugins.
 */
const PLUGIN_NAMESPACES = ["stackserp", "blogforge"];

/**
 * Detect which plugin namespace is active on the WordPress site.
 * Caches result for the duration of the request.
 */
async function detectPluginNamespace(
  base: string,
  apiKey: string,
): Promise<{ namespace: string; headerKey: string } | null> {
  for (const ns of PLUGIN_NAMESPACES) {
    const headerKey = ns === "stackserp" ? "X-StackSerp-Key" : "X-BlogForge-Key";
    try {
      const res = await fetch(`${base}/wp-json/${ns}/v1/status`, {
        headers: { [headerKey]: apiKey, "X-StackSerp-Key": apiKey, "X-BlogForge-Key": apiKey },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { namespace: ns, headerKey };
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Push a blog post via the StackSerp/BlogForge Connector plugin.
 * Auto-detects which plugin namespace is available on the site.
 */
export async function pushToWordPressPlugin(
  post: WordPressPostPayload,
  siteUrl: string,
  pluginApiKey: string
): Promise<WordPressPostResult> {
  const base = normalizeUrl(siteUrl);
  const htmlContent = markdownToHtml(post.content);

  try {
    const detected = await detectPluginNamespace(base, pluginApiKey);
    if (!detected) {
      return {
        success: false,
        error: "Could not reach the WordPress plugin. Make sure the StackSerp Connector (or BlogForge Connector) plugin is installed and activated.",
      };
    }

    // Download the featured image on our side so we can pass it as base64
    // — this is more reliable than asking the WordPress server to sideload it
    let featuredImageData: string | undefined;
    let featuredImageMime: string | undefined;
    if (post.featuredImageUrl) {
      try {
        const imgRes = await fetch(post.featuredImageUrl, { signal: AbortSignal.timeout(20000) });
        if (imgRes.ok) {
          let mime = (imgRes.headers.get("content-type") || "").split(";")[0].trim();
          if (!mime || mime === "application/octet-stream") {
            const lower = post.featuredImageUrl.toLowerCase();
            mime = lower.includes(".png") ? "image/png"
              : lower.includes(".webp") ? "image/webp"
              : lower.includes(".gif") ? "image/gif"
              : "image/jpeg";
          }
          const buf = await imgRes.arrayBuffer();
          featuredImageData = Buffer.from(buf).toString("base64");
          featuredImageMime = mime;
        } else {
          console.error(`[WP plugin image] Could not download ${post.featuredImageUrl}: HTTP ${imgRes.status}`);
        }
      } catch (imgErr) {
        console.error("[WP plugin image] Download error:", imgErr);
      }
    }

    const res = await fetch(`${base}/wp-json/${detected.namespace}/v1/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StackSerp-Key": pluginApiKey,
        "X-BlogForge-Key": pluginApiKey,
      },
      body: JSON.stringify({
        title: post.title,
        content: htmlContent,
        excerpt: post.excerpt || "",
        slug: post.slug || "",
        status: post.status || "draft",
        tags: post.tags || [],
        category: post.category || "",
        meta_title: post.metaTitle || "",
        meta_description: post.metaDescription || "",
        focus_keyword: post.focusKeyword || "",
        featured_image_url: post.featuredImageUrl || "",
        // Base64 fallback — used by plugin v1.2+ if sideload of the URL fails
        ...(featuredImageData && {
          featured_image_data: featuredImageData,
          featured_image_mime: featuredImageMime,
        }),
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as Record<string, string>;
      return { success: false, error: errBody.error || `WordPress plugin returned ${res.status}` };
    }

    const data = await res.json() as { post_id: number; post_url: string; edit_url: string };
    return {
      success: true,
      wpPostId: data.post_id,
      wpPostUrl: data.post_url,
      wpEditUrl: data.edit_url,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
