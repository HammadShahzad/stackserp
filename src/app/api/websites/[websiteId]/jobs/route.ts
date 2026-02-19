import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const jobs = await prisma.generationJob.findMany({
      where: {
        websiteId,
        OR: [
          { status: { in: ["QUEUED", "PROCESSING"] } },
          // Also show recently failed jobs so user can retry
          { status: "FAILED", completedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
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

    // Auto-mark stuck PROCESSING jobs as FAILED
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

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
