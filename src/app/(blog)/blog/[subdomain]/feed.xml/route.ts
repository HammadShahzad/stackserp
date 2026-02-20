/**
 * GET /blog/[subdomain]/feed.xml
 * RSS 2.0 feed for hosted blogs
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const { subdomain } = await params;

  const website = await prisma.website.findUnique({
    where: { subdomain },
    select: {
      id: true,
      brandName: true,
      description: true,
      domain: true,
      subdomain: true,
      primaryColor: true,
    },
  });

  if (!website) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const posts = await prisma.blogPost.findMany({
    where: { websiteId: website.id, status: "PUBLISHED" },
    select: {
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      featuredImage: true,
      category: true,
      tags: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const baseUrl = `${process.env.NEXTAUTH_URL}/blog/${subdomain}`;

  const items = posts.map(
    (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${baseUrl}/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || "")}</description>
      <pubDate>${(post.publishedAt || new Date()).toUTCString()}</pubDate>
      ${post.category ? `<category>${escapeXml(post.category)}</category>` : ""}
      ${post.tags.map((t) => `<category>${escapeXml(t)}</category>`).join("\n      ")}
      ${post.featuredImage ? `<enclosure url="${escapeXml(post.featuredImage)}" type="image/webp" />` : ""}
    </item>`
  );

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(website.brandName)} Blog</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(website.description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
