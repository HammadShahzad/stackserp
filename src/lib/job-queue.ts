/**
 * Generation Job Queue
 * Database-backed async job queue with progress tracking.
 * Uses PostgreSQL (via Prisma) as the queue store — no Redis required for Phase 2.
 * Can be upgraded to BullMQ/Redis for scale.
 */
import prisma from "./prisma";
import { generateBlogPost, ProgressCallback } from "./ai/content-generator";
import type { JobType } from "@prisma/client";
import { runPublishHook } from "./on-publish";
import { calculateContentScore } from "./seo-scorer";

export interface JobInput {
  keywordId: string;
  keyword: string;
  websiteId: string;
  contentLength?: "SHORT" | "MEDIUM" | "LONG" | "PILLAR";
  includeImages?: boolean;
  includeFAQ?: boolean;
  includeTableOfContents?: boolean;
  autoPublish?: boolean;
}

/**
 * Enqueue a new blog generation job
 */
export async function enqueueGenerationJob(input: JobInput): Promise<string> {
  const job = await prisma.generationJob.create({
    data: {
      type: "BLOG_GENERATION" as JobType,
      status: "QUEUED",
      websiteId: input.websiteId,
      keywordId: input.keywordId,
      input: input as object,
      progress: 0,
    },
  });

  // Mark keyword as queued
  await prisma.blogKeyword.update({
    where: { id: input.keywordId },
    data: { status: "RESEARCHING" },
  });

  return job.id;
}

/**
 * Process a single generation job — runs the full AI pipeline
 */
export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "QUEUED") return;

  // Mark as processing
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", startedAt: new Date(), currentStep: "research" },
  });

  const input = job.input as unknown as JobInput;

  try {
    const [website, existingPosts, manualLinks] = await Promise.all([
      prisma.website.findUnique({
        where: { id: input.websiteId },
        include: { blogSettings: true },
      }),
      prisma.blogPost.findMany({
        where: { websiteId: input.websiteId, status: "PUBLISHED" },
        select: { title: true, slug: true, focusKeyword: true, secondaryKeywords: true },
        orderBy: { publishedAt: "desc" },
        take: 100,
      }),
      prisma.internalLinkPair.findMany({
        where: { websiteId: input.websiteId },
        select: { keyword: true, url: true },
      }),
    ]);

    if (!website) throw new Error("Website not found");

    const baseUrl = website.brandUrl.replace(/\/$/, "");
    const blogBase = website.customDomain
      ? `https://${website.customDomain}`
      : `${baseUrl}/blog`;

    const postLinks = existingPosts.map((p) => ({
      title: p.title,
      slug: p.slug,
      url: website.customDomain
        ? `https://${website.customDomain}/${p.slug}`
        : `${baseUrl}/blog/${p.slug}`,
      focusKeyword: p.focusKeyword || "",
    }));

    // Build internal links from actual published posts (primary source)
    const postBasedLinks: { keyword: string; url: string }[] = [];
    const seenKeywords = new Set<string>();

    for (const p of existingPosts) {
      const postUrl = website.customDomain
        ? `https://${website.customDomain}/${p.slug}`
        : `${baseUrl}/blog/${p.slug}`;

      if (p.focusKeyword && !seenKeywords.has(p.focusKeyword.toLowerCase())) {
        seenKeywords.add(p.focusKeyword.toLowerCase());
        postBasedLinks.push({ keyword: p.focusKeyword, url: postUrl });
      }

      if (p.secondaryKeywords?.length) {
        for (const kw of p.secondaryKeywords.slice(0, 2)) {
          if (kw && !seenKeywords.has(kw.toLowerCase())) {
            seenKeywords.add(kw.toLowerCase());
            postBasedLinks.push({ keyword: kw, url: postUrl });
          }
        }
      }
    }

    // Merge: post-based links first, then manual/configured links for non-blog pages
    const allInternalLinks = [
      ...postBasedLinks,
      ...manualLinks
        .filter((l) => !seenKeywords.has(l.keyword.toLowerCase()))
        .map((l) => ({ keyword: l.keyword, url: l.url })),
    ];

    const onProgress: ProgressCallback = async (progress) => {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          currentStep: progress.step,
          progress: progress.percentage,
        },
      });

      if (progress.step === "draft" || progress.step === "tone") {
        await prisma.blogKeyword.update({
          where: { id: input.keywordId },
          data: { status: "GENERATING" },
        }).catch(() => {});
      }
    };

    // Run the full AI pipeline with all context from the strategy
    const generated = await generateBlogPost(
      input.keyword,
      website as Parameters<typeof generateBlogPost>[1],
      input.contentLength || "MEDIUM",
      {
        includeImages: input.includeImages ?? true,
        includeFAQ: input.includeFAQ ?? true,
        includeTableOfContents: input.includeTableOfContents ?? true,
        onProgress,
        existingPosts: postLinks,
        internalLinks: allInternalLinks,
      }
    );

    // Ensure unique slug
    const baseSlug = generated.slug;
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await prisma.blogPost.findUnique({
        where: { websiteId_slug: { websiteId: input.websiteId, slug } },
      });
      if (!existing) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    const status = input.autoPublish ? "PUBLISHED" : "REVIEW";

    const { score: contentScore } = calculateContentScore({
      content: generated.content,
      title: generated.title,
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
      focusKeyword: generated.focusKeyword,
      featuredImage: generated.featuredImageUrl,
      featuredImageAlt: generated.featuredImageAlt,
    });

    const blogPost = await prisma.blogPost.create({
      data: {
        title: generated.title,
        slug,
        content: generated.content,
        excerpt: generated.excerpt,
        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,
        focusKeyword: generated.focusKeyword,
        secondaryKeywords: generated.secondaryKeywords,
        featuredImage: generated.featuredImageUrl || null,
        featuredImageAlt: generated.featuredImageAlt || null,
        structuredData: generated.structuredData,
        socialCaptions: generated.socialCaptions,
        contentScore,
        wordCount: generated.wordCount,
        readingTime: generated.readingTime,
        tags: generated.tags,
        category: generated.category,
        status,
        publishedAt: input.autoPublish ? new Date() : null,
        generatedBy: "ai",
        aiModel: "stackserp-ai-v1",
        researchData: generated.researchData as object,
        generationSteps: { completed: true },
        websiteId: input.websiteId,
      },
    });

    // Link keyword → post, mark completed
    await prisma.blogKeyword.update({
      where: { id: input.keywordId },
      data: {
        status: "COMPLETED",
        blogPostId: blogPost.id,
      },
    }).catch(() => {});

    // Mark job complete
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        progress: 100,
        currentStep: "done",
        blogPostId: blogPost.id,
        output: { blogPostId: blogPost.id, title: blogPost.title, slug: blogPost.slug } as object,
      },
    });

    // Update subscription usage counter
    await prisma.subscription.updateMany({
      where: { organization: { websites: { some: { id: input.websiteId } } } },
      data: { postsGeneratedThisMonth: { increment: 1 } },
    });

    // Fire publish hook if auto-published
    if (input.autoPublish) {
      runPublishHook({
        postId: blogPost.id,
        websiteId: input.websiteId,
        triggeredBy: "auto",
      }).catch(console.error);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Job ${jobId} failed:`, errorMessage);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: errorMessage, completedAt: new Date() },
    });

    await prisma.blogKeyword.update({
      where: { id: input.keywordId },
      data: {
        status: "FAILED",
        errorMessage,
        retryCount: { increment: 1 },
      },
    }).catch(() => {});
  }
}

/**
 * Fire-and-forget HTTP call to the Droplet worker to pick up a job.
 * Falls back silently — the worker also polls on its own.
 */
export function triggerWorker(jobId: string) {
  const workerUrl = process.env.WORKER_URL; // e.g. http://167.71.96.242:3001
  const secret = process.env.CRON_SECRET;
  if (!workerUrl || !secret) return;

  fetch(`${workerUrl}/api/worker/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ jobId }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Silent — worker will pick it up via polling
  });
}

