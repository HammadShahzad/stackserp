"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  Loader2,
  MoreVertical,
  Trash2,
  KeyRound,
  Sparkles,
  Bot,
  FileUp,
  Zap,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { AiLoading, AI_STEPS } from "@/components/ui/ai-loading";
import { useGlobalJobs } from "@/components/dashboard/global-jobs-context";

interface Keyword {
  id: string;
  keyword: string;
  status: string;
  priority: number;
  searchVolume: number | null;
  difficulty: number | null;
  intent: string | null;
  notes: string | null;
  createdAt: string;
}

interface Suggestion {
  keyword: string;
  intent: string;
  difficulty: string;
  priority: number;
  rationale: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  RESEARCHING: "bg-blue-100 text-blue-800",
  GENERATING: "bg-purple-100 text-purple-800",
  REVIEW: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  SKIPPED: "bg-gray-100 text-gray-800",
};

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-50 text-blue-700",
  commercial: "bg-purple-50 text-purple-700",
  transactional: "bg-green-50 text-green-700",
  navigational: "bg-gray-50 text-gray-700",
};

export default function KeywordsPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params.websiteId as string;
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showBulkGenDialog, setShowBulkGenDialog] = useState(false);

  // Add form
  const [newKeyword, setNewKeyword] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Bulk import
  const [bulkText, setBulkText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [isAddingSuggestions, setIsAddingSuggestions] = useState(false);
  const [suggestSeedKeyword, setSuggestSeedKeyword] = useState("");

  // Restore pending suggestions from global context when navigating back to this page
  const { addJob, updateJob, getJob, consumeResult } = useGlobalJobs();
  const suggestJobId = `kw-suggest-${websiteId}`;
  useEffect(() => {
    const job = getJob(suggestJobId);
    if (job?.status === "done" && !job.resultConsumed && job.resultData?.suggestions?.length) {
      setSuggestions(job.resultData.suggestions);
      setSelectedSuggestions(new Set(job.resultData.suggestions.map((s: Suggestion) => s.keyword)));
      consumeResult(suggestJobId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bulk generation
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkCount, setBulkCount] = useState(3);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords`);
      if (res.ok) setKeywords(await res.json());
    } catch {
      toast.error("Failed to load keywords");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId]);

  useEffect(() => { fetchKeywords(); }, [fetchKeywords]);

  // ── Add single keyword ──────────────────────────────────
  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword, notes: newNotes }),
      });
      if (res.ok) {
        toast.success("Keyword added");
        setNewKeyword(""); setNewNotes(""); setShowAddDialog(false);
        fetchKeywords();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to add keyword");
      }
    } catch { toast.error("Failed to add keyword"); }
    finally { setIsAdding(false); }
  };

  // ── Bulk text import ────────────────────────────────────
  const handleBulkImport = async (keywordList: string[]) => {
    const clean = keywordList.map(k => k.trim()).filter(Boolean);
    if (!clean.length) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: clean }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Imported ${data.imported} keywords${data.skipped ? ` (${data.skipped} skipped — already exist)` : ""}`);
        setBulkText(""); setShowBulkDialog(false);
        fetchKeywords();
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch { toast.error("Import failed"); }
    finally { setIsImporting(false); }
  };

  // ── CSV file upload ─────────────────────────────────────
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/[\r\n,]+/).map(l => l.trim()).filter(Boolean);
      // Skip header row if it's "keyword" or similar
      const keywords = lines.filter(l => !["keyword", "keywords", "term", "query"].includes(l.toLowerCase()));
      handleBulkImport(keywords);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── AI keyword suggestions ──────────────────────────────
  const suggestSteps = ["analyzing", "generating", "filtering"];

  const handleGetSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setSuggestions([]);
    setSelectedSuggestions(new Set());

    const label = suggestSeedKeyword.trim()
      ? `Keywords: "${suggestSeedKeyword.trim()}"`
      : "AI Keyword Suggestions";

    addJob({
      id: suggestJobId,
      type: "keywords",
      label,
      websiteId,
      href: `/dashboard/websites/${websiteId}/keywords`,
      status: "running",
      progress: 10,
      currentStep: "analyzing",
      steps: suggestSteps,
    });

    try {
      updateJob(suggestJobId, { progress: 30, currentStep: "generating" });
      const res = await fetch(`/api/websites/${websiteId}/keywords/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedKeyword: suggestSeedKeyword.trim() || undefined,
        }),
      });
      updateJob(suggestJobId, { progress: 80, currentStep: "filtering" });
      const data = await res.json();
      if (res.ok) {
        const fetched: Suggestion[] = data.suggestions || [];
        setSuggestions(fetched);
        setSelectedSuggestions(new Set(fetched.map((s) => s.keyword)));
        // Persist results in global context so they survive navigation
        updateJob(suggestJobId, {
          status: "done",
          progress: 100,
          resultData: { suggestions: fetched },
          resultConsumed: false,
        });
      } else {
        toast.error(data.error || "Failed to generate suggestions");
        updateJob(suggestJobId, { status: "failed", error: data.error || "Generation failed" });
      }
    } catch {
      toast.error("Failed to generate suggestions");
      updateJob(suggestJobId, { status: "failed", error: "Network error" });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAddSuggestions = async () => {
    const toAdd = suggestions.filter(s => selectedSuggestions.has(s.keyword)).map(s => s.keyword);
    if (!toAdd.length) return;
    setIsAddingSuggestions(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: toAdd }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${data.imported} keywords to queue`);
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        consumeResult(suggestJobId);
        fetchKeywords();
      }
    } catch { toast.error("Failed to add keywords"); }
    finally { setIsAddingSuggestions(false); }
  };

  // ── Bulk generation ─────────────────────────────────────
  const handleBulkGenerate = async () => {
    setIsBulkGenerating(true);
    try {
      const keywordIds = selected.size > 0 ? Array.from(selected) : undefined;
      const res = await fetch(`/api/websites/${websiteId}/generate/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordIds, count: bulkCount }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowBulkGenDialog(false);
        setSelected(new Set());
        router.push(`/dashboard/websites/${websiteId}`);
      } else {
        toast.error(data.error || "Bulk generation failed");
      }
    } catch { toast.error("Failed to start bulk generation"); }
    finally { setIsBulkGenerating(false); }
  };

  // ── Delete ──────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Keyword deleted"); fetchKeywords(); }
    } catch { toast.error("Failed to delete"); }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} keyword${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deleted ${data.deleted} keyword${data.deleted !== 1 ? "s" : ""}`);
        setSelected(new Set());
        fetchKeywords();
      } else {
        toast.error(data.error || "Bulk delete failed");
      }
    } catch { toast.error("Bulk delete failed"); }
    finally { setIsBulkDeleting(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pendingKeywords = keywords.filter(k => k.status === "PENDING");
  const statusCounts = {
    pending: keywords.filter(k => k.status === "PENDING").length,
    generating: keywords.filter(k => ["RESEARCHING","GENERATING"].includes(k.status)).length,
    completed: keywords.filter(k => k.status === "COMPLETED").length,
    failed: keywords.filter(k => k.status === "FAILED").length,
  };

  return (
    <div className="space-y-6">
      {/* ── AI Suggestions inline panel ── */}
      {(isLoadingSuggestions || suggestions.length > 0) && (
        <Card className={isLoadingSuggestions ? "border-blue-200 bg-blue-50" : "border-primary/20 bg-primary/5"}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {isLoadingSuggestions ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                {isLoadingSuggestions
                  ? "Generating keyword suggestions…"
                  : `AI Suggestions — ${suggestions.length} keywords`}
              </CardTitle>
              {!isLoadingSuggestions && suggestions.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-7"
                    onClick={() => {
                      if (selectedSuggestions.size === suggestions.length)
                        setSelectedSuggestions(new Set());
                      else
                        setSelectedSuggestions(new Set(suggestions.map(s => s.keyword)));
                    }}>
                    {selectedSuggestions.size === suggestions.length ? "Deselect All" : "Select All"}
                  </Button>
                  <Button size="sm" className="h-7 text-xs"
                    disabled={isAddingSuggestions || selectedSuggestions.size === 0}
                    onClick={handleAddSuggestions}>
                    {isAddingSuggestions
                      ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      : <Plus className="mr-1.5 h-3 w-3" />}
                    Add {selectedSuggestions.size} to Queue
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
                    title="Dismiss suggestions"
                    onClick={() => { setSuggestions([]); setSelectedSuggestions(new Set()); consumeResult(suggestJobId); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {isLoadingSuggestions && (
              <>
                <Progress value={50} className="h-1 mt-2" />
                <div className="flex items-center gap-1 mt-1">
                  {suggestSteps.map((s) => {
                    const labels: Record<string, string> = { analyzing: "Analyzing", generating: "Generating", filtering: "Filtering" };
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

          {!isLoadingSuggestions && suggestions.length > 0 && (
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <div
                    key={s.keyword}
                    onClick={() => setSelectedSuggestions(prev => {
                      const next = new Set(prev);
                      next.has(s.keyword) ? next.delete(s.keyword) : next.add(s.keyword);
                      return next;
                    })}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedSuggestions.has(s.keyword)
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox checked={selectedSuggestions.has(s.keyword)} className="mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm">{s.keyword}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${INTENT_COLORS[s.intent] || "bg-gray-50 text-gray-700"}`}>
                          {s.intent}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          s.difficulty === "low" ? "bg-green-50 text-green-700" :
                          s.difficulty === "medium" ? "bg-yellow-50 text-yellow-700" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {s.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.rationale}</p>
                    </div>
                    <button
                      className="shrink-0 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        const remaining = suggestions.filter(x => x.keyword !== s.keyword);
                        setSuggestions(remaining);
                        setSelectedSuggestions(prev => { const n = new Set(prev); n.delete(s.keyword); return n; });
                        updateJob(suggestJobId, { resultData: { suggestions: remaining } });
                      }}
                      title="Remove suggestion"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Keywords</h2>
          <p className="text-muted-foreground">Manage your content generation queue</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* CSV upload (hidden input) */}
          <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVUpload} />

          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" />
            Import CSV
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowBulkDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Paste Keywords
          </Button>

          <div className="flex items-center gap-1.5">
            <Input
              placeholder="Topic (optional)…"
              value={suggestSeedKeyword}
              onChange={(e) => setSuggestSeedKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoadingSuggestions && handleGetSuggestions()}
              className="h-8 w-40 text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleGetSuggestions} disabled={isLoadingSuggestions}>
              {isLoadingSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              AI Suggest
            </Button>
          </div>

          {pendingKeywords.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowBulkGenDialog(true)}
              className="border-primary text-primary hover:bg-primary/5">
              <Bot className="mr-2 h-4 w-4" />
              Bulk Generate
            </Button>
          )}

          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Keyword
          </Button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Pending", value: statusCounts.pending, color: "text-yellow-600" },
          { label: "Generating", value: statusCounts.generating, color: "text-blue-600" },
          { label: "Completed", value: statusCounts.completed, color: "text-green-600" },
          { label: "Failed", value: statusCounts.failed, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm font-medium">{selected.size} keyword{selected.size !== 1 ? "s" : ""} selected</p>
          <div className="flex gap-2">
            {keywords.filter(k => selected.has(k.id) && k.status === "PENDING").length > 0 && (
              <Button size="sm" onClick={() => setShowBulkGenDialog(true)}>
                <Bot className="mr-2 h-3.5 w-3.5" />
                Generate ({keywords.filter(k => selected.has(k.id) && k.status === "PENDING").length})
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
              Delete ({selected.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Keywords table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : keywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-2">No keywords yet</h3>
              <p className="text-muted-foreground max-w-sm mb-4 text-sm">
                Add keywords manually, import a CSV, or let AI suggest the best keywords for your niche.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGetSuggestions}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Suggest Keywords
                </Button>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manually
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === keywords.length && keywords.length > 0}
                      onCheckedChange={(v) => {
                        if (v) setSelected(new Set(keywords.map(k => k.id)));
                        else setSelected(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((kw) => (
                  <TableRow key={kw.id} className={selected.has(kw.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(kw.id)}
                        onCheckedChange={() => toggleSelect(kw.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[kw.status] || "bg-gray-100 text-gray-800"}`}>
                        {kw.status.toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {kw.intent ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${INTENT_COLORS[kw.intent] || "bg-gray-50 text-gray-700"}`}>
                          {kw.intent}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{kw.priority}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                        {kw.notes || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {kw.status === "PENDING" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/websites/${websiteId}/generator`}>
                                <Zap className="mr-2 h-4 w-4" />
                                Generate Now
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(kw.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Add Keyword Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Keyword</DialogTitle>
            <DialogDescription>Add a target keyword to the generation queue</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="e.g., how to create an invoice" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} />
            <Textarea placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={isAdding || !newKeyword.trim()}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Keyword
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk paste Dialog ── */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste Keywords</DialogTitle>
            <DialogDescription>One keyword per line. Duplicates will be skipped.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={"how to create an invoice\nbest invoicing software\ninvoice template free\n..."}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={10}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button
              onClick={() => handleBulkImport(bulkText.split("\n"))}
              disabled={isImporting || !bulkText.trim()}
            >
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {bulkText.split("\n").filter(Boolean).length} Keywords
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── Bulk Generate Dialog ── */}
      <Dialog open={showBulkGenDialog} onOpenChange={setShowBulkGenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Bulk Generate Posts
            </DialogTitle>
            <DialogDescription>
              {selected.size > 0
                ? `Generate posts for ${selected.size} selected keyword${selected.size !== 1 ? "s" : ""}`
                : `Generate posts from the top pending keywords`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selected.size === 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">How many posts to generate?</p>
                <div className="flex gap-2">
                  {[1, 3, 5, 10].map(n => (
                    <Button
                      key={n}
                      variant={bulkCount === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBulkCount(n)}
                      disabled={n > pendingKeywords.length}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingKeywords.length} pending keywords available
                </p>
              </div>
            )}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <p className="font-medium">This will use {selected.size > 0 ? selected.size : bulkCount} post credits from your monthly limit.</p>
              <p className="text-xs mt-0.5">Posts will be saved as drafts unless auto-publish is enabled.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkGenDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkGenerate} disabled={isBulkGenerating}>
              {isBulkGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" />Start Generating</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
