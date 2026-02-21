/**
 * Topic Cluster Generator
 * Seed → Research (crawl website) → Structure with Gemini → Preview/Queue
 */
import { generateJSON } from "./gemini";
import { crawlWebsite } from "../website-crawler";

export interface ClusterKeyword {
  keyword: string;
  role: "pillar" | "supporting";
  searchIntent: "informational" | "transactional" | "commercial";
  suggestedWordCount: number;
  description: string;
}

export interface ClusterPreview {
  pillarTitle: string;
  description: string;
  keywords: ClusterKeyword[];
}

interface ClusterWebsite {
  brandUrl: string;
  brandName: string;
  niche: string;
  description: string;
  targetAudience: string;
  uniqueValueProp?: string | null;
  competitors?: string[] | null;
  keyProducts?: string[] | null;
  targetLocation?: string | null;
}

async function researchSeedTopic(
  seedTopic: string,
  website: ClusterWebsite,
): Promise<string> {
  const { brandUrl, niche, brandName } = website;

  let siteContext = "";
  try {
    const crawl = await crawlWebsite(brandUrl);
    if (crawl.pages.length > 0) {
      siteContext = "\n\nPages found on the website:\n" +
        crawl.pages.slice(0, 30).map(p => `- ${p.title}: ${p.url}`).join("\n");
    }
  } catch {
    // Non-fatal
  }

  let apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return siteContext || `Topic: ${seedTopic} in the ${niche} space for ${brandName}.`;
  apiKey = apiKey.replace(/\\n/g, "").trim();

  const competitorLine = website.competitors?.length
    ? `\nKnown competitors: ${website.competitors.join(", ")}. Analyze how they cover this topic.`
    : "";
  const productLine = website.keyProducts?.length
    ? `\nKey products/features: ${website.keyProducts.join(", ")}.`
    : "";
  const locationLine = website.targetLocation
    ? `\nPrimary market: ${website.targetLocation}.`
    : "";

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are an SEO content strategist specializing in the ${niche} niche. Only provide research directly relevant to the ${niche} industry and ${brandName}'s target audience. Do not suggest off-topic or generic content.`,
          },
          {
            role: "user",
            content: `Research the topic "${seedTopic}" for a content cluster for ${brandName} (${brandUrl}), which is a ${niche} business.
Target audience: ${website.targetAudience}${competitorLine}${productLine}${locationLine}

IMPORTANT: All research must be specifically relevant to the ${niche} niche and ${brandName}'s audience. Do not suggest topics outside this niche.

I need:
1. Top ranking articles specifically about "${seedTopic}" in the context of ${niche} — list their titles and what angles they cover
2. 15-20 long-tail keyword variations of "${seedTopic}" that are relevant to ${niche}
3. Specific subtopics that top-ranking pages cover for this niche
4. Common questions ${niche} audiences ask about "${seedTopic}"
5. Content gaps — what are competitors missing about "${seedTopic}" in the ${niche} space?${website.competitors?.length ? `\n6. How do ${website.competitors.join(", ")} cover "${seedTopic}"? What angles do they miss?` : ""}

Stay strictly within the ${niche} niche.`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return siteContext || `Topic: ${seedTopic} for ${brandName} in ${niche}.`;
    const data = await res.json();
    const research = data.choices?.[0]?.message?.content || "";
    return research + siteContext;
  } catch {
    return siteContext || `Topic: ${seedTopic} for ${brandName} in ${niche}.`;
  }
}

export interface PublishedPost {
  title: string;
  focusKeyword: string;
}

