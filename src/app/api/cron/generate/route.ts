/**
 * POST /api/cron/generate
 * Cron job that auto-generates blog posts for all active websites
 * Call this endpoint every hour (or daily) via Vercel Cron / external scheduler
 *
 * Protected with CRON_SECRET env var
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enqueueGenerationJob, checkGenerationLimit, recoverStuckJobs, triggerWorker } from "@/lib/job-queue";
import { runPublishHook } from "@/lib/on-publish";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { websiteId: string; name: string; action: string; jobId?: string }[] = [];
  const scheduledResults: { postId: string; title: string }[] = [];

  try {
    // ── 0. Recover stuck jobs before doing anything else ─────
    const recovered = await recoverStuckJobs();

    // ── 1. Publish scheduled posts that are due ──────────────
    const dueScheduledPosts = await prisma.blogPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, title: true, websiteId: true },
    });

    for (const post of dueScheduledPosts) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      runPublishHook({ postId: post.id, websiteId: post.websiteId, triggeredBy: "scheduled" })
        .catch(console.error);
      scheduledResults.push({ postId: post.id, title: post.title });
    }

    // ── 2. AI generation for auto-publish websites ──────────────
    const websites = await prisma.website.findMany({
      where: {
        status: "ACTIVE",
        blogSettings: { autoPublish: true },
      },
      include: {
        blogSettings: true,
        organization: { include: { subscription: true } },
      },
    });

    for (const website of websites) {
      // Skip if already has an active job
      const activeJob = await prisma.generationJob.findFirst({
        where: { websiteId: website.id, status: { in: ["QUEUED", "PROCESSING"] } },
      });

      if (activeJob) {
        results.push({ websiteId: website.id, name: website.name, action: "skipped_active_job" });
        continue;
      }

      // Check plan limits
      const limit = await checkGenerationLimit(website.id);
      if (!limit.allowed) {
        results.push({ websiteId: website.id, name: website.name, action: "limit_reached" });
        continue;
      }

      // Get next pending keyword
      const keyword = await prisma.blogKeyword.findFirst({
        where: { websiteId: website.id, status: "PENDING" },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });

      if (!keyword) {
        results.push({ websiteId: website.id, name: website.name, action: "no_keywords" });
        continue;
      }

      // Enqueue and process
      const jobId = await enqueueGenerationJob({
        keywordId: keyword.id,
        keyword: keyword.keyword,
        websiteId: website.id,
        contentLength: website.blogSettings?.contentLength || "MEDIUM",
        includeImages: website.blogSettings?.includeImages ?? true,
        includeFAQ: website.blogSettings?.includeFAQ ?? true,
        autoPublish: website.blogSettings?.autoPublish ?? false,
      });

      // Worker on the Droplet will pick up the QUEUED job
      triggerWorker(jobId);
      results.push({ websiteId: website.id, name: website.name, action: "queued", jobId });
    }

    return NextResponse.json({
      recoveredJobs: recovered,
      scheduledPublished: scheduledResults.length,
      generated: results.filter((r) => r.action === "generated").length,
      results,
      scheduledResults,
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Cron failed", details: String(error) }, { status: 500 });
  }
}
