/**
 * Public API v1 — Website Analytics
 * GET /api/v1/websites/:websiteId/analytics → Aggregated analytics
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ websiteId: string }> };

async function verifyWebsiteAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: { include: { websites: { select: { id: true } } } },
    },
  });
  return (
    membership?.organization.websites.some((w) => w.id === websiteId) ?? false
  );
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rateCheck = checkRateLimit(auth.ctx.keyId);
  if (!rateCheck.allowed)
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateCheck.resetAt.toISOString(),
        },
      }
    );

  if (!hasScope(auth.ctx, "analytics:read"))
    return NextResponse.json(
      { error: "Insufficient scope: analytics:read required" },
      { status: 403 }
    );

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(toParam) : now;

  // Aggregate analytics data from the BlogAnalytics table
  const analyticsRows = await prisma.blogAnalytics.findMany({
    where: {
      websiteId,
      date: { gte: from, lte: to },
    },
  });

  const aggregated = analyticsRows.reduce(
    (acc, row) => ({
      pageViews: acc.pageViews + row.pageViews,
      uniqueVisitors: acc.uniqueVisitors + row.uniqueVisitors,
      organicTraffic: acc.organicTraffic + row.organicTraffic,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      socialShares: acc.socialShares + row.socialShares,
    }),
    {
      pageViews: 0,
      uniqueVisitors: 0,
      organicTraffic: 0,
      impressions: 0,
      clicks: 0,
      socialShares: 0,
    }
  );

  // Post counts
  const [totalPosts, publishedPosts] = await Promise.all([
    prisma.blogPost.count({ where: { websiteId } }),
    prisma.blogPost.count({ where: { websiteId, status: "PUBLISHED" } }),
  ]);

  // Total views across all posts
  const viewsAgg = await prisma.blogPost.aggregate({
    where: { websiteId },
    _sum: { views: true },
  });

  // Top posts by views
  const topPosts = await prisma.blogPost.findMany({
    where: { websiteId, status: "PUBLISHED" },
    orderBy: { views: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      slug: true,
      views: true,
      publishedAt: true,
      contentScore: true,
    },
  });

  return NextResponse.json({
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      posts: {
        total: totalPosts,
        published: publishedPosts,
        totalViews: viewsAgg._sum.views ?? 0,
      },
      traffic: aggregated,
      topPosts,
    },
  });
}
