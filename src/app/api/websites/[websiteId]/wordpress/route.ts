/**
 * GET  /api/websites/[websiteId]/wordpress — get WP config
 * POST /api/websites/[websiteId]/wordpress — save WP config
 * DELETE /api/websites/[websiteId]/wordpress — remove WP config
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { testWordPressConnection } from "@/lib/cms/wordpress";
import { verifyWebsiteAccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ websiteId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

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
      hasPassword: !!website.cmsApiKey,
      cmsType: website.cmsType,
      mode: isPlugin ? "plugin" : "app-password",
    });
  } catch (error) {
    console.error("WordPress GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

    const body = await req.json();
    const { action, mode, siteUrl, username, appPassword, pluginApiKey, defaultStatus } = body;

    const cleanUrl = (siteUrl || "").replace(/\/$/, "");

    if (action === "test" && mode === "plugin") {
      if (!siteUrl || !pluginApiKey) {
        return NextResponse.json({ error: "siteUrl and pluginApiKey are required" }, { status: 400 });
      }
      // Try both stackserp and blogforge plugin namespaces
      const namespaces = ["stackserp", "blogforge"];
      for (const ns of namespaces) {
        try {
          const res = await fetch(`${cleanUrl}/wp-json/${ns}/v1/status`, {
            headers: {
              "X-StackSerp-Key": pluginApiKey,
              "X-BlogForge-Key": pluginApiKey,
            },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const data = await res.json() as Record<string, string>;
            return NextResponse.json({ success: true, version: data.version ?? "1.0", plugin: ns });
          }
        } catch {
          // try next namespace
        }
      }
      return NextResponse.json({
        success: false,
        error: "Could not reach the WordPress plugin — check your API key and that the StackSerp Connector (or BlogForge Connector) plugin is installed and activated",
      });
    }

    if (action === "test") {
      if (!siteUrl || !username || !appPassword) {
        return NextResponse.json({ error: "siteUrl, username, and appPassword are required" }, { status: 400 });
      }
      const result = await testWordPressConnection({ siteUrl, username, appPassword, defaultStatus: defaultStatus || "draft" });
      return NextResponse.json(result);
    }

    if (mode === "plugin") {
      if (!siteUrl || !pluginApiKey) {
        return NextResponse.json({ error: "siteUrl and pluginApiKey are required" }, { status: 400 });
      }
      await prisma.website.update({
        where: { id: websiteId },
        data: {
          cmsType: "WORDPRESS",
          cmsApiUrl: cleanUrl,
          cmsApiKey: `plugin:${pluginApiKey}`,
        },
      });
      return NextResponse.json({ success: true });
    }

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

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { websiteId } = await params;
    const access = await verifyWebsiteAccess(websiteId);
    if ("error" in access) return access.error;

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
