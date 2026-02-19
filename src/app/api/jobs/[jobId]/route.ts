/**
 * GET /api/jobs/[jobId]  — Poll generation job status
 * POST /api/jobs/[jobId] — Retry a failed or stuck job
 */
import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getJobStatus, processJob } from "@/lib/job-queue";
import prisma from "@/lib/prisma";

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const job = await getJobStatus(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Auto-detect stuck jobs: PROCESSING but started > 10 min ago
    const isStuck =
      job.status === "PROCESSING" &&
      job.startedAt &&
      Date.now() - new Date(job.startedAt).getTime() > STUCK_THRESHOLD_MS;

    if (isStuck) {
      // Reset to QUEUED so user can retry
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", error: "Job timed out. Click Retry to try again.", completedAt: new Date() },
      });
      // Also reset keyword status
      const rawJob = await prisma.generationJob.findUnique({ where: { id: jobId }, select: { keywordId: true } });
      if (rawJob?.keywordId) {
        await prisma.blogKeyword.update({
          where: { id: rawJob.keywordId },
          data: { status: "FAILED", errorMessage: "Generation timed out" },
        });
      }
    }

    // Get blog post details if completed
    let blogPost = null;
    if (job.status === "COMPLETED" && job.blogPostId) {
      blogPost = await prisma.blogPost.findUnique({
        where: { id: job.blogPostId },
        select: { id: true, title: true, slug: true, status: true, websiteId: true },
      });
    }

    return NextResponse.json({ ...job, blogPost, isStuck: isStuck ?? false });
  } catch (error) {
    console.error("Job status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Reset job + keyword to allow reprocessing
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "QUEUED", error: null, startedAt: null, completedAt: null, progress: 0, currentStep: null },
    });
    if (job.keywordId) {
      await prisma.blogKeyword.update({
        where: { id: job.keywordId },
        data: { status: "RESEARCHING", errorMessage: null },
      });
    }

    // Reprocess using after() to keep function alive
    after(async () => {
      try {
        await processJob(jobId);
      } catch (err) {
        console.error("Retry job failed:", err);
      }
    });

    return NextResponse.json({ success: true, message: "Job restarted" });
  } catch (error) {
    console.error("Job retry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
