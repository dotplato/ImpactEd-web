 "use client"

import { IconCirclePlusFilled, IconSearch,IconListDetails, type Icon } from "@tabler/icons-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { AppUser } from "@/lib/auth/session"

type NavItem = {
  title: string
  url: string
  icon?: Icon
}

type NavMainProps = {
  items: NavItem[]
  role: AppUser["role"] | null
}

export function NavMain({ items, role }: NavMainProps) {
  const isStudent = role === "student"

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            {isStudent ? (
              <SidebarMenuButton
                asChild
                tooltip="To do"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground active:bg-secondary/90 active:text-secondary-foreground min-w-8 duration-200 ease-linear"
              >
                <Link href="/todos">
                  <IconListDetails />
                  <span>To do</span>
                </Link>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                tooltip="Create"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground active:bg-secondary/90 active:text-secondary-foreground min-w-8 duration-200 ease-linear"
              >
                <IconCirclePlusFilled />
                <span>Create</span>
              </SidebarMenuButton>
            )}
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <IconSearch />
              <span className="sr-only">Search</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <Link href={item.url} key={item.title}>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </Link>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
