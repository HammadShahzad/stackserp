"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, CheckCircle2, XCircle, Search, FileText, Wand2,
  Sparkles, Image, Tags, Target, ArrowRight, ChevronDown, ChevronUp,
  RefreshCw, Square,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useGlobalJobs } from "./global-jobs-context";

interface Job {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStep: string | null;
  progress: number;
  error: string | null;
  keywordId: string | null;
  input: { keyword?: string } | null;
  createdAt: string;
  blogPostId: string | null;
  isStuck?: boolean;
}

const STEP_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  research: { label: "Research", icon: Search },
  outline:  { label: "Outline",  icon: Target },
  draft:    { label: "Draft",    icon: FileText },
  tone:     { label: "Tone Rewrite", icon: Wand2 },
  seo:      { label: "SEO Optimize", icon: Sparkles },
  metadata: { label: "Metadata", icon: Tags },
  image:    { label: "Image",    icon: Image },
};

const STEP_ORDER = ["research", "outline", "draft", "tone", "seo", "metadata", "image"];

interface Props {
  websiteId: string;
  initialJobCount: number;
}

export function ActiveJobsBanner({ websiteId, initialJobCount }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [hasJobs, setHasJobs] = useState(initialJobCount > 0);
  const { addJob, updateJob, removeJob } = useGlobalJobs();

  const syncToGlobal = useCallback(
    (data: Job[]) => {
      const active = data.filter(
        (j) => j.status === "PROCESSING" || j.status === "QUEUED"
      );
      for (const j of active) {
        const jobId = `content-${j.id}`;
        addJob({
          id: jobId,
          type: "content",
          label: j.input?.keyword || "Content generation",
          websiteId,
          href: `/dashboard/websites/${websiteId}/generator`,
          status: "running",
          progress: j.progress,
          currentStep: j.currentStep || undefined,
          steps: STEP_ORDER,
        });
      }
      const finished = data.filter(
        (j) => j.status === "COMPLETED" || j.status === "FAILED"
      );
      for (const j of finished) {
        const jobId = `content-${j.id}`;
        updateJob(jobId, {
          status: j.status === "COMPLETED" ? "done" : "failed",
          progress: j.status === "COMPLETED" ? 100 : j.progress,
          error: j.error || undefined,
        });
      }
    },
    [websiteId, addJob, updateJob]
  );

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/jobs`);
      if (!res.ok) return;
      const data: Job[] = await res.json();
      setJobs(data);
      setHasJobs(data.length > 0);
      syncToGlobal(data);
      if (data.length === 0 && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      // silent
    }
  }, [websiteId, syncToGlobal]);

  useEffect(() => {
    if (!hasJobs) return;
    fetchJobs();
    pollRef.current = setInterval(fetchJobs, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchJobs, hasJobs]);

  const handleRetry = async (jobId: string) => {
    setRetrying(prev => new Set(prev).add(jobId));
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "POST" });
      if (res.ok) {
        toast.success("Job restarted!");
        // Restart polling
        setHasJobs(true);
        fetchJobs();
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchJobs, 3000);
        }
      } else {
        toast.error("Failed to restart job");
      }
    } catch {
      toast.error("Failed to restart job");
    } finally {
      setRetrying(prev => { const s = new Set(prev); s.delete(jobId); return s; });
    }
  };

  const handleCancel = async (jobId: string) => {
    setCancelling(prev => new Set(prev).add(jobId));
    try {
      const res = await fetch(`/api/websites/${websiteId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", jobId }),
      });
      if (res.ok) {
        toast.success("Job cancelled");
        removeJob(`content-${jobId}`);
        fetchJobs();
      } else {
        toast.error("Failed to cancel job");
      }
    } catch {
      toast.error("Failed to cancel job");
    } finally {
      setCancelling(prev => { const s = new Set(prev); s.delete(jobId); return s; });
    }
  };

  if (!hasJobs && jobs.length === 0) return null;

  const activeJobs = jobs.filter(j =>
    j.status === "QUEUED" || j.status === "PROCESSING" || j.status === "FAILED"
  );
  if (activeJobs.length === 0) return null;

  const processingCount = activeJobs.filter(j => j.status === "PROCESSING" || j.status === "QUEUED").length;
  const failedCount = activeJobs.filter(j => j.status === "FAILED").length;

  return (
    <Card className={`overflow-hidden ${failedCount > 0 && processingCount === 0 ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {processingCount > 0 ? (
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
            <div>
              <p className={`font-medium text-sm ${processingCount > 0 ? "text-blue-900" : "text-red-900"}`}>
                {processingCount > 0 ? "Content generation in progress" : "Generation failed"}
              </p>
              <p className={`text-xs ${processingCount > 0 ? "text-blue-700" : "text-red-700"}`}>
                {processingCount > 0 && `${processingCount} active job${processingCount !== 1 ? "s" : ""}`}
                {processingCount > 0 && failedCount > 0 && " · "}
                {failedCount > 0 && `${failedCount} failed`}
                {activeJobs[0]?.input?.keyword && ` · "${activeJobs[0].input.keyword}"`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline"
              className={`text-xs ${processingCount > 0 ? "border-blue-300 text-blue-800 hover:bg-blue-100" : "border-red-300 text-red-800 hover:bg-red-100"}`}>
              <Link href={`/dashboard/websites/${websiteId}/generator`}>
                View Details <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
            <button onClick={() => setIsExpanded(v => !v)}
              className={`p-1 rounded ${processingCount > 0 ? "hover:bg-blue-100 text-blue-700" : "hover:bg-red-100 text-red-700"}`}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Job details */}
        {isExpanded && activeJobs.map((job) => {
          const keyword = job.input?.keyword || "Generating…";
          const currentStepIdx = STEP_ORDER.indexOf(job.currentStep || "");
          const isFailed = job.status === "FAILED";

          return (
            <div key={job.id} className={`border-t px-4 py-3 bg-white/60 ${isFailed ? "border-red-200" : "border-blue-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">{keyword}</span>
                <div className="flex items-center gap-2">
                  {isFailed ? (
                    <Button size="sm" variant="outline"
                      className="h-6 text-[11px] px-2 border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => handleRetry(job.id)}
                      disabled={retrying.has(job.id)}
                    >
                      {retrying.has(job.id)
                        ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        : <RefreshCw className="h-3 w-3 mr-1" />}
                      Retry
                    </Button>
                  ) : (
                    <>
                      <span className="text-xs text-blue-700 font-medium">{job.progress}%</span>
                      <Button size="sm" variant="outline"
                        className="h-6 text-[11px] px-2 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => handleCancel(job.id)}
                        disabled={cancelling.has(job.id)}
                      >
                        {cancelling.has(job.id)
                          ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          : <Square className="h-3 w-3 mr-1" />}
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {!isFailed && <Progress value={job.progress} className="h-1.5 mb-3" />}

              {/* Step pipeline */}
              <div className="flex items-center gap-1 flex-wrap">
                {STEP_ORDER.map((stepId, idx) => {
                  const config = STEP_CONFIG[stepId];
                  const Icon = config.icon;
                  const isDone = job.status === "COMPLETED" || idx < currentStepIdx;
                  const isCurrent = job.currentStep === stepId && !isFailed;
                  const isPending = !isDone && !isCurrent;

                  return (
                    <div key={stepId}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                        isDone ? "bg-green-100 text-green-700" :
                        isCurrent ? "bg-blue-100 text-blue-800 font-medium ring-1 ring-blue-300" :
                        isFailed && idx === currentStepIdx ? "bg-red-100 text-red-700 ring-1 ring-red-300" :
                        isPending ? "bg-muted/60 text-muted-foreground" : "bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                      ) : isFailed && idx === currentStepIdx ? (
                        <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                      ) : isCurrent ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                      ) : (
                        <Icon className="h-3 w-3 shrink-0 opacity-40" />
                      )}
                      <span>{config.label}</span>
                    </div>
                  );
                })}
              </div>

              {job.error && (
                <p className="text-xs text-red-700 mt-2 p-2 bg-red-50 rounded border border-red-100">
                  {job.error}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
