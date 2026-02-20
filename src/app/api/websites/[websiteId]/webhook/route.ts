import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWebhook } from "@/lib/cms/webhook";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId } = await params;
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { webhookUrl: true },
  });

  return NextResponse.json({
    connected: !!website?.webhookUrl,
    webhookUrl: website?.webhookUrl || null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId } = await params;
  const body = await req.json();
  const { action, webhookUrl, webhookSecret } = body;

  if (action === "test") {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { brandName: true, domain: true },
    });
    if (!webhookUrl) return NextResponse.json({ success: false, error: "No webhook URL" });

    const result = await sendWebhook({
      id: "test-" + Date.now(),
      title: "StackSerp Webhook Test",
      slug: "test-post",
      content: "# Test\n\nThis is a test webhook from StackSerp.",
      contentHtml: "<h1>Test</h1><p>This is a test webhook from StackSerp.</p>",
      excerpt: "Test webhook",
      status: "PUBLISHED",
      publishedAt: new Date().toISOString(),
      wordCount: 10,
      readingTime: 1,
      websiteId,
      websiteDomain: website?.domain || "",
      brandName: website?.brandName || "",
      tags: ["test"],
    }, { webhookUrl, webhookSecret });

    return NextResponse.json(result);
  }

  // Save
  await prisma.website.update({
    where: { id: websiteId },
    data: { webhookUrl, webhookSecret: webhookSecret || null },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId } = await params;
  await prisma.website.update({
    where: { id: websiteId },
    data: { webhookUrl: null, webhookSecret: null },
  });

  return NextResponse.json({ success: true });
}
