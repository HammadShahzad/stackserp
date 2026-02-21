import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { verifyWebsiteAccess } from "@/lib/api-helpers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.userJob.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Auto-sync running content jobs with actual GenerationJob status
  const runningContentJobs = jobs.filter(
    (j) => j.status === "running" && j.type === "content" && j.id.startsWith("content-")
  );

  if (runningContentJobs.length > 0) {
    const genJobIds = runningContentJobs.map((j) => j.id.replace("content-", ""));
    const genJobs = await prisma.generationJob.findMany({
      where: { id: { in: genJobIds } },
      select: { id: true, status: true, currentStep: true, progress: true, error: true },
    });
    const genMap = new Map(genJobs.map((g) => [g.id, g]));

    for (const uj of runningContentJobs) {
      const genId = uj.id.replace("content-", "");
      const gen = genMap.get(genId);
      if (!gen) continue;

      let newStatus: string | null = null;
      if (gen.status === "COMPLETED") newStatus = "done";
      else if (gen.status === "FAILED") newStatus = "failed";

      if (newStatus) {
        await prisma.userJob.update({
          where: { id: uj.id },
          data: {
            status: newStatus,
            progress: gen.status === "COMPLETED" ? 100 : gen.progress,
            step: gen.currentStep,
            error: gen.error,
          },
        }).catch(() => {});

        const idx = jobs.findIndex((j) => j.id === uj.id);
        if (idx !== -1) {
          jobs[idx] = {
            ...jobs[idx],
            status: newStatus,
            progress: gen.status === "COMPLETED" ? 100 : gen.progress,
            step: gen.currentStep,
            error: gen.error,
          };
        }
      } else if (gen.status === "PROCESSING" || gen.status === "QUEUED") {
        // Update progress/step even if still running
        if (gen.progress !== uj.progress || gen.currentStep !== uj.step) {
          await prisma.userJob.update({
            where: { id: uj.id },
            data: { progress: gen.progress, step: gen.currentStep },
          }).catch(() => {});

          const idx = jobs.findIndex((j) => j.id === uj.id);
          if (idx !== -1) {
            jobs[idx] = { ...jobs[idx], progress: gen.progress, step: gen.currentStep };
          }
        }
      }
    }
  }

  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, type, label, status, progress, step, steps, error, data, href, websiteId } = body;

  if (!type || !label || !websiteId)
    return NextResponse.json({ error: "type, label, websiteId required" }, { status: 400 });

  // Verify the websiteId belongs to the current user's organization
  const websiteAccess = await verifyWebsiteAccess(websiteId);
  if ("error" in websiteAccess) return websiteAccess.error;

  const job = await prisma.userJob.upsert({
    where: { id: id || "none" },
    update: {
      type, label, status: status || "running", progress: progress ?? 0,
      step: step ?? null, steps: steps ?? [], error: error ?? null,
      data: data ?? undefined, href: href ?? null,
    },
    create: {
      id: id || undefined,
      type, label, status: status || "running", progress: progress ?? 0,
      step: step ?? null, steps: steps ?? [], error: error ?? null,
      data: data ?? undefined, href: href ?? null,
      websiteId, userId: session.user.id,
    },
  });

  return NextResponse.json(job, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...patch } = body;

  if (!id)
    return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.userJob.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const updated = await prisma.userJob.update({
    where: { id },
    data: {
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.progress !== undefined && { progress: patch.progress }),
      ...(patch.step !== undefined && { step: patch.step }),
      ...(patch.error !== undefined && { error: patch.error }),
      ...(patch.data !== undefined && { data: patch.data }),
      ...(patch.label !== undefined && { label: patch.label }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id)
    return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.userJob.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
