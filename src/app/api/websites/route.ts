import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createWebsiteSchema } from "@/lib/validators/website";
import { fetchFavicon } from "@/lib/website-crawler";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const websites = await prisma.website.findMany({
      where: {
        organizationId: membership.organizationId,
        status: { not: "DELETED" },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(websites);
  } catch (error) {
    console.error("Error fetching websites:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: { subscription: true },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const subscription = membership.organization.subscription;

    // Check website limit
    const currentWebsiteCount = await prisma.website.count({
      where: {
        organizationId: membership.organizationId,
        status: { not: "DELETED" },
      },
    });

    if (subscription && currentWebsiteCount >= subscription.maxWebsites) {
      return NextResponse.json(
        {
          error: `You've reached the limit of ${subscription.maxWebsites} websites on your ${subscription.plan} plan. Please upgrade to add more.`,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createWebsiteSchema.parse(body);

    // Generate subdomain from domain
    const subdomain = validated.domain
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();

    // Check if subdomain is already taken
    const existingSubdomain = await prisma.website.findUnique({
      where: { subdomain },
    });

    const finalSubdomain = existingSubdomain
      ? `${subdomain}-${Date.now().toString(36)}`
      : subdomain;

    const website = await prisma.website.create({
      data: {
        ...validated,
        subdomain: finalSubdomain,
        organizationId: membership.organizationId,
      },
    });

    // Create default blog settings
    await prisma.blogSettings.create({
      data: {
        websiteId: website.id,
        autoPublish: false,
        postsPerWeek: 3,
      },
    });

    // Auto-fetch favicon from the live website (non-blocking)
    if (validated.brandUrl) {
      fetchFavicon(validated.brandUrl).then((favicon) => {
        if (favicon) {
          prisma.website.update({
            where: { id: website.id },
            data: { faviconUrl: favicon },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    // Update subscription website count
    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { websitesUsed: currentWebsiteCount + 1 },
      });
    }

    return NextResponse.json(website, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: (error as unknown as { errors: unknown[] }).errors },
        { status: 400 }
      );
    }
    console.error("Error creating website:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
