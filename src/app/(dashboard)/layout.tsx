import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { GlobalJobsProvider } from "@/components/dashboard/global-jobs-context";
import { GlobalJobsWidget } from "@/components/dashboard/global-jobs-widget";
import { getCurrentOrganization } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, organization } = await getCurrentOrganization();

  const websites = (organization.websites ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    domain: w.domain,
    status: w.status,
  }));

  return (
    <GlobalJobsProvider>
      <SidebarProvider>
        <AppSidebar
          websites={websites}
          currentWebsiteId={websites[0]?.id}
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
      <GlobalJobsWidget />
    </GlobalJobsProvider>
  );
}
