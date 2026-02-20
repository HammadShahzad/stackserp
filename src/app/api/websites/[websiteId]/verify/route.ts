import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateVerificationToken, verifyDomain } from "@/lib/domain-verification";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { domain: true, verified: true },
  });

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const token = generateVerificationToken(websiteId);

  return NextResponse.json({
    domain: website.domain,
    verified: website.verified,
    token,
    instructions: {
      dns: {
        type: "TXT",
        host: website.domain,
        value: `stackserp-verify=${token}`,
        description:
          "Add a DNS TXT record to your domain with the value above. It may take a few minutes to propagate.",
      },
      meta: {
        tag: `<meta name="stackserp-verify" content="${token}">`,
        description:
          "Add this meta tag inside the <head> section of your homepage.",
      },
    },
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { domain: true, verified: true },
  });

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  if (website.verified) {
    return NextResponse.json({ verified: true, method: "already_verified" });
  }

  const result = await verifyDomain(website.domain, websiteId);

  if (result.verified) {
    await prisma.website.update({
      where: { id: websiteId },
      data: { verified: true },
    });
  }

  return NextResponse.json(result);
}
