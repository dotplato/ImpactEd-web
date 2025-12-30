"use client";
import { useEffect, useState } from "react";
import AssignmentsPage from "@/components/assignments/AssignmentsPage";

export default function AssignmentsPageWrapper() {
    const [userRole, setUserRole] = useState<"admin" | "teacher" | "student" | null>(null);

    useEffect(() => {
        fetch("/api/me")
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUserRole(data.user.role);
                }
            })
            .catch(() => { });
    }, []);

    if (!userRole) {
        return <div className="text-sm text-muted-foreground p-6">Loading...</div>;
    }

    return <AssignmentsPage role={userRole} />;
}
