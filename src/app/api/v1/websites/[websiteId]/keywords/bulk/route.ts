/**
 * Public API v1 — Bulk Keyword Operations
 * POST /api/v1/websites/:websiteId/keywords/bulk → Add keywords with priority/notes
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

interface BulkKeywordInput {
  keyword: string;
  priority?: number;
  notes?: string;
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

  if (!Array.isArray(body.keywords) || body.keywords.length === 0)
    return NextResponse.json(
      { error: "Provide a non-empty keywords array" },
      { status: 400 }
    );

  const valid: BulkKeywordInput[] = body.keywords.filter(
    (k: unknown): k is BulkKeywordInput =>
      typeof k === "object" &&
      k !== null &&
      typeof (k as BulkKeywordInput).keyword === "string" &&
      (k as BulkKeywordInput).keyword.trim().length > 0
  );

  if (valid.length === 0)
    return NextResponse.json(
      { error: "No valid keyword objects provided" },
      { status: 400 }
    );

  const results = await Promise.all(
    valid.map((item) =>
      prisma.blogKeyword.create({
        data: {
          keyword: item.keyword.trim(),
          websiteId,
          status: "PENDING",
          priority: item.priority ?? 0,
          notes: item.notes ?? null,
        },
        select: {
          id: true,
          keyword: true,
          priority: true,
          notes: true,
          status: true,
          createdAt: true,
        },
      })
    )
  );

  return NextResponse.json(
    { data: { added: results.length, keywords: results } },
    { status: 201 }
  );
}
