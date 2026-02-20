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
  _req: Request,
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

    const post = await prisma.blogPost.findFirst({
      where: { id: postId, websiteId },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const versions = await prisma.postVersion.findMany({
      where: { blogPostId: postId },
      orderBy: { version: "desc" },
    });

    return NextResponse.json(versions);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
