import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { enqueueGenerationJob, processJob } from "@/lib/job-queue";

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
    const { keywordIds, count = 3, contentLength = "MEDIUM", autoPublish = false } = await req.json();

    // Check subscription limit
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: { organization: { include: { subscription: true } } },
    });

    const subscription = membership?.organization?.subscription;
    const remaining = subscription
      ? subscription.maxPostsPerMonth - subscription.postsGeneratedThisMonth
      : 3;

    if (remaining <= 0) {
      return NextResponse.json(
        { error: "Monthly post limit reached. Please upgrade your plan." },
        { status: 403 }
      );
    }

    // Find keywords to generate
    let keywords;
    if (keywordIds && keywordIds.length > 0) {
      keywords = await prisma.blogKeyword.findMany({
        where: { id: { in: keywordIds }, websiteId, status: "PENDING" },
        orderBy: { priority: "asc" },
        take: Math.min(count, remaining, 10),
      });
    } else {
      keywords = await prisma.blogKeyword.findMany({
        where: { websiteId, status: "PENDING" },
        orderBy: { priority: "asc" },
        take: Math.min(count, remaining, 10),
      });
    }

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "No pending keywords found. Add keywords first." },
        { status: 400 }
      );
    }

    // Enqueue a job for each keyword
    const jobs = await Promise.all(
      keywords.map(async (kw) => {
        const jobId = await enqueueGenerationJob({
          keywordId: kw.id,
          keyword: kw.keyword,
          websiteId,
          contentLength,
          includeImages: true,
          includeFAQ: true,
          autoPublish,
        });

        // Use after() to keep function alive post-response
        after(async () => {
          try {
            await processJob(jobId);
          } catch (err) {
            console.error(`Bulk generation error for keyword ${kw.keyword}:`, err);
          }
        });

        return { jobId, keyword: kw.keyword };
      })
    );

    return NextResponse.json({
      queued: jobs.length,
      jobs,
      message: `${jobs.length} posts queued for generation`,
    });
  } catch (error) {
    console.error("Bulk generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
