/**
 * POST /api/websites/[websiteId]/posts/[postId]/seo-fix
 * Auto-fixes detectable SEO issues in a post:
 *   - Long paragraphs (>80 words)   → split at sentence boundaries (no AI)
 *   - Missing/stale Table of Contents → regenerated from all headings (no AI)
 *   - Missing H3 subheadings         → AI adds H3s under each H2
 *   - Word count < 1500              → AI expands content
 *   - Internal links < 15            → AI inserts links to existing posts
 */
import { NextResponse } from "next/server";
import { verifyWebsiteAccess } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import { generateText } from "@/lib/ai/gemini";

type Params = { params: Promise<{ websiteId: string; postId: string }> };

function detectIssues(content: string, wordCount: number) {
  const h2Count = (content.match(/^## /gm) || []).length;
  const h3Count = (content.match(/^### /gm) || []).length;
  // Count only non-anchor links (i.e., links to other pages, not #id links)
  const outboundLinks = (content.match(/\[.*?\]\((?!#).*?\)/g) || []).length;
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 50);
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 80);

  return {
    needsH3: h2Count >= 2 && h3Count === 0,
    needsWords: wordCount < 1500,
    needsLinks: outboundLinks < 15,
    longParaCount: longParagraphs.length,
    h2Count,
    h3Count,
    outboundLinks,
  };
}

/** Convert a heading text to a GitHub-style anchor id */
function toAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, "")   // strip markdown formatting chars
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Build a Markdown TOC from all H2 and H3 headings in the content.
 * H2s are top-level items; H3s are indented under their parent H2.
 */
function buildTOC(content: string): string {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const lines: string[] = ["## Table of Contents", ""];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length; // 2 = H2, 3 = H3
    const text = match[2].trim();
    // Skip the TOC heading itself
    if (/^table of contents$/i.test(text)) continue;
    const anchor = toAnchor(text);
    const indent = level === 3 ? "  " : "";
    lines.push(`${indent}- [${text}](#${anchor})`);
  }
  return lines.join("\n");
}

/**
 * Replace (or insert) the Table of Contents section in the content.
 * Looks for an existing "## Table of Contents" block and replaces it.
 * If none found, inserts it after the first paragraph.
 */
function injectTOC(content: string): string {
  const newTOC = buildTOC(content);

  // Match existing TOC block: "## Table of Contents" through next H2 (exclusive)
  const tocRegex = /^## Table of Contents\n[\s\S]*?(?=^## |\z)/im;
  if (tocRegex.test(content)) {
    return content.replace(tocRegex, newTOC + "\n\n");
  }

  // No TOC found — insert after first paragraph
  const firstParaEnd = content.indexOf("\n\n");
  if (firstParaEnd !== -1) {
    return (
      content.slice(0, firstParaEnd + 2) +
      newTOC +
      "\n\n" +
      content.slice(firstParaEnd + 2)
    );
  }
  return newTOC + "\n\n" + content;
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

export async function POST(_req: Request, { params }: Params) {
  const { websiteId, postId } = await params;
  const access = await verifyWebsiteAccess(websiteId);
  if ("error" in access) return access.error;

  const post = await prisma.blogPost.findFirst({
    where: { id: postId, websiteId },
    select: { content: true, title: true, focusKeyword: true, wordCount: true },
  });

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const words = post.content.split(/\s+/).filter(Boolean);
  const issues = detectIssues(post.content, words.length);

  // ── Step 1: Non-AI fixes (instant) ─────────────────────────────────────────
  let fixed = fixLongParagraphs(post.content);

  // ── Step 2: AI fixes ────────────────────────────────────────────────────────
  const tasks: string[] = [];

  if (issues.needsH3) {
    tasks.push(
`TASK A — Add H3 subheadings:
For each H2 section (## Heading), add 1-2 H3 subheadings (### Subheading) that logically divide the section content.
- Add H3 headings ONLY inside the body of H2 sections, never before the first H2
- Do NOT modify existing H2 headings or any existing text`
    );
  }

  if (issues.needsWords) {
    const deficit = 1500 - words.length;
    tasks.push(
`TASK B — Expand word count by ~${deficit + 60} words:
Add content to existing sections — a concrete example, extra explanation, or a practical tip.
- Do NOT add new H2 sections
- Keep the same writing style and tone`
    );
  }

  if (issues.needsLinks) {
    const needed = Math.max(0, 15 - issues.outboundLinks);

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
          return `  "${p.focusKeyword || p.title}" → ${url}`;
        })
        .join("\n");

      tasks.push(
`TASK C — Add ${needed} internal links (MANDATORY — you MUST do this):
Find ${needed} places in the article where a phrase naturally matches one of the topics below, and convert that phrase into a Markdown link.

Available pages to link to:
${linkList}

STRICT RULES:
- You MUST insert at least ${needed} new Markdown links in format [anchor text](URL)
- Each URL may only be used ONCE
- Use descriptive anchor text (the keyword phrase, not "click here")
- Insert links in the MIDDLE of paragraphs where the topic is relevant
- DO NOT cluster all links in one section — spread them throughout the article
- DO NOT link in headings, code blocks, or existing links`
      );
    }
  }

  if (tasks.length > 0) {
    const taskList = tasks.join("\n\n");
    const keyword = post.focusKeyword || post.title;

    const prompt = `You are an SEO editor. Apply the following tasks to the blog post below.
Do NOT rewrite, restructure, or change anything not explicitly listed in the tasks.
Preserve all existing content, formatting, tone, and links exactly.

${taskList}

Focus keyword: "${keyword}"

---BLOG POST START---
${fixed}
---BLOG POST END---

Output ONLY the complete modified blog post in Markdown. Start directly with the content — no explanations.`;

    try {
      const aiFixed = await generateText(prompt, undefined, {
        temperature: 0.2,
        maxTokens: 8192,
      });
      if (aiFixed && aiFixed.length > fixed.length * 0.7) {
        fixed = aiFixed.trim();
        // Strip any accidental preamble the AI adds before the article
        const firstHeadingOrPara = fixed.search(/^(#{1,3} |[A-Z*\[])/m);
        if (firstHeadingOrPara > 0 && firstHeadingOrPara < 300) {
          fixed = fixed.slice(firstHeadingOrPara);
        }
      }
    } catch (err) {
      console.error("[seo-fix] AI step failed:", err);
    }
  }

  // ── Step 3: Re-run paragraph fix on AI output ───────────────────────────────
  fixed = fixLongParagraphs(fixed);

  // ── Step 4: Regenerate Table of Contents from final heading structure ────────
  const tocFixed = injectTOC(fixed);
  // Only use the TOC-injected version if it didn't mangle the content
  if (tocFixed.length > fixed.length * 0.9) {
    fixed = tocFixed;
  }

  const newWordCount = fixed.split(/\s+/).filter(Boolean).length;

  await prisma.blogPost.update({
    where: { id: postId },
    data: { content: fixed, wordCount: newWordCount },
  });

  const finalIssues = detectIssues(fixed, newWordCount);

  return NextResponse.json({
    content: fixed,
    wordCount: newWordCount,
    issuesFixed: {
      longParagraphs: issues.longParaCount,
      addedH3s: issues.needsH3,
      expandedWords: issues.needsWords,
      addedLinks: issues.needsLinks,
      tocRegenerated: true,
    },
    // So the caller can see what's still not fixed
    remaining: {
      needsWords: finalIssues.needsWords,
      needsLinks: finalIssues.needsLinks,
      outboundLinks: finalIssues.outboundLinks,
    },
  });
}
