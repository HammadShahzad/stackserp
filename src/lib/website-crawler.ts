/**
 * Direct website crawler — fetches HTML from the actual website
 * to extract favicon, internal links, and sitemap entries.
 * No Perplexity / SERP wasted.
 */

export interface CrawlResult {
  favicon: string | null;
  pages: { title: string; url: string }[];
  sitemapUrls: string[];
}

function absoluteUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function extractFavicon(html: string, baseUrl: string): string | null {
  // Priority order: apple-touch-icon > icon (type svg) > icon (any) > shortcut icon > /favicon.ico
  const patterns = [
    /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i,
    /<link[^>]*rel=["']icon["'][^>]*type=["']image\/svg[^"']*["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']icon["']/i,
    /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']shortcut icon["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const href = match[1] || match[2];
      if (href) return absoluteUrl(baseUrl, href);
    }
  }

  return absoluteUrl(baseUrl, "/favicon.ico");
}

function extractLinks(html: string, baseUrl: string): { title: string; url: string }[] {
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const results: { title: string; url: string }[] = [];

  // Match <a> tags with href
  const linkRegex = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const rawText = match[2].replace(/<[^>]+>/g, "").trim();

    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    const fullUrl = absoluteUrl(baseUrl, href);
    if (!fullUrl) continue;

    // Only keep same-origin links
    try {
      if (new URL(fullUrl).origin !== origin) continue;
    } catch {
      continue;
    }

    const normalized = fullUrl.split("?")[0].split("#")[0].replace(/\/$/, "");
    if (seen.has(normalized) || normalized === origin) continue;
    seen.add(normalized);

    const title = rawText.slice(0, 120) || normalized.split("/").pop() || "";
    if (title) results.push({ title, url: fullUrl.split("#")[0] });
  }

  return results;
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

async function fetchSitemap(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const sitemapUrl = `${baseUrl.replace(/\/$/, "")}/sitemap.xml`;

  try {
    const res = await fetch(sitemapUrl, {
      headers: { "User-Agent": "StackSerp-Bot/1.0" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (!res.ok) return urls;

    const xml = await res.text();
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
      const url = match[1].trim();
      if (url.startsWith("http")) urls.push(url);
    }
  } catch {
    // Sitemap not available — that's fine
  }

  return urls;
}

export async function crawlWebsite(url: string): Promise<CrawlResult> {
  const baseUrl = url.replace(/\/$/, "");
  const result: CrawlResult = { favicon: null, pages: [], sitemapUrls: [] };

  const [htmlRes, sitemapUrls] = await Promise.all([
    fetch(baseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StackSerp-Bot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    }).catch(() => null),
    fetchSitemap(baseUrl),
  ]);

  result.sitemapUrls = sitemapUrls;

  if (htmlRes?.ok) {
    const html = await htmlRes.text();
    result.favicon = extractFavicon(html, baseUrl);
    result.pages = extractLinks(html, baseUrl);
  }

  // Merge sitemap URLs into pages (deduplicated)
  const existingUrls = new Set(result.pages.map((p) => p.url.replace(/\/$/, "")));
  for (const sUrl of sitemapUrls) {
    const normalized = sUrl.replace(/\/$/, "");
    if (!existingUrls.has(normalized)) {
      existingUrls.add(normalized);
      const slug = normalized.split("/").pop() || "";
      const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      result.pages.push({ title, url: sUrl });
    }
  }

  return result;
}

/**
 * Fetch just the favicon for a website.
 */
export async function fetchFavicon(url: string): Promise<string | null> {
  const baseUrl = url.replace(/\/$/, "");
  try {
    const res = await fetch(baseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StackSerp-Bot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractFavicon(html, baseUrl);
  } catch {
    return null;
  }
}
