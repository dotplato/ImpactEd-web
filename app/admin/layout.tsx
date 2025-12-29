"use client";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <div className="border-b h-12 flex items-center gap-2 px-3">
          <SidebarTrigger />
          <div className="text-sm text-muted-foreground">Management Console</div>
        </div>
        <div className="p-6">

          {children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}


