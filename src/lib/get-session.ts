import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session;
}

export async function getCurrentOrganization() {
  const session = await getRequiredSession();

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: {
        include: {
          subscription: true,
          websites: {
            where: { status: { not: "DELETED" } },
            orderBy: { createdAt: "asc" },
            // Only select fields needed by the layout — avoids schema-mismatch
            // errors when new columns are added but migrations haven't run yet
            select: {
              id: true,
              name: true,
              domain: true,
              subdomain: true,
              status: true,
              niche: true,
              brandName: true,
              brandUrl: true,
              primaryColor: true,
              faviconUrl: true,
              createdAt: true,
              organizationId: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/login");
  }

  return {
    session,
    organization: membership.organization,
    membership,
  };
}

export async function getWebsite(websiteId: string) {
  const { session, organization } = await getCurrentOrganization();

  // Try the user's own org first
  let website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: organization.id,
      status: { not: "DELETED" },
    },
  });

  // Admin fallback: load any website
  if (!website && session.user.systemRole === "ADMIN") {
    website = await prisma.website.findFirst({
      where: { id: websiteId, status: { not: "DELETED" } },
    });
  }

  if (!website) {
    redirect("/dashboard/websites");
  }

  return { session, organization, website };
}
