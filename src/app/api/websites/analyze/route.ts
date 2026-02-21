import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateJSON } from "@/lib/ai/gemini";
import { checkAiRateLimit } from "@/lib/api-helpers";

interface WebsiteAnalysis {
  brandName: string;
  brandUrl: string;
  primaryColor: string;
  niche: string;
  description: string;
  targetAudience: string;
  tone: string;
  uniqueValueProp: string;
  competitors: string[];
  keyProducts: string[];
  targetLocation: string;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 10 website analyses per hour per user
    const rateLimitErr = checkAiRateLimit(session.user.id, "analyze", 10);
    if (rateLimitErr) return rateLimitErr;

    const { name, domain } = await req.json();

    if (!name || !domain) {
      return NextResponse.json(
        { error: "name and domain are required" },
        { status: 400 }
      );
    }
    if (typeof name === "string" && name.length > 200) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }
    if (typeof domain === "string" && domain.length > 253) {
      return NextResponse.json({ error: "domain too long" }, { status: 400 });
    }

    // Step 1: Research the website using Perplexity
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
                    "You are a business analyst. Respond with a concise factual summary only.",
                },
                {
                  role: "user",
                  content: `Research the website "${domain}" (brand name: "${name}"). Provide a brief overview of:
1. What the business does (product/service)
2. Their target audience (who they serve)
3. The industry/niche they operate in
4. Their brand tone/voice if apparent
5. What makes them unique vs competitors (unique value proposition)
6. Who their main competitors are (top 3-5 names)
7. Their key products or features (top 3-5)
8. Their primary geographic market
Keep it under 300 words.`,
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
          perplexityData =
            data.choices?.[0]?.message?.content || "";
        }
      } catch (err) {
        console.error("Perplexity research error:", err);
      }
    }

    // Step 2: Use Gemini to generate structured brand + content strategy
    const prompt = `You are setting up an AI content marketing platform for a website.

Website Name: "${name}"
Domain: "${domain}"
${perplexityData ? `Research findings:\n${perplexityData}` : `No research data available — infer from the domain name "${domain}" and brand name "${name}".`}

Generate a complete website profile for content generation. Return JSON with exactly these fields:

{
  "brandName": "clean brand name (e.g. InvoiceCave, not invoicecave.com)",
  "brandUrl": "full URL with https:// (e.g. https://invoicecave.com)",
  "primaryColor": "a hex color that fits the brand personality (e.g. #4F46E5 for SaaS, #16A34A for finance, #DC2626 for bold brands)",
  "niche": "specific niche/industry description (e.g. 'invoicing software for freelancers and small businesses')",
  "description": "2-3 sentence business description explaining what they do, who they help, and what makes them unique",
  "targetAudience": "specific target audience description (e.g. 'freelancers, solopreneurs, and small business owners who need simple invoicing tools')",
  "tone": "writing tone for blog content (e.g. 'professional yet approachable', 'technical and authoritative', 'friendly and educational')",
  "uniqueValueProp": "1-2 sentences on what makes this business genuinely different from competitors — their key differentiator or USP",
  "competitors": ["competitor1", "competitor2", "competitor3"],
  "keyProducts": ["product/feature 1", "product/feature 2", "product/feature 3"],
  "targetLocation": "primary geographic market (e.g. 'United States', 'Global', 'UK and Europe')"
}`;

    const analysis = await generateJSON<WebsiteAnalysis>(prompt);

    // Ensure brandUrl always has https://
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
