/**
 * Public API v1 — RSS Feed
 * GET /api/v1/websites/:id/feed.xml → RSS feed for external hosting
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";

type Params = { params: Promise<{ websiteId: string }> };

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function verifyWebsiteAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: { select: { id: true } } } } },
  });
  return membership?.organization.websites.some((w) => w.id === websiteId) ?? false;
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasScope(auth.ctx, "posts:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const { websiteId } = await params;
  if (!(await verifyWebsiteAccess(websiteId, auth.ctx.userId))) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { brandName: true, description: true, brandUrl: true },
  });
  if (!website) return NextResponse.json({ error: "Website not found" }, { status: 404 });

  const posts = await prisma.blogPost.findMany({
    where: { websiteId, status: "PUBLISHED" },
    select: { title: true, slug: true, excerpt: true, publishedAt: true, category: true, tags: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const baseUrl = website.brandUrl.replace(/\/$/, "");

  const items = posts.map(
    (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${baseUrl}/blog/${p.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${p.slug}</guid>
      <description>${escapeXml(p.excerpt || "")}</description>
      <pubDate>${(p.publishedAt || new Date()).toUTCString()}</pubDate>
    </item>`
  );

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(website.brandName)} Blog</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(website.description)}</description>
    <language>en</language>
${items.join("\n")}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
