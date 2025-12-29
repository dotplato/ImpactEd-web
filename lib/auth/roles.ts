export type AppRole = "admin" | "teacher" | "student";

export function roleHomePath(role: AppRole): string {
  // All roles now use the root dashboard
  return "/";
}


