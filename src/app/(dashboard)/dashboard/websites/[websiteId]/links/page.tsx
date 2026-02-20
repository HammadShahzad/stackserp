"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Link2,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Sparkles,
  CheckCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

interface InternalLink {
  id: string;
  keyword: string;
  url: string;
  createdAt: string;
}

interface SuggestedLink {
  keyword: string;
  url: string;
  reason: string;
}

interface StepStatus {
  crawl: "ok" | "failed";
  gemini: "ok" | "failed";
  error?: string;
  pagesFound: number;
}

// Loading dialog — shown as a modal overlay, impossible to miss
function AiGeneratingDialog({ open }: { open: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = [
    { icon: Globe, label: "Crawling your website…", detail: "Fetching homepage and sitemap directly" },
    { icon: Globe, label: "Discovering pages & sections…", detail: "Scanning links, features, pricing, blog…" },
    { icon: Sparkles, label: "Mapping keywords to URLs…", detail: "Gemini is creating link pairs" },
    { icon: Sparkles, label: "Filtering & ranking links…", detail: "Removing duplicates, validating URLs" },
    { icon: Sparkles, label: "Almost done…", detail: "Finalizing your internal link pairs" },
  ];

  useEffect(() => {
    if (!open) { setStepIdx(0); return; }
    const t = setInterval(() => setStepIdx((i) => (i + 1) % steps.length), 3000);
    return () => clearInterval(t);
  }, [open, steps.length]);

  const current = steps[stepIdx];
  const Icon = current.icon;

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-sm text-center"
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-4 pt-2">
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-16 w-16 rounded-full bg-primary/20 animate-ping" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30">
                <Icon className="h-6 w-6 text-primary animate-pulse" />
              </span>
            </div>
            <span className="text-base font-semibold">{current.label}</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {current.detail}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 py-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`inline-block rounded-full transition-all duration-500 ${
                i === stepIdx
                  ? "w-5 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground pb-2">
          This usually takes 15–30 seconds
        </p>
      </DialogContent>
    </Dialog>
  );
}

// Result dialog after API responds — shows what happened before review
function ResultStatusBanner({ steps }: { steps: StepStatus }) {
  const allGood = steps.crawl === "ok" && steps.gemini === "ok";
  const geminiOnly = steps.crawl !== "ok" && steps.gemini === "ok";

  if (allGood) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-green-800">
            Found {steps.pagesFound} pages on your website
          </p>
          <p className="text-green-700 text-xs mt-0.5">
            Gemini mapped them to keyword→URL pairs below
          </p>
        </div>
      </div>
    );
  }

  if (geminiOnly) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800">
            Couldn&apos;t crawl your website directly
          </p>
          <p className="text-amber-700 text-xs mt-0.5">
            Gemini generated links based on your domain pattern instead — results may be less precise
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-red-800">AI generation failed</p>
        <p className="text-red-700 text-xs mt-0.5">
          {steps.gemini === "failed" ? (
            <>
              Gemini 3.1 Pro returned an error — this is usually temporary. Try again in a moment. If it keeps failing, verify GOOGLE_AI_API_KEY is valid.
              {steps.error && <span className="block mt-1 bg-red-100 p-1.5 rounded text-red-800 font-mono text-[10px] break-all">{steps.error}</span>}
            </>
          ) : (
            "Both crawl and Gemini failed — check your website URL and API keys"
          )}
        </p>
      </div>
    </div>
  );
}

export default function InternalLinksPage() {
  const params = useParams();
  const websiteId = params.websiteId as string;
  const [links, setLinks] = useState<InternalLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState({ keyword: "", url: "" });
  const [search, setSearch] = useState("");

  // AI suggestion state
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedLink[]>([]);
  const [stepStatus, setStepStatus] = useState<StepStatus | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [isSavingSuggestions, setIsSavingSuggestions] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/links`);
      if (res.ok) setLinks(await res.json());
    } catch {
      toast.error("Failed to load links");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleAdd = async () => {
    if (!newLink.keyword.trim() || !newLink.url.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLink),
      });
      if (res.ok) {
        toast.success("Link pair added");
        setNewLink({ keyword: "", url: "" });
        fetchLinks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add link");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (linkId: string) => {
    setDeletingId(linkId);
    try {
      const res = await fetch(`/api/websites/${websiteId}/links?id=${linkId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Link removed");
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setStepStatus(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/links/suggest`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to generate suggestions");
        return;
      }

      setStepStatus(data.steps ?? null);

      if (!data.suggestions?.length) {
        // Show review dialog anyway so user sees the status banner explaining WHY
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        setShowReviewDialog(true);
        return;
      }

      setSuggestions(data.suggestions);
      setSelectedSuggestions(new Set(data.suggestions.map((_: SuggestedLink, i: number) => i)));
      setShowReviewDialog(true);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleSaveSuggestions = async () => {
    const toSave = suggestions.filter((_, i) => selectedSuggestions.has(i));
    if (!toSave.length) { toast.warning("No links selected"); return; }

    setIsSavingSuggestions(true);
    let saved = 0, skipped = 0;

    for (const link of toSave) {
      try {
        const res = await fetch(`/api/websites/${websiteId}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: link.keyword, url: link.url }),
        });
        if (res.ok) saved++; else skipped++;
      } catch { skipped++; }
    }

    await fetchLinks();
    setShowReviewDialog(false);
    setSuggestions([]);
    setIsSavingSuggestions(false);
    toast.success(skipped > 0 ? `Saved ${saved} link pairs (${skipped} skipped)` : `Added ${saved} internal link pairs`);
  };

  const filtered = links.filter(
    (l) =>
      l.keyword.toLowerCase().includes(search.toLowerCase()) ||
      l.url.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Loading Dialog — modal, impossible to miss */}
      <AiGeneratingDialog open={isGenerating} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Internal Links
          </h2>
          <p className="text-muted-foreground mt-1">
            Keyword → URL pairs automatically inserted into AI-generated content
          </p>
        </div>
        <Button onClick={handleAutoGenerate} disabled={isGenerating} className="gap-2 shrink-0">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? "Scanning…" : "Auto-generate with AI"}
        </Button>
      </div>

      {/* Info */}
      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="flex items-start gap-3 p-4">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Auto-generate scans your site</p>
            <p className="text-muted-foreground mt-0.5">
              Click <strong>Auto-generate with AI</strong> — we crawl your website directly,
              Gemini maps them to keyword→URL pairs. Review and save the ones you want.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual add */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Manually
          </CardTitle>
          <CardDescription>
            When the keyword appears in generated content, it will be linked to the URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Keyword (e.g., invoicing software)"
                value={newLink.keyword}
                onChange={(e) => setNewLink((p) => ({ ...p, keyword: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="URL (e.g., https://example.com/features)"
                value={newLink.url}
                onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} disabled={isAdding || !newLink.keyword.trim() || !newLink.url.trim()}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Links list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              Link Pairs
              <Badge variant="secondary">{links.length}</Badge>
            </CardTitle>
            {links.length > 5 && (
              <Input
                placeholder="Search keywords or URLs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Link2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm mb-4">
                {links.length === 0 ? "No link pairs yet" : "No matches found"}
              </p>
              {links.length === 0 && (
                <Button variant="outline" size="sm" className="gap-2" onClick={handleAutoGenerate} disabled={isGenerating}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-generate with AI
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-0">
              {filtered.map((link, i) => (
                <div key={link.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0 font-mono">{link.keyword}</Badge>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate flex items-center gap-1">
                          {link.url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive ml-2 shrink-0"
                      onClick={() => handleDelete(link.id)} disabled={deletingId === link.id}>
                      {deletingId === link.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Internal Links
            </DialogTitle>
            <DialogDescription>
              {suggestions.length > 0
                ? `${suggestions.length} link pairs ready. Deselect any you don't want, then save.`
                : "The AI couldn't generate suggestions — see details below."}
            </DialogDescription>
          </DialogHeader>

          {/* Status banner — always shown so user knows what happened */}
          {stepStatus && <ResultStatusBanner steps={stepStatus} />}

          {suggestions.length > 0 && (
            <>
              <div className="flex items-center gap-3 px-1">
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
                  onClick={() => setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))}>
                  <CheckCheck className="h-3.5 w-3.5" />
                  Select all
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
                  onClick={() => setSelectedSuggestions(new Set())}>
                  <X className="h-3.5 w-3.5" />
                  Deselect all
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">{selectedSuggestions.size} selected</span>
              </div>

              <Separator />

              <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                {suggestions.map((s, i) => (
                  <div key={i}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedSuggestions.has(i)
                        ? "bg-primary/5 border-primary/20"
                        : "border-transparent hover:bg-muted/50"
                    }`}
                    onClick={() => toggleSuggestion(i)}
                  >
                    <Checkbox
                      checked={selectedSuggestions.has(i)}
                      onCheckedChange={() => toggleSuggestion(i)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">{s.keyword}</Badge>
                        <span className="text-muted-foreground text-xs">→</span>
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate max-w-[280px] flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}>
                          {s.url}
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      </div>
                      {s.reason && <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              {suggestions.length === 0 ? "Close" : "Cancel"}
            </Button>
            {suggestions.length > 0 && (
              <Button onClick={handleSaveSuggestions}
                disabled={isSavingSuggestions || selectedSuggestions.size === 0} className="gap-2">
                {isSavingSuggestions
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Plus className="h-4 w-4" />}
                Save {selectedSuggestions.size} link{selectedSuggestions.size !== 1 ? "s" : ""}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
