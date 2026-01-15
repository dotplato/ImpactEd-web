"use client";

import { useEffect, useState } from "react";

import AssignmentsPage from "@/components/assignments/AssignmentsPage";
import QuizzesPage from "@/components/quizzes/QuizzesPage";
import SessionsPage from "@/components/sessions/SessionsPage";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Calendar, HelpCircle, FileText } from "lucide-react";

type Role = "admin" | "teacher" | "student";

export default function StudentTodosPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        if (!isMounted) return;
        if (data?.user?.role) {
          setRole(data.user.role as Role);
        } else {
          setRole(null);
        }
      } catch {
        if (isMounted) {
          setRole(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRole();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || !role) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading your to do items...
      </div>
    );
  }

  if (role !== "student") {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        This to do view is only available for students.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">To do</h1>
        <p className="text-muted-foreground">
          See all your upcoming assignments, today&apos;s sessions, and quizzes in one place.
        </p>
      </div>

      <Tabs defaultValue="assignments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="assignments">
            <FileText className="size-4 mr-2" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Calendar className="size-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="quizzes">
            <HelpCircle className="size-4 mr-2" />
            Quizzes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-6">
          <AssignmentsPage role={role} />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <SessionsPage role={role} variant="today-only" />
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-6">
          <QuizzesPage role={role} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


