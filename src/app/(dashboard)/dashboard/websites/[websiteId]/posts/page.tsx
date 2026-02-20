import { getWebsite } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import Link from "next/link";
import { PostsTable } from "./posts-table";

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  REVIEW: "outline",
  SCHEDULED: "outline",
  ARCHIVED: "secondary",
};

export default async function PostsPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const { website } = await getWebsite(websiteId);

  const posts = await prisma.blogPost.findMany({
    where: { websiteId },
    orderBy: { createdAt: "desc" },
    include: {
      keyword: true,
    },
  });

  const statusCounts = {
    all: posts.length,
    published: posts.filter((p) => p.status === "PUBLISHED").length,
    draft: posts.filter((p) => p.status === "DRAFT").length,
    review: posts.filter((p) => p.status === "REVIEW").length,
    scheduled: posts.filter((p) => p.status === "SCHEDULED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Blog Posts</h2>
          <p className="text-muted-foreground">
            Manage blog content for {website.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/websites/${websiteId}/generator`}>
              AI Generate
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/websites/${websiteId}/posts/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Post
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Filter Badges */}
      <div className="flex items-center gap-2">
        <Badge variant="default">All ({statusCounts.all})</Badge>
        <Badge variant="outline">Published ({statusCounts.published})</Badge>
        <Badge variant="outline">Drafts ({statusCounts.draft})</Badge>
        <Badge variant="outline">Review ({statusCounts.review})</Badge>
        <Badge variant="outline">Scheduled ({statusCounts.scheduled})</Badge>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Generate your first blog post using AI or create one manually.
            </p>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link href={`/dashboard/websites/${websiteId}/generator`}>
                  Generate with AI
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/dashboard/websites/${websiteId}/posts/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Manually
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <PostsTable
              posts={posts.map(p => ({
                id: p.id,
                title: p.title,
                slug: p.slug,
                status: p.status,
                focusKeyword: p.focusKeyword,
                views: p.views,
                contentScore: p.contentScore,
                createdAt: p.createdAt,
              }))}
              websiteId={websiteId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
