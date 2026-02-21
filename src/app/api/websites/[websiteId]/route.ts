import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function verifyAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: true } } },
  });

  if (!membership) return null;
  return membership.organization.websites.find((w) => w.id === websiteId) || null;
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
    const isAdmin = (session.user as { systemRole?: string }).systemRole === "ADMIN";
    let website = await verifyAccess(websiteId, session.user.id);
    if (!website && isAdmin) {
      website = await prisma.website.findFirst({
        where: { id: websiteId, status: { not: "DELETED" } },
      });
    }
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    return NextResponse.json(website);
  } catch (error) {
    console.error("Error fetching website:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;
    const isAdmin = (session.user as { systemRole?: string }).systemRole === "ADMIN";
    let website = await verifyAccess(websiteId, session.user.id);
    if (!website && isAdmin) {
      website = await prisma.website.findFirst({
        where: { id: websiteId, status: { not: "DELETED" } },
      });
    }
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const body = await req.json();

    // Only allow updating specific fields
    const allowedFields = [
      "name", "domain", "niche", "description", "targetAudience",
      "tone", "brandName", "brandUrl", "primaryColor", "logoUrl",
      "faviconUrl", "customDomain", "autoPublish", "postsPerWeek",
      "publishTime", "publishDays", "timezone", "hostingMode", "webhookUrl",
      "webhookSecret", "cmsType", "cmsApiUrl", "cmsApiKey",
      "googleAnalyticsId", "gscPropertyUrl", "twitterApiKey",
      "twitterApiSecret", "twitterAccessToken", "twitterAccessSecret",
      "linkedinAccessToken", "sitemapEnabled", "robotsTxt", "indexNowKey",
      "uniqueValueProp", "competitors", "keyProducts", "targetLocation",
      "status",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Restrict status transitions
    if (updateData.status) {
      const validTransitions: Record<string, string[]> = {
        ACTIVE: ["PAUSED", "DELETED"],
        PAUSED: ["ACTIVE", "DELETED"],
      };
      const allowed = validTransitions[website.status] || [];
      if (!allowed.includes(updateData.status as string)) {
        return NextResponse.json({ error: `Cannot transition from ${website.status} to ${updateData.status}` }, { status: 400 });
      }
    }

    const updated = await prisma.website.update({
      where: { id: websiteId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating website:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;
    const isAdmin = (session.user as { systemRole?: string }).systemRole === "ADMIN";
    let website = await verifyAccess(websiteId, session.user.id);
    if (!website && isAdmin) {
      website = await prisma.website.findFirst({
        where: { id: websiteId, status: { not: "DELETED" } },
      });
    }
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    // Soft delete
    await prisma.website.update({
      where: { id: websiteId },
      data: { status: "DELETED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting website:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
