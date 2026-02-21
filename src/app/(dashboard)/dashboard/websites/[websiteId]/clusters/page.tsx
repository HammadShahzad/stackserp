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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
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

  const { addJob, updateJob } = useGlobalJobs();
  const clusterJobId = `cluster-gen-${websiteId}`;
  const clusterSteps = ["crawling", "analyzing", "generating", "saving"];

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

      setStepStatus(data.steps ?? null);

      if (!data.suggestions?.length) {
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        setShowReviewDialog(true);
        updateJob(clusterJobId, { status: "done", progress: 100 });
        return;
      }

      setSuggestions(data.suggestions);
      setSelectedSuggestions(new Set(data.suggestions.map((_: SuggestedCluster, i: number) => i)));
      setShowReviewDialog(true);
      updateJob(clusterJobId, { status: "done", progress: 100 });
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
      setShowReviewDialog(false);
      setSuggestions([]);
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

  const handleAddToQueue = async (cluster: TopicCluster) => {
    const allKeywords = [cluster.pillarKeyword, ...cluster.supportingKeywords];
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: allKeywords }),
      });
      if (res.ok) {
        toast.success(`Added ${allKeywords.length} keywords to queue`);
        // Update cluster status
        await fetch(`/api/websites/${websiteId}/clusters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updateStatus: true, clusterId: cluster.id, status: "IN_PROGRESS" }),
        }).catch(() => {});
        setClusters((prev) =>
          prev.map((c) => (c.id === cluster.id ? { ...c, status: "IN_PROGRESS" } : c))
        );
      } else {
        toast.error("Failed to add keywords");
      }
    } catch {
      toast.error("Something went wrong");
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
      {/* Inline progress banner — visible when AI generate is running */}
      {isGenerating && (
        <Card className="border-blue-200 bg-blue-50 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 px-4 py-3">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-blue-900">
                  Generating topic clusters…
                </p>
                <p className="text-xs text-blue-700">
                  {seedTopic.trim() ? `Topic: "${seedTopic.trim()}"` : "Based on your niche"}
                </p>
              </div>
            </div>
            <Progress value={50} className="h-1" />
            <div className="flex items-center gap-1 flex-wrap px-4 py-2 bg-white/60">
              {clusterSteps.map((stepId) => {
                const labels: Record<string, string> = { crawling: "Crawling", analyzing: "Analyzing", generating: "Generating", saving: "Saving" };
                return (
                  <span key={stepId} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {labels[stepId] || stepId}
                  </span>
                );
              })}
            </div>
          </CardContent>
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
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Supporting Keywords ({cluster.supportingKeywords.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.supportingKeywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-1.5"
                      onClick={() => handleAddToQueue(cluster)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add All to Keyword Queue
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

      {/* Review Dialog — opens after generation with status banner */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Topic Clusters
            </DialogTitle>
            <DialogDescription>
              {suggestions.length > 0
                ? `${suggestions.length} clusters generated. Deselect any you don't want, then save.`
                : "The AI couldn't generate clusters — see details below."}
            </DialogDescription>
          </DialogHeader>

          {/* Always show what happened */}
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

              <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                {suggestions.map((s, i) => (
                  <div key={i}
                    className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedSuggestions.has(i)
                        ? "bg-primary/5 border-primary/20"
                        : "border-muted hover:bg-muted/30"
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
                            <Badge variant="secondary" className="text-xs">
                              +{s.supportingKeywords.length - 6} more
                            </Badge>
                          )}
                        </div>
                      </div>
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
                disabled={isSaving || selectedSuggestions.size === 0} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save {selectedSuggestions.size} cluster{selectedSuggestions.size !== 1 ? "s" : ""}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