/**
 * Get job status with progress
 */
export async function getJobStatus(jobId: string) {
  return prisma.generationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      currentStep: true,
      progress: true,
      error: true,
      startedAt: true,
      completedAt: true,
      blogPostId: true,
      output: true,
    },
  });
}

/**
 * Recover jobs stuck in PROCESSING for more than 10 minutes.
 * Marks them as FAILED and resets their associated keywords to PENDING.
 */
export async function recoverStuckJobs(): Promise<number> {
  const tenMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

  const stuckJobs = await prisma.generationJob.findMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: tenMinutesAgo },
    },
    select: { id: true, keywordId: true },
  });

  if (stuckJobs.length === 0) return 0;

  await prisma.generationJob.updateMany({
    where: { id: { in: stuckJobs.map((j) => j.id) } },
    data: {
      status: "FAILED",
      error: "Job timed out. Click Retry to try again.",
      completedAt: new Date(),
    },
  });

  const keywordIds = stuckJobs
    .map((j) => j.keywordId)
    .filter((id): id is string => id !== null);

  if (keywordIds.length > 0) {
    await prisma.blogKeyword.updateMany({
      where: { id: { in: keywordIds } },
      data: { status: "PENDING" },
    });
  }

  console.log(`[recoverStuckJobs] Recovered ${stuckJobs.length} stuck job(s)`);
  return stuckJobs.length;
}

/**
 * Check if organization is within their post generation limit
 */
export async function checkGenerationLimit(websiteId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
}> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: {
      organization: {
        include: { subscription: true },
      },
    },
  });

  if (!website) return { allowed: false, reason: "Website not found" };

  const sub = website.organization.subscription;
  if (!sub) return { allowed: true }; // No subscription = allow (shouldn't happen)

  if (sub.postsGeneratedThisMonth >= sub.maxPostsPerMonth) {
    return {
      allowed: false,
      reason: `You've used all ${sub.maxPostsPerMonth} posts for this month on the ${sub.plan} plan. Upgrade to generate more.`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: sub.maxPostsPerMonth - sub.postsGeneratedThisMonth,
  };
}
