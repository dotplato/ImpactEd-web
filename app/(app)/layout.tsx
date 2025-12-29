"use client";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";

function getPageTitle(pathname: string): string {
  // Remove leading slash and split path
  const path = pathname.replace(/^\//, "");
  
  // Handle root path
  if (path === "" || path === "/") {
    return "Dashboard";
  }
  
  // Handle dynamic routes
  if (path.startsWith("courses/")) {
    return "Course Details";
  }
  
  // Map common paths to titles
  const titleMap: Record<string, string> = {
    "courses": "Courses",
    "courses/new": "Create Course",
    "sessions": "Sessions",
    "teachers": "Teachers",
    "students": "Students",
  };
  
  // Check if path matches any key in titleMap
  for (const [key, title] of Object.entries(titleMap)) {
    if (path === key || path.startsWith(key + "/")) {
      return title;
    }
  }
  
  // Capitalize first letter of path segment as fallback
  const segments = path.split("/");
  return segments.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <div className="border-b h-12 flex items-center gap-2 px-3">
          <SidebarTrigger />
          <div className="text-sm text-muted-foreground">{pageTitle}</div>
        </div>
        <div className="p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

