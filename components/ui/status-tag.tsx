import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusTagVariants = cva(
  "inline-flex items-center rounded px-2 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        subtle: "",
        outline: "border",
      },
      color: {
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-200",
        blue: "text-blue-600 bg-blue-50 border-blue-200",
        green: "text-green-600 bg-green-50 border-green-200",
        red: "text-red-600 bg-red-50 border-red-200",
        amber: "text-amber-600 bg-amber-50 border-amber-200",
        gray: "text-gray-600 bg-gray-50 border-gray-200",
        violet: "text-violet-600 bg-violet-50 border-violet-200",
        slate: "text-slate-600 bg-slate-50 border-slate-200",
      },
    },
    compoundVariants: [
      { tone: "outline", color: "indigo", className: "bg-transparent" },
      { tone: "outline", color: "blue", className: "bg-transparent" },
      { tone: "outline", color: "green", className: "bg-transparent" },
      { tone: "outline", color: "red", className: "bg-transparent" },
      { tone: "outline", color: "amber", className: "bg-transparent" },
      { tone: "outline", color: "gray", className: "bg-transparent" },
      { tone: "outline", color: "violet", className: "bg-transparent" },
      { tone: "outline", color: "slate", className: "bg-transparent" },
    ],
    defaultVariants: {
      tone: "subtle",
      color: "indigo",
    },
  }
)

type StatusTagProps = React.ComponentProps<"div"> &
  VariantProps<typeof statusTagVariants>

function StatusTag({ className, tone, color, ...props }: StatusTagProps) {
  return (
    <div className={cn(statusTagVariants({ tone, color }), className)} {...props} />
  )
}

export { StatusTag, statusTagVariants }