export async function generateClusterPreview(
  seedTopic: string,
  website: ClusterWebsite,
  existingKeywords: string[] = [],
  publishedPosts: PublishedPost[] = [],
  avoidTopics: string[] = [],
): Promise<ClusterPreview> {
  const research = await researchSeedTopic(seedTopic, website);

  const existingSection = existingKeywords.length > 0
    ? `\n\n## Keywords Already in Queue (NEVER duplicate these):\n${existingKeywords.slice(0, 40).join(", ")}`
    : "";

  const publishedSection = publishedPosts.length > 0
    ? `\n\n## Already Published Blog Posts (NEVER duplicate these titles, topics, or search intent):\n${publishedPosts.slice(0, 60).map(p => `- "${p.title}"${p.focusKeyword ? ` [keyword: ${p.focusKeyword}]` : ""}`).join("\n")}`
    : "";

  const exclusionSection = avoidTopics.length > 0
    ? `\n\n## Excluded Topics (NEVER suggest keywords about these):\n${avoidTopics.map(t => `- ${t}`).join("\n")}`
    : "";

  const extraContext = [
    website.uniqueValueProp ? `- USP: ${website.uniqueValueProp}` : "",
    website.competitors?.length ? `- Competitors: ${website.competitors.join(", ")}` : "",
    website.keyProducts?.length ? `- Products/Features: ${website.keyProducts.join(", ")}` : "",
    website.targetLocation ? `- Primary market: ${website.targetLocation}` : "",
  ].filter(Boolean).join("\n");

  const productInstruction = website.keyProducts?.length
    ? `- Product names (${website.keyProducts.join(", ")}) MAY appear in keywords when it makes sense, e.g. "how to install [Product] on [vehicle]". Do NOT force product names into every keyword — only where the search intent naturally includes the product.`
    : "";

  const result = await generateJSON<ClusterPreview>(
    `You are an SEO content strategist for ${website.brandName}, a ${website.niche} business. Create a topic cluster for "${seedTopic}".

## Business Context:
- Brand: ${website.brandName} (${website.brandUrl})
- Niche: ${website.niche}
- Description: ${website.description}
- Target audience: ${website.targetAudience}
${extraContext}

## Research Data:
${research.substring(0, 4000)}${existingSection}${publishedSection}${exclusionSection}

## ANTI-CANNIBALIZATION RULES (most important):
- Review the published posts list above CAREFULLY before generating any keyword
- Do NOT generate keywords that target the same TOPIC as an existing post, even if worded differently
- Do NOT generate keywords that target the same SEARCH INTENT as an existing post
- Example: if "Wind Noise Reduction Guide for Cars" exists, do NOT suggest "how to reduce wind noise in car" — instead target a different angle like "wind noise fix for specific door seal types" or a different vehicle zone
- Each new keyword must fill a GAP that no existing post covers
- Think: "Would Google see this new keyword as a different page from the existing posts?" If no, skip it.

## KEYWORD QUALITY RULES:
- Every keyword MUST relate directly to "${seedTopic}" within ${website.niche}
- Target LONG-TAIL, LOW-COMPETITION keywords (4-7 words each) — easier to rank for
- Keywords should be specific: include vehicle types, specific parts, symptoms, or scenarios when possible
- All keywords must be things ${website.targetAudience} would actually search for
- Do NOT suggest generic 1-2 word head terms — they are too competitive
- Do NOT invent topics that aren't covered in the research or aren't clearly part of this niche
${productInstruction}

## OUTPUT STRUCTURE:
- Pillar: ONE broad keyword about "${seedTopic}" (2500-4000 words, 4-6 words long)
- Supporting: 8-12 specific long-tail variations (1200-2000 words each, 5-8 words long)
- Each keyword targets a UNIQUE angle: different vehicle part, different problem, different user scenario, or different buying stage
- Mix search intents: ~60% informational, ~25% commercial, ~15% transactional
- For each keyword, write a short "description" explaining the UNIQUE angle this post would cover that no existing post already handles

Return valid JSON only:
{
  "pillarTitle": "cluster theme name",
  "description": "1-2 sentence description of this cluster",
  "keywords": [
    {
      "keyword": "exact keyword phrase (4-7 words)",
      "role": "pillar",
      "searchIntent": "informational",
      "suggestedWordCount": 3000,
      "description": "what this article covers and why it doesn't overlap with existing posts"
    },
    {
      "keyword": "specific long-tail keyword about ${seedTopic} (5-8 words)",
      "role": "supporting",
      "searchIntent": "informational",
      "suggestedWordCount": 1500,
      "description": "the unique angle and gap this fills"
    }
  ]
}`,
    `You are an SEO content strategist for ${website.brandName} in the ${website.niche} niche. Every keyword must relate directly to "${seedTopic}". Return valid JSON only.`,
  );

  // Ensure exactly one pillar
  if (result.keywords?.length > 0) {
    const pillarCount = result.keywords.filter(k => k.role === "pillar").length;
    if (pillarCount !== 1) {
      result.keywords[0].role = "pillar";
      for (let i = 1; i < result.keywords.length; i++) {
        result.keywords[i].role = "supporting";
      }
    }
  }

  return result;
}
