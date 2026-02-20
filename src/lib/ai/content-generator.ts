/**
 * Core AI Blog Generation Pipeline
 * 7-step process: Research → Outline → Draft → Tone → SEO → Metadata → Image
 */
import { generateText, generateJSON } from "./gemini";
import { researchKeyword, ResearchResult } from "./research";
import { generateBlogImage } from "../storage/image-generator";
import type { Website, BlogSettings } from "@prisma/client";

type WebsiteWithSettings = Website & { blogSettings?: BlogSettings | null };

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

function buildSystemPrompt(ctx: WebsiteContext): string {
  let prompt = `You are a senior content writer for ${ctx.brandName} (${ctx.brandUrl}).
${ctx.brandName} is a ${ctx.description}.
Your target audience is: ${ctx.targetAudience}
Writing tone: ${ctx.tone}
Niche: ${ctx.niche}

RULES:
- Write in a ${ctx.tone} style
- Naturally mention ${ctx.brandName} where relevant (not forced)
${ctx.ctaText && ctx.ctaUrl ? `- Include a call-to-action: "${ctx.ctaText}" linking to ${ctx.ctaUrl}` : ""}
${ctx.avoidTopics?.length ? `- Never mention: ${ctx.avoidTopics.join(", ")}` : ""}
- Format: Markdown with proper H2/H3 hierarchy
- Write for humans first, search engines second
- Use active voice, short paragraphs, and clear language`;

  if (ctx.existingPosts?.length) {
    prompt += `\n- Link to existing content where relevant:\n${ctx.existingPosts.map((p) => `  • "${p.title}" → ${p.url}`).join("\n")}`;
  }

  if (ctx.internalLinks?.length) {
    prompt += `\n- Use these anchor text → URL mappings naturally in the content:\n${ctx.internalLinks.map((l) => `  • "${l.keyword}" → ${l.url}`).join("\n")}`;
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
  };

  const wordTargets = {
    SHORT: "800-1200",
    MEDIUM: "1500-2500",
    LONG: "2500-4000",
    PILLAR: "4000-6000",
  };
  const targetWords = wordTargets[contentLength];

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

  // ─── STEP 1: RESEARCH ───────────────────────────────────────────
  await progress("research", `Researching "${keyword}" with Perplexity AI...`);
  const research = await researchKeyword(keyword, ctx);

  // ─── STEP 2: OUTLINE ────────────────────────────────────────────
  await progress("outline", "Creating content outline and structure...");
  const outline = await generateJSON<{
    title: string;
    sections: { heading: string; points: string[] }[];
    uniqueAngle: string;
  }>(
    `Create a detailed blog post outline for the keyword: "${keyword}"

Context:
- Brand: ${ctx.brandName} (${ctx.niche})
- Target audience: ${ctx.targetAudience}
- Suggested angle: ${research.suggestedAngle}
- Content gaps to address: ${research.contentGaps.slice(0, 3).join(", ")}
- Competitor headings to beat: ${research.competitorHeadings.slice(0, 5).join(", ")}
- Target word count: ${targetWords} words

Create an outline with:
- A compelling, SEO-optimized H1 title (include the keyword naturally)
- 5-7 H2 sections with 3-4 bullet points each
${includeFAQ ? "- A FAQ section with 4-5 questions" : ""}
- A strong conclusion with CTA

Return JSON: { "title": "...", "sections": [{ "heading": "...", "points": ["..."] }], "uniqueAngle": "..." }`,
    systemPrompt
  );

  // ─── STEP 3: DRAFT ───────────────────────────────────────────────
  await progress("draft", "Writing full article draft...");
  const draft = await generateText(
    `Write a complete, ${targetWords}-word blog post about "${keyword}" for ${ctx.brandName}.

Title: ${outline.title}

Outline to follow:
${outline.sections.map((s) => `## ${s.heading}\n${s.points.map((p) => `- ${p}`).join("\n")}`).join("\n\n")}

Key facts to include:
${research.keyStatistics.map((s) => `- ${s}`).join("\n")}

Requirements:
- Write in Markdown format with proper H2/H3 hierarchy
${includeTableOfContents ? "- Add a table of contents after the intro" : ""}
- Include the focus keyword "${keyword}" naturally throughout
- Use concrete examples, data, and actionable advice
- Write ${targetWords} words
- End with a conclusion paragraph
${includeFAQ ? "- Include a FAQ section near the end with 4-5 questions and detailed answers" : ""}
- Write for ${ctx.targetAudience}`,
    systemPrompt,
    { temperature: 0.75, maxTokens: 8192 }
  );

  // ─── STEP 4: TONE REWRITE ────────────────────────────────────────
  await progress("tone", "Refining brand voice and tone...");
  const toneRewritten = await generateText(
    `Rewrite this article to better match ${ctx.brandName}'s brand voice: "${ctx.tone}"

The content should feel natural, engaging, and authentic — not like generic AI writing.

Guidelines:
- Use conversational transitions and natural flow
- Add personality and depth where appropriate
- Keep all facts, data, and structure intact
- Ensure the keyword "${keyword}" appears naturally in the first 100 words
- Do NOT add any new sections — only refine the existing content
- Maintain Markdown formatting

Article to rewrite:
${draft}`,
    systemPrompt,
    { temperature: 0.7 }
  );

  // ─── STEP 5: SEO OPTIMIZATION ────────────────────────────────────
  await progress("seo", "Optimizing for SEO — keywords, links, structure...");

  let linkInstructions: string;
  if (ctx.internalLinks?.length || ctx.existingPosts?.length) {
    const mappings = [
      ...(ctx.internalLinks || []).map((l) => `"${l.keyword}" → ${l.url}`),
      ...(ctx.existingPosts || []).map((p) => `"${p.focusKeyword || p.title}" → ${p.url}`),
    ];
    linkInstructions = `6. Insert 3-8 internal links using these anchor text → URL mappings. Use markdown link syntax [anchor text](URL). Only use links that fit naturally:\n${mappings.map((m) => `   - ${m}`).join("\n")}`;
  } else {
    linkInstructions = "6. Add [INTERNAL_LINK: relevant anchor text] placeholders where internal links would help (3-5 places)";
  }

  const seoOptimized = await generateText(
    `SEO-optimize this article for the focus keyword: "${keyword}"

Tasks:
1. Ensure focus keyword appears in: H1, first paragraph, at least 2 H2s, conclusion
2. Add 2-4 secondary/LSI keywords naturally (related terms, synonyms)
3. Ensure proper H2 → H3 hierarchy
4. Make sure the intro (first 150 words) hooks the reader and includes the keyword
5. Ensure every paragraph is 2-4 sentences max (readability)
${linkInstructions}
7. Keep the article length at ${targetWords} words

Do NOT change the overall structure or add new sections.
Return the full optimized article in Markdown.

Article:
${toneRewritten}`,
    systemPrompt,
    { temperature: 0.4 }
  );

  // Post-process: replace leftover [INTERNAL_LINK: ...] placeholders with real links
  let finalContent = seoOptimized;
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
    structuredData: object;
    featuredImageAlt: string;
  }

  const metadata = await generateJSON<MetadataResult>(
    `Generate complete SEO metadata for this blog post about "${keyword}" for ${ctx.brandName}.

Article title: ${outline.title}
Brand: ${ctx.brandName} (${ctx.brandUrl})
Niche: ${ctx.niche}

Generate:
1. metaTitle: SEO title ≤60 chars, includes keyword, compelling
2. metaDescription: ≤155 chars, includes keyword, has a call to action
3. excerpt: 1-2 sentence teaser (160-200 chars)
4. slug: URL-friendly slug from title (lowercase, hyphens, no stop words, ≤60 chars)
5. secondaryKeywords: array of 3-5 related keywords
6. tags: array of 4-6 topic tags
7. category: single category name
8. twitterCaption: engaging tweet with hashtags (≤280 chars)
9. linkedinCaption: professional LinkedIn post (2-3 sentences + hashtags)
10. structuredData: JSON-LD Article schema object
11. featuredImageAlt: descriptive alt text for featured image (includes keyword)

Return valid JSON with all these keys.`,
    "You are an SEO specialist. Return valid JSON only."
  );

  // ─── STEP 7: IMAGE GENERATION ────────────────────────────────────
  let featuredImageUrl: string | undefined;
  let featuredImageAlt = metadata.featuredImageAlt || keyword;

  if (includeImages && process.env.GOOGLE_AI_API_KEY) {
    await progress("image", "Generating featured image with Imagen 4.0...");
    try {
      const imagePrompt = await generateText(
        `Create a professional, eye-catching image prompt for a blog post titled: "${outline.title}"
        
The image should represent "${keyword}" in the context of ${ctx.niche}.
Style: Clean, modern, professional. Suitable for a B2B blog.
No text in the image.
Describe the scene in 2-3 sentences for an AI image generator.

Return only the image prompt, nothing else.`,
        "You are a creative director specializing in B2B content marketing visuals."
      );

      featuredImageUrl = await generateBlogImage(
        imagePrompt,
        `${metadata.slug}-featured`,
        website.id
      );
    } catch (err) {
      console.error("Image generation failed:", err);
      // Continue without image
    }
  } else if (includeImages) {
    await progress("image", "Skipping image generation (API key not configured)...");
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
    },
    wordCount,
    readingTime,
    tags: metadata.tags || [],
    category: metadata.category || ctx.niche,
    researchData: research,
  };
}
