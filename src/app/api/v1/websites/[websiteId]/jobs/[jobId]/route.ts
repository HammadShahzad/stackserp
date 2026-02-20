/**
 * Public API v1 — Job Status
 * GET /api/v1/websites/:websiteId/jobs/:jobId → Get generation job status
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ websiteId: string; jobId: string }> };

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

  if (!hasScope(auth.ctx, "generate:read"))
    return NextResponse.json(
      { error: "Insufficient scope: generate:read required" },
      { status: 403 }
    );

  const { websiteId, jobId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId)))
    return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, websiteId },
    select: {
      id: true,
      type: true,
      status: true,
      currentStep: true,
      progress: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      blogPostId: true,
      output: true,
    },
  });

  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ data: job });
}
