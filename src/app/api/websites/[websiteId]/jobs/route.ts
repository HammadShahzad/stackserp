import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyWebsiteAccess } from "@/lib/api-helpers";
import { enqueueGenerationJob, triggerWorker } from "@/lib/job-queue";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

    const body = await req.json();

    // Dismiss a job (completed or failed) — just deletes it from view
    if (body.action === "dismiss" && body.jobId) {
      await prisma.generationJob.delete({
        where: { id: body.jobId, websiteId },
      }).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (body.action !== "retry" || !body.jobId) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const failedJob = await prisma.generationJob.findFirst({
      where: { id: body.jobId, websiteId, status: "FAILED" },
    });
    if (!failedJob) {
      return NextResponse.json({ error: "Job not found or not failed" }, { status: 404 });
    }

    const input = failedJob.input as Record<string, unknown> | null;
    const keywordId = failedJob.keywordId;
    const keyword = (input?.keyword as string) || "Unknown";

    if (keywordId) {
      await prisma.blogKeyword.update({
        where: { id: keywordId },
        data: { status: "PENDING", errorMessage: null },
      }).catch(() => {});
    }

    // Remove the failed job so it doesn't clutter
    await prisma.generationJob.delete({ where: { id: body.jobId } }).catch(() => {});

    if (!keywordId) {
      return NextResponse.json({ error: "No keyword linked to this job" }, { status: 400 });
    }

    const jobId = await enqueueGenerationJob({
      keywordId,
      keyword,
      websiteId,
      contentLength: (input?.contentLength as "SHORT" | "MEDIUM") || "MEDIUM",
      includeImages: (input?.includeImages as boolean) ?? true,
      includeFAQ: (input?.includeFAQ as boolean) ?? true,
      autoPublish: (input?.autoPublish as boolean) ?? false,
    });

    triggerWorker(jobId);

    return NextResponse.json({ jobId, keyword, message: "Retrying generation" });
  } catch (error) {
    console.error("Error retrying job:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

    const tenMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const jobs = await prisma.generationJob.findMany({
      where: {
        websiteId,
        OR: [
          { status: { in: ["QUEUED", "PROCESSING"] } },
          { status: "COMPLETED", completedAt: { gte: oneHourAgo } },
          { status: "FAILED", completedAt: { gte: oneHourAgo } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        currentStep: true,
        progress: true,
        error: true,
        keywordId: true,
        startedAt: true,
        createdAt: true,
        blogPostId: true,
        input: true,
      },
    });

    for (const job of jobs) {
      if (job.status === "PROCESSING" && job.startedAt && new Date(job.startedAt) < tenMinutesAgo) {
        await prisma.generationJob.update({
          where: { id: job.id },
          data: { status: "FAILED", error: "Job timed out. Click Retry to try again.", completedAt: new Date() },
        });
        if (job.keywordId) {
          await prisma.blogKeyword.update({
            where: { id: job.keywordId },
            data: { status: "FAILED", errorMessage: "Generation timed out" },
          }).catch(() => {});
        }
        job.status = "FAILED";
        job.error = "Job timed out. Click Retry to try again.";
      }
    }

    const postIds = jobs.map(j => j.blogPostId).filter(Boolean) as string[];
    const posts = postIds.length > 0
      ? await prisma.blogPost.findMany({
          where: { id: { in: postIds } },
          select: { id: true, title: true, slug: true, websiteId: true },
        })
      : [];
    const postMap = new Map(posts.map(p => [p.id, p]));

    const enriched = jobs.map(job => ({
      ...job,
      blogPost: job.blogPostId ? postMap.get(job.blogPostId) || null : null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
