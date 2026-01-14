# Agent Guidelines for Impacted Platform 2

This document outlines the coding patterns, conventions, and best practices for maintaining consistency across the Impacted Platform 2 project.

## Project Overview

**Impacted Platform 2** is a virtual coaching platform built with Next.js 15, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui. It uses Supabase for database operations and Better Auth for authentication.

## Tech Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **React**: 19.1.0
- **TypeScript**: 5.x (strict mode enabled)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (New York style)
- **Database**: Supabase
- **Authentication**: Better Auth (custom implementation)
- **Icons**: Lucide React (primary), Tabler Icons (secondary)
- **Form Validation**: Zod
- **State Management**: React hooks (useState, useEffect, useMemo)
- **Build Tool**: Turbopack

## Project Structure

```
app/
  (app)/          # Protected app routes (requires auth)
  (auth)/         # Authentication routes (sign-in, sign-up)
  api/            # API routes
  dashboard/      # Dashboard pages
components/
  ui/             # shadcn/ui components
  admin/          # Admin-specific components
  course/         # Course-related components
  assignments/    # Assignment components
  quizzes/        # Quiz components
  sessions/       # Session components
  chat/           # Chat components
lib/
  actions/        # Server actions
  auth/           # Authentication utilities
  db/             # Database clients (Supabase)
hooks/            # Custom React hooks
supabase/
  migrations/     # Database migrations
```

## Code Patterns & Conventions

### File Naming

- **Routes**: Use `page.tsx` for pages, `route.ts` for API routes, `layout.tsx` for layouts
- **Components**: PascalCase (e.g., `CourseCard.tsx`, `AppSidebar.tsx`)
- **Utilities**: camelCase (e.g., `utils.ts`, `supabase-server.ts`)
- **Hooks**: kebab-case with `use-` prefix (e.g., `use-mobile.ts`)

### Component Patterns

#### Client Components
- Always add `"use client"` directive at the top
- Use for interactive components, hooks, and browser APIs
- Example:
```tsx
"use client";
import { useState } from "react";

export function MyComponent() {
  const [state, setState] = useState();
  // ...
}
```

#### Server Components
- Default in Next.js App Router (no directive needed)
- Use for data fetching, server-side logic
- Cannot use hooks or browser APIs

#### Component Structure
```tsx
// 1. "use client" if needed
// 2. Imports (external, then internal)
// 3. Type definitions
// 4. Component function
// 5. Exports
```

### TypeScript Conventions

- **Strict mode**: Always enabled
- **Type definitions**: Define types/interfaces before components
- **Props types**: Use `type Props = { ... }` pattern
- **API responses**: Type all API responses
- **Null handling**: Use optional chaining (`?.`) and nullish coalescing (`??`)

Example:
```tsx
type CourseDetails = {
  id: string;
  title: string;
  description?: string | null;
  teacher?: { id: string; name: string | null } | null;
};

type Props = {
  course: CourseDetails;
  onEdit?: () => void;
};
```

### Styling with Tailwind CSS

#### Class Utilities
- Always use `cn()` utility from `@/lib/utils` for conditional classes
- Prefer Tailwind utility classes over custom CSS
- Use semantic color tokens (e.g., `text-muted-foreground`, `bg-primary`)

Example:
```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "border rounded-lg p-4",
  isActive && "bg-accent",
  className
)}>
```

#### Spacing & Layout
- Use Tailwind spacing scale: `space-y-4`, `gap-2`, `p-6`, etc.
- Responsive: `md:grid-cols-2`, `lg:col-span-3`
- Grid: `grid grid-cols-1 lg:grid-cols-4 gap-6`

#### Color System
- Use CSS variables for theming: `bg-background`, `text-foreground`
- Muted colors: `text-muted-foreground`, `bg-muted`
- Semantic colors: `text-destructive`, `bg-primary`, `border-border`

### shadcn/ui Component Usage

#### Import Pattern
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
```

#### Component Variants
- Use variant props for styling: `variant="outline"`, `variant="ghost"`
- Use size props: `size="sm"`, `size="lg"`, `size="icon"`
- Use `asChild` prop for composition

Example:
```tsx
<Button variant="outline" size="sm" asChild>
  <Link href="/courses">Courses</Link>
</Button>
```

#### Common Components
- `Button`: Primary actions
- `Card`: Content containers
- `Dialog`: Modals
- `Sheet`: Side panels
- `Table`: Data tables
- `Input`, `Textarea`: Form inputs
- `Select`: Dropdowns
- `Avatar`: User avatars
- `Badge`: Status indicators
- `Tabs`: Tab navigation
- `Skeleton`: Loading states

### API Route Patterns

#### Structure
```tsx
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const RequestSchema = z.object({
  // validation schema
});

