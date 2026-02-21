"use client";

import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, Wand2, Loader2 } from "lucide-react";

interface SEOScoreProps {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  wordCount: number;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  onAutoFix?: () => void;
  isFixing?: boolean;
}

interface Factor {
  label: string;
  points: number;
  maxPoints: number;
  note: string;
}

/**
 * Mirrors the exact scoring algorithm in src/lib/seo-scorer.ts
 * so the score shown on the post editor matches the stored contentScore.
 */
// Which factor labels can be auto-fixed by the AI
const AUTO_FIXABLE = new Set([
  "Word count",
  "Heading structure",
  "Internal links",
  "Readability",
]);

export function SEOScore({
  title,
  content,
  metaTitle,
  metaDescription,
  focusKeyword,
  wordCount,
  featuredImage,
  featuredImageAlt,
  onAutoFix,
  isFixing,
}: SEOScoreProps) {
  const { score, breakdown } = useMemo(() => {
    const kw = focusKeyword.toLowerCase();
    const contentLower = content.toLowerCase();
    const words = content.split(/\s+/).filter(Boolean);
    const factors: Factor[] = [];

    function add(label: string, points: number, maxPoints: number, note: string) {
      factors.push({ label, points: Math.min(points, maxPoints), maxPoints, note });
    }

    // 1. Focus keyword present (10 pts)
    if (kw) {
      add("Focus keyword set", 10, 10, "Focus keyword is defined");
    } else {
      add("Focus keyword set", 0, 10, "No focus keyword defined");
    }

    // 2. Keyword in title (10 pts)
    if (kw && title.toLowerCase().includes(kw)) {
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
      const kwWordCount = kw.split(/\s+/).length;
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const occurrences = (content.match(regex) || []).length;
      const density = (occurrences * kwWordCount / wordCount) * 100;
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
    const mt = metaTitle || "";
    if (mt.length >= 30 && mt.length <= 60) {
      add("Meta title", 8, 8, `${mt.length} chars (ideal 30-60)`);
    } else if (mt.length > 0) {
      add("Meta title", 4, 8, `${mt.length} chars (target 30-60)`);
    } else {
      add("Meta title", 0, 8, "No meta title set");
    }

    // 6. Meta description (8 pts)
    const md = metaDescription || "";
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
    const h2Count = (contentLower.match(/^##\s/gm) || []).length;
    const h3Count = (contentLower.match(/^###\s/gm) || []).length;
    if (h2Count >= 3 && h3Count >= 1) {
      add("Heading structure", 8, 8, `${h2Count} H2s, ${h3Count} H3s — good hierarchy`);
    } else if (h2Count >= 2) {
      add("Heading structure", 5, 8, `${h2Count} H2s — add more subheadings`);
    } else {
      add("Heading structure", 2, 8, "Needs more H2/H3 structure");
    }

    // 9. Internal links (8 pts)
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
    if (featuredImage && featuredImageAlt) {
      add("Featured image", 6, 6, "Image with alt text set");
    } else if (featuredImage) {
      add("Featured image", 4, 6, "Image set but missing alt text");
    } else {
      add("Featured image", 0, 6, "No featured image");
    }

    // 11. Keyword in H2 headings (6 pts)
    if (kw) {
      const h2s = contentLower.match(/^##\s.+$/gm) || [];
      const kwInH2 = h2s.some((h) => h.includes(kw));
      if (kwInH2) {
        add("Keyword in headings", 6, 6, "Focus keyword found in H2");
      } else {
        add("Keyword in headings", 0, 6, "Focus keyword not found in any H2");
      }
    } else {
      add("Keyword in headings", 0, 6, "No keyword to check");
    }

    // 12. Readability — paragraph length (5 pts)
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 50);
    const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 80);
    if (longParagraphs.length === 0) {
      add("Readability", 5, 5, "Good paragraph lengths");
    } else {
      add("Readability", 2, 5, `${longParagraphs.length} overly long paragraph(s)`);
    }

    const total = factors.reduce((sum, f) => sum + f.points, 0);
    const fixableIssues = factors.filter(
      (f) => f.points < f.maxPoints && AUTO_FIXABLE.has(f.label)
    );
    return { score: total, breakdown: factors, fixableIssues };
  }, [title, content, metaTitle, metaDescription, focusKeyword, wordCount, featuredImage, featuredImageAlt]);

  const scoreColor =
    score >= 80
      ? "text-green-600"
      : score >= 60
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">SEO Score</span>
        <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
      </div>
      <Progress value={score} className="h-2" />

      {/* Auto-fix button — shown when there are fixable issues */}
      {onAutoFix && fixableIssues.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
          onClick={onAutoFix}
          disabled={isFixing}
        >
          {isFixing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          {isFixing
            ? "Fixing issues…"
            : `Auto-Fix ${fixableIssues.length} issue${fixableIssues.length > 1 ? "s" : ""}`}
        </Button>
      )}

      <div className="space-y-2">
        {breakdown.map((factor) => {
          const full = factor.points === factor.maxPoints;
          const partial = factor.points > 0 && !full;
          const fixable = !full && AUTO_FIXABLE.has(factor.label);

          return (
            <div key={factor.label} className="flex items-start gap-2">
              {full ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : partial ? (
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium">{factor.label}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {fixable && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded font-medium">
                        fixable
                      </span>
                    )}
                    <span className={`text-[10px] font-mono ${full ? "text-green-600" : partial ? "text-yellow-600" : "text-muted-foreground"}`}>
                      {factor.points}/{factor.maxPoints}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{factor.note}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
