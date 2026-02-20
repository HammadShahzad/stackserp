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

export interface JobInput {
  keywordId: string;
  keyword: string;
  websiteId: string;
  contentLength?: "SHORT" | "MEDIUM" | "LONG" | "PILLAR";
  includeImages?: boolean;
  includeFAQ?: boolean;
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
    // Fetch website with blog settings
    const website = await prisma.website.findUnique({
      where: { id: input.websiteId },
      include: { blogSettings: true },
    });

    if (!website) throw new Error("Website not found");

    const onProgress: ProgressCallback = async (progress) => {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          currentStep: progress.step,
          progress: progress.percentage,
        },
      });

      // Update keyword status
      if (progress.step === "draft" || progress.step === "tone") {
        await prisma.blogKeyword.update({
          where: { id: input.keywordId },
          data: { status: "GENERATING" },
        });
      }
    };

    // Run the full AI pipeline
    const generated = await generateBlogPost(
      input.keyword,
      website as Parameters<typeof generateBlogPost>[1],
      input.contentLength || "MEDIUM",
      {
        includeImages: input.includeImages ?? true,
        includeFAQ: input.includeFAQ ?? true,
        onProgress,
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

    // Save blog post
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
        wordCount: generated.wordCount,
        readingTime: generated.readingTime,
        tags: generated.tags,
        category: generated.category,
        status,
        publishedAt: input.autoPublish ? new Date() : null,
        generatedBy: "ai",
        aiModel: "gemini-2.5-pro",
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
    });

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
    });
  }
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
