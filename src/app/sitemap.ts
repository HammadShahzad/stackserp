import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

const BASE_URL = process.env.NEXTAUTH_URL || "https://stackserp.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/features`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // StackSerp's own blog posts
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const stackserpSite = await prisma.website.findUnique({
      where: { subdomain: "stackserp" },
      select: { id: true },
    });

    if (stackserpSite) {
      const posts = await prisma.blogPost.findMany({
        where: { websiteId: stackserpSite.id, status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
      });

      blogPages = [
        {
          url: `${BASE_URL}/blog/stackserp`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.8,
        },
        ...posts.map((post) => ({
          url: `${BASE_URL}/blog/stackserp/${post.slug}`,
          lastModified: post.updatedAt || post.publishedAt || new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
      ];
    }
  } catch {
    // DB not available during build — skip blog pages
  }

  return [...staticPages, ...blogPages];
}
