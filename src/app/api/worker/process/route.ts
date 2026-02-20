/**
 * POST /api/worker/process
 * Worker endpoint that processes QUEUED generation jobs.
 * Runs on the Droplet (no timeout) — called by:
 *   1. Vercel's generate route (fire-and-forget trigger)
 *   2. The Droplet's own polling interval
 *
 * Protected by CRON_SECRET.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processJob, recoverStuckJobs } from "@/lib/job-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await recoverStuckJobs();

    const body = await req.json().catch(() => ({}));
    const { jobId } = body as { jobId?: string };

    let job;

    if (jobId) {
      job = await prisma.generationJob.findFirst({
        where: { id: jobId, status: "QUEUED" },
      });
    }

    if (!job) {
      job = await prisma.generationJob.findFirst({
        where: { status: "QUEUED" },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!job) {
      return NextResponse.json({ processed: false, reason: "no_queued_jobs" });
    }

    await processJob(job.id);

    return NextResponse.json({ processed: true, jobId: job.id });
  } catch (error) {
    console.error("[WORKER] Error:", error);
    return NextResponse.json(
      { error: "Worker processing failed", details: String(error) },
      { status: 500 }
    );
  }
}
