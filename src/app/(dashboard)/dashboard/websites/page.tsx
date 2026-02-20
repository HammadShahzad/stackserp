import { getCurrentOrganization } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Plus,
  ArrowRight,
  FileText,
  KeyRound,
  Eye,
  Bot,
  Settings,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export default async function WebsitesPage() {
  const { organization } = await getCurrentOrganization();

  const websitesWithStats = await Promise.all(
    organization.websites.map(async (website) => {
      const [publishedCount, draftCount, pendingKeywords, totalViews, activeJobs] =
        await Promise.all([
          prisma.blogPost.count({
            where: { websiteId: website.id, status: "PUBLISHED" },
          }),
          prisma.blogPost.count({
            where: { websiteId: website.id, status: "DRAFT" },
          }),
          prisma.blogKeyword.count({
            where: { websiteId: website.id, status: "PENDING" },
          }),
          prisma.blogPost.aggregate({
            where: { websiteId: website.id },
            _sum: { views: true },
          }),
          prisma.generationJob.count({
            where: {
              websiteId: website.id,
              status: { in: ["QUEUED", "PROCESSING"] },
            },
          }),
        ]);

      return {
        ...website,
        publishedCount,
        draftCount,
        pendingKeywords,
        totalViews: totalViews._sum.views || 0,
        activeJobs,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Websites</h2>
          <p className="text-muted-foreground mt-1">
            Manage your websites and AI content generation.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/websites/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Website
          </Link>
        </Button>
      </div>

      {websitesWithStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center">
          <div className="rounded-full bg-primary/10 p-5 mb-4">
            <Globe className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No websites yet</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            Add your first website to start generating AI-powered SEO content
            automatically.
          </p>
          <Button asChild size="lg">
            <Link href="/dashboard/websites/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Website
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {websitesWithStats.map((website) => {
            const color = website.primaryColor || "#4F46E5";
            return (
              <div
                key={website.id}
                className="group relative rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col"
              >
                {/* Color accent bar */}
                <div
                  className="h-1 w-full"
                  style={{ backgroundColor: color }}
                />

                {/* Card body */}
                <div className="p-5 flex flex-col flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {website.faviconUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={website.faviconUrl}
                          alt={website.name}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm"
                        />
                      ) : (
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white text-base font-bold shadow-sm"
                          style={{ backgroundColor: color }}
                        >
                          {website.name[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base truncate">
                          {website.name}
                        </h3>
                        <a
                          href={`https://${website.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                        >
                          {website.domain}
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {website.activeJobs > 0 && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 gap-1 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                          Generating
                        </Badge>
                      )}
                      <Badge
                        variant={website.status === "ACTIVE" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {website.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Niche tag */}
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-1 bg-muted/50 px-2 py-1 rounded-md">
                    {website.niche}
                  </p>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      {
                        icon: FileText,
                        value: website.publishedCount,
                        label: "Published",
                        color: "text-green-600",
                        bg: "bg-green-50",
                      },
                      {
                        icon: KeyRound,
                        value: website.pendingKeywords,
                        label: "Keywords",
                        color: "text-blue-600",
                        bg: "bg-blue-50",
                      },
                      {
                        icon: Eye,
                        value: website.totalViews,
                        label: "Views",
                        color: "text-purple-600",
                        bg: "bg-purple-50",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className={`flex flex-col items-center justify-center rounded-xl p-2.5 ${stat.bg}`}
                      >
                        <stat.icon className={`h-3.5 w-3.5 mb-1 ${stat.color}`} />
                        <span className="text-base font-bold">{stat.value}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {stat.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-auto space-y-2">
                    <Link
                      href={`/dashboard/websites/${website.id}`}
                      className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: color }}
                    >
                      Open Dashboard
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Link
                        href={`/dashboard/websites/${website.id}/generator`}
                        className="flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Generate
                      </Link>
                      <Link
                        href={`/dashboard/websites/${website.id}/posts`}
                        className="flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Posts
                        {website.draftCount > 0 && (
                          <span className="text-[9px] text-amber-600 font-medium">
                            {website.draftCount} draft{website.draftCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </Link>
                      <Link
                        href={`/dashboard/websites/${website.id}/analytics`}
                        className="flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Analytics
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Website */}
          <Link
            href="/dashboard/websites/new"
            className="group relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center min-h-[280px] p-8 text-center hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
          >
            <div className="rounded-full border-2 border-dashed border-muted-foreground/30 p-4 mb-3 group-hover:border-primary/40 transition-colors">
              <Plus className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
              Add Website
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              AI analyzes and sets up automatically
            </p>
          </Link>
        </div>
      )}

      {/* Summary bar */}
      {websitesWithStats.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
          <span>
            {websitesWithStats.length} website{websitesWithStats.length !== 1 ? "s" : ""} ·{" "}
            {websitesWithStats.reduce((a, w) => a + w.publishedCount, 0)} posts published ·{" "}
            {websitesWithStats.reduce((a, w) => a + w.totalViews, 0).toLocaleString()} total views
          </span>
          <Link
            href="/dashboard/websites/new"
            className="flex items-center gap-1 text-primary hover:underline text-xs"
          >
            <Plus className="h-3 w-3" />
            Add another
          </Link>
        </div>
      )}
    </div>
  );
}
