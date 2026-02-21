/**
 * Test the full content generation pipeline and verify word counts at each step.
 * Run: npx tsx scripts/test-generation.ts
 */
import "dotenv/config";
import { generateTextWithMeta, generateJSON } from "../src/lib/ai/gemini";
import { researchKeyword } from "../src/lib/ai/research";

const keyword = "first-party vehicle acquisition leads";

const ctx = {
  brandName: "Vehicquire",
  brandUrl: "https://vehicquire.com",
  niche: "B2B private-party vehicle acquisition agency",
  targetAudience: "Franchise dealers, independent dealers with buying centers, wholesalers",
  tone: "professional, data-driven, and direct",
  description: "Vehicquire helps dealers scale to 100-400+ purchased units per month using first-party funnels, AI intake, and custom AccuTrade API technology.",
};

const targetWords = "1500-2500";
const draftTokens = 8192;
const minExpectedWords = 1200;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function deduplicateContent(text: string): string {
  const fullText = text.trim();
  for (let chunkSize = Math.floor(fullText.length * 0.3); chunkSize >= 200; chunkSize -= 50) {
    const firstChunk = fullText.slice(0, chunkSize).trim();
    const secondOccurrence = fullText.indexOf(firstChunk, chunkSize - 50);
    if (secondOccurrence > 0 && secondOccurrence < fullText.length * 0.7) {
      console.log(`  ⚠️  Duplicate at pos ${secondOccurrence}`);
      return fullText.slice(0, secondOccurrence).trim();
    }
  }
  return text;
}

function levenshteinSimilar(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 5) return false;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return longer.includes(shorter.slice(0, Math.floor(shorter.length * 0.7)));
}

