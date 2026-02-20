/**
 * Public API v1 — Keywords Management
 * GET  /api/v1/websites/:websiteId/keywords → List keywords (paginated, filterable)
 * POST /api/v1/websites/:websiteId/keywords → Add keyword(s)
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

  if (!hasScope(auth.ctx, "keywords:read"))
    return NextResponse.json(
      { error: "Insufficient scope: keywords:read required" },
      { status: 403 }
    );

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "50"))
  );
  const statusFilter = url.searchParams.get("status");

  const where: Record<string, unknown> = { websiteId };
  if (statusFilter) where.status = statusFilter;

  const [keywords, total] = await Promise.all([
    prisma.blogKeyword.findMany({
      where: where as never,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        keyword: true,
        status: true,
        priority: true,
        searchVolume: true,
        difficulty: true,
        intent: true,
        parentCluster: true,
        notes: true,
        errorMessage: true,
        retryCount: true,
        blogPostId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.blogKeyword.count({ where: where as never }),
  ]);

  return NextResponse.json({
    data: keywords,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
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

  if (!hasScope(auth.ctx, "keywords:write"))
    return NextResponse.json(
      { error: "Insufficient scope: keywords:write required" },
      { status: 403 }
    );

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const body = await req.json();

  // Accept { keyword: string } or { keywords: string[] }
  let keywordList: string[];
  if (Array.isArray(body.keywords)) {
    keywordList = body.keywords.filter(
      (k: unknown) => typeof k === "string" && k.trim()
    );
  } else if (typeof body.keyword === "string" && body.keyword.trim()) {
    keywordList = [body.keyword.trim()];
  } else {
    return NextResponse.json(
      { error: 'Provide "keyword" (string) or "keywords" (string[])' },
      { status: 400 }
    );
  }

  if (keywordList.length === 0)
    return NextResponse.json(
      { error: "No valid keywords provided" },
      { status: 400 }
    );

  const created = await prisma.blogKeyword.createMany({
    data: keywordList.map((kw) => ({
      keyword: kw.trim(),
      websiteId,
      status: "PENDING" as const,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json(
    { data: { added: created.count, keywords: keywordList } },
    { status: 201 }
  );
}
