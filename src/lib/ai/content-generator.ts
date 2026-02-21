/**
 * Core AI Blog Generation Pipeline
 * 7-step process: Research → Outline → Draft → Tone → SEO → Metadata → Image
 *
 * Ported from InvoiceCave's proven 680-line blog-generator.ts with
 * multi-website parameterization.
 */
import { generateText, generateJSON, setModelOverride } from "./gemini";
import { researchKeyword, ResearchResult } from "./research";
import { generateBlogImage, generateInlineImage } from "../storage/image-generator";
import type { Website, BlogSettings } from "@prisma/client";

type WebsiteWithSettings = Website & {
  blogSettings?: BlogSettings | null;
  // Brand Intelligence fields (added in migration 20260221000003)
  uniqueValueProp?: string | null;
  competitors?: string[];
  keyProducts?: string[];
  targetLocation?: string | null;
};

export interface WebsiteContext {
  id: string;
  brandName: string;
  brandUrl: string;
  niche: string;
  targetAudience: string;
  tone: string;
  description: string;
  existingPosts?: { title: string; slug: string; url: string; focusKeyword: string }[];
  internalLinks?: { keyword: string; url: string }[];
  ctaText?: string;
  ctaUrl?: string;
  avoidTopics?: string[];
  writingStyle?: string;
  requiredSections?: string[];
  // Brand Intelligence
  uniqueValueProp?: string;
  competitors?: string[];
  keyProducts?: string[];
  targetLocation?: string;
}

export interface GeneratedPost {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  structuredData: object;
  socialCaptions: {
    twitter: string;
    linkedin: string;
    instagram: string;
    facebook: string;
  };
  wordCount: number;
  readingTime: number;
  tags: string[];
  category: string;
  researchData: ResearchResult;
}

export interface GenerationProgress {
  step: string;
  stepIndex: number;
  totalSteps: number;
  message: string;
  percentage: number;
}

export type ProgressCallback = (progress: GenerationProgress) => Promise<void>;

const STEPS = [
  "research",
  "outline",
  "draft",
  "tone",
  "seo",
  "metadata",
  "image",
] as const;

function getImageStyle(niche: string): string {
  const n = niche.toLowerCase();
  if (/food|restaurant|cook|recipe|bak/i.test(n))
    return "appetizing professional food photography style, warm lighting, shallow depth of field";
  if (/fashion|beauty|cosmetic|skincare/i.test(n))
    return "clean editorial photography style, soft natural lighting, modern aesthetic";
  if (/tech|saas|software|ai|developer|coding|startup/i.test(n))
    return "clean modern flat illustration with a professional tech aesthetic, minimal and sleek";
  if (/health|fitness|medical|wellness|yoga/i.test(n))
    return "bright clean lifestyle photography style, natural and uplifting";
  if (/finance|banking|invest|insurance|accounting/i.test(n))
    return "professional corporate illustration, clean lines, trustworthy blue-toned palette";
  if (/travel|hotel|tourism|adventure/i.test(n))
    return "vivid landscape photography style, cinematic composition, natural colors";
  if (/education|learning|school|course|tutoring/i.test(n))
    return "friendly modern illustration, approachable and colorful, educational context";
  if (/real.?estate|property|home|interior/i.test(n))
    return "professional architectural photography style, bright and inviting interiors";
  if (/marketing|seo|content|social.?media|agency/i.test(n))
    return "clean modern flat illustration with bold accent colors, professional and data-driven feel";
  if (/ecommerce|shop|retail|product/i.test(n))
    return "clean product photography style on minimal background, professional commercial look";
  return "clean professional illustration, modern and relevant to the topic";
}

const WRITING_STYLE_GUIDANCE: Record<string, string> = {
  informative: "Clear, factual, and educational. Use data, examples, and step-by-step explanations. Authoritative but accessible.",
  conversational: "Friendly and approachable, like talking to a knowledgeable colleague. Use contractions, direct address ('you'), and relatable analogies.",
  technical: "Precise and detailed, written for practitioners. Use correct terminology, include code snippets or configs where relevant, avoid over-simplifying.",
  storytelling: "Narrative-driven. Open with a story or scenario. Use anecdotes, case studies, and real-world examples to illustrate points.",
  persuasive: "Benefit-focused and compelling. Lead with outcomes, use social proof, and create urgency. Every section should move the reader toward action.",
  humorous: "Light-hearted, witty, and fun — but always substantive. Use humor to make complex topics memorable, never at the expense of accuracy.",
};

