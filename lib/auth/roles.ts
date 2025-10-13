export type AppRole = "admin" | "teacher" | "student";

export function roleHomePath(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
  }
}


