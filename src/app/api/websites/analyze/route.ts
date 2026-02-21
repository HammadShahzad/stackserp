import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateJSON } from "@/lib/ai/gemini";
import { checkAiRateLimit } from "@/lib/api-helpers";

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

    // Step 2: Use Gemini to generate structured brand + content strategy with options
    const prompt = `You are setting up an AI content marketing platform for a website.

Website Name: "${name}"
Domain: "${domain}"
${perplexityData ? `Research findings:\n${perplexityData}` : `No research data available — infer from the domain name "${domain}" and brand name "${name}".`}

Generate a complete website profile for content generation. For key fields, provide 3 different options so the user can choose.

Return JSON with exactly these fields:

{
  "brandName": "clean brand name (e.g. InvoiceCave, not invoicecave.com)",
  "brandUrl": "full URL with https://",
  "primaryColor": ["#hex1", "#hex2", "#hex3"],
  "niche": ["option 1 — broad angle", "option 2 — specific angle", "option 3 — alternative angle"],
  "description": ["description option 1", "description option 2 — different angle", "description option 3 — different framing"],
  "targetAudience": ["audience option 1 — broad", "audience option 2 — specific", "audience option 3 — niche"],
  "tone": ["tone option 1 (e.g. professional yet approachable)", "tone option 2 (e.g. technical and authoritative)", "tone option 3 (e.g. friendly and educational)"],
  "uniqueValueProp": ["USP option 1", "USP option 2 — different angle", "USP option 3 — different framing"],
  "competitors": ["competitor1", "competitor2", "competitor3", "competitor4", "competitor5"],
  "keyProducts": ["product1", "product2", "product3", "product4", "product5"],
  "targetLocation": "primary geographic market",
  "suggestedCtaText": ["CTA option 1", "CTA option 2", "CTA option 3"],
  "suggestedCtaUrl": "most logical landing page URL",
  "suggestedWritingStyle": ["style1", "style2", "style3"]
}

Rules for the 3 options:
- Each option should be genuinely DIFFERENT (not rephrased copies)
- Option 1: most conventional/safe approach
- Option 2: more specific/targeted approach
- Option 3: creative/bold approach
- For "suggestedWritingStyle": pick 3 from: informative, conversational, technical, storytelling, persuasive, humorous
- For "primaryColor": pick 3 colors that each fit the brand but feel different (e.g. professional blue, energetic orange, modern purple)
- All descriptions should be 2-3 sentences max`;

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
