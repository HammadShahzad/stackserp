import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PlanTier } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.systemRole !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;
    const { userId } = resolvedParams;
    const body = await req.json();

    const {
      role,
      plan,
      maxWebsites,
      maxPostsPerMonth,
      maxImagesPerMonth,
      websitesUsed,
      postsGeneratedThisMonth,
      imagesGeneratedThisMonth,
    } = body;

    // Update user role if provided
    if (role) {
      await prisma.user.update({
        where: { id: userId },
        data: { role },
      });
    }

    // Update subscription details if provided
    if (
      plan ||
      maxWebsites !== undefined ||
      maxPostsPerMonth !== undefined ||
      maxImagesPerMonth !== undefined ||
      websitesUsed !== undefined ||
      postsGeneratedThisMonth !== undefined ||
      imagesGeneratedThisMonth !== undefined
    ) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });

      if (user?.subscription) {
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: {
            plan: plan as PlanTier,
            maxWebsites: maxWebsites !== undefined ? Number(maxWebsites) : undefined,
            maxPostsPerMonth: maxPostsPerMonth !== undefined ? Number(maxPostsPerMonth) : undefined,
            maxImagesPerMonth: maxImagesPerMonth !== undefined ? Number(maxImagesPerMonth) : undefined,
            websitesUsed: websitesUsed !== undefined ? Number(websitesUsed) : undefined,
            postsGeneratedThisMonth: postsGeneratedThisMonth !== undefined ? Number(postsGeneratedThisMonth) : undefined,
            imagesGeneratedThisMonth: imagesGeneratedThisMonth !== undefined ? Number(imagesGeneratedThisMonth) : undefined,
          },
        });
      }
    }

    // Fetch the updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("[ADMIN_USER_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
