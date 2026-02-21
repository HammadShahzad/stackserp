/**
 * Core AI Blog Generation Pipeline
 * 7-step process: Research → Outline → Draft → Tone → SEO → Metadata → Image
 *
 * Ported from InvoiceCave's proven 680-line blog-generator.ts with
 * multi-website parameterization.
 */
import { generateText, generateJSON } from "./gemini";
import { researchKeyword, ResearchResult } from "./research";
import { generateBlogImage, generateInlineImage } from "../storage/image-generator";
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

function buildSystemPrompt(ctx: WebsiteContext): string {
  let prompt = `You are a professional blog writer for ${ctx.brandName} (${ctx.brandUrl}).
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
  contentLength: "SHORT" | "MEDIUM" = "MEDIUM",
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

Context:
- Brand: ${ctx.brandName} (${ctx.niche})
- Target audience: ${ctx.targetAudience}
- Target word count: ${targetWords} words

Research findings:
${research.rawResearch.substring(0, 3000)}

Content gaps to exploit (what competitors miss):
${research.contentGaps.slice(0, 5).join("\n- ")}

Common questions people ask:
${research.commonQuestions.slice(0, 5).join("\n- ")}

Create an outline with:
- A compelling, SEO-optimized H1 title (include the keyword naturally, 50-70 chars)
- 5-7 H2 sections with 3-4 bullet points each
- Cover everything top competitors cover PLUS the content gaps identified above
${includeFAQ ? "- A FAQ section with 4-5 of the most commonly searched questions" : ""}
- A "Key Takeaways" section near the top
- A strong conclusion with CTA for ${ctx.brandName}

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

Research data to incorporate:
${research.rawResearch.substring(0, 4000)}

## Guidelines:
1. Write ${targetWords} words (aim for comprehensive coverage that beats competitors)
2. Use a conversational, engaging tone — ${ctx.tone}
3. Start with a table of contents linking to each H2 section
4. Include an attention-grabbing introduction that uses the exact keyword "${keyword}" in the first 100 words
5. Break content into clear sections with H2 and H3 headings (use keyword in at least one H2)
6. Include practical tips, examples, and actionable advice
7. Add bullet points, numbered lists, and comparison tables where appropriate
8. Include statistics and data points from the research with context
9. Add a "Key Takeaways" or "Quick Summary" box near the top for skimmers
10. End with a strong conclusion that includes the keyword and a CTA mentioning ${ctx.brandName}
11. Write in Markdown format
12. Make it SEO-friendly by naturally incorporating the keyword and related terms
13. Cover everything competitors cover PLUS the content gaps identified in research
19. CRITICAL READABILITY RULE: Keep every paragraph to 3-4 sentences MAX (under 80 words). Break long paragraphs into shorter ones. Use blank lines between paragraphs. Readers skim, so shorter blocks are always better.
${includeFAQ ? "14. Include a FAQ section near the end with 4-5 common questions and detailed answers" : ""}
15. Write from an EXPERT PERSPECTIVE — use phrases like "In my testing," "I've found that," "From my experience," "What I noticed is" to share first-hand insights
16. Add 2-3 "Pro Tip:" callouts per section that share insider knowledge only an expert would know
17. NEVER use these AI phrases: "delve," "dive deep," "in today's fast-paced world," "game-changer," "leverage," "utilize," "tapestry," "landscape" (metaphorically), "realm," "robust," "cutting-edge," "embark on a journey," "navigating the complexities," "unlock the power"
18. NEVER use em-dash (—). Use commas, periods, or semicolons instead

Output ONLY the blog post content in Markdown. Do not include the title as an H1 — start with the introduction paragraph.`,
    systemPrompt,
    { temperature: 0.75, maxTokens: 8192 }
  );

  // ─── STEP 4: TONE REWRITE ────────────────────────────────────────
  await progress("tone", "Refining brand voice and tone...");
  const toneRewritten = await generateText(
    `You are a witty, self-aware writer who combines humor with genuinely insightful content. Think of a cheeky uncle who is also a thoughtful mentor. You make even dry topics feel like a standup set with useful takeaways.

Rewrite the following blog post for ${ctx.brandName} to be more engaging, conversational, and fun to read. The brand voice is: "${ctx.tone}". Keep ALL the factual information, data, and structure intact. Just improve the tone:

- Add humor and personality (dad jokes, pop culture references, playful sarcasm where appropriate)
- Use relatable analogies that ${ctx.targetAudience} would appreciate
- Make transitions smooth and natural
- Keep it professional enough for a business audience
- Don't overdo it: 80% informative, 20% entertaining
- The content should feel natural, engaging, and authentic, not like generic AI writing
- Ensure the keyword "${keyword}" appears naturally in the first 100 words
- Do NOT add any new sections, only refine the existing content
- Maintain all Markdown formatting, headings, lists, and tables
- CRITICAL: Write from a FIRST-PERSON expert perspective. Use "I've found," "In my testing," "From my experience," "What I noticed" throughout. The reader should feel like they're getting advice from a real expert, not a robot.
- NEVER use these banned AI words/phrases: "delve," "dive deep," "game-changer," "leverage," "utilize," "tapestry," "landscape" (metaphorical), "realm," "robust," "cutting-edge," "embark on a journey," "navigating the complexities," "unlock the power/potential," "it's important to note," "in today's fast-paced world"
- NEVER use the em-dash character. Use commas or periods instead.
- AVOID starting sentences with "So," or "Well,"
- AVOID formal transitions like "Furthermore," "Moreover," "Additionally" - use natural ones instead
- READABILITY: Keep every paragraph to 3-4 sentences max (under 80 words). Break any long paragraph into shorter ones. Short paragraphs are easier to scan.

## Blog Post:
${draft}

Output ONLY the rewritten blog post in Markdown format. Preserve all headings and structure.`,
    systemPrompt,
    { temperature: 0.7 }
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
5. Add internal links using REAL markdown links where naturally relevant:${internalLinkBlock}
   CRITICAL RULES FOR INTERNAL LINKS:
   - Each URL may appear AT MOST ONCE in the entire article. NEVER link to the same URL twice.
   - Use 10-15 unique internal links spread throughout the article, not clustered in one section.
   - Use descriptive anchor text (not "click here").
   - Do NOT use placeholder formats like [INTERNAL_LINK: text]. Use real markdown links only.
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

Output ONLY the optimized blog post in Markdown format.`,
    systemPrompt,
    { temperature: 0.4 }
  );

  // Post-process: replace leftover [INTERNAL_LINK: ...] placeholders
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
}
