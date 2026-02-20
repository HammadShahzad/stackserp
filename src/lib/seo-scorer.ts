/**
 * SEO Content Scorer
 * Calculates a 0-100 score based on on-page SEO factors
 */

interface ScoringInput {
  content: string;
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
}

interface ScoreResult {
  score: number;
  breakdown: { factor: string; points: number; maxPoints: number; note: string }[];
}

export function calculateContentScore(input: ScoringInput): ScoreResult {
  const kw = input.focusKeyword?.toLowerCase() || "";
  const content = input.content.toLowerCase();
  const words = input.content.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const breakdown: ScoreResult["breakdown"] = [];

  function add(factor: string, points: number, maxPoints: number, note: string) {
    breakdown.push({ factor, points: Math.min(points, maxPoints), maxPoints, note });
  }

  // 1. Focus keyword present (10 pts)
  if (kw) {
    add("Focus keyword set", 10, 10, "Focus keyword is defined");
  } else {
    add("Focus keyword set", 0, 10, "No focus keyword defined");
  }

  // 2. Keyword in title (10 pts)
  if (kw && input.title.toLowerCase().includes(kw)) {
    add("Keyword in title", 10, 10, "Title contains focus keyword");
  } else {
    add("Keyword in title", 0, 10, "Title missing focus keyword");
  }

  // 3. Keyword in first 150 words (8 pts)
  const first150 = words.slice(0, 150).join(" ").toLowerCase();
  if (kw && first150.includes(kw)) {
    add("Keyword in intro", 8, 8, "Focus keyword appears in first 150 words");
  } else {
    add("Keyword in intro", 0, 8, "Focus keyword not found in intro");
  }

  // 4. Keyword density 0.5-2.5% (8 pts)
  if (kw && wordCount > 0) {
    const kwWords = kw.split(/\s+/).length;
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const occurrences = (input.content.match(regex) || []).length;
    const density = (occurrences * kwWords / wordCount) * 100;
    if (density >= 0.5 && density <= 2.5) {
      add("Keyword density", 8, 8, `Density: ${density.toFixed(1)}% (ideal 0.5-2.5%)`);
    } else if (density > 0) {
      add("Keyword density", 4, 8, `Density: ${density.toFixed(1)}% (target 0.5-2.5%)`);
    } else {
      add("Keyword density", 0, 8, "Focus keyword not found in content");
    }
  } else {
    add("Keyword density", 0, 8, "Cannot calculate without keyword");
  }

  // 5. Meta title (8 pts)
  const mt = input.metaTitle || "";
  if (mt.length >= 30 && mt.length <= 60) {
    add("Meta title", 8, 8, `${mt.length} chars (ideal 30-60)`);
  } else if (mt.length > 0) {
    add("Meta title", 4, 8, `${mt.length} chars (target 30-60)`);
  } else {
    add("Meta title", 0, 8, "No meta title set");
  }

  // 6. Meta description (8 pts)
  const md = input.metaDescription || "";
  if (md.length >= 120 && md.length <= 160) {
    add("Meta description", 8, 8, `${md.length} chars (ideal 120-160)`);
  } else if (md.length > 0) {
    add("Meta description", 4, 8, `${md.length} chars (target 120-160)`);
  } else {
    add("Meta description", 0, 8, "No meta description set");
  }

  // 7. Word count (10 pts)
  if (wordCount >= 1500) {
    add("Word count", 10, 10, `${wordCount} words (1500+ is great)`);
  } else if (wordCount >= 800) {
    add("Word count", 6, 10, `${wordCount} words (target 1500+)`);
  } else if (wordCount >= 300) {
    add("Word count", 3, 10, `${wordCount} words (minimum for SEO)`);
  } else {
    add("Word count", 0, 10, `${wordCount} words (too short)`);
  }

  // 8. Headings structure (8 pts)
  const h2Count = (content.match(/^##\s/gm) || []).length;
  const h3Count = (content.match(/^###\s/gm) || []).length;
  if (h2Count >= 3 && h3Count >= 1) {
    add("Heading structure", 8, 8, `${h2Count} H2s, ${h3Count} H3s — good hierarchy`);
  } else if (h2Count >= 2) {
    add("Heading structure", 5, 8, `${h2Count} H2s — add more subheadings`);
  } else {
    add("Heading structure", 2, 8, "Needs more H2/H3 structure");
  }

  // 9. Internal links (8 pts) - target 15-20 per article
  const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
  if (linkCount >= 15) {
    add("Internal links", 8, 8, `${linkCount} links found (excellent)`);
  } else if (linkCount >= 8) {
    add("Internal links", 6, 8, `${linkCount} links found (target 15+)`);
  } else if (linkCount >= 3) {
    add("Internal links", 4, 8, `${linkCount} links found (target 15+)`);
  } else if (linkCount >= 1) {
    add("Internal links", 2, 8, `${linkCount} link(s), add more internal links`);
  } else {
    add("Internal links", 0, 8, "No links found");
  }

  // 10. Featured image (6 pts)
  if (input.featuredImage && input.featuredImageAlt) {
    add("Featured image", 6, 6, "Image with alt text set");
  } else if (input.featuredImage) {
    add("Featured image", 4, 6, "Image set but missing alt text");
  } else {
    add("Featured image", 0, 6, "No featured image");
  }

  // 11. Keyword in H2 headings (6 pts)
  if (kw) {
    const h2s = content.match(/^##\s.+$/gm) || [];
    const kwInH2 = h2s.some((h) => h.toLowerCase().includes(kw));
    if (kwInH2) {
      add("Keyword in headings", 6, 6, "Focus keyword found in H2");
    } else {
      add("Keyword in headings", 0, 6, "Focus keyword not found in any H2");
    }
  } else {
    add("Keyword in headings", 0, 6, "No keyword to check");
  }

  // 12. Readability — paragraph length (5 pts)
  const paragraphs = input.content.split(/\n\n+/).filter((p) => p.trim().length > 50);
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 80);
  if (longParagraphs.length === 0) {
    add("Readability", 5, 5, "Good paragraph lengths");
  } else {
    add("Readability", 2, 5, `${longParagraphs.length} overly long paragraph(s)`);
  }

  const totalScore = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { score: totalScore, breakdown };
}