export async function GET(req: Request) {
  try {
    // Implementation
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
```

#### Error Handling
- Always use try-catch blocks
- Return appropriate HTTP status codes
- Provide meaningful error messages
- Use Zod for request validation

#### Response Format
- Success: `NextResponse.json({ ok: true, data: ... })`
- Error: `NextResponse.json({ error: "message" }, { status: 400 })`
- Use `maybeSingle()` for optional queries

### Database Patterns (Supabase)

#### Server Client
```tsx
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const supabase = getSupabaseServerClient();
```

#### Query Patterns
- Use `.maybeSingle()` for optional single results
- Use `.single()` for required single results
- Always handle errors
- Use TypeScript types for responses

Example:
```tsx
const { data, error } = await supabase
  .from("users")
  .select("id, email, role")
  .eq("email", email.toLowerCase())
  .maybeSingle();

if (error || !data) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

### Form Handling

#### Controlled Components
```tsx
const [form, setForm] = useState({
  title: "",
  scheduledAt: "",
  duration: 60,
});

<input
  value={form.title}
  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
/>
```

#### Form Submission
```tsx
async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  const res = await fetch("/api/endpoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await res.json();
  if (!res.ok) {
    setError(data?.error || "Failed");
    return;
  }
  // Success handling
}
```

### State Management

#### Local State
- Use `useState` for component state
- Use `useMemo` for computed values
- Use `useEffect` for side effects

#### Loading States
```tsx
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

async function loadData() {
  setLoading(true);
  setError(null);
  try {
    // fetch data
  } catch (e) {
    setError("Failed to load");
  } finally {
    setLoading(false);
  }
}
```

### Authentication & Authorization

#### Role-Based Access
- Roles: `"admin" | "teacher" | "student"`
- Check roles in components: `userRole === "admin" || userRole === "teacher"`
- Protect routes in middleware

#### Session Management
- Session cookie: `ba_session`
- Fetch user role: `/api/me`
- Check authentication in middleware

### Path Aliases

Use these path aliases (configured in `tsconfig.json`):
- `@/components` → `components/`
- `@/lib` → `lib/`
- `@/hooks` → `hooks/`
- `@/app` → `app/`

### Icon Usage

#### Lucide React (Primary)
```tsx
import { BookOpen, Video, FileText } from "lucide-react";
<BookOpen className="size-5" />
```

#### Tabler Icons (Secondary)
```tsx
import { IconHome, IconUsers } from "@tabler/icons-react";
<IconHome className="size-5" />
```

### Code Quality

#### ESLint
- Uses Next.js ESLint config
- TypeScript strict mode
- Follow linting errors

#### Best Practices
1. **Error Handling**: Always handle errors gracefully
2. **Loading States**: Show loading indicators
3. **Accessibility**: Use semantic HTML, ARIA labels
4. **Performance**: Use `useMemo` for expensive computations
5. **Type Safety**: Type all props, functions, and API responses
6. **Code Organization**: Group related code together
7. **Comments**: Add comments for complex logic only

### Common Patterns

#### Conditional Rendering
```tsx
{loading ? (
  <div>Loading...</div>
) : error ? (
  <div className="text-red-600">{error}</div>
) : data ? (
  <div>{/* content */}</div>
) : (
  <div>No data</div>
)}
```

#### Tab Navigation
```tsx
const [activeTab, setActiveTab] = useState<"overview" | "schedule">("overview");

<button
  className={cn(
    "px-3 py-2 text-sm",
    activeTab === "overview" && "border-b-2 border-foreground font-medium"
  )}
  onClick={() => setActiveTab("overview")}
>
  Overview
</button>
```

#### Date Formatting
```tsx
{new Date(dateString).toLocaleString()}
{new Date(dateString).toLocaleDateString()}
```

### Migration & Database

- Migrations in `supabase/migrations/`
- Use numbered migration files: `0001_name.sql`
- Test migrations before committing

## Development Workflow

1. **Create Feature Branch**: `git checkout -b feature/name`
2. **Follow Patterns**: Use existing code as reference
3. **Type Everything**: Add TypeScript types
4. **Test Locally**: Run `npm run dev`
5. **Check Linting**: Run `npm run lint`
6. **Commit Changes**: Use descriptive commit messages

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com)

