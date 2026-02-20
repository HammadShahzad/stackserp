/**
 * GET /blog/[subdomain]/sitemap.xml
 * Dynamic XML sitemap for hosted blogs
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const { subdomain } = await params;

  const website = await prisma.website.findUnique({
    where: { subdomain },
    select: { id: true, domain: true, subdomain: true, sitemapEnabled: true },
  });

  if (!website || !website.sitemapEnabled) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const posts = await prisma.blogPost.findMany({
    where: { websiteId: website.id, status: "PUBLISHED" },
    select: { slug: true, updatedAt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  const baseUrl = `${process.env.NEXTAUTH_URL}/blog/${subdomain}`;

  const urls = [
    `  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    ...posts.map(
      (post) => `  <url>
    <loc>${baseUrl}/${post.slug}</loc>
    <lastmod>${(post.updatedAt || post.publishedAt || new Date()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
