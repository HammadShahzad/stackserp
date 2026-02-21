/**
 * Perplexity AI Research Engine
 * Analyzes competitors, finds content gaps, and fetches SERP data
 */

export interface ResearchResult {
  rawResearch: string;
  topRankingContent: string;
  contentGaps: string[];       // Topics/questions competitors fail to cover
  missingSubtopics: string[];  // Specific subtopics absent from top-ranking posts
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
    uniqueValueProp?: string;
    competitors?: string[];
    keyProducts?: string[];
    targetLocation?: string;
    tone?: string;
  }
): Promise<ResearchResult> {
  let apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    return getMockResearch(keyword, websiteContext);
  }
  apiKey = apiKey.replace(/\\n/g, "").trim();

  const brandContext = [
    `The blog is for ${websiteContext.brandName}, a ${websiteContext.niche} platform targeting ${websiteContext.targetAudience}.`,
    websiteContext.description ? `Business: ${websiteContext.description}` : "",
    websiteContext.uniqueValueProp ? `USP: ${websiteContext.uniqueValueProp}` : "",
    websiteContext.competitors?.length ? `Key competitors: ${websiteContext.competitors.join(", ")}` : "",
    websiteContext.keyProducts?.length ? `Products/features: ${websiteContext.keyProducts.join(", ")}` : "",
    websiteContext.targetLocation ? `Primary market: ${websiteContext.targetLocation}` : "",
    websiteContext.tone ? `Brand tone: ${websiteContext.tone}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `Research this topic for an SEO blog post that will OUTRANK the current top results: "${keyword}".

${brandContext}

## PART 1 — COMPETITOR BLOG ANALYSIS (most important)
Look at the top 5-7 ranking articles/blog posts for "${keyword}" right now.
For each one:
- What is the URL and headline?
- What H2/H3 sections do they cover?
- What do they get WRONG or oversimplify?
- What subtopics, angles, or questions do they completely SKIP?

## PART 2 — CONTENT GAP IDENTIFICATION
Based on your analysis of the top-ranking content, list:
- 5-8 specific subtopics or questions that NONE of the top articles cover well
- 3-5 specific questions people ask (Reddit, Quora, Google PAA) that current articles ignore
- Any outdated information in existing articles that we can update with 2025-2026 data

## PART 3 — WINNING ANGLE
What single, specific angle would make our article clearly better than everything that ranks now?
Look for: contrarian takes, more specific use cases, more recent data, underserved audience segments, or topics competitors avoid because they're controversial or complex.

## PART 4 — FACTUAL AMMUNITION
- 5-8 statistics with sources (numbers, percentages, study citations)
- 3-5 real-world examples, case studies, or named tools/companies to cite
- Any expert quotes or studies from 2024-2026${websiteContext.competitors?.length ? `\n\n## PART 5 — NAMED COMPETITOR BLOGS\nSpecifically check how ${websiteContext.competitors.join(", ")} cover "${keyword}" on their own blogs.\nWhat do they write about it? What do they deliberately avoid? What angle can we take that beats them?` : ""}`;

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
        return_related_questions: true,
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
      topRankingContent: extractSection(rawResearch, "competitor", "ranking", "top article", "part 1").join("\n") || rawResearch.substring(0, 1000),
      contentGaps: extractSection(rawResearch, "content gap", "miss", "skip", "fail", "gap", "part 2"),
      missingSubtopics: extractSection(rawResearch, "missing", "subtopic", "not covered", "ignore", "avoid", "nobody"),
      competitorHeadings: extractSection(rawResearch, "heading", "h2", "h3", "section", "cover"),
      keyStatistics: extractSection(rawResearch, "statistic", "data", "number", "percent", "%", "%", "study", "part 4"),
      relatedTopics: extractSection(rawResearch, "related", "subtopic", "also", "example"),
      suggestedAngle: extractSection(rawResearch, "winning angle", "unique angle", "contrarian", "underexplored", "part 3")[0] || "",
      commonQuestions: extractSection(rawResearch, "question", "ask", "faq", "paa", "people also", "quora", "reddit"),
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
    missingSubtopics: [
      `How ${keyword} specifically applies to ${ctx.targetAudience}`,
      `Common mistakes that experts make (not just beginners)`,
      `Cost/ROI breakdown that most guides skip`,
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
