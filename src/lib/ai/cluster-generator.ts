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

async function researchSeedTopic(
  seedTopic: string,
  brandUrl: string,
  niche: string,
  brandName: string,
): Promise<string> {
  // Crawl the website directly instead of wasting Perplexity credits
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

  // Use Perplexity for competitive research (this IS a valid use — researching what competitors write)
  let apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return siteContext || `Topic: ${seedTopic} in the ${niche} space for ${brandName}.`;
  apiKey = apiKey.replace(/\\n/g, "").trim();

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

IMPORTANT: All research must be specifically relevant to the ${niche} niche and ${brandName}'s audience. Do not suggest topics outside this niche.

I need:
1. Top ranking articles specifically about "${seedTopic}" in the context of ${niche} — list their titles and what angles they cover
2. 15-20 long-tail keyword variations of "${seedTopic}" that are relevant to ${niche}
3. Specific subtopics that top-ranking pages cover for this niche
4. Common questions ${niche} audiences ask about "${seedTopic}"
5. Content gaps — what are competitors missing about "${seedTopic}" in the ${niche} space?

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

export async function generateClusterPreview(
  seedTopic: string,
  website: {
    brandUrl: string;
    brandName: string;
    niche: string;
    description: string;
    targetAudience: string;
  },
  existingKeywords: string[] = [],
): Promise<ClusterPreview> {
  const research = await researchSeedTopic(
    seedTopic,
    website.brandUrl,
    website.niche,
    website.brandName,
  );

  const existingSection = existingKeywords.length > 0
    ? `\n\nExisting keywords already in the queue (avoid duplicates):\n${existingKeywords.slice(0, 40).join(", ")}`
    : "";

  const result = await generateJSON<ClusterPreview>(
    `You are an SEO content strategist for ${website.brandName}, a ${website.niche} business. Create a topic cluster for "${seedTopic}".

## Business Context:
- Brand: ${website.brandName} (${website.brandUrl})
- Niche: ${website.niche}
- Description: ${website.description}
- Target audience: ${website.targetAudience}

## Research Data:
${research.substring(0, 4000)}${existingSection}

## STRICT RULES — read carefully:
- Every single keyword MUST be directly about "${seedTopic}" as it relates to ${website.niche}
- Do NOT suggest generic keywords unrelated to "${seedTopic}" or the ${website.niche} niche
- Do NOT invent topics that aren't covered in the research or aren't clearly part of this niche
- All keywords must be things ${website.targetAudience} would actually search for
- Pillar: ONE broad keyword directly about "${seedTopic}" (2500-4000 words)
- Supporting: 8-12 specific long-tail variations of "${seedTopic}" (1200-2000 words each, 3-6 words)
- Each keyword must target a distinct, specific angle of "${seedTopic}"
- Do NOT repeat any existing keywords listed above

Return valid JSON only:
{
  "pillarTitle": "cluster theme name",
  "description": "1-2 sentence description of this cluster",
  "keywords": [
    {
      "keyword": "exact keyword phrase",
      "role": "pillar",
      "searchIntent": "informational",
      "suggestedWordCount": 3000,
      "description": "what this article covers in 1-2 sentences"
    },
    {
      "keyword": "specific long-tail keyword about ${seedTopic}",
      "role": "supporting",
      "searchIntent": "informational",
      "suggestedWordCount": 1500,
      "description": "what this article covers"
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
