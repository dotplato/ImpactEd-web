import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminDashboardKpis } from "@/components/admin/AdminDashboardKpis";
import { TeachersList } from "@/components/admin/TeachersList";
import { GenderChart } from "@/components/admin/GenderChart";
import { SquareArrowOutUpRight } from "lucide-react";

async function getRecentTeachers(limit = 8) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, profile_pic, qualification, user:users(id, name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) console.error(error);
  return data ?? [];
}

async function getCounts() {
  const supabase = getSupabaseServerClient();
  const teachersCountReq = supabase.from("teachers").select("id", { count: "exact", head: true });
  const studentsCountReq = supabase.from("students").select("id", { count: "exact", head: true });
  const coursesCountReq = supabase.from("courses").select("id", { count: "exact", head: true });

  const maleCountReq = supabase.from("students").select("id", { count: "exact", head: true }).eq("gender", "Male");
  const femaleCountReq = supabase.from("students").select("id", { count: "exact", head: true }).eq("gender", "Female");

  const [teachersRes, studentsRes, coursesRes, maleRes, femaleRes] = await Promise.all([
    teachersCountReq, studentsCountReq, coursesCountReq, maleCountReq, femaleCountReq,
  ]);

  const teachers = teachersRes.count ?? 0;
  const students = studentsRes.count ?? 0;
  const courses = coursesRes.count ?? 0;
  const male = maleRes.count ?? 0;
  const female = femaleRes.count ?? 0;
  return { teachers, students, courses, male, female };
}

export default async function AdminHomePage() {
  const { teachers, students, courses, male, female } = await getCounts();
  const recentTeachers = await getRecentTeachers(8);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      <AdminDashboardKpis teachers={teachers} students={students} courses={courses}  />
     <div className="flex gap-4 w-full max-w-full">
      {/* Teachers Section */}
      <div className="border rounded-xl bg-white p-6 shadow flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Teachers</h2>
          <Link href="/admin/teachers" className="text-indigo-600 hover:text-indigo-800 transition"aria-label="View all teachers">
<SquareArrowOutUpRight  className="w-4 h-4"/>
         </Link>
        </div>
        {recentTeachers.length ? (
          <TeachersList teachers={recentTeachers} />
        ) : (
          <div className="text-muted-foreground text-sm p-6 text-center">No teachers yet.</div>
        )}
      </div>
      <div className="flex-1">
        <GenderChart male={male} female={female} />
      </div>
     </div>
    


    </div>
  );
}


