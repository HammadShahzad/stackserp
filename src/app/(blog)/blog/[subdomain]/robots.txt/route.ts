/**
 * GET /blog/[subdomain]/robots.txt
 * Per-website robots.txt (customizable via Website.robotsTxt field)
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
    select: { robotsTxt: true, sitemapEnabled: true },
  });

  if (!website) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const baseUrl = `${process.env.NEXTAUTH_URL}/blog/${subdomain}`;

  const defaultRobots = `User-agent: *
Allow: /
${website.sitemapEnabled ? `\nSitemap: ${baseUrl}/sitemap.xml` : ""}`;

  const content = website.robotsTxt || defaultRobots;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