function findMissingSections(content: string, sections: { heading: string }[]): string[] {
  const h2s = (content.match(/^## .+$/gm) || []).map(h => h.replace(/^## /, "").trim().toLowerCase());
  return sections.filter(s => {
    const target = s.heading.toLowerCase();
    return !h2s.some(h => h.includes(target) || target.includes(h) || levenshteinSimilar(h, target));
  }).map(s => s.heading);
}

async function main() {
  console.log(`\n🔬 FULL PIPELINE TEST (with new fixes): "${keyword}"\n`);
  console.log("=".repeat(70));

  const systemPrompt = `You are a professional blog writer for ${ctx.brandName} (${ctx.brandUrl}).
${ctx.brandName} is a ${ctx.description}.
Target audience: ${ctx.targetAudience}
Tone: ${ctx.tone}
Niche: ${ctx.niche}`;

  // STEP 1: Research
  console.log("\n📚 STEP 1: Research...");
  const research = await researchKeyword(keyword, { ...ctx, id: "test", description: ctx.description });
  console.log(`  ✅ Research: ${countWords(research.rawResearch)} words`);

  // STEP 2: Outline
  console.log("\n📋 STEP 2: Outline...");
  const outline = await generateJSON<{
    title: string;
    sections: { heading: string; points: string[] }[];
    uniqueAngle: string;
  }>(
    `Create a detailed blog post outline for "${keyword}". Brand: ${ctx.brandName}. Target: ${targetWords} words. 5-7 H2 sections with 3-4 bullet points each. Include Key Takeaways near top. Return JSON: { "title": "...", "sections": [{ "heading": "...", "points": ["..."] }], "uniqueAngle": "..." }`,
    systemPrompt
  );
  console.log(`  ✅ Title: "${outline.title}"`);
  console.log(`  Sections: ${outline.sections.map(s => s.heading).join(" | ")}`);

  const contentSections = outline.sections.filter(
    (s) => !/^(key takeaways?|table of contents|faq|frequently asked)/i.test(s.heading)
  );

  // STEP 3: Draft
  console.log("\n✏️  STEP 3: Draft...");
  const t3 = Date.now();
  const draftResult = await generateTextWithMeta(
    `Write a complete ${targetWords}-word blog post about "${keyword}" for ${ctx.brandName}.
Title: ${outline.title}
Outline: ${outline.sections.map(s => `## ${s.heading}\n${s.points.map(p => `- ${p}`).join("\n")}`).join("\n\n")}
Research: ${research.rawResearch.substring(0, 2000)}
Start with a hook. Include Key Takeaways + TOC. Write ALL sections. Do NOT stop after TOC.
Output ONLY Markdown, no H1 title.`,
    systemPrompt,
    { temperature: 0.8, maxTokens: draftTokens }
  );

  let cleanDraft = deduplicateContent(draftResult.text);
  let draftWords = countWords(cleanDraft);
  console.log(`  ✅ Done in ${((Date.now() - t3) / 1000).toFixed(1)}s`);
  console.log(`  📊 Words: ${countWords(draftResult.text)} raw → ${draftWords} after dedup`);
  console.log(`  finishReason: ${draftResult.finishReason} | tokens: ${draftResult.outputTokens}/${draftTokens}`);

  const h2s = cleanDraft.match(/^## .+$/gm) || [];
  console.log(`  H2s found: ${h2s.length} → ${h2s.map(h => h.replace('## ', '')).join(', ')}`);

  const missingSections = findMissingSections(cleanDraft, contentSections);
  const needsRetry = draftWords < minExpectedWords || missingSections.length >= 2 || draftResult.truncated;
  console.log(`  Missing sections: ${missingSections.length > 0 ? missingSections.join(", ") : "none"}`);
  console.log(`  Needs section-by-section fallback: ${needsRetry}`);

  if (needsRetry) {
    console.log("\n🔧 FALLBACK: Generating section by section...");
    const sectionParts: string[] = [];
    const wordsPerSection = Math.ceil(parseInt(targetWords.split("-")[1] || "2000") / contentSections.length);

    const introResult = await generateTextWithMeta(
      `Write the opening for a blog post about "${keyword}". Include: 1) A 2-3 paragraph hook 2) Key Takeaways (4-5 bullets) 3) Table of Contents: ${contentSections.map(s => s.heading).join(", ")}. Output Markdown only.`,
      systemPrompt,
      { temperature: 0.8, maxTokens: 2048 }
    );
    sectionParts.push(introResult.text.trim());
    console.log(`  Intro: ${countWords(introResult.text)} words (${introResult.finishReason})`);

    for (let i = 0; i < contentSections.length; i++) {
      const section = contentSections[i];
      const sectionResult = await generateTextWithMeta(
        `Write section ${i + 1}: ## ${section.heading}. Points: ${section.points.join(", ")}. Write ${wordsPerSection} words. Start with ## ${section.heading}. Expert perspective. Markdown only.`,
        systemPrompt,
        { temperature: 0.8, maxTokens: 2048 }
      );
      sectionParts.push(sectionResult.text.trim());
      console.log(`  Section ${i + 1} "${section.heading}": ${countWords(sectionResult.text)} words (${sectionResult.finishReason})`);
    }

    const stitched = sectionParts.join("\n\n");
    const stitchedWords = countWords(stitched);
    console.log(`  Total stitched: ${stitchedWords} words`);

    if (stitchedWords > draftWords) {
      cleanDraft = stitched;
      draftWords = stitchedWords;
    }
  }

  // STEP 4: Tone Polish
  console.log("\n🎨 STEP 4: Tone Polish...");
  const t4 = Date.now();
  const rewriteTokens = Math.max(8192, Math.ceil(draftWords * 1.4 * 1.5));
  console.log(`  Token budget: ${rewriteTokens} (based on ${draftWords} words)`);

  const toneResult = await generateTextWithMeta(
    `Edit this blog post. Keep ALL headings, facts, tables, links. Tighten language, kill AI phrases, add personality. Draft (${draftWords} words — preserve length): ${cleanDraft}\nOutput the COMPLETE article. At LEAST ${draftWords} words.`,
    systemPrompt,
    { temperature: 0.65, maxTokens: rewriteTokens }
  );

  const cleanTone = deduplicateContent(toneResult.text);
  const toneWords = countWords(cleanTone);
  console.log(`  ✅ Done in ${((Date.now() - t4) / 1000).toFixed(1)}s`);
  console.log(`  📊 Words: ${countWords(toneResult.text)} raw → ${toneWords} after dedup`);
  console.log(`  finishReason: ${toneResult.finishReason} | tokens: ${toneResult.outputTokens}/${rewriteTokens}`);

  const toneToUse = (!toneResult.truncated && toneWords >= draftWords * 0.7) ? cleanTone : cleanDraft;
  if (toneResult.truncated || toneWords < draftWords * 0.7) {
    console.log(`  ⚠️  Tone lost content or truncated. Using draft.`);
  }

  // STEP 5: SEO
  console.log("\n🔍 STEP 5: SEO...");
  const t5 = Date.now();
  const toneToUseWords = countWords(toneToUse);
  const seoTokens = Math.max(8192, Math.ceil(toneToUseWords * 1.4 * 1.5));
  console.log(`  Token budget: ${seoTokens} (based on ${toneToUseWords} words)`);

  const seoResult = await generateTextWithMeta(
    `SEO optimize this blog post for "${keyword}". Keyword in first 100 words, one H2, conclusion. 1-2% density. No internal links. Every paragraph under 80 words. Blog Post (${toneToUseWords} words): ${toneToUse}\nOutput COMPLETE article. At LEAST ${toneToUseWords} words.`,
    systemPrompt,
    { temperature: 0.4, maxTokens: seoTokens }
  );

  const cleanSeo = deduplicateContent(seoResult.text);
  const seoWords = countWords(cleanSeo);
  console.log(`  ✅ Done in ${((Date.now() - t5) / 1000).toFixed(1)}s`);
  console.log(`  📊 Words: ${countWords(seoResult.text)} raw → ${seoWords} after dedup`);
  console.log(`  finishReason: ${seoResult.finishReason} | tokens: ${seoResult.outputTokens}/${seoTokens}`);

  // Final selection
  let bestVersion = cleanSeo;
  let bestLabel = "SEO";
  if (seoResult.truncated || seoWords < toneToUseWords * 0.6) {
    bestVersion = toneToUse;
    bestLabel = "tone";
  }
  if (countWords(bestVersion) < draftWords * 0.5) {
    bestVersion = cleanDraft;
    bestLabel = "draft";
  }

  // SUMMARY
  console.log("\n" + "=".repeat(70));
  console.log("📊 PIPELINE SUMMARY:");
  console.log("=".repeat(70));
  console.log(`  Draft:      ${draftWords} words`);
  console.log(`  Tone:       ${toneWords} words (finishReason: ${toneResult.finishReason})`);
  console.log(`  SEO:        ${seoWords} words (finishReason: ${seoResult.finishReason})`);
  console.log(`  Final used: ${bestLabel} → ${countWords(bestVersion)} words`);
  console.log("=".repeat(70));

  const finalH2s = bestVersion.match(/^## .+$/gm) || [];
  console.log(`\n  Final H2s (${finalH2s.length}): ${finalH2s.map(h => h.replace('## ', '')).join(', ')}`);
  
  if (countWords(bestVersion) < 800) {
    console.log("\n🚨 CRITICAL: Final output under 800 words!");
  } else if (countWords(bestVersion) >= 1200) {
    console.log("\n✅ Final output meets minimum word count!");
  }
}

main().catch(console.error);
