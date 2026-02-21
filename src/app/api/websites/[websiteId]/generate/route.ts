/**
 * POST /api/websites/[websiteId]/generate
 * Enqueue a blog generation job for the next pending keyword (or a specific one).
 * The job is picked up and processed by the Droplet worker — NOT by Vercel.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { enqueueGenerationJob, checkGenerationLimit, triggerWorker } from "@/lib/job-queue";

async function verifyAccess(websiteId: string, userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: { include: { websites: true } } },
  });
  return membership?.organization.websites.find((w) => w.id === websiteId) || null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;
    const website = await verifyAccess(websiteId, session.user.id);
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const limitCheck = await checkGenerationLimit(websiteId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 403 });
    }

    if (website.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Website is paused or deleted. Resume it from settings to generate content." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      keywordId,
      contentLength = "MEDIUM",
      includeImages = true,
      includeFAQ = true,
      includeTableOfContents = true,
      autoPublish = false,
    } = body;

    let keyword;
    if (keywordId) {
      keyword = await prisma.blogKeyword.findFirst({
        where: { id: keywordId, websiteId, status: "PENDING" },
      });
    } else {
      keyword = await prisma.blogKeyword.findFirst({
        where: { websiteId, status: "PENDING" },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
    }

    if (!keyword) {
      return NextResponse.json(
        { error: "No pending keywords in queue. Add keywords first." },
        { status: 400 }
      );
    }

    const activeJob = await prisma.generationJob.findFirst({
      where: {
        websiteId,
        status: { in: ["QUEUED", "PROCESSING"] },
      },
    });

    if (activeJob) {
      return NextResponse.json(
        { error: "A generation job is already running for this website.", jobId: activeJob.id },
        { status: 409 }
      );
    }

    const jobId = await enqueueGenerationJob({
      keywordId: keyword.id,
      keyword: keyword.keyword,
      websiteId,
      contentLength,
      includeImages,
      includeFAQ,
      includeTableOfContents,
      autoPublish,
    });

    // Notify the Droplet worker to pick up the job (fire-and-forget)
    triggerWorker(jobId);

    return NextResponse.json({
      jobId,
      keyword: keyword.keyword,
      message: "Generation started. Poll /api/jobs/[jobId] for progress.",
      remaining: limitCheck.remaining,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
