import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { runPublishHook } from "@/lib/on-publish";
import { calculateContentScore } from "@/lib/seo-scorer";

async function verifyAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: true } } },
  });
  return membership?.organization.websites.find((w) => w.id === websiteId) || null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ websiteId: string; postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { websiteId, postId } = await params;
    if (!await verifyAccess(websiteId, session.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const post = await prisma.blogPost.findFirst({ where: { id: postId, websiteId } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json(post);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ websiteId: string; postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { websiteId, postId } = await params;
    if (!await verifyAccess(websiteId, session.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const allowedFields = [
      "title", "content", "excerpt", "metaTitle", "metaDescription",
      "focusKeyword", "secondaryKeywords", "featuredImage", "featuredImageAlt",
      "tags", "category", "status", "scheduledAt",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updateData[field] = body[field];
    }

    // Auto-set publishedAt when publishing
    if (body.status === "PUBLISHED") {
      updateData.publishedAt = new Date();
    }

    // Recalculate word count if content changed
    if (body.content) {
      const wc = body.content.split(/\s+/).filter(Boolean).length;
      updateData.wordCount = wc;
      updateData.readingTime = Math.ceil(wc / 200);
    }

    // Recalculate SEO content score when relevant fields change
    if (body.content || body.title || body.metaTitle || body.metaDescription || body.focusKeyword || body.featuredImage) {
      const current = await prisma.blogPost.findUnique({
        where: { id: postId },
        select: { title: true, content: true, metaTitle: true, metaDescription: true, focusKeyword: true, featuredImage: true, featuredImageAlt: true },
      });
      if (current) {
        const { score } = calculateContentScore({
          content: (body.content as string) || current.content,
          title: (body.title as string) || current.title,
          metaTitle: (body.metaTitle as string) ?? current.metaTitle,
          metaDescription: (body.metaDescription as string) ?? current.metaDescription,
          focusKeyword: (body.focusKeyword as string) ?? current.focusKeyword,
          featuredImage: (body.featuredImage as string) ?? current.featuredImage,
          featuredImageAlt: (body.featuredImageAlt as string) ?? current.featuredImageAlt,
        });
        updateData.contentScore = score;
      }
    }

    const wasPublished = (await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { status: true },
    }))?.status !== "PUBLISHED";

    const post = await prisma.blogPost.update({
      where: { id: postId, websiteId },
      data: updateData,
    });

    // Fire publish hook when transitioning to PUBLISHED
    if (body.status === "PUBLISHED" && wasPublished) {
      runPublishHook({ postId, websiteId, triggeredBy: "manual" }).catch(console.error);
    }

    return NextResponse.json(post);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ websiteId: string; postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { websiteId, postId } = await params;
    if (!await verifyAccess(websiteId, session.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.blogKeyword.updateMany({
        where: { blogPostId: postId },
        data: { blogPostId: null },
      }),
      prisma.blogAnalytics.deleteMany({
        where: { blogPostId: postId, websiteId },
      }),
      prisma.generationJob.deleteMany({
        where: { blogPostId: postId, websiteId },
      }),
      prisma.blogPost.delete({ where: { id: postId, websiteId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[delete-post]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
