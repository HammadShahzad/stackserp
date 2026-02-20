/**
 * Public API v1 — Sitemap data
 * GET /api/v1/websites/:id/sitemap.xml → XML sitemap for external hosting
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";

type Params = { params: Promise<{ websiteId: string }> };

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
    select: { brandUrl: true },
  });

  const posts = await prisma.blogPost.findMany({
    where: { websiteId, status: "PUBLISHED" },
    select: { slug: true, updatedAt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  const baseUrl = website?.brandUrl?.replace(/\/$/, "") || "";

  const urls = posts.map(
    (p) => `  <url>
    <loc>${baseUrl}/blog/${p.slug}</loc>
    <lastmod>${(p.updatedAt || p.publishedAt || new Date()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
