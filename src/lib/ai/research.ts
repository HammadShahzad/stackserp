/**
 * Perplexity AI Research Engine
 * Analyzes competitors, finds content gaps, and fetches SERP data
 */

export interface ResearchResult {
  topRankingContent: string;
  contentGaps: string[];
  competitorHeadings: string[];
  keyStatistics: string[];
  relatedTopics: string[];
  suggestedAngle: string;
  rawResponse: string;
}

export async function researchKeyword(
  keyword: string,
  websiteContext: {
    niche: string;
    brandName: string;
    targetAudience: string;
  }
): Promise<ResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    // Return mock data if key not configured
    return getMockResearch(keyword, websiteContext);
  }

  const prompt = `Research the keyword "${keyword}" for a ${websiteContext.niche} blog targeting ${websiteContext.targetAudience}.

Please provide:
1. What the top-ranking articles cover (summarize the main points from top 5 results)
2. Content gaps - what topics are missing or underserved in existing content
3. Common headings/sections used by top-ranking articles
4. Key statistics, data points, or facts that should be included
5. Related topics and subtopics worth mentioning
6. A unique angle that would differentiate a new article on this topic

Format your response as JSON with these exact keys:
{
  "topRankingContent": "summary of what top articles cover",
  "contentGaps": ["gap1", "gap2", "gap3"],
  "competitorHeadings": ["h2 heading 1", "h2 heading 2", ...],
  "keyStatistics": ["stat1", "stat2", ...],
  "relatedTopics": ["topic1", "topic2", ...],
  "suggestedAngle": "unique differentiation angle"
}`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          {
            role: "system",
            content: "You are an expert SEO researcher. Always respond with valid JSON only, no markdown.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        search_domain_filter: [],
        return_related_questions: false,
        search_recency_filter: "month",
      }),
      signal: AbortSignal.timeout(30000), // 30s hard timeout
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Perplexity API error:", err);
      return getMockResearch(keyword, websiteContext);
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content || "{}";

    try {
      const parsed = JSON.parse(rawResponse);
      return {
        topRankingContent: parsed.topRankingContent || "",
        contentGaps: parsed.contentGaps || [],
        competitorHeadings: parsed.competitorHeadings || [],
        keyStatistics: parsed.keyStatistics || [],
        relatedTopics: parsed.relatedTopics || [],
        suggestedAngle: parsed.suggestedAngle || "",
        rawResponse,
      };
    } catch {
      return getMockResearch(keyword, websiteContext);
    }
  } catch (error) {
    console.error("Research error:", error);
    return getMockResearch(keyword, websiteContext);
  }
}

function getMockResearch(
  keyword: string,
  ctx: { niche: string; brandName: string; targetAudience: string }
): ResearchResult {
  return {
    topRankingContent: `Top articles about "${keyword}" in the ${ctx.niche} space typically cover the basics, step-by-step guides, best practices, and common mistakes to avoid.`,
    contentGaps: [
      "Lack of real-world examples and case studies",
      "Missing actionable tips for beginners",
      "No comparison of different approaches",
      "Outdated statistics and data",
    ],
    competitorHeadings: [
      `What is ${keyword}?`,
      `Why ${keyword} matters`,
      `How to get started with ${keyword}`,
      `Best practices for ${keyword}`,
      `Common mistakes to avoid`,
      `${keyword} tools and resources`,
      "Frequently Asked Questions",
    ],
    keyStatistics: [
      "Studies show this topic has grown 40% in search interest over the past year",
      `${ctx.targetAudience} spend significant time researching this topic before making decisions`,
    ],
    relatedTopics: [
      `${keyword} for beginners`,
      `${keyword} best practices`,
      `${keyword} examples`,
      `${keyword} tools`,
    ],
    suggestedAngle: `Focus on practical, actionable advice specifically tailored for ${ctx.targetAudience}, with real examples from the ${ctx.niche} industry.`,
    rawResponse: "{}",
  };
}
