/**
 * POST /api/cron/generate
 * Cron job that auto-generates blog posts for all active websites.
 * Respects each website's publishDays, publishTime, and timezone settings.
 * Protected with CRON_SECRET env var (required).
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enqueueGenerationJob, checkGenerationLimit, recoverStuckJobs, triggerWorker } from "@/lib/job-queue";
import { runPublishHook } from "@/lib/on-publish";
import { requireCronAuth } from "@/lib/api-helpers";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function isScheduledNow(
  publishDays: string | null,
  publishTime: string | null,
  timezone: string | null,
): boolean {
  const tz = timezone || "UTC";
  const now = new Date();

  let localDay: string;
  let localHour: number;
  let localMinute: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    localDay = (parts.find((p) => p.type === "weekday")?.value || "").toUpperCase().slice(0, 3);
    localHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    localMinute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  } catch {
    localDay = DAY_NAMES[now.getUTCDay()];
    localHour = now.getUTCHours();
    localMinute = now.getUTCMinutes();
  }

  const days = (publishDays || "MON,WED,FRI").split(",").map((d) => d.trim().toUpperCase());
  if (!days.includes(localDay)) return false;

  const [targetH, targetM] = (publishTime || "09:00").split(":").map(Number);
  const diffMinutes = Math.abs(localHour * 60 + localMinute - (targetH * 60 + targetM));
  return diffMinutes <= 30;
}

export async function POST(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const results: { websiteId: string; name: string; action: string; jobId?: string }[] = [];
  const scheduledResults: { postId: string; title: string }[] = [];

  try {
    const recovered = await recoverStuckJobs();

    const dueScheduledPosts = await prisma.blogPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, title: true, websiteId: true },
    });

    for (const post of dueScheduledPosts) {
      try {
        await prisma.blogPost.update({
          where: { id: post.id },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
        runPublishHook({ postId: post.id, websiteId: post.websiteId, triggeredBy: "scheduled" })
          .catch(e => console.error(`[Cron] Publish hook failed for post ${post.id}:`, e));
        scheduledResults.push({ postId: post.id, title: post.title });
      } catch (e) {
        console.error(`[Cron] Failed to publish scheduled post ${post.id}:`, e);
      }
    }

    const websites = await prisma.website.findMany({
      where: {
        status: "ACTIVE",
        autoPublish: true,
      },
      include: {
        blogSettings: true,
        organization: { include: { subscription: true } },
      },
    });

    for (const website of websites) {
      try {
        if (!isScheduledNow(website.publishDays, website.publishTime, website.timezone)) {
          results.push({ websiteId: website.id, name: website.name, action: "not_scheduled_now" });
          continue;
        }

        const activeJob = await prisma.generationJob.findFirst({
          where: { websiteId: website.id, status: { in: ["QUEUED", "PROCESSING"] } },
        });

        if (activeJob) {
          results.push({ websiteId: website.id, name: website.name, action: "skipped_active_job" });
          continue;
        }

        const limit = await checkGenerationLimit(website.id);
        if (!limit.allowed) {
          results.push({ websiteId: website.id, name: website.name, action: "limit_reached" });
          continue;
        }

        const keyword = await prisma.blogKeyword.findFirst({
          where: { websiteId: website.id, status: "PENDING" },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        });

        if (!keyword) {
          results.push({ websiteId: website.id, name: website.name, action: "no_keywords" });
          continue;
        }

        const jobId = await enqueueGenerationJob({
          keywordId: keyword.id,
          keyword: keyword.keyword,
          websiteId: website.id,
          contentLength: (["SHORT", "MEDIUM"].includes(website.blogSettings?.contentLength || "") ? website.blogSettings?.contentLength : "MEDIUM") as "SHORT" | "MEDIUM",
          includeImages: website.blogSettings?.includeImages ?? true,
          includeFAQ: website.blogSettings?.includeFAQ ?? true,
          autoPublish: website.blogSettings?.autoPublish ?? false,
        });

        triggerWorker(jobId);
        results.push({ websiteId: website.id, name: website.name, action: "queued", jobId });
      } catch (e) {
        console.error(`[Cron] Error processing website ${website.id}:`, e);
        results.push({ websiteId: website.id, name: website.name, action: "error" });
      }
    }

    return NextResponse.json({
      recoveredJobs: recovered,
      scheduledPublished: scheduledResults.length,
      generated: results.filter((r) => r.action === "queued").length,
      results,
      scheduledResults,
    });
  } catch (error) {
    console.error("[Cron] Fatal error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
