import { getWebsite } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  KeyRound,
  Eye,
  Bot,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Brain,
} from "lucide-react";
import Link from "next/link";
import { ActiveJobsBanner } from "@/components/dashboard/active-jobs-banner";

export default async function WebsiteDashboard({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const { website } = await getWebsite(websiteId);

  const [
    totalPosts,
    publishedPosts,
    draftPosts,
    scheduledPosts,
    pendingKeywords,
    generatingKeywords,
    totalViews,
    recentPosts,
    activeJobs,
  ] = await Promise.all([
    prisma.blogPost.count({ where: { websiteId } }),
    prisma.blogPost.count({ where: { websiteId, status: "PUBLISHED" } }),
    prisma.blogPost.count({ where: { websiteId, status: "DRAFT" } }),
    prisma.blogPost.count({ where: { websiteId, status: "SCHEDULED" } }),
    prisma.blogKeyword.count({ where: { websiteId, status: "PENDING" } }),
    prisma.blogKeyword.count({ where: { websiteId, status: "GENERATING" } }),
    prisma.blogPost.aggregate({
      where: { websiteId },
      _sum: { views: true },
    }),
    prisma.blogPost.findMany({
      where: { websiteId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.generationJob.count({
      where: { websiteId, status: { in: ["QUEUED", "PROCESSING"] } },
    }),
  ]);

  const stats = [
    {
      title: "Published",
      value: publishedPosts,
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      title: "Drafts",
      value: draftPosts,
      icon: FileText,
      color: "text-yellow-600",
    },
    {
      title: "Queued Keywords",
      value: pendingKeywords,
      icon: KeyRound,
      color: "text-blue-600",
    },
    {
      title: "Total Views",
      value: totalViews._sum.views || 0,
      icon: Eye,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Website Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold"
              style={{ backgroundColor: website.primaryColor || "#4F46E5" }}
            >
              {website.name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{website.name}</h2>
              <p className="text-muted-foreground">{website.domain}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={website.status === "ACTIVE" ? "default" : "secondary"}>
            {website.status.toLowerCase()}
          </Badge>
          {website.brandUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={website.brandUrl} target="_blank" rel="noopener noreferrer">
                Visit Site ↗
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/websites/${websiteId}/settings`}>
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Active Jobs Banner — live polling */}
      {(activeJobs > 0 || generatingKeywords > 0) && (
        <ActiveJobsBanner
          websiteId={websiteId}
          initialJobCount={activeJobs + generatingKeywords}
        />
      )}

      {/* Brand Intelligence completion prompt */}
      {!(website as Record<string, unknown>).uniqueValueProp && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Supercharge your AI content</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Add your USP, competitors, key products, and target market — AI articles will be dramatically more targeted and unique.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/dashboard/websites/${websiteId}/settings?tab=brand`}>
              <Brain className="mr-1.5 h-3.5 w-3.5" />
              Complete Profile
            </Link>
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Bot className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Generate Content</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use AI to generate blog posts from your keyword queue
            </p>
            <Button asChild className="w-full">
              <Link href={`/dashboard/websites/${websiteId}/generator`}>
                Open Generator
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <KeyRound className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Add Keywords</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add target keywords to your content generation queue
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/dashboard/websites/${websiteId}/keywords`}>
                Manage Keywords
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <FileText className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Write Manually</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a new blog post manually with the editor
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/dashboard/websites/${websiteId}/posts?new=true`}>
                Create Post
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Posts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>Latest blog posts for this website</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/websites/${websiteId}/posts`}>
              View All
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No posts yet. Generate your first post!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          post.status === "PUBLISHED"
                            ? "default"
                            : post.status === "DRAFT"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {post.status.toLowerCase()}
                      </Badge>
                      {post.focusKeyword && (
                        <span className="text-xs text-muted-foreground">
                          {post.focusKeyword}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.views}
                      </span>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/websites/${websiteId}/posts`}>
                      Edit
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
