/**
 * Public API v1 — Topic Clusters
 * GET  /api/v1/websites/:websiteId/clusters → List topic clusters
 * POST /api/v1/websites/:websiteId/clusters → Create a topic cluster
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

  if (!hasScope(auth.ctx, "clusters:read"))
    return NextResponse.json(
      { error: "Insufficient scope: clusters:read required" },
      { status: 403 }
    );

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const clusters = await prisma.topicCluster.findMany({
    where: { websiteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      pillarKeyword: true,
      pillarPostId: true,
      supportingKeywords: true,
      status: true,
      totalPosts: true,
      publishedPosts: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    data: clusters,
    meta: { total: clusters.length },
  });
}

export async function POST(req: Request, { params }: Params) {
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

  if (!hasScope(auth.ctx, "clusters:write"))
    return NextResponse.json(
      { error: "Insufficient scope: clusters:write required" },
      { status: 403 }
    );

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const body = await req.json();

  if (!body.name || !body.pillarKeyword)
    return NextResponse.json(
      { error: "name and pillarKeyword are required" },
      { status: 400 }
    );

  const supportingKeywords = Array.isArray(body.supportingKeywords)
    ? body.supportingKeywords
    : [];

  const cluster = await prisma.topicCluster.create({
    data: {
      name: body.name,
      pillarKeyword: body.pillarKeyword,
      supportingKeywords,
      websiteId,
      totalPosts: 1 + supportingKeywords.length,
      status: "PLANNING",
    },
    select: {
      id: true,
      name: true,
      pillarKeyword: true,
      supportingKeywords: true,
      status: true,
      totalPosts: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: cluster }, { status: 201 });
}
