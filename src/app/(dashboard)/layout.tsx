import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getCurrentOrganization } from "@/lib/get-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, organization } = await getCurrentOrganization();

  const websites = organization.websites.map((w) => ({
    id: w.id,
    name: w.name,
    domain: w.domain,
    status: w.status,
  }));

  // Try to detect current website from URL if on a website-specific page
  // The actual websiteId will be extracted from the URL in the layout
  const defaultWebsiteId = websites[0]?.id;

  return (
    <SidebarProvider>
      <AppSidebar
        websites={websites}
        currentWebsiteId={defaultWebsiteId}
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          systemRole: session.user.systemRole,
        }}
      />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
