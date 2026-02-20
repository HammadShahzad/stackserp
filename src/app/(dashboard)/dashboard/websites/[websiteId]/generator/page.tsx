"use client";

import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  FileText,
  Wand2,
  Sparkles,
  Image,
  Tags,
  ArrowRight,
  Zap,
  Target,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface PipelineStep {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: "research",  name: "Research",      icon: Search,    description: "Analyzing competitors & content gaps" },
  { id: "outline",   name: "Outline",       icon: Target,    description: "Structuring content & headings" },
  { id: "draft",     name: "Draft",         icon: FileText,  description: "Writing the full article" },
  { id: "tone",      name: "Tone Rewrite",  icon: Wand2,     description: "Adjusting brand voice & style" },
  { id: "seo",       name: "SEO Optimize",  icon: Sparkles,  description: "Keywords, links & structure" },
  { id: "metadata",  name: "Metadata",      icon: Tags,      description: "Meta tags, schema & captions" },
  { id: "image",     name: "Image",         icon: Image,     description: "Generating featured image" },
];

interface Keyword {
  id: string;
  keyword: string;
  status: string;
  priority: number;
}

interface JobStatus {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  currentStep: string | null;
  progress: number;
  error: string | null;
  input?: { keyword?: string } | null;
  blogPost?: { id: string; title: string; slug: string; websiteId: string } | null;
}

