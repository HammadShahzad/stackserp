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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Network,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  KeyRound,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useGlobalJobs } from "@/components/dashboard/global-jobs-context";

interface TopicCluster {
  id: string;
  name: string;
  pillarKeyword: string;
  supportingKeywords: string[];
  status: string;
  createdAt: string;
}

interface SuggestedCluster {
  pillarKeyword: string;
  name: string;
  supportingKeywords: string[];
  rationale: string;
}

interface StepStatus {
  crawl: "ok" | "failed";
  gemini: "ok" | "failed";
  error?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
};

// ── Modal loading dialog — impossible to miss ────────────────────────────────
function AiGeneratingDialog({ open }: { open: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = [
    { icon: Globe,    label: "Crawling your website…",            detail: "Fetching pages and sitemap directly" },
    { icon: Globe,    label: "Identifying core topics…",          detail: "Analyzing what your business offers" },
    { icon: Globe,    label: "Mapping content themes…",           detail: "Finding what your customers search for" },
    { icon: Sparkles, label: "Designing cluster structure…",      detail: "Gemini is grouping topics into pillars" },
    { icon: Sparkles, label: "Writing supporting keywords…",      detail: "Generating long-tail keyword variations" },
    { icon: Sparkles, label: "Almost done…",                      detail: "Finalizing your topic clusters" },
  ];

  useEffect(() => {
    if (!open) { setStepIdx(0); return; }
    const t = setInterval(() => setStepIdx((i) => (i + 1) % steps.length), 3200);
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

// ── Status banner shown inside the review dialog ─────────────────────────────
function ResultStatusBanner({ steps }: { steps: StepStatus }) {
  if (steps.crawl === "ok" && steps.gemini === "ok") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-green-800">Research completed successfully</p>
          <p className="text-green-700 text-xs mt-0.5">
            Crawled your website · Gemini designed the clusters below
          </p>
        </div>
      </div>
    );
  }

  if (steps.crawl !== "ok" && steps.gemini === "ok") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800">
            Couldn&apos;t crawl your website directly
          </p>
          <p className="text-amber-700 text-xs mt-0.5">
            Gemini used your brand description instead — clusters may be less precise than usual
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
          Gemini 3.1 Pro returned an error — this is usually temporary. Try again in a moment.
          If it keeps failing, check that GOOGLE_AI_API_KEY is valid in your environment.
          {steps.error && <span className="block mt-1 bg-red-100 p-1.5 rounded text-red-800 font-mono text-[10px] break-all">{steps.error}</span>}
        </p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ClustersPage() {
  const params = useParams();
  const websiteId = params.websiteId as string;
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clusterKeywordSelection, setClusterKeywordSelection] = useState<Record<string, Set<string>>>({});
  const [addingToQueueId, setAddingToQueueId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedCluster[]>([]);
  const [stepStatus, setStepStatus] = useState<StepStatus | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [seedTopic, setSeedTopic] = useState("");
  const [newCluster, setNewCluster] = useState({
    name: "",
    pillarKeyword: "",
    supportingKeywords: "",
  });

  const fetchClusters = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/clusters`);
      if (res.ok) setClusters(await res.json());
    } catch {
      toast.error("Failed to load clusters");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  const { addJob, updateJob, removeJob, getJob } = useGlobalJobs();
  const clusterJobId = `cluster-gen-${websiteId}`;
  const clusterSteps = ["crawling", "analyzing", "generating", "saving"];

  // Restore cluster suggestions from global context (backed by sessionStorage) on mount
  useEffect(() => {
    let job = getJob(clusterJobId);
    // Fallback: read directly from sessionStorage in case ref isn't synced yet
    if (!job) {
      try {
        const raw = sessionStorage.getItem("global-jobs");
        if (raw) {
          const all = JSON.parse(raw) as Array<{ id: string; status: string; resultData?: Record<string, unknown> }>;
          job = all.find((j) => j.id === clusterJobId) as ReturnType<typeof getJob>;
        }
      } catch { /* ignore */ }
    }
    if (job?.status === "done" && job.resultData?.suggestions?.length) {
      setSuggestions(job.resultData.suggestions);
      setSelectedSuggestions(new Set(
        (job.resultData.suggestions as SuggestedCluster[]).map((_, i) => i)
      ));
      if (job.resultData.stepStatus) setStepStatus(job.resultData.stepStatus);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    setStepStatus(null);

    const label = seedTopic.trim()
      ? `Clusters: "${seedTopic.trim()}"`
      : "AI Topic Clusters";

    addJob({
      id: clusterJobId,
      type: "clusters",
      label,
      websiteId,
      href: `/dashboard/websites/${websiteId}/clusters`,
      status: "running",
      progress: 5,
      currentStep: "crawling",
      steps: clusterSteps,
    });

    try {
      updateJob(clusterJobId, { progress: 20, currentStep: "analyzing" });

      const res = await fetch(`/api/websites/${websiteId}/clusters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, seedTopic: seedTopic.trim() || undefined }),
      });

      updateJob(clusterJobId, { progress: 80, currentStep: "generating" });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Generation failed");
        updateJob(clusterJobId, { status: "failed", error: data.error || "Generation failed" });
        return;
      }

      const stepStatus = data.steps ?? null;
      setStepStatus(stepStatus);

      if (!data.suggestions?.length) {
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        updateJob(clusterJobId, { status: "done", progress: 100, resultData: { suggestions: [], stepStatus }, resultConsumed: false });
        return;
      }

      setSuggestions(data.suggestions);
      setSelectedSuggestions(new Set(data.suggestions.map((_: SuggestedCluster, i: number) => i)));
      // Persist results so they survive navigation
      updateJob(clusterJobId, {
        status: "done",
        progress: 100,
        resultData: { suggestions: data.suggestions, stepStatus },
        resultConsumed: false,
      });
    } catch {
      toast.error("Network error — please try again");
      updateJob(clusterJobId, { status: "failed", error: "Network error" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSuggestions = async () => {
    const toSave = suggestions.filter((_, i) => selectedSuggestions.has(i));
    if (!toSave.length) { toast.warning("No clusters selected"); return; }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/clusters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveClusters: true, clusters: toSave }),
      });

      if (!res.ok) throw new Error("Save failed");
      toast.success(`Saved ${toSave.length} topic clusters`);
      setSuggestions([]);
      setSelectedSuggestions(new Set());
      removeJob(clusterJobId);
      fetchClusters();
    } catch {
      toast.error("Failed to save clusters");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleAddManual = async () => {
    if (!newCluster.name || !newCluster.pillarKeyword) return;
    setIsAdding(true);
    try {
      const keywords = newCluster.supportingKeywords
        .split(",").map((k) => k.trim()).filter(Boolean);

      const res = await fetch(`/api/websites/${websiteId}/clusters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCluster.name,
          pillarKeyword: newCluster.pillarKeyword,
          supportingKeywords: keywords,
        }),
      });

      if (res.ok) {
        toast.success("Cluster added");
        setShowAddDialog(false);
        setNewCluster({ name: "", pillarKeyword: "", supportingKeywords: "" });
        fetchClusters();
      } else {
        toast.error("Failed to add cluster");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (clusterId: string) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/clusters?id=${clusterId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Cluster deleted");
        setClusters((prev) => prev.filter((c) => c.id !== clusterId));
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggleClusterKeyword = (clusterId: string, kw: string) => {
    setClusterKeywordSelection((prev) => {
      const current = new Set(prev[clusterId] ?? []);
      if (current.has(kw)) current.delete(kw); else current.add(kw);
      return { ...prev, [clusterId]: current };
    });
  };

  const toggleAllClusterKeywords = (cluster: TopicCluster) => {
    const allKws = [cluster.pillarKeyword, ...cluster.supportingKeywords];
    const current = clusterKeywordSelection[cluster.id];
    const allSelected = current && allKws.every((kw) => current.has(kw));
    setClusterKeywordSelection((prev) => ({
      ...prev,
      [cluster.id]: allSelected ? new Set() : new Set(allKws),
    }));
  };

  const handleAddToQueue = async (cluster: TopicCluster) => {
    const selection = clusterKeywordSelection[cluster.id];
    const toAdd = selection && selection.size > 0
      ? Array.from(selection)
      : [cluster.pillarKeyword, ...cluster.supportingKeywords];

    setAddingToQueueId(cluster.id);
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: toAdd }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${data.imported} keyword${data.imported !== 1 ? "s" : ""} to queue${data.skipped ? ` (${data.skipped} already existed)` : ""}`);
        await fetch(`/api/websites/${websiteId}/clusters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updateStatus: true, clusterId: cluster.id, status: "IN_PROGRESS" }),
        }).catch(() => {});
        setClusters((prev) =>
          prev.map((c) => (c.id === cluster.id ? { ...c, status: "IN_PROGRESS" } : c))
        );
        // Clear selection after adding
        setClusterKeywordSelection((prev) => ({ ...prev, [cluster.id]: new Set() }));
      } else {
        toast.error(data.error || "Failed to add keywords");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAddingToQueueId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── AI Suggestions inline panel (generating + results) ── */}
      {(isGenerating || suggestions.length > 0 || (stepStatus && !isGenerating)) && (
        <Card className={isGenerating ? "border-blue-200 bg-blue-50" : "border-primary/20 bg-primary/5"}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                {isGenerating
                  ? "Generating topic clusters…"
                  : suggestions.length > 0
                    ? `AI Suggestions — ${suggestions.length} clusters`
                    : "Generation complete"}
              </CardTitle>
              {!isGenerating && (
                <div className="flex items-center gap-2">
                  {suggestions.length > 0 && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"
                        onClick={() => setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))}>
                        <CheckCheck className="h-3.5 w-3.5" /> Select All
                      </Button>
                      <Button size="sm" className="h-7 text-xs"
                        disabled={isSaving || selectedSuggestions.size === 0}
                        onClick={handleSaveSuggestions}>
                        {isSaving
                          ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          : <Plus className="mr-1.5 h-3 w-3" />}
                        Save {selectedSuggestions.size} cluster{selectedSuggestions.size !== 1 ? "s" : ""}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
                    title="Dismiss"
                    onClick={() => {
                      setSuggestions([]);
                      setSelectedSuggestions(new Set());
                      setStepStatus(null);
                      removeJob(clusterJobId);
                    }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {isGenerating && (
              <>
                <Progress value={50} className="h-1 mt-2" />
                <div className="flex items-center gap-1 mt-1">
                  {clusterSteps.map((s) => {
                    const labels: Record<string, string> = { crawling: "Crawling", analyzing: "Analyzing", generating: "Generating", saving: "Saving" };
                    return (
                      <span key={s} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-800">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        {labels[s]}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </CardHeader>

          {!isGenerating && (
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              {stepStatus && <ResultStatusBanner steps={stepStatus} />}

              {suggestions.length > 0 && (
                <div className="space-y-2 mt-1">
                  {suggestions.map((s, i) => (
                    <div key={i}
                      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedSuggestions.has(i)
                          ? "bg-primary/5 border-primary/20"
                          : "border-border bg-background hover:bg-muted/30"
                      }`}
                      onClick={() => toggleSuggestion(i)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedSuggestions.has(i)}
                          onCheckedChange={() => toggleSuggestion(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm">{s.name}</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              <KeyRound className="h-2.5 w-2.5 mr-1" />
                              {s.pillarKeyword}
                            </Badge>
                          </div>
                          {s.rationale && (
                            <p className="text-xs text-muted-foreground mb-2">{s.rationale}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {s.supportingKeywords.slice(0, 6).map((kw) => (
                              <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                            ))}
                            {s.supportingKeywords.length > 6 && (
                              <Badge variant="secondary" className="text-xs">+{s.supportingKeywords.length - 6} more</Badge>
                            )}
                          </div>
                        </div>
                        <button
                          className="shrink-0 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            const remaining = suggestions.filter((_, j) => j !== i);
                            setSuggestions(remaining);
                            setSelectedSuggestions(prev => {
                              const next = new Set<number>();
                              for (const idx of prev) {
                                if (idx < i) next.add(idx);
                                else if (idx > i) next.add(idx - 1);
                              }
                              return next;
                            });
                            if (remaining.length === 0) { removeJob(clusterJobId); }
                            else { updateJob(clusterJobId, { resultData: { suggestions: remaining, stepStatus } }); }
                          }}
                          title="Remove suggestion"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Topic Clusters
          </h2>
          <p className="text-muted-foreground mt-1">
            Organize content around pillar topics to dominate search rankings
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Manual
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Topic Cluster</DialogTitle>
                <DialogDescription>Define a pillar topic and its supporting keywords</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Cluster Name</Label>
                  <Input placeholder="e.g., Invoicing & Billing"
                    value={newCluster.name}
                    onChange={(e) => setNewCluster((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Pillar Keyword</Label>
                  <Input placeholder="e.g., invoicing software"
                    value={newCluster.pillarKeyword}
                    onChange={(e) => setNewCluster((p) => ({ ...p, pillarKeyword: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Supporting Keywords</Label>
                  <Input placeholder="keyword1, keyword2, keyword3"
                    value={newCluster.supportingKeywords}
                    onChange={(e) => setNewCluster((p) => ({ ...p, supportingKeywords: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Comma-separated list</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                  <Button onClick={handleAddManual} disabled={isAdding || !newCluster.name || !newCluster.pillarKeyword}>
                    {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Cluster
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* Seed topic + generate */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="seedTopic" className="text-sm font-medium">Topic / Keyword</Label>
              <Input
                id="seedTopic"
                placeholder="e.g., email marketing, invoicing software, SEO tools…"
                value={seedTopic}
                onChange={(e) => setSeedTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isGenerating && handleAIGenerate()}
              />
              <p className="text-xs text-muted-foreground">
                Enter a topic to generate clusters around it, or leave empty to auto-detect from your niche
              </p>
            </div>
            <Button onClick={handleAIGenerate} disabled={isGenerating} className="shrink-0">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isGenerating ? "Researching…" : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="flex items-start gap-3 p-4">
          <Network className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">What are topic clusters?</p>
            <p className="text-muted-foreground mt-0.5">
              A pillar page covers a broad topic, while supporting pages cover related subtopics.
              Internal linking between them signals authority to Google.{" "}
              <span className="text-foreground font-medium">
                AI crawls your actual website
              </span>{" "}
              before generating — so results are specific to your business.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Empty state or cluster list */}
      {clusters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Network className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No topic clusters yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Enter a topic above and click Generate — AI will research and
              build a pillar + supporting keyword cluster around it.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster) => (
            <Card key={cluster.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
                      <Network className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{cluster.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-0.5">
                        <KeyRound className="h-3 w-3" />
                        Pillar:{" "}
                        <span className="font-medium text-foreground">{cluster.pillarKeyword}</span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[cluster.status] || ""}`}>
                      {cluster.status.charAt(0) + cluster.status.slice(1).toLowerCase()}
                    </Badge>
                    <Button variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(cluster.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setExpandedId(expandedId === cluster.id ? null : cluster.id)}>
                      {expandedId === cluster.id
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedId === cluster.id && (
                <CardContent className="pt-0 pb-4">
                  <div className="pl-12">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Keywords ({1 + cluster.supportingKeywords.length})
                      </p>
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => toggleAllClusterKeywords(cluster)}
                      >
                        {(() => {
                          const allKws = [cluster.pillarKeyword, ...cluster.supportingKeywords];
                          const sel = clusterKeywordSelection[cluster.id];
                          return sel && allKws.every((kw) => sel.has(kw)) ? "Deselect All" : "Select All";
                        })()}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {[cluster.pillarKeyword, ...cluster.supportingKeywords].map((kw) => {
                        const checked = clusterKeywordSelection[cluster.id]?.has(kw) ?? false;
                        return (
                          <label key={kw} className="flex items-center gap-2 cursor-pointer group">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleClusterKeyword(cluster.id, kw)}
                              className="shrink-0"
                            />
                            <span className={`text-sm ${kw === cluster.pillarKeyword ? "font-medium" : ""}`}>
                              {kw}
                              {kw === cluster.pillarKeyword && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4">pillar</Badge>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-1.5"
                      disabled={addingToQueueId === cluster.id}
                      onClick={() => handleAddToQueue(cluster)}
                    >
                      {addingToQueueId === cluster.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Plus className="h-3.5 w-3.5" />}
                      {(() => {
                        const sel = clusterKeywordSelection[cluster.id];
                        const count = sel && sel.size > 0 ? sel.size : 1 + cluster.supportingKeywords.length;
                        return `Add ${count} to Keyword Queue`;
                      })()}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {clusters.length > 0 && (
        <div className="flex justify-center">
          <p className="text-xs text-muted-foreground">
            {clusters.length} cluster{clusters.length !== 1 ? "s" : ""} ·{" "}
            {clusters.reduce((acc, c) => acc + c.supportingKeywords.length, 0)} supporting keywords total
          </p>
        </div>
      )}

    </div>
  );
}
