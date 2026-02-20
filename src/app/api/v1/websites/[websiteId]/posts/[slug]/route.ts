/**
 * Public API v1 — Single Post
 * GET    /api/v1/websites/:id/posts/:slug → Get post by slug (includes full content)
 * PATCH  /api/v1/websites/:id/posts/:slug → Update post
 * DELETE /api/v1/websites/:id/posts/:slug → Delete post
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";

type Params = { params: Promise<{ websiteId: string; slug: string }> };

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
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const { websiteId, slug } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId))) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const post = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId, slug } },
  });

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.ctx, "posts:write")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const { websiteId, slug } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId))) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const existing = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId, slug } },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const body = await req.json();
  const allowed = [
    "title", "content", "excerpt", "metaTitle", "metaDescription",
    "focusKeyword", "secondaryKeywords", "featuredImage", "featuredImageAlt",
    "tags", "category", "status", "scheduledAt",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  if (body.content) {
    const wc = body.content.split(/\s+/).filter(Boolean).length;
    data.wordCount = wc;
    data.readingTime = Math.ceil(wc / 200);
  }
  if (body.status === "PUBLISHED") data.publishedAt = new Date();

  const post = await prisma.blogPost.update({ where: { id: existing.id }, data });
  return NextResponse.json(post);
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.ctx, "posts:write")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const { websiteId, slug } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId))) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const existing = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId, slug } },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  await prisma.blogPost.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
