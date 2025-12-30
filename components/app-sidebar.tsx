"use client"

import * as React from "react"
import {
  IconHome,
  IconHelp,
  IconInnerShadowTop,
  IconSettings,
  IconUsers,
  IconSchool,
  IconChalkboardTeacher,
  IconSpeakerphone,
  IconBook,
  IconPlane,
  IconMessage,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Overview",
      url: "/",
      icon: IconHome,
    },
    {
      title: "Courses",
      url: "/courses",
      icon: IconBook,
    },
    {
      title: "Teachers",
      url: "/teachers",
      icon: IconUsers,
    },
    {
      title: "Students",
      url: "/students",
      icon: IconSchool,
    },
    {
      title: "Sessions",
      url: "/sessions",
      icon: IconChalkboardTeacher,
    },
    {
      title: "Announcements",
      url: "/announcements",
      icon: IconSpeakerphone
    },
  ],

  navSecondary: [
    {
      title: "Messages",
      url: "/messages",
      icon: IconMessage,
    },
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
  ],
  // documents: [
  //   {
  //     name: "Data Library",
  //     url: "#",
  //     icon: IconDatabase,
  //   },
  //   {
  //     name: "Reports",
  //     url: "#",
  //     icon: IconReport,
  //   },
  //   {
  //     name: "Word Assistant",
  //     url: "#",
  //     icon: IconFileWord,
  //   },
  // ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    const fetchUnread = async () => {
      try {
        // Dynamic import to avoid server-side issues if any, though server actions are fine
        const { getTotalUnreadCount } = await import("@/lib/actions/chat");
        const count = await getTotalUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    };

    fetchUnread();

    // Poll every minute? Or rely on realtime? 
    // Realtime is better but for global badge polling is easier for now without global context
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const navSecondaryWithBadge = data.navSecondary.map(item => {
    if (item.title === "Messages" && unreadCount > 0) {
      return { ...item, badge: unreadCount };
    }
    return item;
  });

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">CourseImpact</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavDocuments items={data.documents} /> */}
        <NavSecondary items={navSecondaryWithBadge} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
