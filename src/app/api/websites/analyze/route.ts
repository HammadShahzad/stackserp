import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateJSON } from "@/lib/ai/gemini";
import { checkAiRateLimit } from "@/lib/api-helpers";
import { crawlWebsite } from "@/lib/website-crawler";

interface WebsiteAnalysis {
  brandName: string;
  brandUrl: string;
  primaryColor: string[];
  niche: string[];
  description: string[];
  targetAudience: string[];
  tone: string[];
  uniqueValueProp: string[];
  competitors: string[];
  keyProducts: string[];
  targetLocation: string;
  suggestedCtaText: string[];
  suggestedCtaUrl: string;
  suggestedWritingStyle: string[];
}

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitErr = checkAiRateLimit(session.user.id, "analyze", 10);
    if (rateLimitErr) return rateLimitErr;

    const { name, domain } = await req.json();

    if (!name || !domain) {
      return NextResponse.json({ error: "name and domain are required" }, { status: 400 });
    }
    if (typeof name === "string" && name.length > 200) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }
    if (typeof domain === "string" && domain.length > 253) {
      return NextResponse.json({ error: "domain too long" }, { status: 400 });
    }

    // Step 1: Crawl the actual website to get real homepage content
    let homepageText = "";
    let metaDesc = "";
    let sitePages: string[] = [];
    const fullUrl = domain.startsWith("http") ? domain : `https://${domain}`;

    try {
      const crawl = await crawlWebsite(fullUrl);
      homepageText = crawl.pageText || "";
      metaDesc = crawl.metaDescription || "";
      sitePages = crawl.pages.slice(0, 20).map(p => p.title ? `${p.title}: ${p.url}` : p.url);
    } catch {
      // Non-fatal — we'll still try Perplexity
    }

    // Step 2: Research with Perplexity (supplementary, not primary)
    let perplexityData = "";
    let apiKey = process.env.PERPLEXITY_API_KEY;

    if (apiKey) {
      apiKey = apiKey.replace(/\\n/g, "").trim();
      try {
        const response = await fetch(
          "https://api.perplexity.ai/chat/completions",
          {
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
                  content:
                    "You are a business analyst. Respond with a concise factual summary only. If you are unsure about something, say so rather than guessing.",
                },
                {
                  role: "user",
                  content: `Research the website "${domain}" (brand name: "${name}").${homepageText ? `\n\nHere is the actual text from their homepage for context:\n${homepageText.slice(0, 2000)}` : ""}

Provide a brief overview of:
1. What the business ACTUALLY does (product/service) — based on the homepage text above
2. Their target audience (who they serve)
3. The industry/niche they operate in
4. Their brand tone/voice if apparent
5. What makes them unique vs competitors
6. Who their main competitors are (top 3-5 names)
7. Their key products, services, or features (top 3-5)
8. Their primary geographic market
Keep it under 300 words. Do NOT invent features or services not mentioned on their website.`,
                },
              ],
              max_tokens: 400,
              temperature: 0.2,
              search_recency_filter: "month",
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          perplexityData = data.choices?.[0]?.message?.content || "";
        }
      } catch (err) {
        console.error("Perplexity research error:", err);
      }
    }

    // Step 3: Use Gemini with REAL data — homepage text is the primary source
    const hasRealContent = homepageText.length > 100;

    const prompt = `You are setting up an AI content marketing platform for a website. Your job is to generate an accurate profile based on REAL information.

Website Name: "${name}"
Domain: "${domain}"
${metaDesc ? `Meta Description: "${metaDesc}"` : ""}

${hasRealContent ? `## ACTUAL HOMEPAGE CONTENT (PRIMARY SOURCE — this is the real text from the website):
${homepageText.slice(0, 3500)}` : ""}

${sitePages.length > 0 ? `## Pages found on the website:
${sitePages.join("\n")}` : ""}

${perplexityData ? `## External research (SECONDARY source — use only to supplement, not override the homepage content):
${perplexityData}` : ""}

## CRITICAL RULES — READ CAREFULLY:
1. The homepage content above is the TRUTH. Base ALL your answers on what the website ACTUALLY says about itself.
2. Do NOT invent features, services, or products that are not mentioned on the website.
3. Do NOT guess what the business does — read the homepage text and describe what it ACTUALLY does.
4. If the business is B2B (serves other businesses), say so. If it's B2C (serves consumers), say so. Read the homepage.
5. If the homepage mentions specific services (e.g. "AI intake", "first-party funnels"), include those as products/features — not made-up alternatives.
6. Competitors should be real companies in the same space — if unsure, list fewer rather than fabricating names.
7. For niche: describe what the business actually does, not what you think the industry should be.

Generate a website profile. For key fields, provide 3 genuinely different options.

Return JSON:
{
  "brandName": "clean brand name",
  "brandUrl": "full URL with https://",
  "primaryColor": ["#hex1", "#hex2", "#hex3"],
  "niche": ["option 1", "option 2", "option 3"],
  "description": ["description 1", "description 2", "description 3"],
  "targetAudience": ["audience 1", "audience 2", "audience 3"],
  "tone": ["tone 1", "tone 2", "tone 3"],
  "uniqueValueProp": ["USP 1", "USP 2", "USP 3"],
  "competitors": ["real competitor 1", "real competitor 2", ...up to 5],
  "keyProducts": ["actual product/service 1", ...up to 5],
  "targetLocation": "geographic market",
  "suggestedCtaText": ["CTA 1", "CTA 2", "CTA 3"],
  "suggestedCtaUrl": "logical landing page URL from the site",
  "suggestedWritingStyle": ["style1", "style2", "style3"]
}

Rules for the 3 options:
- Each option should be genuinely DIFFERENT (not rephrased copies)
- Option 1: most accurate/literal description of what the business does
- Option 2: more specific/targeted angle
- Option 3: positioned for marketing/growth
- "suggestedWritingStyle": pick 3 from: informative, conversational, technical, storytelling, persuasive, humorous
- "primaryColor": 3 colors that fit the brand (check homepage for any brand colors)
- All descriptions should be 2-3 sentences max
- "keyProducts": ONLY list products/services/features explicitly mentioned on the website
- "suggestedCtaUrl": use an actual URL from the website pages list if available`;

    const analysis = await generateJSON<WebsiteAnalysis>(prompt);

    if (analysis.brandUrl && !analysis.brandUrl.startsWith("http")) {
      analysis.brandUrl = `https://${analysis.brandUrl}`;
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Website analyze error:", error);
    return NextResponse.json(
      { error: "Failed to analyze website" },
      { status: 500 }
    );
  }
}
