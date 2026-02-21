"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Save, Globe, Palette, Bot, Share2, Code, AlertTriangle,
  CheckCircle2, XCircle, Download, Eye, EyeOff, ExternalLink, Plug,
  Webhook, Zap, Twitter, Linkedin, ShoppingBag, ChevronDown, Clock, CalendarDays,
  Brain, X, Plus, Target, Megaphone, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface WebsiteData {
  id: string;
  name: string;
  domain: string;
  niche: string;
  description: string;
  targetAudience: string;
  tone: string;
  brandName: string;
  brandUrl: string;
  primaryColor: string;
  autoPublish: boolean;
  postsPerWeek: number;
  publishTime: string;
  publishDays: string;
  timezone: string;
  hostingMode: string;
  googleAnalyticsId: string | null;
  gscPropertyUrl: string | null;
  indexNowKey: string | null;
  twitterApiKey: string | null;
  twitterApiSecret: string | null;
  twitterAccessToken: string | null;
  twitterAccessSecret: string | null;
  linkedinAccessToken: string | null;
  status: string;
  // Brand Intelligence
  uniqueValueProp: string | null;
  competitors: string[];
  keyProducts: string[];
  targetLocation: string | null;
}

interface BlogSettingsData {
  ctaText: string | null;
  ctaUrl: string | null;
  avoidTopics: string[];
  writingStyle: string;
  contentLength: string;
  includeFAQ: boolean;
  includeTableOfContents: boolean;
}

const ALL_DAYS = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
  { key: "SUN", label: "Sun" },
] as const;

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

function getTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value || "";
    return `${tz.replace(/_/g, " ")} (${offset})`;
  } catch {
    return tz;
  }
}

function computeNextPublishDate(
  publishDays: string,
  publishTime: string,
  timezone: string,
): Date | null {
  if (!publishDays || !publishTime) return null;
  const days = publishDays.split(",").map((d) => d.trim().toUpperCase());
  const dayMap: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const targetDayNumbers = days.map((d) => dayMap[d]).filter((n) => n !== undefined);
  if (targetDayNumbers.length === 0) return null;

  const [h, m] = publishTime.split(":").map(Number);
  const tz = timezone || "UTC";
  const now = new Date();

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 86400000);
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(candidate);
      const weekday = (parts.find((p) => p.type === "weekday")?.value || "").toUpperCase().slice(0, 3);
      const dayNum = dayMap[weekday];
      if (!targetDayNumbers.includes(dayNum)) continue;

      const localDateStr = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
      const scheduledLocal = new Date(`${localDateStr}T${publishTime}:00`);
      const localNowStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(now);
      const [datePart, timePart] = localNowStr.split(", ");
      const localNow = new Date(`${datePart}T${timePart}:00`);

      if (offset === 0 && scheduledLocal <= localNow) continue;

      const offsetMs = now.getTime() - localNow.getTime();
      return new Date(scheduledLocal.getTime() + offsetMs);
    } catch {
      continue;
    }
  }
  return null;
}

