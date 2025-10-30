"use client";

import { Card } from "../ui/card";

export function AdminDashboardKpis({ teachers, students, courses }: { teachers: number; students: number; courses: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

      <Card className="p-4 flex  flex-row justify-between gap-4">
        <div className="flex flex-col">
          <div className="text-xs text-muted-foreground">Total Teachers</div>
          <div className="text-2xl font-semibold mt-1">{teachers}</div>
        </div>
        <span className="rounded-full bg-indigo-100 p-2 flex-shrink-0">
          {/* Teachers Icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="4" />
            <path d="M5.5 21v-2A3.5 3.5 0 0 1 9 15.5h6A3.5 3.5 0 0 1 18.5 19v2" />
          </svg>
        </span>
      </Card>

      <Card className="p-4 flex  flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Total Students</div>
          <div className="text-2xl font-semibold mt-1">{students}</div>
        </div>
        <span className="rounded-full bg-green-100 p-2 flex-shrink-0">
          {/* Students Icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="4" />
            <path d="M4 21v-2A4 4 0 0 1 8 15h8a4 4 0 0 1 4 4v2" />
          </svg>
        </span>
      </Card>

      <Card className="p-4 flex  flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Total Courses</div>
          <div className="text-2xl font-semibold mt-1">{courses}</div>
        </div>
        <span className="rounded-full bg-yellow-100 p-2 flex-shrink-0">
          {/* Courses Icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M16 3v4M8 3v4" />
            <path d="M3 9h18" />
          </svg>
        </span>
      </Card>
    </div>
  );
}