export default function GeneratorPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params.websiteId as string;

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [activeJobs, setActiveJobs] = useState<JobStatus[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string>("");
  const [contentLength, setContentLength] = useState("MEDIUM");
  const [includeImages, setIncludeImages] = useState(true);
  const [includeFAQ, setIncludeFAQ] = useState(true);
  const [autoPublish, setAutoPublish] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchKeywords = async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/keywords`);
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.filter((k: Keyword) => k.status === "PENDING"));
      }
    } catch {
      toast.error("Failed to load keywords");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/jobs`);
      if (!res.ok) return;
      const jobs: JobStatus[] = await res.json();
      setActiveJobs(jobs);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchKeywords();
    fetchJobs();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [websiteId]);

  // Poll while there are active jobs
  useEffect(() => {
    const hasActive = activeJobs.some(j => j.status === "QUEUED" || j.status === "PROCESSING");

    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        await fetchJobs();
      }, 3000);
    }

    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeJobs]);

  // Notify on newly completed/failed jobs
  const prevJobsRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const job of activeJobs) {
      const prev = prevJobsRef.current.get(job.id);
      if (prev && prev !== job.status) {
        if (job.status === "COMPLETED") {
          toast.success("Blog post generated successfully!");
          fetchKeywords();
        } else if (job.status === "FAILED") {
          toast.error(`Generation failed: ${job.error}`);
        }
      }
    }
    const newMap = new Map<string, string>();
    for (const job of activeJobs) {
      newMap.set(job.id, job.status);
    }
    prevJobsRef.current = newMap;
  }, [activeJobs]);

  const handleRetry = async (jobId: string) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Retry failed");
        return;
      }
      toast.success(`Retrying "${data.keyword}"...`);
      await fetchJobs();
      await fetchKeywords();
    } catch {
      toast.error("Failed to retry");
    }
  };

  const handleGenerate = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordId: selectedKeywordId || undefined,
          contentLength,
          includeImages,
          includeFAQ,
          autoPublish,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error);
        return;
      }

      toast.success(`Generating "${data.keyword}"...`);
      await fetchJobs();
    } catch {
      toast.error("Failed to start generation");
    } finally {
      setIsStarting(false);
    }
  };

  const runningJobs = activeJobs.filter(j => j.status === "QUEUED" || j.status === "PROCESSING");
  const completedJobs = activeJobs.filter(j => j.status === "COMPLETED");
  const failedJobs = activeJobs.filter(j => j.status === "FAILED");
  const hasRunning = runningJobs.length > 0;

  const nextKeyword = selectedKeywordId
    ? keywords.find((k) => k.id === selectedKeywordId)
    : keywords[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            AI Content Generator
          </h2>
          <p className="text-muted-foreground">
            Generate SEO-optimized blog posts powered by Gemini + Perplexity
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {keywords.length} keyword{keywords.length !== 1 ? "s" : ""} in queue
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">

          {/* All Active Jobs */}
          {runningJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {runningJobs.length} active job{runningJobs.length > 1 ? "s" : ""}
              </h3>
              {runningJobs.map(job => (
                <JobCard key={job.id} job={job} websiteId={websiteId} onRetry={handleRetry} />
              ))}
            </div>
          )}

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {completedJobs.length} completed
              </h3>
              {completedJobs.map(job => (
                <JobCard key={job.id} job={job} websiteId={websiteId} onRetry={handleRetry} />
              ))}
            </div>
          )}

          {/* Failed Jobs */}
          {failedJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-red-600 flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5" />
                {failedJobs.length} failed
              </h3>
              {failedJobs.map(job => (
                <JobCard key={job.id} job={job} websiteId={websiteId} onRetry={handleRetry} />
              ))}
            </div>
          )}

          {/* Queue Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Keyword Queue</CardTitle>
              <CardDescription>
                Select which keyword to generate next
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : keywords.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium mb-1">No keywords in queue</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add keywords to start generating content
                  </p>
                  <Button variant="outline" asChild>
                    <Link href={`/dashboard/websites/${websiteId}/keywords`}>
                      Add Keywords
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select keyword</Label>
                    <Select
                      value={selectedKeywordId || keywords[0]?.id}
                      onValueChange={setSelectedKeywordId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {keywords.map((kw, i) => (
                          <SelectItem key={kw.id} value={kw.id}>
                            <span className="text-muted-foreground mr-2">#{i + 1}</span>
                            {kw.keyword}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {nextKeyword && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <p className="font-medium">{nextKeyword.keyword}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Priority: {nextKeyword.priority} · Ready to generate
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleGenerate}
                    disabled={isStarting}
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Generate Blog Post
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Content Length</Label>
                <Select value={contentLength} onValueChange={setContentLength}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT">Short (800-1200 words)</SelectItem>
                    <SelectItem value="MEDIUM">Medium (1500-2500 words)</SelectItem>
                    <SelectItem value="LONG">Long (2500-4000 words)</SelectItem>
                    <SelectItem value="PILLAR">Pillar (4000-6000 words)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Include AI Image</Label>
                  <p className="text-xs text-muted-foreground">Imagen 4.0 featured image</p>
                </div>
                <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Include FAQ Section</Label>
                  <p className="text-xs text-muted-foreground">4-5 Q&A pairs</p>
                </div>
                <Switch checked={includeFAQ} onCheckedChange={setIncludeFAQ} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Publish</Label>
                  <p className="text-xs text-muted-foreground">Publish immediately on complete</p>
                </div>
                <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Models</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Research", model: "Perplexity Sonar Pro" },
                { label: "Writing", model: "Gemini 3.1 Pro" },
                { label: "Images", model: "Imagen 4.0" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.model}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Active</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button asChild variant="outline" className="w-full">
            <Link href={`/dashboard/websites/${websiteId}/keywords`}>
              Manage Keywords
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, websiteId, onRetry }: { job: JobStatus; websiteId: string; onRetry?: (jobId: string) => void }) {
  const isRunning = job.status === "QUEUED" || job.status === "PROCESSING";
  const isCompleted = job.status === "COMPLETED";
  const isFailed = job.status === "FAILED";
  const keyword = (job.input as { keyword?: string })?.keyword || "Unknown keyword";

  return (
    <Card className={
      isCompleted ? "border-green-200 bg-green-50/50" :
      isFailed ? "border-red-200 bg-red-50/50" :
      "border-primary/20 bg-primary/5"
    }>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
            {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
            {isFailed && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
            <span className="text-sm font-medium truncate">{keyword}</span>
          </div>
          <span className="text-sm font-medium tabular-nums shrink-0 ml-2">{job.progress}%</span>
        </div>

        <Progress value={job.progress} className="h-1.5" />

        <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
          {PIPELINE_STEPS.map((step) => {
            const stepIdx = PIPELINE_STEPS.findIndex(s => s.id === step.id);
            const currentIdx = PIPELINE_STEPS.findIndex(s => s.id === job.currentStep);
            const isDone = isCompleted || (currentIdx > stepIdx);
            const isCurrent = job.currentStep === step.id;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-1 text-[11px] ${
                  isDone ? "text-green-700" :
                  isCurrent ? "text-primary font-medium" :
                  "text-muted-foreground/60"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className="hidden sm:inline">{step.name}</span>
              </div>
            );
          })}
        </div>

        {isFailed && (
          <div className="flex items-center justify-between gap-2 p-2 bg-red-100 rounded">
            <p className="text-xs text-red-700 flex-1">
              {job.error || "Generation failed"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 h-7 text-xs shrink-0 text-red-700 hover:bg-red-200"
              onClick={() => onRetry?.(job.id)}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          </div>
        )}

        {isCompleted && job.blogPost && (
          <div className="flex items-center justify-between p-2 bg-green-100 rounded">
            <p className="text-xs font-medium text-green-900 truncate mr-2">
              {job.blogPost.title}
            </p>
            <Button asChild size="sm" variant="outline" className="border-green-300 h-7 text-xs shrink-0">
              <Link href={`/dashboard/websites/${websiteId}/posts/${job.blogPost.id}`}>
                Edit <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
