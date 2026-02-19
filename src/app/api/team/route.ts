import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            subscription: true,
            members: {
              include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    return NextResponse.json({
      members: membership.organization.members,
      currentUserId: session.user.id,
      role: membership.role,
      plan: membership.organization.subscription?.plan || "FREE",
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, role = "MEMBER" } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            subscription: true,
            members: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Only owners and admins can invite members" }, { status: 403 });
    }

    const plan = membership.organization.subscription?.plan || "FREE";
    const maxMembers = PLANS[plan as keyof typeof PLANS]?.features?.teamMembers ?? 1;
    const currentCount = membership.organization.members.length;

    if (maxMembers !== -1 && currentCount >= maxMembers) {
      return NextResponse.json(
        { error: `Your ${plan} plan allows ${maxMembers} team member(s). Upgrade to add more.` },
        { status: 403 }
      );
    }

    // Check if user exists
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!invitedUser) {
      return NextResponse.json(
        { error: "No account found with that email. They must sign up first." },
        { status: 404 }
      );
    }

    // Check if already a member
    const alreadyMember = await prisma.organizationMember.findFirst({
      where: {
        userId: invitedUser.id,
        organizationId: membership.organizationId,
      },
    });

    if (alreadyMember) {
      return NextResponse.json(
        { error: "This user is already a team member" },
        { status: 400 }
      );
    }

    const newMember = await prisma.organizationMember.create({
      data: {
        userId: invitedUser.id,
        organizationId: membership.organizationId,
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error("Error inviting team member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
