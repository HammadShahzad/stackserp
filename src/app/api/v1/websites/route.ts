/**
 * Public API v1 — Websites
 * GET /api/v1/websites → List websites the authenticated user has access to
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
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

  if (!hasScope(auth.ctx, "websites:read"))
    return NextResponse.json(
      { error: "Insufficient scope: websites:read required" },
      { status: 403 }
    );

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: auth.ctx.userId },
    select: { organizationId: true },
  });

  const orgIds = memberships.map((m) => m.organizationId);

  const websites = await prisma.website.findMany({
    where: { organizationId: { in: orgIds } },
    select: {
      id: true,
      name: true,
      domain: true,
      subdomain: true,
      customDomain: true,
      niche: true,
      brandName: true,
      brandUrl: true,
      status: true,
      hostingMode: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: websites,
    meta: { total: websites.length },
  });
}
