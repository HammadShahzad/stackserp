import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function verifyAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: true } } },
  });
  return membership?.organization.websites.find((w) => w.id === websiteId) || null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;
    const website = await verifyAccess(websiteId, session.user.id);
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = {
      websiteId,
      ...(status ? { status: status as "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED" } : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true, title: true, slug: true, status: true,
          focusKeyword: true, views: true, wordCount: true,
          readingTime: true, contentScore: true, featuredImage: true,
          publishedAt: true, scheduledAt: true, createdAt: true, updatedAt: true,
          tags: true, category: true, metaTitle: true, metaDescription: true,
          excerpt: true,
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return NextResponse.json({ posts, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;
    const website = await verifyAccess(websiteId, session.user.id);
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title, content, excerpt, metaTitle, metaDescription,
      focusKeyword, secondaryKeywords = [], featuredImage, tags = [],
      category, status = "DRAFT", scheduledAt,
    } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }
    if (typeof title === "string" && title.length > 500) {
      return NextResponse.json({ error: "Title too long (max 500 characters)" }, { status: 400 });
    }
    if (typeof content === "string" && content.length > 500_000) {
      return NextResponse.json({ error: "Content too large (max 500,000 characters)" }, { status: 400 });
    }

    // Generate slug from title
    const baseSlug = title.toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await prisma.blogPost.findUnique({
        where: { websiteId_slug: { websiteId, slug } },
      });
      if (!existing) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;

    const post = await prisma.blogPost.create({
      data: {
        title, slug, content,
        excerpt: excerpt || null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        focusKeyword: focusKeyword || null,
        secondaryKeywords,
        featuredImage: featuredImage || null,
        tags,
        category: category || null,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        wordCount,
        readingTime: Math.ceil(wordCount / 200),
        generatedBy: "manual",
        websiteId,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
