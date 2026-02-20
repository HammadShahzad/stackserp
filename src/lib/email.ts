/**
 * Email notifications via Resend
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL in env
 */
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || "StackSerp <noreply@stackserp.com>";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[Email skipped — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("Email send error:", err);
  }
}

// ─── Email templates ──────────────────────────────────────────

export async function sendPostGeneratedEmail(opts: {
  to: string;
  userName: string;
  postTitle: string;
  postUrl: string;
  websiteName: string;
  wordCount: number;
}) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <div style="background:#4F46E5;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">⚡ StackSerp</h1>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 8px">Your post is ready! 🎉</h2>
        <p style="color:#6b7280;margin:0 0 24px">Hey ${opts.userName}, your AI-generated blog post has been created for <strong>${opts.websiteName}</strong>.</p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">New Post</p>
          <p style="margin:0 0 12px;font-size:18px;font-weight:600">${opts.postTitle}</p>
          <p style="margin:0;font-size:13px;color:#6b7280">${opts.wordCount.toLocaleString()} words</p>
        </div>

        <a href="${opts.postUrl}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Review &amp; Publish →
        </a>

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
          You're receiving this because you have email notifications enabled.
          <a href="${process.env.NEXTAUTH_URL}/dashboard/settings" style="color:#4F46E5">Manage preferences</a>
        </p>
      </div>
    </div>
  `;
  await send(opts.to, `✅ New post ready: "${opts.postTitle}"`, html);
}

export async function sendLimitWarningEmail(opts: {
  to: string;
  userName: string;
  used: number;
  limit: number;
  plan: string;
  upgradeUrl: string;
}) {
  const pct = Math.round((opts.used / opts.limit) * 100);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <div style="background:#f59e0b;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">⚡ StackSerp</h1>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 8px">You're at ${pct}% of your monthly limit</h2>
        <p style="color:#6b7280;margin:0 0 24px">Hey ${opts.userName}, you've used <strong>${opts.used}</strong> of your <strong>${opts.limit}</strong> monthly posts on the <strong>${opts.plan}</strong> plan.</p>

        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin-bottom:24px">
          <div style="background:#e5e7eb;border-radius:4px;height:8px;margin-bottom:8px">
            <div style="background:#f59e0b;border-radius:4px;height:8px;width:${pct}%"></div>
          </div>
          <p style="margin:0;font-size:13px;color:#92400e">${opts.used} / ${opts.limit} posts used this month</p>
        </div>

        <a href="${opts.upgradeUrl}" style="display:inline-block;background:#f59e0b;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Upgrade Plan →
        </a>
      </div>
    </div>
  `;
  await send(opts.to, `⚠️ You're at ${pct}% of your monthly post limit`, html);
}

export async function sendWeeklyDigestEmail(opts: {
  to: string;
  userName: string;
  websiteName: string;
  postsPublished: number;
  totalViews: number;
  topPost?: { title: string; views: number; url: string };
  dashboardUrl: string;
}) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <div style="background:#4F46E5;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">⚡ StackSerp — Weekly Digest</h1>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 4px">Your week at a glance</h2>
        <p style="color:#6b7280;margin:0 0 24px">Here's what happened with <strong>${opts.websiteName}</strong> this week.</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center">
            <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:#16a34a">${opts.postsPublished}</p>
            <p style="margin:0;font-size:13px;color:#15803d">Posts Published</p>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center">
            <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:#2563eb">${opts.totalViews.toLocaleString()}</p>
            <p style="margin:0;font-size:13px;color:#1d4ed8">Total Views</p>
          </div>
        </div>

        ${opts.topPost ? `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase">Top Post This Week</p>
          <p style="margin:0 0 8px;font-weight:600">${opts.topPost.title}</p>
          <p style="margin:0;font-size:13px;color:#6b7280">${opts.topPost.views.toLocaleString()} views</p>
        </div>
        ` : ""}

        <a href="${opts.dashboardUrl}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          View Dashboard →
        </a>
      </div>
    </div>
  `;
  await send(opts.to, `📊 ${opts.websiteName} weekly digest — ${opts.postsPublished} posts, ${opts.totalViews.toLocaleString()} views`, html);
}
