/**
 * Public API v1 — Trigger Generation
 * POST /api/v1/websites/:websiteId/generate → Start generation for a keyword
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkGenerationLimit,
  enqueueGenerationJob,
  processJob,
} from "@/lib/job-queue";

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

  if (!hasScope(auth.ctx, "generate:write"))
    return NextResponse.json(
      { error: "Insufficient scope: generate:write required" },
      { status: 403 }
    );

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  // Check subscription limits
  const limitCheck = await checkGenerationLimit(websiteId);
  if (!limitCheck.allowed)
    return NextResponse.json(
      { error: limitCheck.reason, remaining: limitCheck.remaining },
      { status: 403 }
    );

  const body = await req.json().catch(() => ({}));

  let keyword;

  if (body.keywordId) {
    // Generate for a specific keyword
    keyword = await prisma.blogKeyword.findFirst({
      where: { id: body.keywordId, websiteId, status: "PENDING" },
    });
    if (!keyword)
      return NextResponse.json(
        { error: "Keyword not found or not in PENDING status" },
        { status: 404 }
      );
  } else {
    // Pick the next pending keyword by priority
    keyword = await prisma.blogKeyword.findFirst({
      where: { websiteId, status: "PENDING" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    if (!keyword)
      return NextResponse.json(
        { error: "No pending keywords available for generation" },
        { status: 404 }
      );
  }

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: { blogSettings: true },
  });

  const jobId = await enqueueGenerationJob({
    keywordId: keyword.id,
    keyword: keyword.keyword,
    websiteId,
    contentLength: website?.blogSettings?.contentLength ?? "MEDIUM",
    includeImages: website?.blogSettings?.includeImages ?? true,
    includeFAQ: website?.blogSettings?.includeFAQ ?? true,
    autoPublish: website?.autoPublish ?? false,
  });

  // Fire-and-forget: process the job asynchronously
  processJob(jobId).catch(console.error);

  return NextResponse.json(
    {
      data: {
        jobId,
        keywordId: keyword.id,
        keyword: keyword.keyword,
        status: "QUEUED",
      },
      meta: { remaining: limitCheck.remaining },
    },
    { status: 202 }
  );
}
