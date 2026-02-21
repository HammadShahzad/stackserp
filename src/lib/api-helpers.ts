/**
 * Shared API route helpers — website ownership verification & input validation
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

export async function verifyWebsiteAccess(websiteId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // Admin can access any website
  const isAdmin = (session.user as { systemRole?: string }).systemRole === "ADMIN";
  if (isAdmin) {
    const website = await prisma.website.findFirst({
      where: { id: websiteId, status: { not: "DELETED" } },
    });
    if (!website) {
      return { error: NextResponse.json({ error: "Website not found" }, { status: 404 }) };
    }
    return { session, website, organizationId: website.organizationId };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  });

  if (!membership) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organizationId,
      status: { not: "DELETED" },
    },
  });

  if (!website) {
    return { error: NextResponse.json({ error: "Website not found" }, { status: 404 }) };
  }

  return { session, website, organizationId: membership.organizationId };
}

export function requireCronAuth(req: Request): NextResponse | null {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const provided = authHeader?.replace(/^Bearer /, "") ?? "";
  const expected = cronSecret;

  // Constant-time comparison to prevent timing oracle attacks
  let authorized = false;
  try {
    authorized =
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    authorized = false;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function validateEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const RATE_STORE = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = RATE_STORE.get(identifier);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    RATE_STORE.set(identifier, bucket);
  }

  bucket.count++;

  if (bucket.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - bucket.count };
}

/** 10 requests per minute per identifier (auth/IP rate limiting). */
export function checkIpRateLimit(identifier: string) {
  return checkRateLimit(identifier, 10, 60_000);
}

/**
 * Per-user AI endpoint rate limiting.
 * @param userId   Session user ID
 * @param endpoint Short label to namespace (e.g. "ai-rewrite", "clusters")
 * @param max      Max requests allowed in the window (default 20)
 * @param windowMs Window in milliseconds (default 1 hour)
 */
export function checkAiRateLimit(
  userId: string,
  endpoint: string,
  max = 20,
  windowMs = 60 * 60_000
): NextResponse | null {
  const result = checkRateLimit(`ai:${endpoint}:${userId}`, max, windowMs);
  if (!result.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Max ${max} requests per hour for this feature.` },
      { status: 429 }
    );
  }
  return null;
}
