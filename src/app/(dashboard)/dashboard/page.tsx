import { getCurrentOrganization } from "@/lib/get-session";
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
  Globe,
  FileText,
  KeyRound,
  TrendingUp,
  Plus,
  ArrowRight,
  Bot,
  Eye,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardOverview() {
  const { organization } = await getCurrentOrganization();

  // Aggregate stats across all websites
  const websiteIds = organization.websites.map((w) => w.id);

  const [totalPosts, publishedPosts, draftPosts, pendingKeywords, totalViews] =
    await Promise.all([
      prisma.blogPost.count({
        where: { websiteId: { in: websiteIds } },
      }),
      prisma.blogPost.count({
        where: { websiteId: { in: websiteIds }, status: "PUBLISHED" },
      }),
      prisma.blogPost.count({
        where: { websiteId: { in: websiteIds }, status: "DRAFT" },
      }),
      prisma.blogKeyword.count({
        where: { websiteId: { in: websiteIds }, status: "PENDING" },
      }),
      prisma.blogPost.aggregate({
        where: { websiteId: { in: websiteIds } },
        _sum: { views: true },
      }),
    ]);

  const stats = [
    {
      title: "Total Websites",
      value: organization.websites.length,
      icon: Globe,
      description: "Active websites",
      href: "/dashboard/websites",
    },
    {
      title: "Published Posts",
      value: publishedPosts,
      icon: FileText,
      description: `${draftPosts} drafts`,
      href: "/dashboard/websites",
    },
    {
      title: "Pending Keywords",
      value: pendingKeywords,
      icon: KeyRound,
      description: "In generation queue",
      href: "/dashboard/websites",
    },
    {
      title: "Total Views",
      value: totalViews._sum.views || 0,
      icon: Eye,
      description: "All time",
      href: "/dashboard/websites",
    },
  ];

  const subscription = organization.subscription;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back
        </h2>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your content marketing across all websites.
        </p>
      </div>

      {/* Subscription Banner */}
      {subscription && subscription.plan === "FREE" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">
                  You&apos;re on the Free plan
                </p>
                <p className="text-sm text-muted-foreground">
                  {subscription.postsGeneratedThisMonth}/{subscription.maxPostsPerMonth} posts used this month.
                  Upgrade for more.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/billing">Upgrade Plan</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      {organization.websites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Add your first website
            </h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Get started by adding a website. We&apos;ll help you create
              AI-powered SEO content, generate images, and publish to your blog.
            </p>
            <Button asChild size="lg">
              <Link href="/dashboard/websites/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Website
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* All Websites */}
          {organization.websites.map((website) => (
            <Card key={website.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{website.name}</CardTitle>
                  <Badge
                    variant={website.status === "ACTIVE" ? "default" : "secondary"}
                  >
                    {website.status.toLowerCase()}
                  </Badge>
                </div>
                <CardDescription>{website.domain}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {website.niche}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/websites/${website.id}`}>
                      View
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add New Website Card */}
          <Card className="border-dashed hover:shadow-md transition-shadow">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium mb-1">Add Website</p>
              <p className="text-xs text-muted-foreground mb-4">
                Connect another website
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/websites/new">Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
