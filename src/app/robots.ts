import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXTAUTH_URL || "https://stackserp.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
