import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function verifyWebsiteAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: true } } },
  });

  if (!membership) return null;

  const website = membership.organization.websites.find(
    (w) => w.id === websiteId
  );
  return website || null;
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
    const website = await verifyWebsiteAccess(websiteId, session.user.id);
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const keywords = await prisma.blogKeyword.findMany({
      where: { websiteId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(keywords);
  } catch (error) {
    console.error("Error fetching keywords:", error);
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
    const website = await verifyWebsiteAccess(websiteId, session.user.id);
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const { keyword, notes, priority } = await req.json();

    if (!keyword?.trim()) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }
    if (typeof keyword !== "string" || keyword.trim().length > 300) {
      return NextResponse.json({ error: "Keyword too long (max 300 characters)" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.blogKeyword.findFirst({
      where: { websiteId, keyword: keyword.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This keyword already exists" },
        { status: 409 }
      );
    }

    const newKeyword = await prisma.blogKeyword.create({
      data: {
        keyword: keyword.trim(),
        notes: notes || null,
        priority: priority || 0,
        websiteId,
      },
    });

    return NextResponse.json(newKeyword, { status: 201 });
  } catch (error) {
    console.error("Error creating keyword:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
