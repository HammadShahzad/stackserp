"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import {
  BarChart3,
  Globe,
  FileText,
  KeyRound,
  Bot,
  Link2,
  Network,
  Settings,
  CreditCard,
  Users,
  LayoutDashboard,
  Zap,
  User,
  CalendarDays,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { WebsiteSwitcher } from "./website-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "next-auth/react";

interface Website {
  id: string;
  name: string;
  domain: string;
  status: string;
}

interface AppSidebarProps {
  websites: Website[];
  currentWebsiteId?: string;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AppSidebar({ websites, currentWebsiteId, user }: AppSidebarProps) {
  const pathname = usePathname();

  const mainNavItems = [
    {
      title: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Websites",
      href: "/dashboard/websites",
      icon: Globe,
    },
  ];

  const websiteNavItems = currentWebsiteId
    ? [
        {
          title: "Dashboard",
          href: `/dashboard/websites/${currentWebsiteId}`,
          icon: BarChart3,
        },
        {
          title: "Posts",
          href: `/dashboard/websites/${currentWebsiteId}/posts`,
          icon: FileText,
        },
        {
          title: "Keywords",
          href: `/dashboard/websites/${currentWebsiteId}/keywords`,
          icon: KeyRound,
        },
        {
          title: "AI Generator",
          href: `/dashboard/websites/${currentWebsiteId}/generator`,
          icon: Bot,
        },
        {
          title: "Topic Clusters",
          href: `/dashboard/websites/${currentWebsiteId}/clusters`,
          icon: Network,
        },
        {
          title: "Internal Links",
          href: `/dashboard/websites/${currentWebsiteId}/links`,
          icon: Link2,
        },
        {
          title: "Calendar",
          href: `/dashboard/websites/${currentWebsiteId}/calendar`,
          icon: CalendarDays,
        },
        {
          title: "Analytics",
          href: `/dashboard/websites/${currentWebsiteId}/analytics`,
          icon: BarChart3,
        },
        {
          title: "Settings",
          href: `/dashboard/websites/${currentWebsiteId}/settings`,
          icon: Settings,
        },
      ]
    : [];

  const accountNavItems = [
    {
      title: "Team",
      href: "/dashboard/team",
      icon: Users,
    },
    {
      title: "Billing",
      href: "/dashboard/billing",
      icon: CreditCard,
    },
    {
      title: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0]?.toUpperCase() || "U";

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Logo className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">StackSerp</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Website Switcher + Website Navigation */}
        {websites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Website</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 pb-2">
                <WebsiteSwitcher
                  websites={websites}
                  currentWebsiteId={currentWebsiteId}
                />
              </div>
              {currentWebsiteId && (
                <SidebarMenu>
                  {websiteNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Account Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="text-sm font-medium truncate">{user.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <User className="mr-2 h-4 w-4" />
                Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
