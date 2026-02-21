/**
 * POST /api/websites/[websiteId]/wordpress/push
 * Push a specific blog post to the connected WordPress site
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeWordPressConfig, pushToWordPress, pushToWordPressPlugin } from "@/lib/cms/wordpress";
import { verifyWebsiteAccess } from "@/lib/api-helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;
    const { postId, status = "draft" } = await req.json();

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    // Load website WP config + brand details for link rewriting
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { cmsType: true, cmsApiUrl: true, cmsApiKey: true, brandUrl: true, customDomain: true, subdomain: true },
    });

    if (!website?.cmsApiUrl || !website?.cmsApiKey) {
      return NextResponse.json(
        { error: "WordPress not connected. Configure it in Website Settings → WordPress." },
        { status: 400 }
      );
    }

    // Decode stored credentials (handles both app-password and plugin mode)
    const wpConfig = decodeWordPressConfig(website.cmsApiUrl, website.cmsApiKey);

    if (wpConfig.mode === "app-password" && (!wpConfig.username || !wpConfig.appPassword)) {
      return NextResponse.json(
        { error: "Invalid WordPress credentials. Please reconnect in Settings → WordPress." },
        { status: 400 }
      );
    }

    // Load the post
    const post = await prisma.blogPost.findFirst({
      where: { id: postId, websiteId },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Rewrite internal links from StackSerp blog URL format → WordPress URL
    // Content links are built as: brandUrl/blog/slug (or customDomain/slug)
    // WordPress expects them at: wordpressSiteUrl/slug
    const brandUrl = (website.brandUrl || "").replace(/\/$/, "");
    const stackserpBlogBase = website.subdomain
      ? `${process.env.NEXTAUTH_URL}/blog/${website.subdomain}`
      : null;
    const brandBlogBase = website.customDomain
      ? `https://${website.customDomain}`
      : brandUrl ? `${brandUrl}/blog` : null;
    const wpBase = wpConfig.siteUrl.replace(/\/$/, "");

    function rewriteInternalLinks(content: string): string {
      let result = content;
      // Rewrite brandUrl/blog/slug → wpBase/slug
      if (brandBlogBase && brandBlogBase !== wpBase) {
        result = result.replace(
          new RegExp(brandBlogBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/", "g"),
          `${wpBase}/`
        );
      }
      // Rewrite stackserp.com/blog/subdomain/slug → wpBase/slug
      if (stackserpBlogBase) {
        result = result.replace(
          new RegExp(stackserpBlogBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/", "g"),
          `${wpBase}/`
        );
      }
      return result;
    }

    const postContent = rewriteInternalLinks(post.content);

    const postPayload = {
      title: post.title,
      content: postContent,
      excerpt: post.excerpt || undefined,
      slug: post.slug,
      status: status as "draft" | "publish",
      featuredImageUrl: post.featuredImage || undefined,
      metaTitle: post.metaTitle || undefined,
      metaDescription: post.metaDescription || undefined,
      focusKeyword: post.focusKeyword || undefined,
      tags: post.tags || [],
      category: post.category || undefined,
    };

    // Push via the correct method
    const result = wpConfig.mode === "plugin"
      ? await pushToWordPressPlugin(postPayload, wpConfig.siteUrl, wpConfig.pluginApiKey!)
      : await pushToWordPress(postPayload, {
          siteUrl: wpConfig.siteUrl,
          username: wpConfig.username,
          appPassword: wpConfig.appPassword,
          defaultStatus: status as "draft" | "publish",
        });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Persist the live URL so the editor can show it later
    if (result.wpPostUrl) {
      await prisma.blogPost.update({
        where: { id: postId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { externalUrl: result.wpPostUrl } as any,
      });
    }

    return NextResponse.json({
      success: true,
      wpPostId: result.wpPostId,
      wpPostUrl: result.wpPostUrl,
      wpEditUrl: result.wpEditUrl,
    });
  } catch (error) {
    console.error("WordPress push error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
