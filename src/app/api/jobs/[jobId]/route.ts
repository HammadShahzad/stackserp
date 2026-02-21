/**
 * GET /api/jobs/[jobId]  — Poll generation job status
 * POST /api/jobs/[jobId] — Retry a failed or stuck job
 */
import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getJobStatus, processJob } from "@/lib/job-queue";
import prisma from "@/lib/prisma";

const STUCK_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

/** Returns the job only if the current user has access to its website. */
async function getJobWithOwnership(jobId: string, userId: string, isAdmin: boolean) {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { id: true, websiteId: true, keywordId: true },
  });
  if (!job) return null;

  if (isAdmin) return job;

  // Verify user belongs to the org that owns this website
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  if (!membership) return null;

  const website = await prisma.website.findFirst({
    where: { id: job.websiteId, organizationId: membership.organizationId },
    select: { id: true },
  });

  return website ? job : null;
}

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
    const isAdmin = (session.user as { systemRole?: string }).systemRole === "ADMIN";

    // IDOR fix: verify ownership before exposing job data
    const ownership = await getJobWithOwnership(jobId, session.user.id, isAdmin);
    if (!ownership) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = await getJobStatus(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Auto-detect stuck jobs: PROCESSING but started > threshold
    const isStuck =
      job.status === "PROCESSING" &&
      job.startedAt &&
      Date.now() - new Date(job.startedAt).getTime() > STUCK_THRESHOLD_MS;

    if (isStuck) {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", error: "Job timed out. Click Retry to try again.", completedAt: new Date() },
      });
      if (ownership.keywordId) {
        await prisma.blogKeyword.update({
          where: { id: ownership.keywordId },
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
    const isAdmin = (session.user as { systemRole?: string }).systemRole === "ADMIN";

    // IDOR fix: verify ownership before allowing retry
    const ownership = await getJobWithOwnership(jobId, session.user.id, isAdmin);
    if (!ownership) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Only allow retrying failed/stuck jobs (not actively processing ones)
    if (job.status === "PROCESSING" || job.status === "QUEUED") {
      return NextResponse.json({ error: "Job is already running" }, { status: 409 });
    }

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
