"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  FileText,
  BarChart3,
  Tags,
  Plug,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Wand2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  CalendarClock,
  X,
  Globe,
  Download,
} from "lucide-react";
// Lucide's Image component conflicts with Next.js <img>; alias to avoid naming clash
import { Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { SEOScore } from "@/components/editor/seo-score";

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  featuredImage: string | null;
  featuredImageAlt: string | null;
  tags: string[];
  category: string | null;
  status: string;
  scheduledAt: string | null;
  wordCount: number | null;
  readingTime: number | null;
  socialCaptions: { twitter?: string; linkedin?: string } | null;
  externalUrl: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className?: string }> = {
  DRAFT:     { label: "Draft",     variant: "secondary" },
  REVIEW:    { label: "Review",    variant: "outline" },
  SCHEDULED: { label: "Scheduled", variant: "outline", className: "border-blue-400 text-blue-700 bg-blue-50" },
  PUBLISHED: { label: "Published", variant: "default" },
  ARCHIVED:  { label: "Archived",  variant: "secondary" },
};

export default function PostEditorPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params.websiteId as string;
  const postId = params.postId as string;
  const isNew = postId === "new";

  const [post, setPost] = useState<Partial<Post>>({
    title: "", slug: "", content: "", excerpt: "",
    metaTitle: "", metaDescription: "", focusKeyword: "",
    secondaryKeywords: [], tags: [], category: "", status: "DRAFT",
  });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPushingToCMS, setIsPushingToCMS] = useState(false);
  const [cmsResult, setCmsResult] = useState<{
    type: "wp" | "shopify" | null;
    viewUrl?: string;
    editUrl?: string;
  } | null>(null);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isFixingSEO, setIsFixingSEO] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiAction, setAiAction] = useState<"rewrite" | "expand" | "shorten" | "improve" | "custom">("improve");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [imagePromptInput, setImagePromptInput] = useState("");
  const [imageCacheBust, setImageCacheBust] = useState<number>(Date.now());
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [autoSlug, setAutoSlug] = useState(isNew);

  const [integrations, setIntegrations] = useState<{
    wp: boolean;
    shopify: boolean;
    ghost: boolean;
    webhook: boolean;
    hostingMode: string;
    brandUrl: string;
    customDomain: string | null;
    subdomain: string | null;
  }>({ wp: false, shopify: false, ghost: false, webhook: false, hostingMode: "HOSTED", brandUrl: "", customDomain: null, subdomain: null });

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/websites/${websiteId}/posts/${postId}`)
        .then((r) => r.json())
        .then((data) => { setPost(data); setAutoSlug(false); })
        .catch(() => toast.error("Failed to load post"))
        .finally(() => setIsLoading(false));
    }
  }, [websiteId, postId, isNew]);

  useEffect(() => {
    fetch(`/api/websites/${websiteId}`)
      .then((r) => r.json())
      .then((data) => {
        setIntegrations({
          wp: Boolean(data.cmsApiUrl && data.cmsApiKey),
          shopify: Boolean(data.shopifyConfig),
          ghost: Boolean(data.ghostConfig),
          webhook: Boolean(data.webhookUrl),
          hostingMode: data.hostingMode || "HOSTED",
          brandUrl: data.brandUrl || "",
          customDomain: data.customDomain || null,
          subdomain: data.subdomain || null,
        });
      })
      .catch(() => {});
  }, [websiteId]);

  const updateField = (field: string, value: unknown) => {
    setPost((p) => ({ ...p, [field]: value }));
    if (field === "title" && autoSlug) {
      const slug = (value as string)
        .toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "").slice(0, 80);
      setPost((p) => ({ ...p, title: value as string, slug }));
    }
  };

  const wordCount = post.content ? post.content.split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  const liveUrl = (() => {
    if (post.externalUrl) return post.externalUrl;
    if (!post.slug || post.status !== "PUBLISHED") return null;
    if (integrations.customDomain) return `https://${integrations.customDomain}/${post.slug}`;
    if (integrations.subdomain) return `https://${integrations.subdomain}.stackserp.com/${post.slug}`;
    if (integrations.brandUrl) return `${integrations.brandUrl.replace(/\/$/, "")}/blog/${post.slug}`;
    return null;
  })();

  // ─── Single core save function — all saves go through here ───────────────
  const savePost = async (statusOverride?: string): Promise<{ ok: boolean; saved?: Post }> => {
    if (!post.title?.trim() || !post.content?.trim()) {
      toast.error("Title and content are required");
      return { ok: false };
    }
    const payload = { ...post, wordCount, readingTime };
    if (statusOverride) payload.status = statusOverride;

    const url = isNew
      ? `/api/websites/${websiteId}/posts`
      : `/api/websites/${websiteId}/posts/${postId}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to save");
      return { ok: false };
    }
    return { ok: true, saved: await res.json() };
  };

  // Run SEO auto-fix in background after any save (non-blocking)
  const runSEOFix = (savedPostId: string) => {
    setIsFixingSEO(true);
    const contentAtSave = post.content;
    fetch(`/api/websites/${websiteId}/posts/${savedPostId}/seo-fix`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.content && data.content !== contentAtSave) {
          updateField("content", data.content);
          const fixed = data.issuesFixed ?? {};
          const msgs: string[] = [];
          if (fixed.longParagraphs > 0) msgs.push(`${fixed.longParagraphs} paragraph(s) split`);
          if (fixed.addedH3s) msgs.push("H3s added");
          if (fixed.expandedWords) msgs.push("content expanded");
          if (fixed.addedLinks) msgs.push("links added");
          if (fixed.tocRegenerated) msgs.push("TOC updated");
          if (msgs.length) toast.success(`Auto-optimized: ${msgs.join(", ")}`);
        }
      })
      .catch(() => {})
      .finally(() => setIsFixingSEO(false));
  };

  const handleSave = async (statusOverride?: string) => {
    setIsSaving(true);
    try {
      const { ok, saved } = await savePost(statusOverride);
      if (!ok || !saved) return;
      const msg = statusOverride === "PUBLISHED" ? "Post published!" :
        statusOverride === "DRAFT" ? "Moved to Draft" :
        statusOverride === "REVIEW" ? "Marked as ready for review" : "Post saved";
      toast.success(msg);
      if (isNew) {
        router.replace(`/dashboard/websites/${websiteId}/posts/${saved.id}`);
      } else {
        setPost((p) => ({ ...p, status: saved.status }));
        runSEOFix(saved.id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const { ok, saved } = await savePost("PUBLISHED");
      if (!ok || !saved) return;
      toast.success("Post published!");
      setPost((p) => ({ ...p, status: "PUBLISHED" }));
      if (isNew) {
        router.replace(`/dashboard/websites/${websiteId}/posts/${saved.id}`);
      } else {
        runSEOFix(saved.id);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) { toast.error("Please pick a date and time"); return; }
    const scheduledAt = new Date(scheduleDate);
    if (scheduledAt <= new Date()) { toast.error("Scheduled time must be in the future"); return; }
    if (!post.title?.trim() || !post.content?.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setIsScheduling(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...post, wordCount, readingTime,
          status: "SCHEDULED",
          scheduledAt: scheduledAt.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule");
      const saved = await res.json();
      setPost((p) => ({ ...p, status: saved.status, scheduledAt: saved.scheduledAt }));
      setShowScheduler(false);
      toast.success(`Scheduled for ${scheduledAt.toLocaleString()}`);
    } catch {
      toast.error("Failed to schedule post");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleUnschedule = async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT", scheduledAt: null }),
      });
      if (res.ok) {
        setPost((p) => ({ ...p, status: "DRAFT", scheduledAt: null }));
        setShowScheduler(false);
        toast.success("Schedule removed — post is now a Draft");
      }
    } catch { toast.error("Failed to unschedule"); }
  };

  const handlePushToWordPress = async (status: "draft" | "publish") => {
    if (isNew) { toast.error("Save the post first"); return; }
    setIsPushingToCMS(true);
    setCmsResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/wordpress/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, status }),
      });
      const data = await res.json();
      if (res.ok) {
        setCmsResult({ type: "wp", viewUrl: data.wpPostUrl, editUrl: data.wpEditUrl });
        if (data.wpPostUrl) setPost((p) => ({ ...p, externalUrl: data.wpPostUrl }));
        toast.success(`Pushed to WordPress as ${status}!`);
      } else {
        toast.error(data.error || "Failed to push to WordPress");
      }
    } catch { toast.error("Failed to push to WordPress"); }
    finally { setIsPushingToCMS(false); }
  };

  const handlePushToShopify = async (status: "draft" | "published") => {
    if (isNew) { toast.error("Save the post first"); return; }
    setIsPushingToCMS(true);
    setCmsResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/shopify/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, status }),
      });
      const data = await res.json();
      if (res.ok) {
        setCmsResult({ type: "shopify", viewUrl: data.articleUrl, editUrl: data.adminUrl });
        if (data.articleUrl) setPost((p) => ({ ...p, externalUrl: data.articleUrl }));
        toast.success(`Pushed to Shopify as ${status}!`);
      } else {
        toast.error(data.error || "Failed to push to Shopify");
      }
    } catch { toast.error("Failed to push to Shopify"); }
    finally { setIsPushingToCMS(false); }
  };

  const handleAIRewrite = async () => {
    if (!aiText.trim()) { toast.error("Paste the text you want to rewrite"); return; }
    setIsRewriting(true);
    setAiResult("");
    try {
      const res = await fetch(`/api/websites/${websiteId}/ai-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText, action: aiAction, customPrompt: aiCustomPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rewrite failed");
      setAiResult(data.result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleAutoFixSEO = async () => {
    if (isNew) { toast.error("Save the post first"); return; }
    setIsFixingSEO(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/posts/${postId}/seo-fix`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        updateField("content", data.content);
        const fixed = data.issuesFixed;
        const messages = [];
        if (fixed.longParagraphs > 0) messages.push(`${fixed.longParagraphs} long paragraph(s) split`);
        if (fixed.addedH3s) messages.push("H3 subheadings added");
        if (fixed.expandedWords) messages.push("content expanded to 1500+ words");
        if (fixed.addedLinks) messages.push("internal links added");
        if (fixed.tocRegenerated) messages.push("table of contents updated");
        toast.success(`Fixed: ${messages.join(", ") || "content polished"}`);
      } else {
        toast.error(data.error || "Auto-fix failed");
      }
    } catch { toast.error("Auto-fix failed"); }
    finally { setIsFixingSEO(false); }
  };

  const handleRegenerateImage = async (customPrompt?: string) => {
    if (isNew) { toast.error("Save the post first"); return; }
    setIsRegeneratingImage(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/posts/${postId}/regenerate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customPrompt ? { prompt: customPrompt } : {}),
      });
      const data = await res.json();
      if (res.ok) {
        updateField("featuredImage", data.imageUrl);
        setImageCacheBust(Date.now());
        toast.success("New image generated!");
        setImagePromptInput("");
      } else {
        toast.error(data.error || "Failed to generate image");
      }
    } catch { toast.error("Image generation failed"); }
    finally { setIsRegeneratingImage(false); }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      updateField("tags", [...(post.tags || []), tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => updateField("tags", (post.tags || []).filter((t) => t !== tag));

  const prefillScheduleDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    setScheduleDate(
      `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`
    );
  };

  const handleDownloadPDF = async () => {
    if (!post.content?.trim()) { toast.error("No content to export"); return; }
    setIsDownloadingPDF(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const container = document.createElement("div");
      container.style.cssText = "padding:40px 50px;max-width:800px;margin:0 auto;font-family:Georgia,serif;color:#1a1a1a;line-height:1.7;font-size:14px";

      // Convert markdown to HTML using a simple render via the markdown editor's preview
      const { Marked } = await import("marked");
      const md = new Marked({ gfm: true, breaks: false });
      const htmlContent = md.parse(post.content) as string;

      container.innerHTML = `
        <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e5e5e5">
          <h1 style="font-size:28px;margin:0 0 12px;line-height:1.3;color:#111">${post.title || "Untitled"}</h1>
          ${post.focusKeyword ? `<p style="font-size:12px;color:#666;margin:0">Focus keyword: ${post.focusKeyword}</p>` : ""}
          ${post.wordCount ? `<p style="font-size:12px;color:#666;margin:4px 0 0">Word count: ${post.wordCount} &middot; ${post.readingTime || Math.ceil(post.wordCount / 200)} min read</p>` : ""}
        </div>
        <style>
          h2 { font-size:22px; margin:28px 0 12px; color:#111; border-bottom:1px solid #eee; padding-bottom:8px; }
          h3 { font-size:18px; margin:20px 0 8px; color:#222; }
          p { margin:0 0 12px; }
          ul, ol { margin:0 0 12px; padding-left:24px; }
          li { margin-bottom:4px; }
          table { width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; }
          th { background:#f5f5f5; font-weight:600; text-align:left; padding:8px 12px; border:1px solid #ddd; }
          td { padding:8px 12px; border:1px solid #ddd; }
          blockquote { margin:16px 0; padding:12px 20px; border-left:4px solid #ddd; color:#555; background:#fafafa; }
          code { background:#f3f3f3; padding:2px 6px; border-radius:3px; font-size:13px; }
          a { color:#2563eb; text-decoration:underline; }
          img { max-width:100%; height:auto; margin:12px 0; border-radius:8px; }
        </style>
        ${htmlContent}
      `;

      document.body.appendChild(container);

      const slug = post.slug || post.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "blog-post";

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `${slug}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(container)
        .save();

      document.body.removeChild(container);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const hasCMSIntegration = integrations.wp || integrations.shopify;

  const statusCfg = STATUS_CONFIG[post.status || "DRAFT"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: back + title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/dashboard/websites/${websiteId}/posts`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{isNew ? "New Post" : (post.title || "Edit Post")}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge
                variant={statusCfg.variant}
                className={statusCfg.className}
              >
                {post.status === "SCHEDULED" && <CalendarClock className="mr-1 h-3 w-3" />}
                {statusCfg.label}
              </Badge>
              {post.status === "SCHEDULED" && post.scheduledAt && (
                <span className="text-xs text-blue-600 font-medium">
                  {new Date(post.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {wordCount.toLocaleString()} words · {readingTime} min read
              </span>
              {isFixingSEO && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Optimizing…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Save */}
          <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={isSaving || isPublishing}>
            {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>

          {/* View Live — only when published & URL known */}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
                <Globe className="mr-1.5 h-3.5 w-3.5" />
                View Live
              </Button>
            </a>
          )}

          {/* ── Publish-state actions ── */}
          {post.status === "SCHEDULED" ? (
            <>
              <Button size="sm" onClick={handlePublish} disabled={isPublishing || isSaving}
                className="bg-green-600 hover:bg-green-700 text-white">
                {isPublishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                Publish Now
              </Button>
              <Button size="sm" variant="outline" onClick={handleUnschedule}
                className="border-blue-400 text-blue-700 hover:bg-blue-50">
                <X className="mr-1 h-3.5 w-3.5" />
                Unschedule
              </Button>
            </>
          ) : post.status === "PUBLISHED" ? (
            <Button size="sm" variant="outline" onClick={() => handleSave("DRAFT")} disabled={isSaving}
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-50">
              Unpublish
            </Button>
          ) : (
            <>
              {/* Mark Review — only for DRAFT (not REVIEW, not SCHEDULED) */}
              {post.status === "DRAFT" && !isNew && (
                <Button size="sm" variant="secondary" onClick={() => handleSave("REVIEW")} disabled={isSaving}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Mark Review
                </Button>
              )}
              {/* Schedule — only for saved posts */}
              {!isNew && (
                <Button size="sm" variant="outline" onClick={() => { prefillScheduleDate(); setShowScheduler((v) => !v); }}
                  className="border-blue-400 text-blue-700 hover:bg-blue-50">
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                  Schedule
                </Button>
              )}
              <Button size="sm" onClick={handlePublish} disabled={isPublishing || isSaving}
                className="bg-green-600 hover:bg-green-700 text-white">
                {isPublishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                Publish
              </Button>
            </>
          )}

          {/* ── Push to CMS dropdown — only if connected ── */}
          {!isNew && hasCMSIntegration && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isPushingToCMS}>
                  {isPushingToCMS ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plug className="mr-1.5 h-3.5 w-3.5" />}
                  Push to CMS
                  <ChevronDown className="ml-1.5 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {integrations.wp && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">WordPress</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handlePushToWordPress("draft")} className="text-sm cursor-pointer">
                      <Plug className="mr-2 h-3.5 w-3.5 text-[#21759b]" />
                      Push as Draft
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePushToWordPress("publish")} className="text-sm cursor-pointer">
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-[#21759b]" />
                      Publish to WordPress
                    </DropdownMenuItem>
                  </>
                )}
                {integrations.wp && integrations.shopify && <DropdownMenuSeparator />}
                {integrations.shopify && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Shopify</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handlePushToShopify("draft")} className="text-sm cursor-pointer">
                      <Plug className="mr-2 h-3.5 w-3.5 text-[#5c8a1e]" />
                      Push as Draft
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePushToShopify("published")} className="text-sm cursor-pointer">
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-[#5c8a1e]" />
                      Publish to Shopify
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* ── Download PDF ── */}
          {!isNew && (
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloadingPDF || !post.content?.trim()}>
              {isDownloadingPDF ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* ── Scheduler Panel ───────────────────────────────────────────────── */}
      {showScheduler && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm flex-wrap">
          <CalendarClock className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="font-medium text-blue-800 shrink-0">Schedule publish:</span>
          <input
            type="datetime-local"
            value={scheduleDate}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <Button size="sm" onClick={handleSchedule} disabled={isScheduling || !scheduleDate}
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            {isScheduling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="mr-1.5 h-3.5 w-3.5" />}
            Confirm
          </Button>
          <button type="button" onClick={() => setShowScheduler(false)} className="ml-auto text-blue-400 hover:text-blue-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Scheduled banner ─────────────────────────────────────────────── */}
      {post.status === "SCHEDULED" && post.scheduledAt && !showScheduler && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm">
          <CalendarClock className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-blue-800">
            Scheduled to publish on{" "}
            <strong>
              {new Date(post.scheduledAt).toLocaleString(undefined, {
                weekday: "long", year: "numeric", month: "long",
                day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </strong>
          </span>
          <button type="button" onClick={() => {
            const d = new Date(post.scheduledAt!);
            const pad = (n: number) => String(n).padStart(2, "0");
            setScheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
            setShowScheduler(true);
          }}
            className="ml-auto text-xs text-blue-600 hover:underline font-medium whitespace-nowrap">
            Change date
          </button>
        </div>
      )}

      {/* ── CMS push result banner ────────────────────────────────────────── */}
      {cmsResult && (
        <div className={`flex items-center justify-between p-3 rounded-lg text-sm ${cmsResult.type === "wp" ? "bg-[#21759b]/10 border border-[#21759b]/20" : "bg-[#96bf48]/10 border border-[#96bf48]/20"}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`h-4 w-4 ${cmsResult.type === "wp" ? "text-[#21759b]" : "text-[#5c8a1e]"}`} />
            <span className={`font-medium ${cmsResult.type === "wp" ? "text-[#21759b]" : "text-[#5c8a1e]"}`}>
              Pushed to {cmsResult.type === "wp" ? "WordPress" : "Shopify"} successfully
            </span>
          </div>
          <div className="flex gap-3">
            {cmsResult.viewUrl && (
              <a href={cmsResult.viewUrl} target="_blank" rel="noopener noreferrer"
                className={`text-xs hover:underline flex items-center gap-1 ${cmsResult.type === "wp" ? "text-[#21759b]" : "text-[#5c8a1e]"}`}>
                View Post <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {cmsResult.editUrl && (
              <a href={cmsResult.editUrl} target="_blank" rel="noopener noreferrer"
                className={`text-xs hover:underline flex items-center gap-1 ${cmsResult.type === "wp" ? "text-[#21759b]" : "text-[#5c8a1e]"}`}>
                Edit <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button type="button" onClick={() => setCmsResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Grid ─────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Editor */}
        <div className="space-y-4">
          {/* Title */}
          <Input
            placeholder="Post title..."
            value={post.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
            className="text-xl font-bold h-14 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Slug */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0 text-xs">Slug:</span>
            <Input
              value={post.slug || ""}
              onChange={(e) => { setAutoSlug(false); updateField("slug", e.target.value); }}
              className="h-7 text-xs"
            />
          </div>

          {/* Markdown Editor */}
          <MarkdownEditor
            value={post.content || ""}
            onChange={(v) => updateField("content", v)}
            height={600}
          />

          {/* ── AI Writing Assistant — below editor so it doesn't interrupt flow ── */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => { setShowAIPanel((p) => !p); setAiResult(""); }}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 text-sm font-medium text-purple-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-600" />
                AI Writing Assistant
                <span className="text-xs font-normal text-purple-500">— rewrite, expand, shorten any section</span>
              </span>
              {showAIPanel ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {showAIPanel && (
              <div className="p-4 space-y-3 bg-white border-t">
                <Textarea
                  placeholder="Paste the section you want to transform…"
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={4}
                  className="text-sm font-mono"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {(["improve", "rewrite", "expand", "shorten", "custom"] as const).map((a) => (
                    <button key={a} type="button" onClick={() => setAiAction(a)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        aiAction === a
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-purple-700 border-purple-300 hover:border-purple-600"
                      }`}>
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                  <Button size="sm" onClick={handleAIRewrite} disabled={isRewriting || !aiText.trim()}
                    className="ml-auto bg-purple-600 hover:bg-purple-700 text-white">
                    {isRewriting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
                    {isRewriting ? "Working…" : "Apply"}
                  </Button>
                </div>
                {aiAction === "custom" && (
                  <input type="text" placeholder="Describe what you want to do…"
                    value={aiCustomPrompt} onChange={(e) => setAiCustomPrompt(e.target.value)}
                    className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                )}
                {aiResult && (
                  <div className="space-y-2">
                    <div className="border rounded-md p-3 bg-gray-50 text-sm font-mono whitespace-pre-wrap max-h-56 overflow-y-auto">
                      {aiResult}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        className="text-xs border-purple-400 text-purple-700 hover:bg-purple-50"
                        onClick={() => { navigator.clipboard.writeText(aiResult); toast.success("Copied!"); }}>
                        <ClipboardPaste className="mr-1 h-3 w-3" />
                        Copy
                      </Button>
                      <Button size="sm" className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => {
                          if (aiText && post.content?.includes(aiText)) {
                            updateField("content", post.content.replace(aiText, aiResult));
                            toast.success("Section replaced");
                          } else {
                            updateField("content", (post.content || "") + "\n\n" + aiResult);
                            toast.success("Appended to content");
                          }
                          setAiText(aiResult);
                          setAiResult("");
                        }}>
                        Replace in Editor
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          <Tabs defaultValue="seo">
            <TabsList className="w-full">
              <TabsTrigger value="seo" className="flex-1 text-xs px-1">
                <BarChart3 className="mr-1 h-3 w-3" />SEO
              </TabsTrigger>
              <TabsTrigger value="meta" className="flex-1 text-xs px-1">
                <FileText className="mr-1 h-3 w-3" />Meta
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-1 text-xs px-1">
                <ImageIcon className="mr-1 h-3 w-3" />Image
              </TabsTrigger>
              <TabsTrigger value="social" className="flex-1 text-xs px-1">
                <Tags className="mr-1 h-3 w-3" />Social
              </TabsTrigger>
            </TabsList>

            {/* ── SEO Tab ── */}
            <TabsContent value="seo" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-4">
                  <SEOScore
                    title={post.title || ""} content={post.content || ""}
                    metaTitle={post.metaTitle || ""} metaDescription={post.metaDescription || ""}
                    focusKeyword={post.focusKeyword || ""} wordCount={wordCount}
                    featuredImage={post.featuredImage} featuredImageAlt={post.featuredImageAlt}
                    onAutoFix={!isNew ? handleAutoFixSEO : undefined}
                    isFixing={isFixingSEO}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Focus Keyword</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input placeholder="e.g., invoicing software"
                    value={post.focusKeyword || ""}
                    onChange={(e) => updateField("focusKeyword", e.target.value)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Publish Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={post.status || "DRAFT"}
                      onValueChange={(v) => updateField("status", v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="REVIEW">Review</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                        {/* SCHEDULED only appears if already scheduled (read-only context) */}
                        {post.status === "SCHEDULED" && (
                          <SelectItem value="SCHEDULED" disabled>
                            Scheduled (use toolbar to change)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Input placeholder="e.g., Invoicing Tips"
                      value={post.category || ""}
                      onChange={(e) => updateField("category", e.target.value)}
                      className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tags (press Enter)</Label>
                    <Input placeholder="Add tag…" value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={addTag} className="h-8 text-sm" />
                    {(post.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary"
                            className="text-xs cursor-pointer hover:bg-destructive/10"
                            onClick={() => removeTag(tag)}>
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Meta Tab ── */}
            <TabsContent value="meta" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Meta Title</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="SEO title (≤60 chars)" value={post.metaTitle || ""}
                    onChange={(e) => updateField("metaTitle", e.target.value)}
                    rows={2} className="text-sm resize-none" />
                  <p className={`text-xs mt-1 ${(post.metaTitle || "").length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                    {(post.metaTitle || "").length}/60
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Meta Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="Meta description (≤155 chars)" value={post.metaDescription || ""}
                    onChange={(e) => updateField("metaDescription", e.target.value)}
                    rows={3} className="text-sm resize-none" />
                  <p className={`text-xs mt-1 ${(post.metaDescription || "").length > 155 ? "text-destructive" : "text-muted-foreground"}`}>
                    {(post.metaDescription || "").length}/155
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Excerpt</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="Short post summary…" value={post.excerpt || ""}
                    onChange={(e) => updateField("excerpt", e.target.value)}
                    rows={3} className="text-sm resize-none" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Image Tab ── */}
            <TabsContent value="image" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Featured Image
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {post.featuredImage ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${post.featuredImage}?v=${imageCacheBust}`}
                        alt={post.featuredImageAlt || "Featured image"}
                        className="w-full rounded-lg aspect-video object-cover"
                      />
                      {isRegeneratingImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                          <div className="text-center text-white">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p className="text-xs">Generating…</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`w-full aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2 ${isRegeneratingImage ? "border-primary/50 bg-primary/5" : ""}`}>
                      {isRegeneratingImage
                        ? <><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-xs">Generating…</p></>
                        : <><ImageIcon className="h-6 w-6" /><p className="text-xs">No image yet</p></>}
                    </div>
                  )}

                  {!isNew && (
                    <div className="space-y-2">
                      <Button size="sm" className="w-full" variant="outline"
                        onClick={() => handleRegenerateImage()} disabled={isRegeneratingImage}>
                        {isRegeneratingImage
                          ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                        {post.featuredImage ? "Regenerate with AI" : "Generate with AI"}
                      </Button>
                      <div className="flex gap-1.5">
                        <input type="text" placeholder="Custom prompt (optional)…"
                          value={imagePromptInput}
                          onChange={(e) => setImagePromptInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && imagePromptInput.trim()) handleRegenerateImage(imagePromptInput.trim()); }}
                          className="flex-1 h-7 text-xs px-2 border rounded-md bg-background"
                          disabled={isRegeneratingImage} />
                        <Button size="sm" variant="ghost" className="h-7 px-2"
                          onClick={() => imagePromptInput.trim() && handleRegenerateImage(imagePromptInput.trim())}
                          disabled={isRegeneratingImage || !imagePromptInput.trim()}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Manual URL override</Label>
                    <Input placeholder="Paste image URL…" value={post.featuredImage || ""}
                      onChange={(e) => updateField("featuredImage", e.target.value)}
                      className="text-xs h-8" />
                    <Input placeholder="Alt text" value={post.featuredImageAlt || ""}
                      onChange={(e) => updateField("featuredImageAlt", e.target.value)}
                      className="text-xs h-8" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Social Tab ── */}
            <TabsContent value="social" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Twitter / X Caption</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="Tweet caption with hashtags…"
                    value={(post.socialCaptions as { twitter?: string })?.twitter || ""}
                    onChange={(e) => updateField("socialCaptions", { ...(post.socialCaptions || {}), twitter: e.target.value })}
                    rows={3} className="text-sm resize-none" />
                  <p className={`text-xs mt-1 ${((post.socialCaptions as { twitter?: string })?.twitter || "").length > 280 ? "text-destructive" : "text-muted-foreground"}`}>
                    {((post.socialCaptions as { twitter?: string })?.twitter || "").length}/280
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">LinkedIn Caption</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea placeholder="LinkedIn post caption…"
                    value={(post.socialCaptions as { linkedin?: string })?.linkedin || ""}
                    onChange={(e) => updateField("socialCaptions", { ...(post.socialCaptions || {}), linkedin: e.target.value })}
                    rows={4} className="text-sm resize-none" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
