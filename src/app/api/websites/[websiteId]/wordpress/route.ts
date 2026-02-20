/**
 * GET  /api/websites/[websiteId]/wordpress — get WP config
 * POST /api/websites/[websiteId]/wordpress — save WP config
 * DELETE /api/websites/[websiteId]/wordpress — remove WP config
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { testWordPressConnection } from "@/lib/cms/wordpress";

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

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: {
        cmsType: true,
        cmsApiUrl: true,
        cmsApiKey: true,
        webhookUrl: true,
      },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const isPlugin = website.cmsApiKey?.startsWith("plugin:") ?? false;
    return NextResponse.json({
      connected: !!(website.cmsApiUrl && website.cmsApiKey),
      siteUrl: website.cmsApiUrl || "",
      hasPassword: !!(website.cmsApiKey),
      cmsType: website.cmsType,
      mode: isPlugin ? "plugin" : "app-password",
    });
  } catch (error) {
    console.error("WordPress GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
    const body = await req.json();
    const { action, mode, siteUrl, username, appPassword, pluginApiKey, defaultStatus } = body;

    const cleanUrl = (siteUrl || "").replace(/\/$/, "");

    // ── Plugin mode test ──────────────────────────────────────────────
    if (action === "test" && mode === "plugin") {
      if (!siteUrl || !pluginApiKey) {
        return NextResponse.json({ error: "siteUrl and pluginApiKey are required" }, { status: 400 });
      }
      try {
        const res = await fetch(`${cleanUrl}/wp-json/stackserp/v1/status`, {
          headers: { "X-StackSerp-Key": pluginApiKey },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json() as Record<string, string>;
          return NextResponse.json({ success: true, version: data.version ?? "1.0" });
        }
        return NextResponse.json({ success: false, error: `WordPress returned ${res.status} — check your API key and that the plugin is active` });
      } catch {
        return NextResponse.json({ success: false, error: "Could not reach your WordPress site — check the URL and that the plugin is installed" });
      }
    }

    // ── App-password test ─────────────────────────────────────────────
    if (action === "test") {
      if (!siteUrl || !username || !appPassword) {
        return NextResponse.json({ error: "siteUrl, username, and appPassword are required" }, { status: 400 });
      }
      const result = await testWordPressConnection({ siteUrl, username, appPassword, defaultStatus: defaultStatus || "draft" });
      return NextResponse.json(result);
    }

    // ── Plugin mode save ──────────────────────────────────────────────
    if (mode === "plugin") {
      if (!siteUrl || !pluginApiKey) {
        return NextResponse.json({ error: "siteUrl and pluginApiKey are required" }, { status: 400 });
      }
      await prisma.website.update({
        where: { id: websiteId },
        data: {
          cmsType: "WORDPRESS",
          cmsApiUrl: cleanUrl,
          // prefix distinguishes plugin key from app-password (base64)
          cmsApiKey: `plugin:${pluginApiKey}`,
        },
      });
      return NextResponse.json({ success: true });
    }

    // ── App-password save ─────────────────────────────────────────────
    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json({ error: "siteUrl, username, and appPassword are required" }, { status: 400 });
    }
    const encoded = Buffer.from(`${username}:::${appPassword}`).toString("base64");
    await prisma.website.update({
      where: { id: websiteId },
      data: {
        cmsType: "WORDPRESS",
        cmsApiUrl: cleanUrl,
        cmsApiKey: encoded,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WordPress POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteId } = await params;

    await prisma.website.update({
      where: { id: websiteId },
      data: {
        cmsType: null,
        cmsApiUrl: null,
        cmsApiKey: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WordPress DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
