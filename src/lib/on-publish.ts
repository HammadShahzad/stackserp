/**
 * Central publish hook — called whenever a post is published (manually or auto)
 * Handles: IndexNow, Twitter/X, LinkedIn, Webhook, Email notification
 */
import prisma from "./prisma";
import { indexPost } from "./indexnow";
import { postTweet, buildTweetText } from "./social/twitter";
import { shareToLinkedIn } from "./social/linkedin";
import { sendWebhook } from "./cms/webhook";
import { pushToGhost } from "./cms/ghost";
import { pushToShopify, ShopifyConfig } from "./cms/shopify";
import { pushToWebflow, WebflowConfig } from "./cms/webflow";
import { sendPostGeneratedEmail } from "./email";
import { markdownToHtml } from "./cms/wordpress";

interface PublishHookInput {
  postId: string;
  websiteId: string;
  triggeredBy?: "manual" | "auto" | "scheduled";
}

export async function runPublishHook({ postId, websiteId, triggeredBy = "manual" }: PublishHookInput) {
  // Fetch post + website in parallel
  const [post, website] = await Promise.all([
    prisma.blogPost.findUnique({
      where: { id: postId },
      select: {
        id: true, title: true, slug: true, content: true,
        excerpt: true, metaTitle: true, metaDescription: true,
        focusKeyword: true, featuredImage: true, tags: true,
        wordCount: true, readingTime: true, publishedAt: true,
      },
    }),
    prisma.website.findUnique({
      where: { id: websiteId },
      select: {
        id: true, domain: true, subdomain: true, brandName: true,
        indexNowKey: true,
        twitterApiKey: true,
        linkedinAccessToken: true,
        webhookUrl: true, webhookSecret: true,
        ghostConfig: true,
        shopifyConfig: true,
        cmsType: true, cmsApiKey: true,
        organization: {
          select: {
            members: {
              where: { role: "OWNER" },
              select: { user: { select: { email: true, name: true } } },
            },
          },
        },
      },
    }),
  ]);

  if (!post || !website) return;

  const baseUrl = website.subdomain
    ? `${process.env.NEXTAUTH_URL}/blog/${website.subdomain}`
    : `https://${website.domain}`;
  const postUrl = `${baseUrl}/${post.slug}`;
  const ownerEmail = website.organization.members[0]?.user?.email;
  const ownerName = website.organization.members[0]?.user?.name || "there";

  // Run all integrations in parallel — failures are silent (best-effort)
  const tasks: Promise<void>[] = [];

  // 1. IndexNow
  if (website.indexNowKey) {
    tasks.push(
      indexPost(post.slug, website.domain, website.subdomain, website.indexNowKey)
        .catch(e => console.error("[IndexNow] error:", e))
    );
  }

  // 2. Twitter/X
  if (website.twitterApiKey) {
    tasks.push((async () => {
      const text = buildTweetText(post, postUrl);
      const result = await postTweet(text, website.twitterApiKey!);
      if (result.success) {
        console.log(`[Twitter] Posted: ${result.tweetUrl}`);
        await prisma.blogPost.update({
          where: { id: postId },
          data: { socialPublished: true },
        });
      } else {
        console.error("[Twitter] failed:", result.error);
      }
    })().catch(e => console.error("[Twitter] error:", e)));
  }

  // 3. LinkedIn
  if (website.linkedinAccessToken) {
    tasks.push((async () => {
      const result = await shareToLinkedIn(post, postUrl, website.linkedinAccessToken!);
      if (result.success) console.log(`[LinkedIn] Shared: ${result.postId}`);
      else console.error("[LinkedIn] failed:", result.error);
    })().catch(e => console.error("[LinkedIn] error:", e)));
  }

  // 4. Webhook
  if (website.webhookUrl) {
    tasks.push(
      sendWebhook({
        id: post.id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        contentHtml: markdownToHtml(post.content),
        excerpt: post.excerpt || undefined,
        metaTitle: post.metaTitle || undefined,
        metaDescription: post.metaDescription || undefined,
        focusKeyword: post.focusKeyword || undefined,
        featuredImage: post.featuredImage || undefined,
        tags: post.tags,
        status: "PUBLISHED",
        publishedAt: post.publishedAt?.toISOString() || new Date().toISOString(),
        wordCount: post.wordCount || undefined,
        readingTime: post.readingTime || undefined,
        websiteId,
        websiteDomain: website.domain,
        brandName: website.brandName,
      }, { webhookUrl: website.webhookUrl, webhookSecret: website.webhookSecret || undefined })
        .then(r => { if (!r.success) console.error("[Webhook] failed:", r.error); })
        .catch(e => console.error("[Webhook] error:", e))
    );
  }

  // 5. Shopify auto-push (if configured and it's auto-triggered)
  if (website.shopifyConfig && triggeredBy === "auto") {
    tasks.push((async () => {
      const config = JSON.parse(website.shopifyConfig as string) as ShopifyConfig;
      const result = await pushToShopify({
        title: post.title,
        contentHtml: markdownToHtml(post.content),
        excerpt: post.excerpt || undefined,
        slug: post.slug,
        tags: post.tags,
        featuredImageUrl: post.featuredImage || undefined,
        status: "published",
        metaTitle: post.metaTitle || undefined,
        metaDescription: post.metaDescription || undefined,
      }, config);
      if (result.success) console.log(`[Shopify] Pushed article: ${result.articleUrl}`);
      else console.error("[Shopify] failed:", result.error);
    })().catch(e => console.error("[Shopify] error:", e)));
  }

  // 7. Ghost auto-push (if configured and it's auto-triggered)
  if (website.ghostConfig && triggeredBy === "auto") {
    tasks.push((async () => {
      const config = JSON.parse(website.ghostConfig as string);
      const result = await pushToGhost({
        title: post.title,
        html: markdownToHtml(post.content),
        excerpt: post.excerpt || undefined,
        slug: post.slug,
        status: "published",
        tags: post.tags,
        featureImageUrl: post.featuredImage || undefined,
        metaTitle: post.metaTitle || undefined,
        metaDescription: post.metaDescription || undefined,
      }, config);
      if (result.success) console.log(`[Ghost] Pushed: ${result.postUrl}`);
      else console.error("[Ghost] failed:", result.error);
    })().catch(e => console.error("[Ghost] error:", e)));
  }

  // 8. Webflow auto-push (if cmsType is WEBFLOW and it's auto-triggered)
  if (website.cmsType === "WEBFLOW" && website.cmsApiKey && triggeredBy === "auto") {
    tasks.push((async () => {
      const config = JSON.parse(website.cmsApiKey as string) as WebflowConfig;
      const result = await pushToWebflow({
        title: post.title,
        slug: post.slug,
        contentHtml: markdownToHtml(post.content),
        excerpt: post.excerpt || undefined,
        metaTitle: post.metaTitle || undefined,
        metaDescription: post.metaDescription || undefined,
      }, config);
      if (result.success) console.log(`[Webflow] Pushed item: ${result.itemId}`);
      else console.error("[Webflow] failed:", result.error);
    })().catch(e => console.error("[Webflow] error:", e)));
  }

  // 9. Email notification to owner
  if (ownerEmail) {
    tasks.push(
      sendPostGeneratedEmail({
        to: ownerEmail,
        userName: ownerName,
        postTitle: post.title,
        postUrl: `${process.env.NEXTAUTH_URL}/dashboard/websites/${websiteId}/posts/${postId}`,
        websiteName: website.brandName,
        wordCount: post.wordCount || 0,
      }).catch(e => console.error("[Email] error:", e))
    );
  }

  await Promise.allSettled(tasks);
}
