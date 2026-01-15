"use client"

import { IconCirclePlusFilled, IconSearch, IconListDetails, IconBook, IconChalkboardTeacher, IconFiles, IconAB2, type Icon } from "@tabler/icons-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Create"
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground active:bg-secondary/90 active:text-secondary-foreground min-w-8 duration-200 ease-linear"
                  >
                    <IconCirclePlusFilled />
                    <span>Create</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <Link href="/courses/new">
                    <DropdownMenuItem className="cursor-pointer">
                      <IconBook className="mr-2 size-4" />
                      <span>Course</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/sessions?create=true">
                    <DropdownMenuItem className="cursor-pointer">
                      <IconChalkboardTeacher className="mr-2 size-4" />
                      <span>Session</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/assignments?create=true">
                    <DropdownMenuItem className="cursor-pointer">
                      <IconFiles className="mr-2 size-4" />
                      <span>Assignment</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/quizzes?create=true">
                    <DropdownMenuItem className="cursor-pointer">
                      <IconAB2 className="mr-2 size-4" />
                      <span>Quiz</span>
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
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
