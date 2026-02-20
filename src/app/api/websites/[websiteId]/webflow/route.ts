import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { testWebflowConnection } from "@/lib/cms/webflow";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;
  const body = await req.json();
  const { accessToken, siteId } = body;

  if (!accessToken || !siteId) {
    return NextResponse.json(
      { error: "accessToken and siteId are required" },
      { status: 400 }
    );
  }

  const result = await testWebflowConnection({ accessToken, siteId });
  return NextResponse.json(result);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;
  const body = await req.json();
  const { accessToken, siteId, collectionId } = body;

  if (!accessToken || !siteId || !collectionId) {
    return NextResponse.json(
      { error: "accessToken, siteId, and collectionId are required" },
      { status: 400 }
    );
  }

  const webflowConfig = JSON.stringify({ accessToken, siteId, collectionId });

  await prisma.website.update({
    where: { id: websiteId },
    data: {
      cmsType: "WEBFLOW",
      cmsApiKey: webflowConfig,
    },
  });

  return NextResponse.json({ success: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { cmsType: true, cmsApiKey: true },
  });

  if (!website || website.cmsType !== "WEBFLOW" || !website.cmsApiKey) {
    return NextResponse.json({ connected: false });
  }

  try {
    const config = JSON.parse(website.cmsApiKey);
    return NextResponse.json({
      connected: true,
      siteId: config.siteId,
      collectionId: config.collectionId,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;

  await prisma.website.update({
    where: { id: websiteId },
    data: { cmsType: null, cmsApiKey: null },
  });

  return NextResponse.json({ success: true });
}
