/**
 * Retroactive Internal Linker
 *
 * When a new post is published, automatically find 3-5 older relevant posts
 * and insert a single natural link back to the new post in each one.
 *
 * This keeps the internal link graph growing automatically without any
 * manual editing — identical to the technique used in InvoiceCave.
 *
 * Runs fire-and-forget from on-publish.ts — never blocks the publish flow.
 */
import prisma from "./prisma";
import { generateText } from "./ai/gemini";

/**
 * After a new post is published, update up to 5 older posts in the same
 * website to include a contextual link to the new post.
 *
 * Steps:
 *  1. Ask Gemini to pick the 3-5 most relevant existing posts
 *  2. For each chosen post, ask Gemini to insert ONE natural link
 *  3. Sanity-check (length, URL presence) then save to DB
 */
export async function updateOldPostsWithLink(
  newPostSlug: string,
  newPostTitle: string,
  newPostKeyword: string,
  websiteId: string,
  postBaseUrl: string  // e.g. "https://blog.example.com" or "https://sub.stackserp.com"
): Promise<number> {
  try {
    const [existingPosts, website] = await Promise.all([
      prisma.blogPost.findMany({
        where: { websiteId, status: "PUBLISHED", slug: { not: newPostSlug } },
        select: { id: true, slug: true, title: true, focusKeyword: true, content: true },
        orderBy: { publishedAt: "desc" },
        take: 40,
      }),
      prisma.website.findUnique({
        where: { id: websiteId },
        select: { brandName: true, tone: true, niche: true, targetAudience: true },
      }),
    ]);

    if (existingPosts.length === 0) return 0;

    const newPostUrl = `${postBaseUrl}/${newPostSlug}`;

    // Step 1: ask Gemini which posts are most topically relevant
    const postSummaries = existingPosts
      .map((p) => `ID:${p.id} | "${p.title}" | keyword: ${p.focusKeyword || "n/a"}`)
      .join("\n");

    const selectPrompt = `From the list below, pick the 3-5 articles MOST relevant to a new article titled "${newPostTitle}" (keyword: "${newPostKeyword}").
Only choose articles whose topics genuinely overlap — where a reader of one would benefit from reading the other.

Articles:
${postSummaries}

Output ONLY a JSON array of IDs. Example: ["id1","id2","id3"]`;

    const selectText = await generateText(selectPrompt, undefined, { temperature: 0.2, maxTokens: 200 });
    const idMatch = selectText?.match(/\[[\s\S]*?\]/);
    if (!idMatch) return 0;

    let selectedIds: string[];
    try {
      selectedIds = JSON.parse(idMatch[0]);
    } catch {
      return 0;
    }

    // Step 2: for each selected post, insert one contextual link
    let updatedCount = 0;
    for (const postId of selectedIds.slice(0, 5)) {
      const post = existingPosts.find((p) => p.id === postId);
      if (!post) continue;

      // Skip if it already links to this post
      if (post.content.includes(`/${newPostSlug}`)) continue;

      const brandLine = website
        ? `\nBrand: ${website.brandName} | Tone: ${website.tone || "professional"} | Audience: ${website.targetAudience || "general"}`
        : "";

      const linkPrompt = `You are an SEO editor. Add ONE natural internal link to the article below, pointing to a new related article.${brandLine}

New article to link to:
- Title: "${newPostTitle}"
- URL: ${newPostUrl}
- Keyword: "${newPostKeyword}"

## Rules:
1. Find the single BEST place in the article to naturally mention and link to the new article
2. Modify an EXISTING sentence to include a Markdown link — do NOT add a new sentence
3. Use descriptive, keyword-rich anchor text (not "click here" or "read more")
4. Keep ALL existing content exactly as-is except for the one link insertion
5. Output the COMPLETE article — no truncation
6. Match the existing article's tone and voice

## Article to update (keyword: "${post.focusKeyword || "n/a"}"):
${post.content}

Output ONLY the updated article in Markdown format. No code fences.`;

      try {
        const updated = await generateText(linkPrompt, undefined, { temperature: 0.2, maxTokens: 8192 });
        if (!updated) continue;

        const clean = updated
          .replace(/^```(?:markdown|md)?\s*\n?/i, "")
          .replace(/\n?```\s*$/i, "")
          .trim();

        // Sanity checks
        if (clean.length < post.content.length * 0.85) {
          console.warn(`[Linker] Output too short for "${post.title}" — skipping`);
          continue;
        }
        if (!clean.includes(`/${newPostSlug}`)) {
          console.warn(`[Linker] Link not inserted in "${post.title}" — skipping`);
          continue;
        }

        await prisma.blogPost.update({
          where: { id: post.id },
          data: { content: clean },
        });

        console.log(`[Linker] Updated "${post.title}" with link to "${newPostTitle}"`);
        updatedCount++;
      } catch (err: unknown) {
        console.warn(`[Linker] Failed to update "${post.title}":`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[Linker] ${updatedCount} older posts updated with link to "${newPostTitle}"`);
    return updatedCount;
  } catch (err: unknown) {
    console.error("[Linker] updateOldPostsWithLink failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}
