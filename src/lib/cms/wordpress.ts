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
    // Fetch the image from its URL
    const imgRes = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = await imgRes.arrayBuffer();

    // Derive file extension
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";

    const filename = `${postTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}.${ext}`;

    const uploadRes = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": contentType,
      },
      body: buffer,
      signal: AbortSignal.timeout(30000),
    });

    if (!uploadRes.ok) return null;

    const media = await uploadRes.json();
    return media.id || null;
  } catch {
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
 * Convert markdown to basic HTML for WordPress
 */
export function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`{3}[\s\S]*?`{3}/gm, (m) => `<pre><code>${m.replace(/`{3}\w*\n?/g, "")}</code></pre>`)
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[hup]|<li|<block)/gm, "<p>")
    .replace(/(?<!\>)\n$/gm, "</p>");
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
      }),
      signal: AbortSignal.timeout(30000),
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
