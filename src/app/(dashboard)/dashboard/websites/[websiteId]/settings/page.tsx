"use client";

import { useState, useEffect } from "react";
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
  Loader2, Save, Globe, Palette, Bot, Share2, Code, AlertTriangle,
  CheckCircle2, XCircle, Download, Eye, EyeOff, ExternalLink, Plug,
  Webhook, Zap, Twitter, Linkedin, ShoppingBag, ChevronDown,
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
  hostingMode: string;
  googleAnalyticsId: string | null;
  gscPropertyUrl: string | null;
  indexNowKey: string | null;
  twitterApiKey: string | null;
  linkedinAccessToken: string | null;
}

export default function WebsiteSettingsPage() {
  const params = useParams();
  const websiteId = params.websiteId as string;
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchWebsite();
  }, [websiteId]);

  const fetchWebsite = async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}`);
      if (res.ok) {
        setWebsite(await res.json());
      }
    } catch {
      toast.error("Failed to load website settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(website),
      });
      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string | boolean | number) => {
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
          <h2 className="text-2xl font-bold">Website Settings</h2>
          <p className="text-muted-foreground">
            Configure {website.name}
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">
            <Globe className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="brand">
            <Palette className="mr-2 h-4 w-4" />
            Brand
          </TabsTrigger>
          <TabsTrigger value="content">
            <Bot className="mr-2 h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="wordpress">
            <Plug className="mr-2 h-4 w-4" />
            WordPress
          </TabsTrigger>
          <TabsTrigger value="ghost">
            <Zap className="mr-2 h-4 w-4" />
            Other CMS
          </TabsTrigger>
          <TabsTrigger value="shopify">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Shopify
          </TabsTrigger>
          <TabsTrigger value="publishing">
            <Share2 className="mr-2 h-4 w-4" />
            Social
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Code className="mr-2 h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
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
              <div className="space-y-2">
                <Label>Niche / Industry</Label>
                <Input
                  value={website.niche}
                  onChange={(e) => updateField("niche", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={website.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Textarea
                  value={website.targetAudience}
                  onChange={(e) => updateField("targetAudience", e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brand" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand Identity</CardTitle>
              <CardDescription>
                Used by AI to match your brand voice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand Name</Label>
                  <Input
                    value={website.brandName}
                    onChange={(e) => updateField("brandName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brand URL</Label>
                  <Input
                    value={website.brandUrl}
                    onChange={(e) => updateField("brandUrl", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Writing Tone</Label>
                <Input
                  value={website.tone}
                  onChange={(e) => updateField("tone", e.target.value)}
                />
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Settings</CardTitle>
              <CardDescription>
                Configure AI content generation preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Publish</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically publish posts after generation
                  </p>
                </div>
                <Switch
                  checked={website.autoPublish}
                  onCheckedChange={(v) => updateField("autoPublish", v)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Posts Per Week</Label>
                <Select
                  value={String(website.postsPerWeek)}
                  onValueChange={(v) => updateField("postsPerWeek", parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 7, 10, 14].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} post{n !== 1 ? "s" : ""}/week
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Publish Time (UTC)</Label>
                <Input
                  type="time"
                  value={website.publishTime || "09:00"}
                  onChange={(e) => updateField("publishTime", e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="space-y-2">
                <Label>Hosting Mode</Label>
                <Select
                  value={website.hostingMode}
                  onValueChange={(v) => updateField("hostingMode", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="API">API (You fetch via REST API)</SelectItem>
                    <SelectItem value="WEBHOOK">Webhook (Push to your CMS)</SelectItem>
                    <SelectItem value="WORDPRESS">WordPress (Plugin or App Password)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wordpress" className="space-y-4 mt-4">
          <WordPressSettings websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="ghost" className="space-y-4 mt-4">
          <GhostSettings websiteId={websiteId} />
          <WebhookSettings websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="shopify" className="space-y-4 mt-4">
          <ShopifySettings websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="publishing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                Twitter / X
              </CardTitle>
              <CardDescription>
                Auto-post a thread when a new article is published
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Twitter API Key"
                  value={website.twitterApiKey || ""}
                  onChange={(e) => updateField("twitterApiKey", e.target.value)}
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                Requires a Twitter Developer account with Read & Write permissions.{" "}
                <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Get API keys →
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </CardTitle>
              <CardDescription>
                Share posts to your LinkedIn company page automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>LinkedIn Access Token</Label>
                <Input
                  type="password"
                  placeholder="LinkedIn OAuth access token"
                  value={website.linkedinAccessToken || ""}
                  onChange={(e) => updateField("linkedinAccessToken", e.target.value)}
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                Requires a LinkedIn app with <code className="bg-muted px-1 rounded">w_member_social</code> scope.{" "}
                <a href="https://www.linkedin.com/developers/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  LinkedIn Developers →
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics &amp; Search</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Google Analytics Measurement ID</Label>
                <Input
                  placeholder="G-XXXXXXXXXX"
                  value={website.googleAnalyticsId || ""}
                  onChange={(e) => updateField("googleAnalyticsId", e.target.value)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Google Search Console Property URL</Label>
                <Input
                  placeholder="https://yourdomain.com"
                  value={website.gscPropertyUrl || ""}
                  onChange={(e) => updateField("gscPropertyUrl", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your site property URL as registered in Google Search Console
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  IndexNow API Key
                </Label>
                <Input
                  placeholder="e.g. a1b2c3d4e5f6..."
                  value={website.indexNowKey || ""}
                  onChange={(e) => updateField("indexNowKey", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Submit published posts to Google &amp; Bing instantly.{" "}
                  <a href="https://www.indexnow.org/faq" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Learn more →
                  </a>
                </p>
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
                  <p className="text-sm text-muted-foreground">
                    Stop all content generation for this website
                  </p>
                </div>
                <Button variant="outline">Pause</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Delete Website</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this website and all its content
                  </p>
                </div>
                <Button variant="destructive">Delete</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
