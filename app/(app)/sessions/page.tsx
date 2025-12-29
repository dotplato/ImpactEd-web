"use client";
import { useEffect, useState } from "react";
import SessionsPage from "@/components/sessions/SessionsPage";

export default function SessionsPageWrapper() {
  const [userRole, setUserRole] = useState<"admin" | "teacher" | "student" | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUserRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  if (!userRole) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return <SessionsPage role={userRole} />;
}

