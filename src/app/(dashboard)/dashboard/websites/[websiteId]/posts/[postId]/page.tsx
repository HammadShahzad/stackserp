"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Save,
  Eye,
  Send,
  Loader2,
  Clock,
  FileText,
  BarChart3,
  Image,
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
} from "lucide-react";
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
  wordCount: number | null;
  readingTime: number | null;
  socialCaptions: { twitter?: string; linkedin?: string } | null;
  externalUrl: string | null;
}

export default function PostEditorPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params.websiteId as string;
  const postId = params.postId as string;
  const isNew = postId === "new";

  const [post, setPost] = useState<Partial<Post>>({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
    secondaryKeywords: [],
    tags: [],
    category: "",
    status: "DRAFT",
  });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPushingToWP, setIsPushingToWP] = useState(false);
  const [isPushingToShopify, setIsPushingToShopify] = useState(false);
  const [wpResult, setWpResult] = useState<{ url?: string; editUrl?: string } | null>(null);
  const [shopifyResult, setShopifyResult] = useState<{ articleUrl?: string; adminUrl?: string } | null>(null);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isFixingSEO, setIsFixingSEO] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiAction, setAiAction] = useState<"rewrite" | "expand" | "shorten" | "improve" | "custom">("improve");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [imagePromptInput, setImagePromptInput] = useState("");
  const [imageCacheBust, setImageCacheBust] = useState<number>(Date.now());
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
        .then((data) => {
          setPost(data);
          setAutoSlug(false);
        })
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
    // Auto-generate slug from title
    if (field === "title" && autoSlug) {
      const slug = (value as string)
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
      setPost((p) => ({ ...p, title: value as string, slug }));
    }
  };

  const wordCount = post.content ? post.content.split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  // Compute the live URL for the "View Live" button
  const liveUrl = (() => {
    if (post.externalUrl) return post.externalUrl;
    if (!post.slug || post.status !== "PUBLISHED") return null;
    if (integrations.customDomain) return `https://${integrations.customDomain}/${post.slug}`;
    if (integrations.subdomain) return `https://${integrations.subdomain}.stackserp.com/${post.slug}`;
    if (integrations.brandUrl) return `${integrations.brandUrl.replace(/\/$/, "")}/blog/${post.slug}`;
    return null;
  })();

  const handleSave = async (statusOverride?: string) => {
    if (!post.title || !post.content) {
      toast.error("Title and content are required");
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...post, wordCount, readingTime };
      if (statusOverride) payload.status = statusOverride;

      const url = isNew
        ? `/api/websites/${websiteId}/posts`
        : `/api/websites/${websiteId}/posts/${postId}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        toast.success(
          statusOverride === "PUBLISHED" ? "Post published!" : "Post saved"
        );
        if (isNew) {
          router.replace(
            `/dashboard/websites/${websiteId}/posts/${saved.id}`
          );
        } else {
          setPost((p) => ({ ...p, status: saved.status }));
          // Auto-run SEO fix in background (non-blocking)
          const contentAtSave = post.content;
          setIsFixingSEO(true);
          fetch(`/api/websites/${websiteId}/posts/${saved.id}/seo-fix`, { method: "POST" })
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
                if (msgs.length > 0) toast.success(`Auto-optimized: ${msgs.join(", ")}`);
              }
            })
            .catch(() => {})
            .finally(() => setIsFixingSEO(false));
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save post");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIRewrite = async () => {
    if (!aiText.trim()) {
      toast.error("Paste or type the text you want to rewrite");
      return;
    }
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

  const handlePublish = async () => {
    if (!post.title || !post.content) {
      toast.error("Title and content are required");
      return;
    }
    setIsPublishing(true);
    try {
      const payload = { ...post, wordCount, readingTime, status: "PUBLISHED" };
      const url = isNew
        ? `/api/websites/${websiteId}/posts`
        : `/api/websites/${websiteId}/posts/${postId}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        toast.success("Post published!");
        setPost((p) => ({ ...p, status: "PUBLISHED" }));
        if (isNew) {
          router.replace(`/dashboard/websites/${websiteId}/posts/${saved.id}`);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to publish");
      }
    } catch {
      toast.error("Failed to publish post");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePushToShopify = async (status: "draft" | "published") => {
    if (isNew || !postId) {
      toast.error("Save the post first before pushing to Shopify");
      return;
    }
    setIsPushingToShopify(true);
    setShopifyResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/shopify/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, status }),
      });
      const data = await res.json();
      if (res.ok) {
        setShopifyResult({ articleUrl: data.articleUrl, adminUrl: data.adminUrl });
        if (data.articleUrl) setPost((p) => ({ ...p, externalUrl: data.articleUrl }));
        toast.success(`Pushed to Shopify as ${status}!`);
      } else {
        toast.error(data.error || "Failed to push to Shopify");
      }
    } catch {
      toast.error("Failed to push to Shopify");
    } finally {
      setIsPushingToShopify(false);
    }
  };

  const handlePushToWordPress = async (status: "draft" | "publish") => {
    if (isNew || !postId) {
      toast.error("Save the post first before pushing to WordPress");
      return;
    }
    setIsPushingToWP(true);
    setWpResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/wordpress/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, status }),
      });
      const data = await res.json();
      if (res.ok) {
        setWpResult({ url: data.wpPostUrl, editUrl: data.wpEditUrl });
        if (data.wpPostUrl) setPost((p) => ({ ...p, externalUrl: data.wpPostUrl }));
        toast.success(`Pushed to WordPress as ${status}!`);
      } else {
        toast.error(data.error || "Failed to push to WordPress");
        if (data.error?.includes("not connected")) {
          toast.error("Go to Website Settings → WordPress to connect first");
        }
      }
    } catch {
      toast.error("Failed to push to WordPress");
    } finally {
      setIsPushingToWP(false);
    }
  };

  const handleAutoFixSEO = async () => {
    if (isNew || !postId) {
      toast.error("Save the post first");
      return;
    }
    setIsFixingSEO(true);
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/posts/${postId}/seo-fix`,
        { method: "POST" }
      );
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
    } catch {
      toast.error("Auto-fix failed");
    } finally {
      setIsFixingSEO(false);
    }
  };

  const handleRegenerateImage = async (customPrompt?: string) => {
    if (isNew || !postId) {
      toast.error("Save the post first before regenerating the image");
      return;
    }
    setIsRegeneratingImage(true);
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/posts/${postId}/regenerate-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customPrompt ? { prompt: customPrompt } : {}),
        }
      );
      const data = await res.json();
      if (res.ok) {
        updateField("featuredImage", data.imageUrl);
        setImageCacheBust(Date.now());
        toast.success("New image generated and saved!");
        setImagePromptInput("");
      } else {
        toast.error(data.error || "Failed to generate image");
      }
    } catch {
      toast.error("Image generation failed");
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTags = [...(post.tags || []), tagInput.trim()];
      updateField("tags", newTags);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    updateField("tags", (post.tags || []).filter((t) => t !== tag));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/dashboard/websites/${websiteId}/posts`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-bold">
              {isNew ? "New Post" : "Edit Post"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={
                post.status === "PUBLISHED" ? "default" :
                post.status === "REVIEW" ? "outline" : "secondary"
              }>
                {post.status?.toLowerCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {wordCount} words · {readingTime} min read
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isFixingSEO ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-green-600" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isFixingSEO ? "Optimizing…" : "Save"}
          </Button>

          {/* View Live button — shown whenever we have a live URL */}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View Live
              </Button>
            </a>
          )}

          {/* Publish on StackSerp */}
          {post.status !== "PUBLISHED" ? (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={isPublishing || isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isPublishing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Publish
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave("DRAFT")}
              disabled={isSaving}
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
            >
              Unpublish
            </Button>
          )}

          {/* WordPress push buttons */}
          {!isNew && integrations.wp && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePushToWordPress("draft")}
                disabled={isPushingToWP || isSaving}
                className="border-[#21759b] text-[#21759b] hover:bg-[#21759b]/5"
              >
                {isPushingToWP ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plug className="mr-1.5 h-3.5 w-3.5" />
                )}
                WP Draft
              </Button>
              <Button
                size="sm"
                onClick={() => handlePushToWordPress("publish")}
                disabled={isPushingToWP || isSaving}
                className="bg-[#21759b] hover:bg-[#21759b]/90"
              >
                {isPushingToWP ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plug className="mr-1.5 h-3.5 w-3.5" />
                )}
                WP Publish
              </Button>
            </div>
          )}

          {/* Shopify push buttons */}
          {!isNew && integrations.shopify && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePushToShopify("draft")}
                disabled={isPushingToShopify || isSaving}
                className="border-[#96bf48] text-[#5c8a1e] hover:bg-[#96bf48]/5"
              >
                {isPushingToShopify ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                )}
                Shopify Draft
              </Button>
              <Button
                size="sm"
                onClick={() => handlePushToShopify("published")}
                disabled={isPushingToShopify || isSaving}
                className="bg-[#5c8a1e] hover:bg-[#4a7018] text-white"
              >
                {isPushingToShopify ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                )}
                Shopify Publish
              </Button>
            </div>
          )}

          {/* Save as ready for review */}
          {post.status !== "PUBLISHED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleSave("REVIEW")}
              disabled={isSaving}
            >
              <Send className="mr-2 h-4 w-4" />
              Mark Ready
            </Button>
          )}
        </div>
      </div>

      {/* WordPress push success banner */}
      {wpResult && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#21759b]/10 border border-[#21759b]/20 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#21759b]" />
            <span className="font-medium text-[#21759b]">Successfully pushed to WordPress</span>
          </div>
          <div className="flex gap-2">
            {wpResult.url && (
              <a href={wpResult.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#21759b] hover:underline flex items-center gap-1">
                View Post <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {wpResult.editUrl && (
              <a href={wpResult.editUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#21759b] hover:underline flex items-center gap-1 ml-3">
                Edit in WP <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Shopify push success banner */}
      {shopifyResult && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#96bf48]/10 border border-[#96bf48]/20 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#5c8a1e]" />
            <span className="font-medium text-[#5c8a1e]">Successfully pushed to Shopify</span>
          </div>
          <div className="flex gap-2">
            {shopifyResult.articleUrl && (
              <a href={shopifyResult.articleUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#5c8a1e] hover:underline flex items-center gap-1">
                View Article <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {shopifyResult.adminUrl && (
              <a href={shopifyResult.adminUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#5c8a1e] hover:underline flex items-center gap-1 ml-3">
                Edit in Shopify <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Editor */}
        <div className="space-y-4">
          {/* Title */}
          <Input
            placeholder="Post title..."
            value={post.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
            className="text-2xl font-bold h-14 text-xl border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Slug */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">URL slug:</span>
            <Input
              value={post.slug || ""}
              onChange={(e) => {
                setAutoSlug(false);
                updateField("slug", e.target.value);
              }}
              className="h-7 text-sm"
            />
          </div>

          {/* AI Writing Assistant */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => { setShowAIPanel((p) => !p); setAiResult(""); }}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 text-sm font-medium text-purple-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-600" />
                AI Writing Assistant
              </span>
              {showAIPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAIPanel && (
              <div className="p-4 space-y-3 bg-white border-t">
                <p className="text-xs text-muted-foreground">Paste any section of your article, choose an action, and apply it back.</p>
                <Textarea
                  placeholder="Paste the section you want to rewrite, expand, shorten or improve…"
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={5}
                  className="text-sm font-mono"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {(["rewrite", "expand", "shorten", "improve", "custom"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAiAction(a)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        aiAction === a
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-purple-700 border-purple-300 hover:border-purple-600"
                      }`}
                    >
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                  <Button
                    size="sm"
                    onClick={handleAIRewrite}
                    disabled={isRewriting || !aiText.trim()}
                    className="ml-auto bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isRewriting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {isRewriting ? "Working…" : "Apply"}
                  </Button>
                </div>
                {aiAction === "custom" && (
                  <input
                    type="text"
                    placeholder="Describe what you want to do with this text…"
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                )}
                {aiResult && (
                  <div className="space-y-2">
                    <div className="border rounded-md p-3 bg-gray-50 text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {aiResult}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-purple-400 text-purple-700 hover:bg-purple-50"
                        onClick={() => {
                          navigator.clipboard.writeText(aiResult);
                          toast.success("Copied to clipboard");
                        }}
                      >
                        <ClipboardPaste className="mr-1 h-3 w-3" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => {
                          if (aiText && post.content?.includes(aiText)) {
                            updateField("content", post.content.replace(aiText, aiResult));
                            toast.success("Section replaced in editor");
                          } else {
                            updateField("content", (post.content || "") + "\n\n" + aiResult);
                            toast.success("Appended to content");
                          }
                          setAiText(aiResult);
                          setAiResult("");
                        }}
                      >
                        Replace in Editor
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Markdown Editor */}
          <MarkdownEditor
            value={post.content || ""}
            onChange={(v) => updateField("content", v)}
            height={600}
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          <Tabs defaultValue="seo">
            <TabsList className="w-full">
              <TabsTrigger value="seo" className="flex-1 text-xs px-2">
                <BarChart3 className="mr-1 h-3 w-3" />
                SEO
              </TabsTrigger>
              <TabsTrigger value="meta" className="flex-1 text-xs px-2">
                <FileText className="mr-1 h-3 w-3" />
                Meta
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-1 text-xs px-2">
                <Image className="mr-1 h-3 w-3" />
                Image
              </TabsTrigger>
              <TabsTrigger value="social" className="flex-1 text-xs px-2">
                <Tags className="mr-1 h-3 w-3" />
                Social
              </TabsTrigger>
            </TabsList>

            {/* SEO Tab */}
            <TabsContent value="seo" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-4">
                  <SEOScore
                    title={post.title || ""}
                    content={post.content || ""}
                    metaTitle={post.metaTitle || ""}
                    metaDescription={post.metaDescription || ""}
                    focusKeyword={post.focusKeyword || ""}
                    wordCount={wordCount}
                    featuredImage={post.featuredImage}
                    featuredImageAlt={post.featuredImageAlt}
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
                  <Input
                    placeholder="e.g., invoicing software"
                    value={post.focusKeyword || ""}
                    onChange={(e) => updateField("focusKeyword", e.target.value)}
                  />
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
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Input
                      placeholder="e.g., Invoicing Tips"
                      value={post.category || ""}
                      onChange={(e) => updateField("category", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tags (press Enter)</Label>
                    <Input
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      className="h-8 text-sm"
                    />
                    {(post.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.tags?.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={() => removeTag(tag)}
                          >
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Meta Tab */}
            <TabsContent value="meta" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Meta Title</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="SEO title (≤60 chars)"
                    value={post.metaTitle || ""}
                    onChange={(e) => updateField("metaTitle", e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(post.metaTitle || "").length}/60
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Meta Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Meta description (≤155 chars)"
                    value={post.metaDescription || ""}
                    onChange={(e) => updateField("metaDescription", e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(post.metaDescription || "").length}/155
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Excerpt</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Short post summary..."
                    value={post.excerpt || ""}
                    onChange={(e) => updateField("excerpt", e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Image Tab */}
            <TabsContent value="image" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Featured Image
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Preview */}
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
                            <p className="text-xs">Generating image…</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`w-full aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2 ${isRegeneratingImage ? "border-primary/50 bg-primary/5" : ""}`}>
                      {isRegeneratingImage
                        ? <><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-xs">Generating image…</p></>
                        : <><Image className="h-6 w-6" /><p className="text-xs">No image yet</p></>
                      }
                    </div>
                  )}

                  {/* AI Regenerate buttons */}
                  {!isNew && (
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        className="w-full"
                        variant="outline"
                        onClick={() => handleRegenerateImage()}
                        disabled={isRegeneratingImage}
                      >
                        {isRegeneratingImage
                          ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          : <Sparkles className="mr-2 h-3.5 w-3.5" />
                        }
                        {post.featuredImage ? "Regenerate with AI" : "Generate with AI"}
                      </Button>

                      {/* Custom prompt input */}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Custom prompt (optional)…"
                          value={imagePromptInput}
                          onChange={(e) => setImagePromptInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && imagePromptInput.trim()) {
                              handleRegenerateImage(imagePromptInput.trim());
                            }
                          }}
                          className="flex-1 h-7 text-xs px-2 border rounded-md bg-background"
                          disabled={isRegeneratingImage}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => imagePromptInput.trim() && handleRegenerateImage(imagePromptInput.trim())}
                          disabled={isRegeneratingImage || !imagePromptInput.trim()}
                          title="Generate from custom prompt"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Manual URL override */}
                  <Input
                    placeholder="Or paste image URL directly"
                    value={post.featuredImage || ""}
                    onChange={(e) => updateField("featuredImage", e.target.value)}
                    className="text-xs h-8"
                  />
                  <Input
                    placeholder="Alt text"
                    value={post.featuredImageAlt || ""}
                    onChange={(e) => updateField("featuredImageAlt", e.target.value)}
                    className="text-xs h-8"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Tab */}
            <TabsContent value="social" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Twitter/X Caption</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Tweet caption with hashtags..."
                    value={(post.socialCaptions as { twitter?: string })?.twitter || ""}
                    onChange={(e) =>
                      updateField("socialCaptions", {
                        ...(post.socialCaptions || {}),
                        twitter: e.target.value,
                      })
                    }
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((post.socialCaptions as { twitter?: string })?.twitter || "").length}/280
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">LinkedIn Caption</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="LinkedIn post caption..."
                    value={(post.socialCaptions as { linkedin?: string })?.linkedin || ""}
                    onChange={(e) =>
                      updateField("socialCaptions", {
                        ...(post.socialCaptions || {}),
                        linkedin: e.target.value,
                      })
                    }
                    rows={4}
                    className="text-sm resize-none"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
