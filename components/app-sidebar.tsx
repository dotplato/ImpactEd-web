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
  IconFiles,
  IconQuestionMark,
  IconAB2,
} from "@tabler/icons-react"

import { AppUser } from "@/lib/auth/session"
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

const getNavData = (userRole: AppUser["role"] | null, user: AppUser | null) => {
  const allNavItems = [
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
      title: "Sessions",
      url: "/sessions",
      icon: IconChalkboardTeacher,
    },
    {
      title: "Assignments",
      url: "/assignments",
      icon: IconFiles,
    },
    {
      title: "Quizzes",
      url: "/quizzes",
      icon: IconAB2,
    },
    {
      title: "Teachers",
      url: "/teachers",
      icon: IconUsers,
      roles: ["admin", "student"] as const, // Only show to admin and students
    },
    {
      title: "Students",
      url: "/students",
      icon: IconSchool,
      roles: ["admin", "teacher"] as const, // Only show to admin and teachers
    },
    {
      title: "Announcements",
      url: "/announcements",
      icon: IconSpeakerphone
    },
  ];

  // Filter nav items based on user role
  const filteredNavItems = allNavItems.filter(item => {
    if (!item.roles) return true; // Show items without role restrictions to everyone
    if (!userRole) return false; // Hide role-restricted items if no user role
    return (item.roles as readonly AppUser["role"][]).includes(userRole);
  });

  return {
    user: user ? {
      name: user.name || "User",
      email: user.email,
      avatar: user.image_url || "",
    } : {
      name: "User",
      email: "",
      avatar: "",
    },
    navMain: filteredNavItems,
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
  };
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [user, setUser] = React.useState<AppUser | null>(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/me");
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };

    fetchUser();
  }, []);

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

  const data = getNavData(user?.role || null, user);

  const navSecondaryWithBadge = data.navSecondary.map(item => {
    if (item.title === "Messages" && unreadCount > 0) {
      return { ...item, badge: unreadCount };
    }
    return item;
  });

  return (
    <Sidebar collapsible="icon" {...props}>
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
