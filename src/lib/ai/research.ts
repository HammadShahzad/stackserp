/**
 * Perplexity AI Research Engine
 * Analyzes competitors, finds content gaps, and fetches SERP data
 */

export interface ResearchResult {
  rawResearch: string;
  topRankingContent: string;
  contentGaps: string[];
  competitorHeadings: string[];
  keyStatistics: string[];
  relatedTopics: string[];
  suggestedAngle: string;
  commonQuestions: string[];
  rawResponse: string;
}

export async function researchKeyword(
  keyword: string,
  websiteContext: {
    niche: string;
    brandName: string;
    targetAudience: string;
    description?: string;
  }
): Promise<ResearchResult> {
  let apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    return getMockResearch(keyword, websiteContext);
  }
  apiKey = apiKey.replace(/\\n/g, "").trim();

  const prompt = `Research this topic thoroughly for an SEO blog post: "${keyword}".${websiteContext.description ? ` Additional context: ${websiteContext.description}.` : ""}

The blog is for ${websiteContext.brandName}, a ${websiteContext.niche} platform targeting ${websiteContext.targetAudience}.

Provide:
1. Factual, up-to-date data, statistics, expert insights, and actionable information
2. Specific numbers, prices, comparisons, and real-world examples
3. What are the top 5 ranking articles for "${keyword}"? What do they cover that we should include?
4. What content gaps exist that competitors miss?
5. What are the most common questions people ask about this topic?
6. Any relevant trends or recent changes in 2025-2026
7. Key statistics and data points that would strengthen the article
8. Related subtopics worth covering to be comprehensive`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are an SEO content researcher and competitor analyst. Provide comprehensive research with sources, statistics, competitor insights, and content gap analysis. Focus on actionable data that helps create content that outranks existing articles.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.2,
        search_domain_filter: [],
        return_related_questions: true,
        search_recency_filter: "month",
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Perplexity API error:", err);
      return getMockResearch(keyword, websiteContext);
    }

    const data = await response.json();
    const rawResearch = data.choices?.[0]?.message?.content || "";

    if (!rawResearch) {
      return getMockResearch(keyword, websiteContext);
    }

    return {
      rawResearch,
      topRankingContent: rawResearch,
      contentGaps: extractSection(rawResearch, "content gap", "miss"),
      competitorHeadings: extractSection(rawResearch, "heading", "cover", "ranking"),
      keyStatistics: extractSection(rawResearch, "statistic", "data", "number", "percent"),
      relatedTopics: extractSection(rawResearch, "related", "subtopic", "also"),
      suggestedAngle: "",
      commonQuestions: extractSection(rawResearch, "question", "ask", "faq"),
      rawResponse: rawResearch,
    };
  } catch (error) {
    console.error("Research error:", error);
    return getMockResearch(keyword, websiteContext);
  }
}

function extractSection(text: string, ...keywords: string[]): string[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const results: string[] = [];
  let inRelevantSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw)) && (lower.startsWith("#") || lower.startsWith("**"))) {
      inRelevantSection = true;
      continue;
    }
    if (inRelevantSection) {
      if (line.match(/^#{1,3}\s/) || line.match(/^\*\*[^*]+\*\*$/)) {
        inRelevantSection = false;
        continue;
      }
      const cleaned = line.replace(/^[-*•\d.)\s]+/, "").trim();
      if (cleaned.length > 10) {
        results.push(cleaned);
      }
    }
  }

  if (results.length === 0) {
    return lines
      .filter((l) => l.match(/^[-*•]\s/) && l.trim().length > 15)
      .map((l) => l.replace(/^[-*•]\s+/, "").trim())
      .slice(0, 8);
  }

  return results.slice(0, 10);
}

function getMockResearch(
  keyword: string,
  ctx: { niche: string; brandName: string; targetAudience: string }
): ResearchResult {
  return {
    rawResearch: `Research on "${keyword}" for ${ctx.brandName} in the ${ctx.niche} space. Top articles cover basics, step-by-step guides, best practices, and common mistakes.`,
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
    commonQuestions: [
      `What is ${keyword}?`,
      `How does ${keyword} work?`,
      `What are the best ${keyword} strategies?`,
      `How much does ${keyword} cost?`,
    ],
    rawResponse: "{}",
  };
}
