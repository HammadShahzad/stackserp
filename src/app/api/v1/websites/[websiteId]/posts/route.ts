/**
 * Public API v1 — Blog Posts
 * GET  /api/v1/websites/:id/posts       → List published posts (paginated)
 * POST /api/v1/websites/:id/posts       → Create a manual post
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";

type Params = { params: Promise<{ websiteId: string }> };

async function verifyWebsiteAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: { select: { id: true } } } } },
  });
  return membership?.organization.websites.some((w) => w.id === websiteId) ?? false;
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.ctx, "posts:read")) {
    return NextResponse.json({ error: "Insufficient scope: posts:read required" }, { status: 403 });
  }

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId))) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const status = url.searchParams.get("status") || "PUBLISHED";

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: { websiteId, status: status as never },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, slug: true, excerpt: true,
        metaTitle: true, metaDescription: true, focusKeyword: true,
        featuredImage: true, featuredImageAlt: true,
        status: true, publishedAt: true, updatedAt: true,
        wordCount: true, readingTime: true, category: true, tags: true,
      },
    }),
    prisma.blogPost.count({ where: { websiteId, status: status as never } }),
  ]);

  return NextResponse.json({
    posts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.ctx, "posts:write")) {
    return NextResponse.json({ error: "Insufficient scope: posts:write required" }, { status: 403 });
  }

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId))) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const body = await req.json();
  if (!body.title || !body.slug || !body.content) {
    return NextResponse.json({ error: "title, slug, and content are required" }, { status: 400 });
  }

  const post = await prisma.blogPost.create({
    data: {
      websiteId,
      title: body.title,
      slug: body.slug,
      content: body.content,
      excerpt: body.excerpt || null,
      metaTitle: body.metaTitle || null,
      metaDescription: body.metaDescription || null,
      focusKeyword: body.focusKeyword || null,
      secondaryKeywords: body.secondaryKeywords || [],
      featuredImage: body.featuredImage || null,
      featuredImageAlt: body.featuredImageAlt || null,
      tags: body.tags || [],
      category: body.category || null,
      status: body.status || "DRAFT",
      generatedBy: "manual",
      wordCount: body.content.split(/\s+/).filter(Boolean).length,
      readingTime: Math.ceil(body.content.split(/\s+/).filter(Boolean).length / 200),
    },
  });

  return NextResponse.json(post, { status: 201 });
}
