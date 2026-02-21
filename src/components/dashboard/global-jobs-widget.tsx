"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Network,
  KeyRound,
  Link2,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGlobalJobs, type GlobalJob } from "./global-jobs-context";

const TYPE_CONFIG: Record<
  GlobalJob["type"],
  { label: string; icon: React.ElementType }
> = {
  content: { label: "Content", icon: FileText },
  keywords: { label: "Keywords", icon: KeyRound },
  clusters: { label: "Clusters", icon: Network },
  links: { label: "Links", icon: Link2 },
};

const STEP_LABELS: Record<string, string> = {
  research: "Research",
  outline: "Outline",
  draft: "Draft",
  tone: "Tone Rewrite",
  seo: "SEO Optimize",
  metadata: "Metadata",
  image: "Image",
  crawling: "Crawling",
  analyzing: "Analyzing",
  generating: "Generating",
  saving: "Saving",
  filtering: "Filtering",
};

export function GlobalJobsWidget() {
  const { jobs, removeJob } = useGlobalJobs();
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);

  const activeJobs = jobs.filter(
    (j) =>
      !dismissed.has(j.id) &&
      (j.status === "running" || j.status === "done" || j.status === "failed")
  );

  const runningJobs = activeJobs.filter((j) => j.status === "running");
  const doneOrFailed = activeJobs.filter(
    (j) => j.status === "done" || j.status === "failed"
  );

  useEffect(() => {
    if (activeJobs.length > 0) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [activeJobs.length]);

  if (!visible && activeJobs.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    setTimeout(() => removeJob(id), 300);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-80 shadow-2xl rounded-xl border bg-background overflow-hidden transition-all duration-300 ${
        activeJobs.length > 0
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 bg-muted/50 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {runningJobs.length > 0 && (
            <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin shrink-0" />
          )}
          <span className="text-sm font-medium">
            {runningJobs.length > 0
              ? `${runningJobs.length} process${runningJobs.length !== 1 ? "es" : ""} running`
              : `${doneOrFailed.length} completed`}
          </span>
        </div>
        <button className="p-0.5 rounded hover:bg-muted">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Job list */}
      {expanded && (
        <div className="max-h-72 overflow-y-auto divide-y">
          {activeJobs.map((job) => {
            const cfg = TYPE_CONFIG[job.type];
            const isRunning = job.status === "running";
            const isDone = job.status === "done";
            const isFailed = job.status === "failed";

            return (
              <div
                key={job.id}
                className="px-3 py-2.5 space-y-1.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      isRunning
                        ? "bg-blue-100 text-blue-700"
                        : isDone
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isRunning ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <XCircle className="h-2.5 w-2.5" />
                    )}
                    {cfg.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate block">
                      {job.label}
                    </span>
                    {isDone && !job.resultConsumed && job.resultData && (
                      <span className="text-[10px] text-blue-600 font-medium">
                        Tap → to view results
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      asChild
                      size="sm"
                      variant={isDone && !job.resultConsumed && job.resultData ? "default" : "ghost"}
                      className={`h-5 px-1.5 text-[10px] ${isDone && !job.resultConsumed && job.resultData ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                    >
                      <Link href={job.href}>
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    </Button>
                    {!isRunning && (
                      <button
                        onClick={() => handleDismiss(job.id)}
                        className="p-0.5 rounded hover:bg-muted"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {isRunning && (
                  <Progress value={job.progress} className="h-1" />
                )}

                {job.steps && job.steps.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {job.steps.map((stepId) => {
                      const stepLabel = STEP_LABELS[stepId] || stepId;
                      const stepIdx = job.steps!.indexOf(stepId);
                      const currentIdx = job.steps!.indexOf(
                        job.currentStep || ""
                      );
                      const stepDone =
                        isDone || (currentIdx >= 0 && stepIdx < currentIdx);
                      const stepCurrent =
                        isRunning && job.currentStep === stepId;

                      return (
                        <span
                          key={stepId}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                            stepDone
                              ? "bg-green-100 text-green-700"
                              : stepCurrent
                                ? "bg-blue-100 text-blue-800 font-medium ring-1 ring-blue-300"
                                : "bg-muted/60 text-muted-foreground"
                          }`}
                        >
                          {stepDone ? (
                            <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
                          ) : stepCurrent ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : null}
                          {stepLabel}
                        </span>
                      );
                    })}
                  </div>
                )}

                {isFailed && job.error && (
                  <p className="text-[10px] text-red-600 truncate">
                    {job.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
