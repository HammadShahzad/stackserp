/**
 * POST /api/websites/[websiteId]/posts/[postId]/seo-fix
 * Auto-fixes detectable SEO issues in a post:
 *   - Long paragraphs (>80 words) → split at sentence boundaries
 *   - Missing H3 subheadings → AI adds H3s under each H2
 *   - Word count < 1500 → AI expands content slightly
 *   - Internal links < 15 → AI inserts links to existing posts
 */
import { NextResponse } from "next/server";
import { verifyWebsiteAccess } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import { generateText } from "@/lib/ai/gemini";

type Params = { params: Promise<{ websiteId: string; postId: string }> };

function detectIssues(content: string, wordCount: number) {
  const h2Count = (content.match(/^## /gm) || []).length;
  const h3Count = (content.match(/^### /gm) || []).length;
  const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 50);
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 80);

  return {
    needsH3: h2Count >= 2 && h3Count === 0,
    needsWords: wordCount < 1500,
    needsLinks: linkCount < 15,
    longParaCount: longParagraphs.length,
    h2Count,
    h3Count,
    linkCount,
    wordCount,
  };
}

/** Split overly long paragraphs without AI */
function fixLongParagraphs(content: string): string {
  return content
    .split("\n\n")
    .flatMap((block) => {
      const trimmed = block.trim();
      if (/^(#{1,6}\s|[-*]\s|\d+\.\s|!\[|```|<|\|)/.test(trimmed)) return [block];
      const words = trimmed.split(/\s+/);
      if (words.length <= 80) return [block];
      const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
      if (!sentences || sentences.length < 2) return [block];
      const mid = Math.ceil(sentences.length / 2);
      return [
        sentences.slice(0, mid).join("").trim(),
        sentences.slice(mid).join("").trim(),
      ];
    })
    .join("\n\n");
}

export async function POST(req: Request, { params }: Params) {
  const { websiteId, postId } = await params;
  const access = await verifyWebsiteAccess(websiteId);
  if ("error" in access) return access.error;

  const post = await prisma.blogPost.findFirst({
    where: { id: postId, websiteId },
    select: {
      content: true,
      title: true,
      focusKeyword: true,
      wordCount: true,
    },
  });

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const words = post.content.split(/\s+/).filter(Boolean);
  const issues = detectIssues(post.content, words.length);

  // Step 1: Fix long paragraphs in code (fast, no AI cost)
  let fixed = fixLongParagraphs(post.content);

  // Collect AI tasks
  const tasks: string[] = [];

  if (issues.needsH3) {
    tasks.push(
      `- Add H3 subheadings (###) inside each H2 section where content warrants it. Each H2 should have 1-2 H3s breaking down the subtopic further. Do NOT change existing H2 headings or content.`
    );
  }

  if (issues.needsWords) {
    const deficit = 1500 - words.length;
    tasks.push(
      `- Expand content by approximately ${deficit + 50} words. Add a brief extra paragraph or expand thin sections — keep it relevant to the topic. Do NOT add new H2 sections.`
    );
  }

  if (issues.needsLinks) {
    const needed = Math.max(0, 15 - issues.linkCount);
    // Fetch existing published posts for this site to link to
    const existingPosts = await prisma.blogPost.findMany({
      where: { websiteId, status: "PUBLISHED", id: { not: postId } },
      select: { title: true, slug: true, focusKeyword: true },
      orderBy: { publishedAt: "desc" },
      take: 30,
    });

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { brandUrl: true, customDomain: true },
    });

    if (existingPosts.length > 0 && website) {
      const baseUrl = website.brandUrl.replace(/\/$/, "");
      const linkList = existingPosts
        .map((p) => {
          const url = website.customDomain
            ? `https://${website.customDomain}/${p.slug}`
            : `${baseUrl}/blog/${p.slug}`;
          return `  - "${p.focusKeyword || p.title}" → ${url}`;
        })
        .join("\n");

      tasks.push(
        `- Add ${needed} more internal links by naturally hyperlinking relevant phrases in the text to these URLs:\n${linkList}\n  Rules: each URL max once, use descriptive anchor text, insert where contextually relevant.`
      );
    }
  }

  // Run AI fixes if needed
  if (tasks.length > 0) {
    const taskList = tasks.join("\n");
    const keyword = post.focusKeyword || post.title;

    const prompt = `You are an SEO editor. Apply ONLY the following fixes to the blog post below. Do not rewrite, restructure, or change anything else. Preserve all existing headings, content, formatting, links, and tone exactly.

## Fixes to apply:
${taskList}

## Focus keyword: "${keyword}"

## Blog post:
${fixed}

Output ONLY the fixed blog post in Markdown. No explanations, no preamble.`;

    try {
      const aiFixed = await generateText(prompt, undefined, {
        temperature: 0.2,
        maxTokens: 8192,
      });
      if (aiFixed && aiFixed.length > fixed.length * 0.7) {
        fixed = aiFixed;
      }
    } catch (err) {
      console.error("[seo-fix] AI step failed:", err);
      // Return the paragraph-only fix if AI errors
    }
  }

  // Re-run paragraph fix on the AI output too
  fixed = fixLongParagraphs(fixed);

  // Compute new word count
  const newWordCount = fixed.split(/\s+/).filter(Boolean).length;

  // Persist the fixed content
  await prisma.blogPost.update({
    where: { id: postId },
    data: { content: fixed, wordCount: newWordCount },
  });

  return NextResponse.json({
    content: fixed,
    wordCount: newWordCount,
    issuesFixed: {
      longParagraphs: issues.longParaCount,
      addedH3s: issues.needsH3,
      expandedWords: issues.needsWords,
      addedLinks: issues.needsLinks,
    },
  });
}