function buildSystemPrompt(ctx: WebsiteContext): string {
  const styleGuidance = ctx.writingStyle && WRITING_STYLE_GUIDANCE[ctx.writingStyle]
    ? WRITING_STYLE_GUIDANCE[ctx.writingStyle]
    : null;

  let prompt = `You are a professional blog writer for ${ctx.brandName} (${ctx.brandUrl}).
${ctx.brandName} is a ${ctx.description}.
Your target audience is: ${ctx.targetAudience}
Writing tone: ${ctx.tone}${styleGuidance ? `\nWriting style: ${ctx.writingStyle} — ${styleGuidance}` : ""}
Niche: ${ctx.niche}
${ctx.targetLocation ? `Geographic focus: ${ctx.targetLocation} — use locally relevant data, examples, pricing, and market references.` : ""}
${ctx.uniqueValueProp ? `${ctx.brandName}'s unique value: ${ctx.uniqueValueProp}` : ""}
${ctx.keyProducts?.length ? `Key products/features to reference naturally when relevant: ${ctx.keyProducts.join(", ")}` : ""}
${ctx.competitors?.length ? `Main competitors: ${ctx.competitors.join(", ")} — write content that positions ${ctx.brandName} as the better choice without directly attacking them.` : ""}

RULES:
- Write in a ${ctx.tone} style${styleGuidance ? `, applying the ${ctx.writingStyle} writing approach described above` : ""}
- Naturally mention ${ctx.brandName} where relevant (not forced)
${ctx.uniqueValueProp ? `- When recommending tools or solutions, position ${ctx.brandName} using its unique value: "${ctx.uniqueValueProp}"` : ""}
${ctx.ctaText && ctx.ctaUrl ? `- Include a call-to-action: "${ctx.ctaText}" linking to ${ctx.ctaUrl}` : ""}
${ctx.avoidTopics?.length ? `- Never mention: ${ctx.avoidTopics.join(", ")}` : ""}
- Format: Markdown with proper H2/H3 hierarchy
- Write for humans first, search engines second
- Use active voice, short paragraphs, and clear language

EEAT (Experience, Expertise, Authority, Trust) RULES:
- Write from the perspective of an expert with 10+ years of hands-on experience
- Use first-person experience phrases like "In my testing," "I've found that," "From my experience," "What I noticed," "After working with X for years"
- Share specific observations and personal insights — not generic advice
- Include practical "pro-tips" that only someone with real experience would know
- Reference specific scenarios you've encountered and how you solved them

BANNED AI PHRASES (NEVER USE):
- "Delve" or "delve into"
- "Dive deep" or "deep dive"
- "In today's fast-paced world" or "In today's digital landscape"
- "Buckle up"
- "Game-changer" or "game changing"
- "Leverage" (use "use" instead)
- "Utilize" (use "use" instead)
- "Tapestry"
- "Landscape" (when used metaphorically)
- "Realm"
- "Robust"
- "Cutting-edge" or "state-of-the-art"
- "Embark on a journey"
- "Navigating the complexities"
- "Unlock the power/potential"
- "It's important to note that" or "It's worth noting"
- Em-dash (—) — use commas or periods instead
- Do NOT start sentences with "So," or "Well,"
- Avoid overly formal transitions like "Furthermore," "Moreover," "Additionally"`;



  if (ctx.existingPosts?.length) {
    prompt += `\n- When relevant, link to existing blog articles on the site (links will be provided in the SEO optimization step)`;
  }

  return prompt;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export async function generateBlogPost(
  keyword: string,
  website: WebsiteWithSettings,
  contentLength: "SHORT" | "MEDIUM" | "LONG" | "PILLAR" = "MEDIUM",
  options: {
    includeImages?: boolean;
    includeFAQ?: boolean;
    includeTableOfContents?: boolean;
    onProgress?: ProgressCallback;
    existingPosts?: { title: string; slug: string; url: string; focusKeyword: string }[];
    internalLinks?: { keyword: string; url: string }[];
  } = {}
): Promise<GeneratedPost> {
  const { includeImages = true, includeFAQ = true, includeTableOfContents = true, onProgress } = options;

  // Use the preferred model from BlogSettings if configured
  const preferredModel = website.blogSettings?.preferredModel;
  if (preferredModel && preferredModel !== "gemini-3.1-pro-preview") {
    setModelOverride(preferredModel);
  }

  const ctx: WebsiteContext = {
    id: website.id,
    brandName: website.brandName,
    brandUrl: website.brandUrl,
    niche: website.niche,
    targetAudience: website.targetAudience,
    tone: website.tone,
    description: website.description,
    existingPosts: options.existingPosts,
    internalLinks: options.internalLinks,
    ctaText: website.blogSettings?.ctaText ?? undefined,
    ctaUrl: website.blogSettings?.ctaUrl ?? undefined,
    avoidTopics: website.blogSettings?.avoidTopics ?? undefined,
    writingStyle: website.blogSettings?.writingStyle ?? undefined,
    requiredSections: website.blogSettings?.requiredSections?.length ? website.blogSettings.requiredSections : undefined,
    uniqueValueProp: website.uniqueValueProp ?? undefined,
    competitors: website.competitors?.length ? website.competitors : undefined,
    keyProducts: website.keyProducts?.length ? website.keyProducts : undefined,
    targetLocation: website.targetLocation ?? undefined,
  };

  const wordTargets: Record<string, string> = {
    SHORT: "800-1200",
    MEDIUM: "1500-2500",
    LONG: "2500-4000",
    PILLAR: "4000-6000",
  };
  const targetWords = wordTargets[contentLength] || wordTargets.MEDIUM;

  const maxTokensForLength: Record<string, number> = {
    SHORT: 8192,
    MEDIUM: 12288,
    LONG: 16384,
    PILLAR: 24576,
  };
  const outputTokens = maxTokensForLength[contentLength] || maxTokensForLength.MEDIUM;

  const progress = async (step: typeof STEPS[number], message: string) => {
    const stepIndex = STEPS.indexOf(step);
    if (onProgress) {
      await onProgress({
        step,
        stepIndex,
        totalSteps: STEPS.length,
        message,
        percentage: Math.round(((stepIndex + 1) / STEPS.length) * 100),
      });
    }
  };

  const systemPrompt = buildSystemPrompt(ctx);

  // Detect comparison/listicle article type to force mandatory table
  const isComparisonArticle = /\b(best|vs\.?|compare|comparison|top \d+|alternatives?|review|which|ranking|ranked|versus)\b/i.test(keyword);

  // ─── STEP 1: RESEARCH ───────────────────────────────────────────
  await progress("research", `Researching "${keyword}"...`);
  const research = await researchKeyword(keyword, {
    ...ctx,
    description: ctx.description,
  });

  // ─── STEP 2: OUTLINE ────────────────────────────────────────────
  await progress("outline", "Creating content outline and structure...");
  const outline = await generateJSON<{
    title: string;
    sections: { heading: string; points: string[] }[];
    uniqueAngle: string;
  }>(
    `Create a detailed blog post outline for the keyword: "${keyword}"

## Brand Context
- Brand: ${ctx.brandName} (${ctx.niche})
- Target audience: ${ctx.targetAudience}
- Target word count: ${targetWords} words
${ctx.targetLocation ? `- Geographic focus: ${ctx.targetLocation}` : ""}
${ctx.uniqueValueProp ? `- ${ctx.brandName}'s USP: ${ctx.uniqueValueProp}` : ""}
${ctx.keyProducts?.length ? `- Products/features to reference: ${ctx.keyProducts.join(", ")}` : ""}

## What Competitors Are MISSING (these gaps MUST become dedicated sections or deep sub-points)
${research.contentGaps.length ? research.contentGaps.slice(0, 6).map((g, i) => `${i + 1}. ${g}`).join("\n") : "- Cover more specific, actionable advice than generic guides"}
${research.missingSubtopics?.length ? "\nMissing subtopics no current article covers:\n" + research.missingSubtopics.slice(0, 4).map((s) => `- ${s}`).join("\n") : ""}

## Winning Angle (what makes this article beat everything ranking now)
${research.suggestedAngle || "Take a more specific, practitioner-level perspective than generic overviews"}

## Questions People Ask That Current Articles Ignore
${research.commonQuestions.slice(0, 5).map((q) => `- ${q}`).join("\n")}

## Key Statistics to Use
${research.keyStatistics.slice(0, 4).map((s) => `- ${s}`).join("\n")}

## Research Summary
${research.rawResearch.substring(0, 2500)}

## Outline Rules
- H1 title: SEO-optimized (50-70 chars), includes keyword, reflects the winning angle
- 5-7 H2 sections — at least 2 of them must directly address the identified content gaps above
- Each section: 3-4 bullet points showing exactly what will be covered
- Vary section types: how-to, comparison table, case study, data breakdown, common mistakes
- Include a "Key Takeaways" box near the top
${isComparisonArticle ? `- ⚠️ MANDATORY COMPARISON TABLE: This is a comparison/listicle article ("${keyword}"). You MUST include a dedicated section in the outline (2nd or 3rd position) titled something like "Quick Comparison: [Options] at a Glance" or "Side-by-Side Comparison". This section's points must specify: a markdown table comparing all main options by key criteria (price, ease of use, best for, key features). THIS IS NON-NEGOTIABLE — do not skip the comparison table section.` : ""}
${includeFAQ ? "- Include a FAQ section answering the questions competitors' articles ignore" : ""}
${ctx.requiredSections?.length ? `- MUST include these sections: ${ctx.requiredSections.join(", ")}` : ""}
- Conclusion: CTA for ${ctx.brandName}${ctx.uniqueValueProp ? ` built around: "${ctx.uniqueValueProp}"` : ""}
- "uniqueAngle" field: the specific take that makes this article clearly better than the top 5 results

Return JSON: { "title": "...", "sections": [{ "heading": "...", "points": ["..."] }], "uniqueAngle": "..." }`,
    systemPrompt
  );

  // ─── STEP 3: DRAFT ───────────────────────────────────────────────
  await progress("draft", "Writing full article draft...");
  const draft = await generateText(
    `Write a complete, ${targetWords}-word blog post about "${keyword}" for ${ctx.brandName}.

Title: ${outline.title}
Unique angle: ${outline.uniqueAngle}
${ctx.targetLocation ? `Geographic context: Write for a ${ctx.targetLocation} audience — use relevant pricing, tools, and examples.` : ""}
${ctx.uniqueValueProp ? `Brand USP to highlight: "${ctx.uniqueValueProp}" — weave this into the conclusion and any tool/solution recommendations.` : ""}
${ctx.keyProducts?.length ? `Products/features to mention naturally where relevant: ${ctx.keyProducts.join(", ")}` : ""}
${ctx.competitors?.length ? `Context: ${ctx.brandName} competes with ${ctx.competitors.join(", ")} — don't mention competitors by name, but make ${ctx.brandName}'s approach clearly superior through specific examples.` : ""}

Outline to follow:
${outline.sections.map((s) => `## ${s.heading}\n${s.points.map((p) => `- ${p}`).join("\n")}`).join("\n\n")}

## Content Gaps to Fill (what competitors miss — cover these thoroughly)
${research.contentGaps.slice(0, 5).map((g, i) => `${i + 1}. ${g}`).join("\n")}
${research.missingSubtopics?.length ? "\nMissing subtopics that will make this article stand out:\n" + research.missingSubtopics.slice(0, 3).map((s) => `- ${s}`).join("\n") : ""}

## Research Data
${research.rawResearch.substring(0, 3500)}

## Writing Guidelines:

**HOOK (most important rule):**
The opening 2-3 paragraphs MUST drop the reader into a SPECIFIC, RELATABLE SITUATION before introducing the topic.
Think: paint a vivid scene the audience has lived through. A frustrated late-night moment, a specific pain point, a surprising contrast.
BAD opening: "Getting X used to be straightforward. Now it's complicated."
BAD opening: "In today's competitive landscape..."
GOOD opening: Put the reader IN a moment. Make them think "that's me."

**Structure:**
- Open with the HOOK (story/scenario/question)
- Key Takeaways / Quick Summary box (bulleted, 4-5 points)
${includeTableOfContents ? "- Table of Contents (linking to H2 sections — MUST match the actual H2 headings EXACTLY, character for character)" : "- Do NOT include a Table of Contents"}
- Main sections following the outline
${isComparisonArticle ? `- ⚠️ MANDATORY COMPARISON TABLE: You MUST include a markdown comparison table early in the article (before or right after the 2nd H2 section). Compare all the main options covered in this article. Example format:\n| Option | Best For | Price | Ease of Use | Key Feature |\n|--------|----------|-------|-------------|-------------|\n| ... | ... | ... | ... | ... |\nDo NOT skip the table. If you finish writing and there's no table, you have failed the assignment.` : ""}
${includeFAQ ? "- FAQ section (4-5 questions with detailed answers)" : ""}
- Conclusion with CTA for ${ctx.brandName}

**Content rules:**
- Write ${targetWords} words — comprehensive, beats competitors
- Every section must have a DIFFERENT internal structure: mix of prose, bullet lists, numbered steps, comparison tables, code snippets (if relevant), or callout boxes
- Include real statistics and data from the research with context
- Use the keyword "${keyword}" naturally — in first 100 words, one H2, and conclusion
- Write from an EXPERT perspective: "In my testing," "I've found," "From my experience," "What I noticed"
- EXPERT CALLOUTS: use at most 2 total "Pro Tip:" callouts in the ENTIRE article. Make them count — share something non-obvious that only someone with real experience would know. DO NOT add a "Pro Tip" in every section.
- Keep every paragraph under 80 words (3-4 sentences max)
- Use active voice, concrete examples, and specific numbers
- NEVER use: "delve," "dive deep," "game-changer," "leverage," "utilize," "tapestry," "landscape" (metaphorical), "realm," "robust," "cutting-edge," "embark on a journey," "navigating the complexities," "unlock the power"
- NEVER use em-dash (—). Use commas or periods instead.
- Write in Markdown format

Output ONLY the blog post content in Markdown. Do not include the title as an H1 — start with the hook paragraph.`,
    systemPrompt,
    { temperature: 0.8, maxTokens: outputTokens }
  );

  // ─── STEP 4: CRITIQUE + TONE POLISH ─────────────────────────────
  await progress("tone", "Polishing voice — removing generic patterns...");
  const toneRewritten = await generateText(
    `You are a senior editor at a sharp, opinionated media publication. Your job is to take a decent blog draft and make it genuinely great — the kind of article someone shares because it's actually useful AND enjoyable to read.

Brand voice for ${ctx.brandName}: "${ctx.tone}"
Audience: ${ctx.targetAudience}

## Your editing checklist (apply ALL of these):

**Kill generic patterns:**
- If the opening paragraph sounds like every other article on this topic, rewrite it with a specific scene, question, or startling observation that immediately pulls the reader in
- Count the "Pro Tip:" labels. If there are more than 2, delete the weakest ones and fold those insights naturally into the surrounding prose
- If any paragraph starts with "It is important to...", "In today's...", "As a [profession]...", or "With the rise of...", rewrite it completely
- If any two sections have the same rhythm/structure, change one of them

**Add genuine personality:**
- One well-placed pop culture reference, analogy, or moment of deadpan humor per 500 words (don't force it — only where it fits naturally)
- Use relatable comparisons specific to ${ctx.targetAudience}
- Where the draft states a generic opinion, replace it with a specific observation: "In my testing X happened" beats "experts say X is good"

**Tighten language:**
- Eliminate all em-dashes (—) — replace with commas or periods
- No "Furthermore," "Moreover," "Additionally" — use normal transitions
- No starting sentences with "So," or "Well,"
- Kill every instance of: "delve," "dive deep," "game-changer," "leverage," "utilize," "tapestry," "realm," "robust," "cutting-edge," "embark on a journey," "navigate the complexities," "unlock the power"
- Keep every paragraph under 80 words. Split anything longer.

**Preserve everything structural:**
- Keep ALL headings exactly as written (character for character — the TOC depends on them matching)
- Keep all facts, data, statistics, and internal links
- Keep Markdown formatting, tables, code blocks, bullet lists
- Do NOT add new H2 sections

## Draft to edit:
${draft}

Output ONLY the polished blog post in Markdown. Start directly with the content.
CRITICAL: Output the COMPLETE article — every section, every table, every paragraph. Do NOT stop early or truncate.`,
    systemPrompt,
    { temperature: 0.65, maxTokens: outputTokens }
  );

  // ─── STEP 5: SEO OPTIMIZATION ────────────────────────────────────
  await progress("seo", "Optimizing for SEO — keywords, links, structure...");

  // Build a single deduplicated internal link list (one entry per URL)
  const seenUrls = new Set<string>();
  const consolidatedLinks: { anchor: string; url: string }[] = [];

  if (ctx.internalLinks?.length) {
    for (const l of ctx.internalLinks) {
      if (!seenUrls.has(l.url)) {
        seenUrls.add(l.url);
        consolidatedLinks.push({ anchor: l.keyword, url: l.url });
      }
    }
  }
  if (ctx.existingPosts?.length) {
    for (const p of ctx.existingPosts) {
      if (!seenUrls.has(p.url)) {
        seenUrls.add(p.url);
        consolidatedLinks.push({ anchor: p.focusKeyword || p.title, url: p.url });
      }
    }
  }

  let internalLinkBlock = "";
  if (consolidatedLinks.length) {
    internalLinkBlock = "\n\n## Internal Links (use each URL AT MOST ONCE — no duplicate links):\n" +
      consolidatedLinks.map((l) => `   - "${l.anchor}" → ${l.url}`).join("\n");
  }

  const seoOptimized = await generateText(
    `You are an SEO expert. Optimize the following blog post for the keyword "${keyword}" while retaining the same writing style and tone.

## Rules:
1. Use the exact keyword "${keyword}" in the first 100 words, at least one H2 heading, and the conclusion
2. Naturally weave the primary keyword throughout (aim for 1-2% density — not stuffed, but present)
3. Add related/LSI keywords naturally (synonyms, related terms people search for)
4. Ensure proper heading hierarchy (H2, H3) — no heading level skips
5. Add internal links — this is MANDATORY. You MUST insert ALL the links listed below into the article using real markdown syntax [anchor text](url). Do not skip this step.${internalLinkBlock}
   RULES FOR INTERNAL LINKS:
   - YOU MUST ADD THESE LINKS. Insert every link that fits naturally — aim for 3-7 total.
   - Each URL may appear AT MOST ONCE. NEVER link to the same URL twice.
   - Place links inline in the body text where the topic is being discussed — not all in one paragraph.
   - Use descriptive anchor text that matches the context (not "click here" or "read more").
   - Use REAL markdown links only: [anchor text](url). NEVER use placeholder formats.
6. Make sure the intro paragraph contains the keyword
${includeFAQ ? `7. Ensure there's a FAQ section at the end with 4-5 common questions (format as proper ## FAQ heading with ### for each question — this helps with Google's FAQ rich snippets)` : "7. Skip FAQ if not present"}
8. CRITICAL: Every paragraph MUST be under 80 words (3-4 sentences max). Split any longer paragraph into two. This is a hard requirement for readability scoring.
9. DO NOT stuff keywords — keep it natural
10. Preserve the humor and conversational tone, do not make it robotic
11a. REMOVE any remaining AI phrases: "delve," "dive deep," "game-changer," "leverage," "utilize," "tapestry," "realm," "robust," "cutting-edge," "embark," "navigate the complexities," "unlock the power"
11b. REMOVE all em-dash characters (—) and replace with commas or periods
11c. Ensure first-person expert voice is present: "In my testing," "I've found," "From my experience"
11. If there's a table of contents, ensure it matches the actual headings
12. Keep the article length at ${targetWords} words

## Blog Post:
${toneRewritten}

Output ONLY the optimized blog post in Markdown format.
CRITICAL: Output the COMPLETE article — every section, every table, every paragraph. Do NOT stop early or truncate. The output MUST be at least ${targetWords} words.`,
    systemPrompt,
    { temperature: 0.4, maxTokens: outputTokens }
  );

  // Safety check: if the SEO step truncated the article, fall back to the tone-polished version
  const seoWordCount = countWords(seoOptimized);
  const toneWordCount = countWords(toneRewritten);
  const draftWordCount = countWords(draft);

  let bestVersion = seoOptimized;
  if (seoWordCount < toneWordCount * 0.6) {
    console.warn(`[content-gen] SEO step truncated article: ${seoWordCount} words vs ${toneWordCount} in tone step. Falling back to tone version.`);
    bestVersion = toneRewritten;
  } else if (seoWordCount < draftWordCount * 0.5) {
    console.warn(`[content-gen] SEO step severely truncated: ${seoWordCount} words vs ${draftWordCount} draft. Falling back to draft.`);
    bestVersion = draft;
  }

  // Post-process: replace leftover [INTERNAL_LINK: ...] placeholders
  let finalContent = bestVersion;
  if (ctx.internalLinks?.length) {
    finalContent = finalContent.replace(
      /\[INTERNAL_LINK:\s*([^\]]+)\]/gi,
      (_, anchor: string) => {
        const trimmed = anchor.trim().toLowerCase();
        const match = ctx.internalLinks!.find(
          (l) => trimmed.includes(l.keyword.toLowerCase()) || l.keyword.toLowerCase().includes(trimmed)
        );
        return match ? `[${anchor.trim()}](${match.url})` : anchor.trim();
      }
    );
  }

  // Post-process: remove duplicate links (keep first occurrence of each URL)
  const linkedUrls = new Set<string>();
  finalContent = finalContent.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (fullMatch, anchor: string, url: string) => {
      const normalizedUrl = url.replace(/\/$/, "").toLowerCase();
      if (linkedUrls.has(normalizedUrl)) {
        return anchor;
      }
      linkedUrls.add(normalizedUrl);
      return fullMatch;
    }
  );

  // Post-process: fix TOC entries to match actual headings exactly
  // Prevents "zing for Long-Tail AI Prompts" style truncation bugs
  finalContent = (() => {
    const lines = finalContent.split("\n");
    // Build a map of anchor → actual heading text from the real headings
    const headingMap = new Map<string, string>();
    for (const line of lines) {
      const h = line.match(/^(#{2,3})\s+(.+)$/);
      if (!h) continue;
      const text = h[2].trim();
      if (/^table of contents$/i.test(text)) continue;
      const anchor = text.toLowerCase().replace(/[`*_[\]()]/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
      headingMap.set(anchor, text);
    }
    // Rewrite TOC link labels to match actual heading text
    return lines.map((line) => {
      const tocLink = line.match(/^(\s*-\s+\[)([^\]]+)(\]\(#)([^)]+)(\))/);
      if (!tocLink) return line;
      const anchor = tocLink[4];
      const correctText = headingMap.get(anchor);
      if (correctText && correctText !== tocLink[2]) {
        return `${tocLink[1]}${correctText}${tocLink[3]}${anchor}${tocLink[5]}`;
      }
      return line;
    }).join("\n");
  })();

  // Post-process: break overly long paragraphs (>80 words) for readability
  finalContent = finalContent
    .split("\n\n")
    .flatMap((block) => {
      const trimmed = block.trim();
      // Skip headings, lists, images, code blocks, tables
      if (/^(#{1,6}\s|[-*]\s|\d+\.\s|!\[|```|<|\|)/.test(trimmed)) return [block];
      const words = trimmed.split(/\s+/);
      if (words.length <= 80) return [block];
      // Split at the sentence boundary closest to the midpoint
      const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
      if (!sentences || sentences.length < 2) return [block];
      const mid = Math.ceil(sentences.length / 2);
      return [sentences.slice(0, mid).join("").trim(), sentences.slice(mid).join("").trim()];
    })
    .join("\n\n");

  // ─── STEP 6: METADATA ────────────────────────────────────────────
  await progress("metadata", "Generating SEO metadata, schema, and social captions...");

  interface MetadataResult {
    title: string;
    metaTitle: string;
    metaDescription: string;
    excerpt: string;
    slug: string;
    secondaryKeywords: string[];
    tags: string[];
    category: string;
    twitterCaption: string;
    linkedinCaption: string;
    instagramCaption: string;
    facebookCaption: string;
    structuredData: object;
    featuredImageAlt: string;
  }

  const metadata = await generateJSON<MetadataResult>(
    `Generate SEO metadata and social media captions for this blog post about "${keyword}" for ${ctx.brandName} (${ctx.brandUrl}).

## Blog Post:
${finalContent.substring(0, 3000)}

Output ONLY valid JSON (no markdown code fences) with this exact structure:
{
  "title": "Compelling blog title (50-70 chars, include keyword)",
  "slug": "url-friendly-slug-with-keyword (lowercase, hyphens, no stop words, ≤60 chars)",
  "excerpt": "2-3 sentence summary for preview cards (160-200 chars)",
  "metaTitle": "SEO title tag (under 60 chars, keyword near front)",
  "metaDescription": "SEO meta description (under 155 chars, include keyword, call to action)",
  "secondaryKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "category": "Single category name relevant to ${ctx.niche}",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "twitterCaption": "Engaging tweet under 280 chars with hashtags",
  "linkedinCaption": "Professional LinkedIn post (2-3 paragraphs with emojis and hashtags)",
  "instagramCaption": "Instagram caption with emojis and hashtags",
  "facebookCaption": "Facebook post (2-3 sentences, conversational)",
  "structuredData": { "@context": "https://schema.org", "@type": "Article", "headline": "...", "description": "...", "author": { "@type": "Organization", "name": "${ctx.brandName}" } },
  "featuredImageAlt": "Descriptive alt text for featured image (includes keyword)"
}`,
    "You are an SEO specialist and social media expert. Return valid JSON only."
  );

  // ─── STEP 7: IMAGE GENERATION (sequential, one at a time) ───────
  let featuredImageUrl: string | undefined;
  let featuredImageAlt = metadata.featuredImageAlt || keyword;
  const postSlug = metadata.slug || slugify(outline.title);

  if (includeImages && process.env.GOOGLE_AI_API_KEY) {
    await progress("image", "Generating featured image…");
    // 1. Featured image — Gemini crafts a creative prompt, Imagen renders it
    try {
      const featPrompt = `Create an image that directly represents the concept of "${keyword}" for a ${ctx.niche} business. The image should clearly relate to "${outline.title}". No text, words, letters, or watermarks.`;
      featuredImageUrl = await generateBlogImage(
        featPrompt,
        `${postSlug}-featured`,
        website.id,
        outline.title,
        keyword,
        ctx.niche,
        "fast",
      );
      featuredImageAlt = metadata.featuredImageAlt || `${keyword} - ${outline.title}`;
    } catch (err) {
      console.error("Featured image generation failed after retries:", err);
    }

    // Only 1 image per post (featured) — uses fast model for batch jobs.
  } else if (includeImages) {
    await progress("image", "Skipping image generation (API key not configured)…");
  }

  // ─── FINAL: ASSEMBLE ─────────────────────────────────────────────
  const wordCount = countWords(finalContent);
  const readingTime = Math.ceil(wordCount / 200);

  return {
    title: outline.title,
    slug: metadata.slug || slugify(outline.title),
    content: finalContent,
    excerpt: metadata.excerpt || "",
    metaTitle: metadata.metaTitle || outline.title,
    metaDescription: metadata.metaDescription || "",
    focusKeyword: keyword,
    secondaryKeywords: metadata.secondaryKeywords || [],
    featuredImageUrl,
    featuredImageAlt,
    structuredData: metadata.structuredData || {},
    socialCaptions: {
      twitter: metadata.twitterCaption || "",
      linkedin: metadata.linkedinCaption || "",
      instagram: metadata.instagramCaption || "",
      facebook: metadata.facebookCaption || "",
    },
    wordCount,
    readingTime,
    tags: metadata.tags || [],
    category: metadata.category || ctx.niche,
    researchData: research,
  };

  // Reset model override after generation completes
  setModelOverride(null);
}
