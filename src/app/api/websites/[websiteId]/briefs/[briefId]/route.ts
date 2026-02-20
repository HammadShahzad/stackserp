/**
 * Single Content Brief
 * GET    /api/websites/:id/briefs/:briefId → Get brief details
 * PATCH  /api/websites/:id/briefs/:briefId → Update brief (approve, edit)
 * DELETE /api/websites/:id/briefs/:briefId → Delete brief
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ websiteId: string; briefId: string }> };

async function verifyAccess(websiteId: string, userId: string) {
  const m = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: { select: { id: true } } } } },
  });
  return m?.organization.websites.some((w) => w.id === websiteId) ?? false;
}

export async function GET(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId, briefId } = await params;
  if (!(await verifyAccess(websiteId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const brief = await prisma.contentBrief.findFirst({ where: { id: briefId, websiteId } });
  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  return NextResponse.json(brief);
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId, briefId } = await params;
  if (!(await verifyAccess(websiteId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = body.title;
  if ("outline" in body) data.outline = body.outline;
  if ("status" in body) data.status = body.status;
  if ("approved" in body) data.approved = body.approved;

  const brief = await prisma.contentBrief.update({
    where: { id: briefId },
    data,
  });

  return NextResponse.json(brief);
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId, briefId } = await params;
  if (!(await verifyAccess(websiteId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.contentBrief.delete({ where: { id: briefId } });
  return NextResponse.json({ success: true });
}