export default function WebsiteSettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const websiteId = params.websiteId as string;
  const { data: sessionData } = useSession();
  const defaultTab = searchParams.get("tab") || "general";
  const isAdmin = sessionData?.user?.systemRole === "ADMIN";
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const [blogSettings, setBlogSettings] = useState<BlogSettingsData>({
    ctaText: null, ctaUrl: null, avoidTopics: [], writingStyle: "informative",
    contentLength: "MEDIUM", includeFAQ: true, includeTableOfContents: true,
  });
  const [isSavingBlogSettings, setIsSavingBlogSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Helpers for array fields (tag-style input)
  const [competitorInput, setCompetitorInput] = useState("");
  const [keyProductInput, setKeyProductInput] = useState("");
  const [avoidTopicInput, setAvoidTopicInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  // AI preview dialog — multi-option
  interface AIRawData {
    brandName: string; brandUrl: string; primaryColor: string[];
    niche: string[]; description: string[]; targetAudience: string[]; tone: string[];
    uniqueValueProp: string[]; competitors: string[]; keyProducts: string[];
    targetLocation: string; suggestedCtaText: string[]; suggestedCtaUrl: string;
    suggestedWritingStyle: string[];
  }
  const [aiRaw, setAiRaw] = useState<AIRawData | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  // Selected index per field (which option the user picked)
  const [aiPicks, setAiPicks] = useState<Record<string, number>>({});
  // Whether to apply each field
  const [aiEnabled, setAiEnabled] = useState<Record<string, boolean>>({});

  const MULTI_FIELDS = [
    { key: "niche", label: "Niche / Industry", group: "General" },
    { key: "description", label: "Description", group: "General" },
    { key: "targetAudience", label: "Target Audience", group: "General" },
    { key: "tone", label: "Writing Tone", group: "Brand" },
    { key: "primaryColor", label: "Brand Color", group: "Brand" },
    { key: "uniqueValueProp", label: "Value Proposition", group: "Brand" },
    { key: "suggestedCtaText", label: "Call-to-Action", group: "Content" },
    { key: "suggestedWritingStyle", label: "Writing Style", group: "Content" },
  ] as const;

  const SINGLE_FIELDS = [
    { key: "brandName", label: "Brand Name", group: "Brand" },
    { key: "brandUrl", label: "Brand URL", group: "Brand" },
    { key: "targetLocation", label: "Location", group: "Brand" },
    { key: "suggestedCtaUrl", label: "CTA URL", group: "Content" },
  ] as const;

  const handleAIResearch = async () => {
    if (!website) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/websites/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: website.name || website.brandName, domain: website.domain }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "AI analysis failed");
        return;
      }
      const data = await res.json() as AIRawData;
      setAiRaw(data);
      const picks: Record<string, number> = {};
      const enabled: Record<string, boolean> = {};
      for (const f of MULTI_FIELDS) { picks[f.key] = 0; enabled[f.key] = true; }
      for (const f of SINGLE_FIELDS) { enabled[f.key] = true; }
      enabled["competitors"] = true;
      enabled["keyProducts"] = true;
      setAiPicks(picks);
      setAiEnabled(enabled);
      setAiDialogOpen(true);
    } catch {
      toast.error("AI analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPickedValue = (key: string): string => {
    if (!aiRaw) return "";
    const raw = (aiRaw as unknown as Record<string, unknown>)[key];
    if (Array.isArray(raw)) return raw[aiPicks[key] ?? 0] || raw[0] || "";
    return String(raw || "");
  };

  const handleAIApply = () => {
    if (!aiRaw) return;
    let applied = 0;
    const pick = (k: string) => getPickedValue(k);

    if (aiEnabled.niche) { updateField("niche", pick("niche")); applied++; }
    if (aiEnabled.description) { updateField("description", pick("description")); applied++; }
    if (aiEnabled.targetAudience) { updateField("targetAudience", pick("targetAudience")); applied++; }
    if (aiEnabled.brandName) { updateField("brandName", aiRaw.brandName); applied++; }
    if (aiEnabled.brandUrl) { updateField("brandUrl", aiRaw.brandUrl); applied++; }
    if (aiEnabled.tone) { updateField("tone", pick("tone")); applied++; }
    if (aiEnabled.primaryColor) { updateField("primaryColor", pick("primaryColor")); applied++; }
    if (aiEnabled.uniqueValueProp) { updateField("uniqueValueProp", pick("uniqueValueProp")); applied++; }
    if (aiEnabled.targetLocation) { updateField("targetLocation", aiRaw.targetLocation); applied++; }
    if (aiEnabled.competitors && aiRaw.competitors?.length) { updateField("competitors", aiRaw.competitors); applied++; }
    if (aiEnabled.keyProducts && aiRaw.keyProducts?.length) { updateField("keyProducts", aiRaw.keyProducts); applied++; }
    if (aiEnabled.suggestedCtaText) {
      setBlogSettings((p) => ({ ...p, ctaText: pick("suggestedCtaText") })); applied++;
    }
    if (aiEnabled.suggestedCtaUrl) {
      setBlogSettings((p) => ({ ...p, ctaUrl: aiRaw.suggestedCtaUrl })); applied++;
    }
    if (aiEnabled.suggestedWritingStyle) {
      const style = pick("suggestedWritingStyle");
      if (["informative", "conversational", "technical", "storytelling", "persuasive", "humorous"].includes(style)) {
        setBlogSettings((p) => ({ ...p, writingStyle: style })); applied++;
      }
    }

    setAiDialogOpen(false);
    toast.success(`Applied ${applied} field${applied !== 1 ? "s" : ""} — review and save`);
  };

  const handlePause = useCallback(async () => {
    if (!website) return;
    const isPaused = website.status === "PAUSED";
    setIsPausing(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isPaused ? "ACTIVE" : "PAUSED" }),
      });
      if (res.ok) {
        toast.success(isPaused ? "Website resumed" : "Website paused — content generation stopped");
        fetchWebsite();
      } else toast.error("Failed to update status");
    } catch { toast.error("Something went wrong"); }
    finally { setIsPausing(false); }
  }, [website, websiteId]);

  const handleDelete = useCallback(async () => {
    if (confirmDelete !== website?.domain) {
      toast.error("Type the domain name to confirm deletion");
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELETED" }),
      });
      if (res.ok) {
        toast.success("Website deleted");
        router.push("/dashboard/websites");
      } else toast.error("Failed to delete website");
    } catch { toast.error("Something went wrong"); }
    finally { setIsDeleting(false); }
  }, [confirmDelete, website?.domain, websiteId, router]);

  const nextPublish = useMemo(() => {
    if (!website?.autoPublish) return null;
    return computeNextPublishDate(
      website.publishDays || "MON,WED,FRI",
      website.publishTime || "09:00",
      website.timezone || "UTC",
    );
  }, [website?.autoPublish, website?.publishDays, website?.publishTime, website?.timezone]);

  const toggleDay = (dayKey: string) => {
    if (!website) return;
    const current = (website.publishDays || "MON,WED,FRI").split(",").map((d) => d.trim());
    const updated = current.includes(dayKey)
      ? current.filter((d) => d !== dayKey)
      : [...current, dayKey];
    if (updated.length === 0) return;
    const ordered = ALL_DAYS.map((d) => d.key).filter((k) => updated.includes(k));
    updateField("publishDays", ordered.join(","));
  };

  useEffect(() => {
    fetchWebsite();
  }, [websiteId]);

  const fetchWebsite = async () => {
    try {
      const [siteRes, bsRes] = await Promise.all([
        fetch(`/api/websites/${websiteId}`),
        fetch(`/api/websites/${websiteId}/blog-settings`),
      ]);
      if (siteRes.ok) setWebsite(await siteRes.json());
      if (bsRes.ok) {
        const bs = await bsRes.json();
        if (bs && Object.keys(bs).length > 0) setBlogSettings((prev) => ({ ...prev, ...bs }));
      }
    } catch {
      toast.error("Failed to load website settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBlogSettings = async () => {
    const { finalWebsite, finalBlogSettings } = buildFinalData();
    if (finalWebsite) setWebsite(finalWebsite);
    setBlogSettings(finalBlogSettings);
    setIsSavingBlogSettings(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/blog-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalBlogSettings),
      });
      if (res.ok) toast.success("Content settings saved");
      else toast.error("Failed to save content settings");
    } catch {
      toast.error("Failed to save content settings");
    } finally {
      setIsSavingBlogSettings(false);
    }
  };

  // Build final website/blogSettings objects that include any pending chip inputs
  const buildFinalData = () => {
    const finalWebsite = website ? { ...website } : null;
    const finalBlogSettings = { ...blogSettings };

    if (finalWebsite) {
      if (competitorInput.trim()) {
        const val = competitorInput.trim();
        if (!finalWebsite.competitors?.includes(val)) {
          finalWebsite.competitors = [...(finalWebsite.competitors || []), val];
        }
        setCompetitorInput("");
      }
      if (keyProductInput.trim()) {
        const val = keyProductInput.trim();
        if (!finalWebsite.keyProducts?.includes(val)) {
          finalWebsite.keyProducts = [...(finalWebsite.keyProducts || []), val];
        }
        setKeyProductInput("");
      }
    }
    if (avoidTopicInput.trim()) {
      const val = avoidTopicInput.trim();
      if (!finalBlogSettings.avoidTopics?.includes(val)) {
        finalBlogSettings.avoidTopics = [...(finalBlogSettings.avoidTopics || []), val];
      }
      setAvoidTopicInput("");
    }

    return { finalWebsite, finalBlogSettings };
  };

  const handleSave = async () => {
    if (!website) return;
    const { finalWebsite, finalBlogSettings } = buildFinalData();
    if (!finalWebsite) return;
    // Sync flushed chips into state so UI reflects it
    setWebsite(finalWebsite);
    setBlogSettings(finalBlogSettings);
    setIsSaving(true);
    try {
      const [siteRes, bsRes] = await Promise.all([
        fetch(`/api/websites/${websiteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalWebsite),
        }),
        fetch(`/api/websites/${websiteId}/blog-settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalBlogSettings),
        }),
      ]);
      if (siteRes.ok && bsRes.ok) {
        toast.success("All settings saved");
      } else if (!siteRes.ok) {
        toast.error("Failed to save website settings");
      } else {
        toast.error("Failed to save content settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string | boolean | number | string[]) => {
    setWebsite((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!website) return <p>Website not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">
            {website.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAIResearch}
            disabled={isAnalyzing}
            className="border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            {isAnalyzing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {isAnalyzing ? "Researching..." : "AI Auto-Fill"}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {website.status === "PAUSED" && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 flex items-center justify-between">
          <p className="text-sm text-yellow-800 font-medium">Website is paused — content generation is stopped.</p>
          <Button variant="outline" size="sm" onClick={handlePause} disabled={isPausing}>
            {isPausing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Resume
          </Button>
        </div>
      )}

      {/* ── GENERAL ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Website Name</Label>
              <Input
                value={website.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input
                value={website.domain}
                onChange={(e) => updateField("domain", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Niche / Industry</Label>
              <Input
                value={website.niche}
                onChange={(e) => updateField("niche", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Input
                value={website.targetAudience}
                onChange={(e) => updateField("targetAudience", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={website.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── BRAND ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Brand &amp; Identity
          </CardTitle>
          <CardDescription>
            AI uses this to match your voice, differentiate content, and write targeted CTAs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input value={website.brandName} onChange={(e) => updateField("brandName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Brand URL</Label>
              <Input value={website.brandUrl} onChange={(e) => updateField("brandUrl", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Writing Tone</Label>
              <Input value={website.tone} onChange={(e) => updateField("tone", e.target.value)} placeholder="e.g., Friendly, authoritative, witty" />
            </div>
            <div className="space-y-2">
              <Label>Brand Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={website.primaryColor || "#4F46E5"}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="h-10 w-10 rounded border cursor-pointer"
                />
                <Input
                  value={website.primaryColor || "#4F46E5"}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Unique Value Proposition</Label>
            <Textarea
              placeholder="What makes your business different from competitors?"
              value={website.uniqueValueProp || ""}
              onChange={(e) => updateField("uniqueValueProp", e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              AI uses this to write differentiating CTAs and unique angles in every article.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Geographic Focus</Label>
              <Input
                placeholder="e.g., United States, Global, Pakistan"
                value={website.targetLocation || ""}
                onChange={(e) => updateField("targetLocation", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for pricing, examples, and market references.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Hosting Mode</Label>
              <Select value={website.hostingMode} onValueChange={(v) => updateField("hostingMode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="HOSTED">Self-Hosted</SelectItem>}
                  <SelectItem value="WORDPRESS">WordPress</SelectItem>
                  <SelectItem value="WEBHOOK">Webhook</SelectItem>
                  <SelectItem value="API">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Key Products / Features</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type and press Enter to add"
                value={keyProductInput}
                onChange={(e) => setKeyProductInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = keyProductInput.trim().replace(/,$/, "");
                    if (val && !(website.keyProducts || []).includes(val)) {
                      updateField("keyProducts", [...(website.keyProducts || []), val]);
                    }
                    setKeyProductInput("");
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const val = keyProductInput.trim();
                if (val && !(website.keyProducts || []).includes(val)) {
                  updateField("keyProducts", [...(website.keyProducts || []), val]);
                }
                setKeyProductInput("");
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(website.keyProducts || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(website.keyProducts || []).map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {p}
                    <button type="button" onClick={() => updateField("keyProducts", (website.keyProducts || []).filter((x) => x !== p))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Top Competitors</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type and press Enter to add"
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = competitorInput.trim().replace(/,$/, "");
                    if (val && !(website.competitors || []).includes(val)) {
                      updateField("competitors", [...(website.competitors || []), val]);
                    }
                    setCompetitorInput("");
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const val = competitorInput.trim();
                if (val && !(website.competitors || []).includes(val)) {
                  updateField("competitors", [...(website.competitors || []), val]);
                }
                setCompetitorInput("");
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(website.competitors || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(website.competitors || []).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-medium">
                    {c}
                    <button type="button" onClick={() => updateField("competitors", (website.competitors || []).filter((x) => x !== c))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── CONTENT AI ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Content &amp; AI
          </CardTitle>
          <CardDescription>
            Control what the AI writes, how it writes, and when it publishes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Writing Style</Label>
              <Select value={blogSettings.writingStyle} onValueChange={(v) => setBlogSettings((p) => ({ ...p, writingStyle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                  <SelectItem value="humorous">Humorous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Article Length</Label>
              <Select value={blogSettings.contentLength} onValueChange={(v) => setBlogSettings((p) => ({ ...p, contentLength: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHORT">Short (~800 words)</SelectItem>
                  <SelectItem value="MEDIUM">Medium (~1,500 words)</SelectItem>
                  <SelectItem value="LONG">Long (~2,500 words)</SelectItem>
                  <SelectItem value="PILLAR">Pillar (~4,000 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Call-to-Action Text</Label>
              <Input
                placeholder="e.g., Start your free trial"
                value={blogSettings.ctaText || ""}
                onChange={(e) => setBlogSettings((p) => ({ ...p, ctaText: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Call-to-Action URL</Label>
              <Input
                placeholder="e.g., https://yoursite.com/signup"
                value={blogSettings.ctaUrl || ""}
                onChange={(e) => setBlogSettings((p) => ({ ...p, ctaUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Topics to Avoid</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type and press Enter to add"
                value={avoidTopicInput}
                onChange={(e) => setAvoidTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = avoidTopicInput.trim().replace(/,$/, "");
                    if (val && !(blogSettings.avoidTopics || []).includes(val)) {
                      setBlogSettings((p) => ({ ...p, avoidTopics: [...(p.avoidTopics || []), val] }));
                    }
                    setAvoidTopicInput("");
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const val = avoidTopicInput.trim();
                if (val && !(blogSettings.avoidTopics || []).includes(val)) {
                  setBlogSettings((p) => ({ ...p, avoidTopics: [...(p.avoidTopics || []), val] }));
                }
                setAvoidTopicInput("");
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(blogSettings.avoidTopics || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(blogSettings.avoidTopics || []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
                    {t}
                    <button type="button" onClick={() => setBlogSettings((p) => ({ ...p, avoidTopics: (p.avoidTopics || []).filter((x) => x !== t) }))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-x-8 gap-y-3 md:grid-cols-3">
            <div className="flex items-center justify-between">
              <Label>Auto-Publish</Label>
              <Switch checked={website.autoPublish} onCheckedChange={(v) => updateField("autoPublish", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>FAQ Section</Label>
              <Switch checked={blogSettings.includeFAQ} onCheckedChange={(v) => setBlogSettings((p) => ({ ...p, includeFAQ: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Table of Contents</Label>
              <Switch checked={blogSettings.includeTableOfContents} onCheckedChange={(v) => setBlogSettings((p) => ({ ...p, includeTableOfContents: v }))} />
            </div>
          </div>

          {website.autoPublish && (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Publish Schedule
                </p>
                <div className="space-y-2">
                  <Label>Publish Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DAYS.map((day) => {
                      const active = (website.publishDays || "MON,WED,FRI").split(",").map((d) => d.trim()).includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => toggleDay(day.key)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time</Label>
                    <Input type="time" value={website.publishTime || "09:00"} onChange={(e) => updateField("publishTime", e.target.value)} className="w-32" />
                  </div>
                  <div className="space-y-2">
                    <Label>Posts/Week</Label>
                    <Select value={String(website.postsPerWeek)} onValueChange={(v) => updateField("postsPerWeek", parseInt(v))}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 5, 7, 10, 14].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}/week</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={website.timezone || "UTC"} onValueChange={(v) => updateField("timezone", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{getTimezoneLabel(tz)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {nextPublish && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <span className="font-medium">Next post:</span>{" "}
                    {nextPublish.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: website.timezone || "UTC" })}
                    {" at "}
                    {nextPublish.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: website.timezone || "UTC" })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── INTEGRATIONS ────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          Integrations
        </h3>
        <Tabs defaultValue={["wordpress","ghost","shopify","publishing","advanced"].includes(defaultTab) ? defaultTab : "wordpress"}>
          <TabsList className="flex-wrap h-auto mb-4">
            <TabsTrigger value="wordpress"><Plug className="mr-1.5 h-3.5 w-3.5" /> WordPress</TabsTrigger>
            <TabsTrigger value="ghost"><Zap className="mr-1.5 h-3.5 w-3.5" /> Ghost / Webhook</TabsTrigger>
            <TabsTrigger value="shopify"><ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Shopify</TabsTrigger>
            <TabsTrigger value="publishing"><Share2 className="mr-1.5 h-3.5 w-3.5" /> Social</TabsTrigger>
            <TabsTrigger value="advanced"><Code className="mr-1.5 h-3.5 w-3.5" /> Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="wordpress" className="mt-0">
            <WordPressSettings websiteId={websiteId} />
          </TabsContent>

          <TabsContent value="ghost" className="space-y-4 mt-0">
            <GhostSettings websiteId={websiteId} />
            <WebhookSettings websiteId={websiteId} />
          </TabsContent>

          <TabsContent value="shopify" className="mt-0">
            <ShopifySettings websiteId={websiteId} />
          </TabsContent>

          <TabsContent value="publishing" className="mt-0">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2 mb-3"><Twitter className="h-4 w-4" /> Twitter / X</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input type="password" placeholder="API Key (Consumer Key)" value={website.twitterApiKey || ""} onChange={(e) => updateField("twitterApiKey", e.target.value)} />
                    <Input type="password" placeholder="API Secret (Consumer Secret)" value={website.twitterApiSecret || ""} onChange={(e) => updateField("twitterApiSecret", e.target.value)} />
                    <Input type="password" placeholder="Access Token" value={website.twitterAccessToken || ""} onChange={(e) => updateField("twitterAccessToken", e.target.value)} />
                    <Input type="password" placeholder="Access Token Secret" value={website.twitterAccessSecret || ""} onChange={(e) => updateField("twitterAccessSecret", e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    All 4 keys needed.{" "}
                    <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get API keys →</a>
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium flex items-center gap-2 mb-3"><Linkedin className="h-4 w-4" /> LinkedIn</p>
                  <Input type="password" placeholder="LinkedIn OAuth access token" value={website.linkedinAccessToken || ""} onChange={(e) => updateField("linkedinAccessToken", e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Requires <code className="bg-muted px-1 rounded">w_member_social</code> scope.{" "}
                    <a href="https://www.linkedin.com/developers/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn Developers →</a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="mt-0 space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Google Analytics ID</Label>
                    <Input placeholder="G-XXXXXXXXXX" value={website.googleAnalyticsId || ""} onChange={(e) => updateField("googleAnalyticsId", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Search Console URL</Label>
                    <Input placeholder="https://yourdomain.com" value={website.gscPropertyUrl || ""} onChange={(e) => updateField("gscPropertyUrl", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-primary" /> IndexNow API Key</Label>
                  <Input placeholder="Auto-submit to Google & Bing on publish" value={website.indexNowKey || ""} onChange={(e) => updateField("indexNowKey", e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pause Website</p>
                    <p className="text-sm text-muted-foreground">Stop all content generation</p>
                  </div>
                  <Button variant="outline" onClick={handlePause} disabled={isPausing}>
                    {isPausing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {website.status === "PAUSED" ? "Resume" : "Pause"}
                  </Button>
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="font-medium">Delete Website</p>
                  <p className="text-sm text-muted-foreground">Permanently delete this website and all its content</p>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Type <span className="font-mono font-semibold text-foreground">{website.domain}</span> to confirm:
                    </p>
                    <div className="flex gap-2">
                      <Input placeholder={website.domain} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className="max-w-xs" />
                      <Button variant="destructive" onClick={handleDelete} disabled={isDeleting || confirmDelete !== website.domain}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Forever
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── AI PREVIEW DIALOG ───────────────────────────── */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              AI Research Results
            </DialogTitle>
            <DialogDescription>
              Pick your preferred option for each field. Click an option to select it, toggle the switch to skip a field.
            </DialogDescription>
          </DialogHeader>

          {aiRaw && (
            <div className="space-y-5 py-2">
              {["General", "Brand", "Content"].map((group) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{group}</p>
                  <div className="space-y-3">
                    {/* Multi-option fields */}
                    {MULTI_FIELDS.filter((f) => f.group === group).map((field) => {
                      const options = (aiRaw as unknown as Record<string, unknown>)[field.key];
                      if (!Array.isArray(options) || options.length === 0) return null;
                      const selected = aiPicks[field.key] ?? 0;
                      const enabled = aiEnabled[field.key] !== false;

                      return (
                        <div key={field.key} className={`rounded-lg border p-3 transition-colors ${enabled ? "border-border" : "border-muted opacity-50"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">{field.label}</p>
                            <Switch checked={enabled} onCheckedChange={(v) => setAiEnabled((p) => ({ ...p, [field.key]: v }))} />
                          </div>
                          {field.key === "primaryColor" ? (
                            <div className="flex gap-2">
                              {options.map((color: string, i: number) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setAiPicks((p) => ({ ...p, [field.key]: i }))}
                                  className={`h-10 w-10 rounded-lg border-2 transition-all ${selected === i ? "border-violet-500 scale-110 ring-2 ring-violet-200" : "border-transparent hover:scale-105"}`}
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {options.map((opt: string, i: number) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setAiPicks((p) => ({ ...p, [field.key]: i }))}
                                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all border ${
                                    selected === i
                                      ? "bg-violet-50 border-violet-300 text-violet-900 ring-1 ring-violet-200"
                                      : "bg-muted/30 border-transparent hover:bg-muted/60 text-muted-foreground"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Single-value fields */}
                    {SINGLE_FIELDS.filter((f) => f.group === group).map((field) => {
                      const val = (aiRaw as unknown as Record<string, unknown>)[field.key];
                      if (!val) return null;
                      const enabled = aiEnabled[field.key] !== false;
                      return (
                        <div key={field.key} className={`rounded-lg border p-3 transition-colors ${enabled ? "border-border" : "border-muted opacity-50"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium">{field.label}</p>
                            <Switch checked={enabled} onCheckedChange={(v) => setAiEnabled((p) => ({ ...p, [field.key]: v }))} />
                          </div>
                          <p className="text-sm text-muted-foreground">{String(val)}</p>
                        </div>
                      );
                    })}

                    {/* Competitors / Products as badges */}
                    {group === "Brand" && (
                      <>
                        {aiRaw.competitors?.length > 0 && (
                          <div className={`rounded-lg border p-3 transition-colors ${aiEnabled.competitors !== false ? "border-border" : "border-muted opacity-50"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">Competitors</p>
                              <Switch checked={aiEnabled.competitors !== false} onCheckedChange={(v) => setAiEnabled((p) => ({ ...p, competitors: v }))} />
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {aiRaw.competitors.map((c: string) => (
                                <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {aiRaw.keyProducts?.length > 0 && (
                          <div className={`rounded-lg border p-3 transition-colors ${aiEnabled.keyProducts !== false ? "border-border" : "border-muted opacity-50"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">Products / Features</p>
                              <Switch checked={aiEnabled.keyProducts !== false} onCheckedChange={(v) => setAiEnabled((p) => ({ ...p, keyProducts: v }))} />
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {aiRaw.keyProducts.map((p: string) => (
                                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAIApply} className="bg-violet-600 hover:bg-violet-700">
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Apply {Object.values(aiEnabled).filter(Boolean).length} Fields
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Ghost Settings Component
// ─────────────────────────────────────────────────────
function GhostSettings({ websiteId }: { websiteId: string }) {
  const [siteUrl, setSiteUrl] = useState("");
  const [adminApiKey, setAdminApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; siteName?: string; error?: string } | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch(`/api/websites/${websiteId}/ghost`)
      .then(r => r.json())
      .then(d => { if (d.connected) { setConnected(true); setSiteUrl(d.siteUrl || ""); } })
      .catch(() => {});
  }, [websiteId]);

  const handleTest = async () => {
    setIsTesting(true); setTestResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/ghost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", siteUrl, adminApiKey }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) toast.success("Ghost connection successful!"); else toast.error(data.error || "Connection failed");
    } catch { toast.error("Test failed"); }
    finally { setIsTesting(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/ghost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, adminApiKey }),
      });
      if (res.ok) { setConnected(true); toast.success("Ghost connected!"); }
      else toast.error("Failed to save");
    } catch { toast.error("Something went wrong"); }
    finally { setIsSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          Ghost CMS
        </CardTitle>
        <CardDescription>Publish posts directly to your Ghost blog</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            Ghost connected — {siteUrl}
          </div>
        )}
        <div className="space-y-2">
          <Label>Ghost Site URL</Label>
          <Input placeholder="https://yourblog.ghost.io" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Admin API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="id:secret (from Ghost Admin → Integrations)"
              value={adminApiKey}
              onChange={e => setAdminApiKey(e.target.value)}
              className="pr-10 font-mono text-sm"
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowKey(v => !v)}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ghost Admin → Integrations → Add custom integration → Copy Admin API Key
          </p>
        </div>
        {testResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {testResult.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />}
            {testResult.success ? <>Connected to <strong>{testResult.siteName}</strong></> : testResult.error}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting || !siteUrl || !adminApiKey}>
            {isTesting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Test
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !siteUrl || !adminApiKey}>
            {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────
// Webhook Settings Component
// ─────────────────────────────────────────────────────
function WebhookSettings({ websiteId }: { websiteId: string }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch(`/api/websites/${websiteId}/webhook`)
      .then(r => r.json())
      .then(d => { if (d.connected) { setConnected(true); setWebhookUrl(d.webhookUrl || ""); } })
      .catch(() => {});
  }, [websiteId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, webhookSecret }),
      });
      if (res.ok) { setConnected(true); toast.success("Webhook saved!"); }
      else toast.error("Failed to save webhook");
    } catch { toast.error("Something went wrong"); }
    finally { setIsSaving(false); }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", webhookUrl, webhookSecret }),
      });
      const data = await res.json();
      if (data.success) toast.success(`Webhook test sent! Server responded ${data.statusCode}`);
      else toast.error(data.error || "Test failed");
    } catch { toast.error("Test failed"); }
    finally { setIsTesting(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="h-4 w-4" />
          Webhook / Custom CMS
        </CardTitle>
        <CardDescription>
          POST every published post to any URL — works with Webflow, Make, Zapier, n8n, custom APIs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            Webhook active — {webhookUrl}
          </div>
        )}
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <Input placeholder="https://yourapp.com/api/content" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Secret (optional)</Label>
          <div className="relative">
            <Input
              type={showSecret ? "text" : "password"}
              placeholder="Used to sign requests with HMAC-SHA256"
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              className="pr-10"
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSecret(v => !v)}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            We'll send <code className="bg-muted px-1 rounded">X-StackSerp-Signature: sha256=…</code> with each request
          </p>
        </div>
        <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Payload includes:</p>
          <p>title, slug, content (Markdown + HTML), excerpt, metaTitle, metaDescription, focusKeyword, featuredImage, tags, wordCount, publishedAt</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting || !webhookUrl}>
            {isTesting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Test Webhook
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !webhookUrl}>
            {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────
// WordPress Settings Component
// ─────────────────────────────────────────────────────
function WordPressSettings({ websiteId }: { websiteId: string }) {
  const [mode, setMode] = useState<"app-password" | "plugin">("app-password");

  // App-password fields
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Plugin fields
  const [pluginSiteUrl, setPluginSiteUrl] = useState("");
  const [pluginApiKey, setPluginApiKey] = useState("");
  const [showPluginKey, setShowPluginKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    siteName?: string;
    userName?: string;
    version?: string;
    error?: string;
  } | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectedUrl, setConnectedUrl] = useState("");
  const [connectedMode, setConnectedMode] = useState<"app-password" | "plugin" | null>(null);

  useEffect(() => {
    fetch(`/api/websites/${websiteId}/wordpress`)
      .then((r) => r.json())
      .then((d) => {
        if (d.connected) {
          setConnected(true);
          setConnectedUrl(d.siteUrl || "");
          setConnectedMode(d.mode || "app-password");
          if (d.mode === "plugin") {
            setPluginSiteUrl(d.siteUrl || "");
            setMode("plugin");
          } else {
            setSiteUrl(d.siteUrl || "");
          }
        }
      })
      .catch(() => {});
  }, [websiteId]);

  // ── App-password handlers ──
  const handleTest = async () => {
    if (!siteUrl || !username || !appPassword) {
      toast.error("Fill in all fields before testing");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", mode: "app-password", siteUrl, username, appPassword }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) toast.success("Connection successful!");
      else toast.error(data.error || "Connection failed");
    } catch {
      toast.error("Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!siteUrl || !username || !appPassword) {
      toast.error("Fill in Site URL, username, and application password");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "app-password", siteUrl, username, appPassword }),
      });
      if (res.ok) {
        setConnected(true);
        setConnectedUrl(siteUrl);
        setConnectedMode("app-password");
        toast.success("WordPress connected!");
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to save");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Plugin handlers ──
  const handlePluginTest = async () => {
    if (!pluginSiteUrl || !pluginApiKey) {
      toast.error("Enter your WordPress site URL and API key");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", mode: "plugin", siteUrl: pluginSiteUrl, pluginApiKey }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) toast.success("Plugin connection successful!");
      else toast.error(data.error || "Plugin connection failed — check the API key");
    } catch {
      toast.error("Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handlePluginSave = async () => {
    if (!pluginSiteUrl || !pluginApiKey) {
      toast.error("Enter your WordPress site URL and API key");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "plugin", siteUrl: pluginSiteUrl, pluginApiKey }),
      });
      if (res.ok) {
        setConnected(true);
        setConnectedUrl(pluginSiteUrl);
        setConnectedMode("plugin");
        toast.success("WordPress plugin connected!");
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to save");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await fetch(`/api/websites/${websiteId}/wordpress`, { method: "DELETE" });
      setConnected(false);
      setConnectedUrl("");
      setConnectedMode(null);
      setSiteUrl(""); setUsername(""); setAppPassword("");
      setPluginSiteUrl(""); setPluginApiKey("");
      setTestResult(null);
      toast.success("WordPress disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Connected banner */}
      {connected && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">WordPress Connected</p>
                <p className="text-sm text-green-700">
                  {connectedUrl}
                  {connectedMode && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                      {connectedMode === "plugin" ? "Plugin method" : "App Password"}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-green-300 text-green-800"
              onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mode selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4" />
            WordPress Integration
          </CardTitle>
          <CardDescription>
            Choose how StackSerp connects to your WordPress site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                id: "app-password" as const,
                title: "Application Password",
                badge: "Recommended",
                badgeColor: "bg-green-50 text-green-700 border-green-200",
                description: "No plugin needed. Works with any WordPress 5.6+ site. Uses built-in Application Passwords.",
              },
              {
                id: "plugin" as const,
                title: "Plugin Method",
                badge: "Download Required",
                badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
                description: "Download and install our free plugin for custom post types, extra fields, and advanced control.",
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  mode === opt.id
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{opt.title}</p>
                  <Badge variant="outline" className={`text-[10px] ${opt.badgeColor}`}>
                    {opt.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* App Password setup */}
      {mode === "app-password" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect via Application Password</CardTitle>
            <CardDescription>
              <a
                href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                How to create an Application Password
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <p className="font-medium">Quick setup:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground text-xs">
                <li>Go to your WordPress admin → Users → Profile</li>
                <li>Scroll to "Application Passwords" section</li>
                <li>Type "StackSerp" and click "Add New Application Password"</li>
                <li>Copy the generated password (shown once)</li>
                <li>Paste it below</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label>WordPress Site URL</Label>
              <Input
                placeholder="https://yoursite.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="your_wp_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>Application Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                )}
                <div>
                  {testResult.success ? (
                    <>Connected to <strong>{testResult.siteName}</strong> as <strong>{testResult.userName}</strong></>
                  ) : (
                    testResult.error
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTest} disabled={isTesting || isSaving}>
                {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test Connection
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isTesting}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & Connect
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plugin method */}
      {mode === "plugin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">StackSerp WordPress Plugin</CardTitle>
            <CardDescription>
              Install our free plugin for advanced WordPress integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl border bg-muted/30">
              <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                <Plug className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">StackSerp Connector Plugin</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Free plugin · Works with all WordPress themes · Supports Yoast SEO, custom post types, and more
                </p>
                <div className="flex gap-2 mt-3">
                  <Button asChild size="sm">
                    <a href="/api/download/plugin" download="stackserp-connector.zip">
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download Plugin (.zip)
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium">Installation steps:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Download the plugin file above</li>
                <li>Go to WordPress Admin → Plugins → Add New → Upload Plugin</li>
                <li>Upload the <code className="bg-muted px-1 rounded text-xs">stackserp-connector.zip</code> file</li>
                <li>Activate the plugin</li>
                <li>Go to Settings → StackSerp and copy your API key</li>
                <li>Come back here and enter your site URL + API key below</li>
              </ol>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Enter Plugin Connection Details</p>
              <div className="space-y-2">
                <Label>WordPress Site URL</Label>
                <Input
                  placeholder="https://yoursite.com"
                  value={pluginSiteUrl}
                  onChange={(e) => setPluginSiteUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Plugin API Key</Label>
                <div className="relative">
                  <Input
                    type={showPluginKey ? "text" : "password"}
                    placeholder="From Settings → StackSerp in your WP admin"
                    value={pluginApiKey}
                    onChange={(e) => setPluginApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPluginKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPluginKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {testResult && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                }`}>
                  {testResult.success
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                  <div>
                    {testResult.success
                      ? <p className="font-medium text-green-800">Plugin connected! Version: {testResult.version ?? "1.0"}</p>
                      : <p className="font-medium text-red-800">{testResult.error || "Connection failed — check your API key"}</p>}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handlePluginTest}
                  disabled={isTesting || !pluginSiteUrl || !pluginApiKey}>
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Test Connection
                </Button>
                <Button onClick={handlePluginSave}
                  disabled={isSaving || !pluginSiteUrl || !pluginApiKey}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Connection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Shopify Settings Component
// ─────────────────────────────────────────────────────
interface ShopifyBlogOption { id: number; title: string; handle: string }

function ShopifySettings({ websiteId }: { websiteId: string }) {
  const [storeUrl, setStoreUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [blogId, setBlogId] = useState("");
  const [blogTitle, setBlogTitle] = useState("");
  const [blogs, setBlogs] = useState<ShopifyBlogOption[]>([]);
  const [loadingBlogs, setLoadingBlogs] = useState(false);

  const [connected, setConnected] = useState(false);
  const [connectedStore, setConnectedStore] = useState("");
  const [connectedBlog, setConnectedBlog] = useState("");

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    shopName?: string;
    shopDomain?: string;
    email?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/websites/${websiteId}/shopify`)
      .then(r => r.json())
      .then((d: { connected?: boolean; storeUrl?: string; blogId?: string; blogTitle?: string }) => {
        if (d.connected) {
          setConnected(true);
          setConnectedStore(d.storeUrl || "");
          setConnectedBlog(d.blogTitle || "");
          setStoreUrl(d.storeUrl || "");
          setBlogId(d.blogId || "");
          setBlogTitle(d.blogTitle || "");
        }
      })
      .catch(() => {});
  }, [websiteId]);

  const handleTest = async () => {
    if (!storeUrl || !accessToken) { toast.error("Enter store URL and access token"); return; }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", storeUrl, accessToken }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(`Connected to ${data.shopName}!`);
        // Auto-fetch blogs after successful test
        handleFetchBlogs();
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch { toast.error("Test failed"); }
    finally { setIsTesting(false); }
  };

  const handleFetchBlogs = async () => {
    if (!storeUrl || !accessToken) return;
    setLoadingBlogs(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-blogs", storeUrl, accessToken }),
      });
      const data = await res.json();
      if (data.blogs?.length) {
        setBlogs(data.blogs);
        if (!blogId) {
          setBlogId(String(data.blogs[0].id));
          setBlogTitle(data.blogs[0].title);
        }
      }
    } catch { /* silent */ }
    finally { setLoadingBlogs(false); }
  };

  const handleSave = async () => {
    if (!storeUrl || !accessToken) { toast.error("Enter store URL and access token"); return; }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeUrl, accessToken, blogId, blogTitle }),
      });
      if (res.ok) {
        setConnected(true);
        setConnectedStore(storeUrl.replace(/^https?:\/\//i, ""));
        setConnectedBlog(blogTitle);
        toast.success("Shopify connected!");
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to save");
      }
    } catch { toast.error("Something went wrong"); }
    finally { setIsSaving(false); }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await fetch(`/api/websites/${websiteId}/shopify`, { method: "DELETE" });
      setConnected(false);
      setConnectedStore(""); setConnectedBlog("");
      setStoreUrl(""); setAccessToken(""); setBlogId(""); setBlogTitle("");
      setBlogs([]); setTestResult(null);
      toast.success("Shopify disconnected");
    } catch { toast.error("Failed to disconnect"); }
    finally { setIsDisconnecting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Connected banner */}
      {connected && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Shopify Connected</p>
                <p className="text-sm text-green-700">
                  {connectedStore}
                  {connectedBlog && <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">Blog: {connectedBlog}</span>}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-green-300 text-green-800"
              onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connection form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" />
            Shopify Integration
          </CardTitle>
          <CardDescription>
            Publish AI-generated posts directly to your Shopify blog
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* How-to info */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How to get your Access Token</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to your Shopify Admin → <strong>Apps → App and sales channel settings</strong></li>
              <li>Click <strong>Develop apps</strong> → <strong>Create an app</strong></li>
              <li>Under <strong>Configuration</strong>, add <strong>write_content, read_content</strong> Admin API scopes</li>
              <li>Click <strong>Install app</strong> → copy the <strong>Admin API access token</strong></li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label>Shopify Store URL</Label>
            <Input
              placeholder="mystore.myshopify.com"
              value={storeUrl}
              onChange={e => setStoreUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Your store&apos;s .myshopify.com domain</p>
          </div>

          <div className="space-y-2">
            <Label>Admin API Access Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
              testResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}>
              {testResult.success
                ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
              <div>
                {testResult.success ? (
                  <>
                    <p className="font-medium text-green-800">{testResult.shopName}</p>
                    <p className="text-green-700 text-xs">{testResult.shopDomain} · {testResult.email}</p>
                  </>
                ) : (
                  <p className="font-medium text-red-800">{testResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Blog selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Target Blog</Label>
              <Button variant="ghost" size="sm" onClick={handleFetchBlogs}
                disabled={loadingBlogs || !storeUrl || !accessToken}
                className="h-7 text-xs">
                {loadingBlogs ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {blogs.length ? "Refresh blogs" : "Fetch blogs"}
              </Button>
            </div>
            {blogs.length > 0 ? (
              <Select value={blogId} onValueChange={id => {
                setBlogId(id);
                const found = blogs.find(b => String(b.id) === id);
                if (found) setBlogTitle(found.title);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a blog" />
                </SelectTrigger>
                <SelectContent>
                  {blogs.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Leave blank to use your first blog automatically"
                value={blogId}
                onChange={e => setBlogId(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Articles will be posted to this Shopify blog. Click &quot;Fetch blogs&quot; after testing to see available options.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={handleTest} disabled={isTesting || !storeUrl || !accessToken}>
              {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !storeUrl || !accessToken}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save & Connect
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
