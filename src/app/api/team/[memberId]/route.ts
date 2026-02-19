import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await params;

    const adminMembership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
    });

    if (!adminMembership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (adminMembership.role !== "OWNER" && adminMembership.role !== "ADMIN") {
      return NextResponse.json({ error: "Only owners and admins can remove members" }, { status: 403 });
    }

    const targetMember = await prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: adminMembership.organizationId,
      },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove the organization owner" }, { status: 400 });
    }

    await prisma.organizationMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
