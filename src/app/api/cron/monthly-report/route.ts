/**
 * POST /api/cron/monthly-report
 * Sends monthly content performance reports to all website owners.
 * Call once per month via Vercel Cron or external scheduler.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const monthName = monthStart.toLocaleString("en", { month: "long", year: "numeric" });

  const websites = await prisma.website.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      brandName: true,
      organization: {
        select: {
          members: {
            where: { role: "OWNER" },
            select: { user: { select: { email: true, name: true } } },
          },
        },
      },
    },
  });

  let sent = 0;
  const resend = process.env.RESEND_API_KEY
    ? (await import("resend")).Resend
    : null;
  const mailer = resend ? new resend(process.env.RESEND_API_KEY!) : null;
  const from = process.env.RESEND_FROM_EMAIL || "BlogForge <noreply@blogforge.app>";

  for (const website of websites) {
    const ownerEmail = website.organization.members[0]?.user?.email;
    if (!ownerEmail) continue;
    const ownerName = website.organization.members[0]?.user?.name || "there";

    const [postsPublished, totalViews, topPost] = await Promise.all([
      prisma.blogPost.count({
        where: {
          websiteId: website.id,
          status: "PUBLISHED",
          publishedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.blogAnalytics.aggregate({
        where: {
          websiteId: website.id,
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { pageViews: true },
      }),
      prisma.blogAnalytics.findFirst({
        where: {
          websiteId: website.id,
          date: { gte: monthStart, lte: monthEnd },
          blogPostId: { not: null },
        },
        orderBy: { pageViews: "desc" },
        select: { blogPostId: true, pageViews: true },
      }),
    ]);

    let topPostTitle = "";
    if (topPost?.blogPostId) {
      const tp = await prisma.blogPost.findUnique({
        where: { id: topPost.blogPostId },
        select: { title: true },
      });
      topPostTitle = tp?.title || "";
    }

    const views = totalViews._sum.pageViews || 0;

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <div style="background:#4F46E5;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">⚡ BlogForge — Monthly Report</h1>
        </div>
        <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px">${monthName} Report</h2>
          <p style="color:#6b7280;margin:0 0 24px">Hey ${ownerName}, here's how <strong>${website.brandName}</strong> performed this month.</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center">
              <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:#16a34a">${postsPublished}</p>
              <p style="margin:0;font-size:13px;color:#15803d">Posts Published</p>
            </div>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center">
              <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:#2563eb">${views.toLocaleString()}</p>
              <p style="margin:0;font-size:13px;color:#1d4ed8">Total Page Views</p>
            </div>
          </div>

          ${topPostTitle ? `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase">Top Performing Post</p>
            <p style="margin:0 0 4px;font-weight:600">${topPostTitle}</p>
            <p style="margin:0;font-size:13px;color:#6b7280">${(topPost?.pageViews || 0).toLocaleString()} views</p>
          </div>` : ""}

          <a href="${process.env.NEXTAUTH_URL}/dashboard/websites/${website.id}/analytics" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            View Full Analytics →
          </a>
        </div>
      </div>
    `;

    if (mailer) {
      try {
        await mailer.emails.send({
          from,
          to: ownerEmail,
          subject: `📊 ${website.brandName} — ${monthName} Content Report`,
          html,
        });
        sent++;
      } catch (err) {
        console.error(`[Monthly Report] Failed for ${website.brandName}:`, err);
      }
    } else {
      console.log(`[Monthly Report — no mailer] ${website.brandName}: ${postsPublished} posts, ${views} views`);
      sent++;
    }
  }

  return NextResponse.json({ sent, total: websites.length });
}
