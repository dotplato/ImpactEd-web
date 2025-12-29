"use client";

import { Card } from "../ui/card";
import Image from "next/image";
import { TrendingUp } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number;
  iconSrc: string;
  iconAlt: string;
  trend?: number;
}

export function KpiCard({ title, value, iconSrc, iconAlt, trend }: KpiCardProps) {
  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex flex-row justify-between items-start gap-4">
        <div className="flex flex-col">
          <h2 className="text-md text-muted-foreground">{title}</h2>
          <div className="text-3xl font-semibold mt-1">{value}</div>
        </div>
        <span className="rounded-full p-3 flex-shrink-0 flex items-center justify-center">
          <Image 
            src={iconSrc} 
            alt={iconAlt} 
            width={90} 
            height={90}
            className="object-contain w-18 h-18"
          />
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="w-4 h-4 text-green-600" />
        <span className="text-green-600 font-medium">
          {trend !== undefined ? `+${trend}%` : "+12.5%"}
        </span>
      </div>
    </Card>
  );
}

export function AdminDashboardKpis({ 
  teachers, 
  students, 
  courses,
  teacherTrend,
  studentTrend,
  courseTrend
}: { 
  teachers: number; 
  students: number; 
  courses: number;
  teacherTrend?: number;
  studentTrend?: number;
  courseTrend?: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      <KpiCard
        title="Total Teachers"
        value={teachers}
        iconSrc="/icons/teacher-brand-icon.png"
        iconAlt="Teachers"
        trend={teacherTrend}
      />
      <KpiCard
        title="Total Students"
        value={students}
        iconSrc="/icons/student-brand-icon.png"
        iconAlt="Students"
        trend={studentTrend}
      />
      <KpiCard
        title="Total Courses"
        value={courses}
        iconSrc="/icons/course-brand-icon.png"
        iconAlt="Courses"
        trend={courseTrend}
      />
    </div>
  );
}
