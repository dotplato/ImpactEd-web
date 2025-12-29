import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import Link from "next/link";
import { AdminDashboardKpis } from "@/components/admin/AdminDashboardKpis";
import { TeachersList } from "@/components/admin/TeachersList";
import { GenderChart } from "@/components/admin/GenderChart";
import { SquareArrowOutUpRight, BookOpen, Users, GraduationCap, Calendar } from "lucide-react";
import { redirect } from "next/navigation";

async function getRecentTeachers(limit = 8) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, profile_pic, qualification, user:users!teachers_user_id_fkey(id, name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) console.error(error);
  // Transform the data to match the expected type
  return (data ?? []).map((t: any) => ({
    id: t.id,
    profile_pic: t.profile_pic,
    qualification: t.qualification,
    user: Array.isArray(t.user) ? t.user[0] : t.user,
  }));
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

async function getTeacherCourses(userId: string) {
  const supabase = getSupabaseServerClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (!teacher) return [];
  
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, teacher:teachers(id, user:users(name, email))")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false })
    .limit(5);
  
  return courses ?? [];
}

async function getStudentCourses(userId: string) {
  const supabase = getSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (!student) return [];
  
  const { data: enrollments } = await supabase
    .from("course_students")
    .select("course:courses(id, title, teacher:teachers(id, user:users(name, email)))")
    .eq("student_id", student.id)
    .limit(5);
  
  return (enrollments ?? []).map((e: any) => e.course).filter(Boolean);
}

async function getUpcomingSessions(userId: string, role: string) {
  const supabase = getSupabaseServerClient();
  const now = new Date().toISOString();
  
  if (role === "admin") {
    const { data } = await supabase
      .from("course_sessions")
      .select("id, title, scheduled_at, duration_minutes, course:courses(id, title)")
      .gte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(5);
    return data ?? [];
  }
  
  if (role === "teacher") {
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!teacher) return [];
    
    const { data } = await supabase
      .from("course_sessions")
      .select("id, title, scheduled_at, duration_minutes, course:courses(id, title)")
      .eq("teacher_id", teacher.id)
      .gte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(5);
    return data ?? [];
  }
  
  if (role === "student") {
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!student) return [];
    
    const { data: enrollments } = await supabase
      .from("session_students")
      .select("session:course_sessions(id, title, scheduled_at, duration_minutes, course:courses(id, title))")
      .eq("student_id", student.id);
    
    if (!enrollments) return [];
    
    const sessions = enrollments
      .map((e: any) => e.session)
      .filter((s: any) => s && new Date(s.scheduled_at) >= new Date(now))
      .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 5);
    
    return sessions;
  }
  
  return [];
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { role, id } = user;

  if (role === "admin") {
    const { teachers, students, courses, male, female } = await getCounts();
    const recentTeachers = await getRecentTeachers(8);
    const upcomingSessions = await getUpcomingSessions(id, role);

    return (
      <div className="space-y-6">
        <AdminDashboardKpis 
          teachers={teachers} 
          students={students} 
          courses={courses}
          teacherTrend={12.5}
          studentTrend={8.3}
          courseTrend={15.2}
        />
        <div className="flex gap-4 w-full max-w-full">
          {/* Teachers Section */}
          <div className="border rounded-xl bg-white p-6 shadow flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Teachers</h2>
              <Link href="/teachers" className="text-indigo-600 hover:text-indigo-800 transition" aria-label="View all teachers">
                <SquareArrowOutUpRight className="w-4 h-4" />
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
        {upcomingSessions.length > 0 && (
          <div className="border rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
              <Link href="/sessions" className="text-indigo-600 hover:text-indigo-800 transition">
                <SquareArrowOutUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-2">
              {upcomingSessions.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{s.title || "Session"}</div>
                    <div className="text-sm text-muted-foreground">{s.course?.title || "No course"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.scheduled_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (role === "teacher") {
    const courses = await getTeacherCourses(id);
    const upcomingSessions = await getUpcomingSessions(id, role);

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                My Courses
              </h2>
              <Link href="/courses" className="text-indigo-600 hover:text-indigo-800 transition">
                <SquareArrowOutUpRight className="w-4 h-4" />
              </Link>
            </div>
            {courses.length > 0 ? (
              <div className="space-y-2">
                {courses.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/courses/${c.id}`}
                    className="block p-3 border rounded hover:bg-gray-50 transition"
                  >
                    <div className="font-medium">{c.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {c.teacher?.user?.name || "Unassigned"}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm p-6 text-center">No courses yet.</div>
            )}
          </div>
          <div className="border rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Sessions
              </h2>
              <Link href="/sessions" className="text-indigo-600 hover:text-indigo-800 transition">
                <SquareArrowOutUpRight className="w-4 h-4" />
              </Link>
            </div>
            {upcomingSessions.length > 0 ? (
              <div className="space-y-2">
                {upcomingSessions.map((s: any) => (
                  <div key={s.id} className="p-3 border rounded">
                    <div className="font-medium">{s.title || "Session"}</div>
                    <div className="text-sm text-muted-foreground">{s.course?.title || "No course"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.scheduled_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm p-6 text-center">No upcoming sessions.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (role === "student") {
    const courses = await getStudentCourses(id);
    const upcomingSessions = await getUpcomingSessions(id, role);

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                My Courses
              </h2>
              <Link href="/courses" className="text-indigo-600 hover:text-indigo-800 transition">
                <SquareArrowOutUpRight className="w-4 h-4" />
              </Link>
            </div>
            {courses.length > 0 ? (
              <div className="space-y-2">
                {courses.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/courses/${c.id}`}
                    className="block p-3 border rounded hover:bg-gray-50 transition"
                  >
                    <div className="font-medium">{c.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {c.teacher?.user?.name || "Unassigned"}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm p-6 text-center">No enrolled courses yet.</div>
            )}
          </div>
          <div className="border rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Sessions
              </h2>
              <Link href="/sessions" className="text-indigo-600 hover:text-indigo-800 transition">
                <SquareArrowOutUpRight className="w-4 h-4" />
              </Link>
            </div>
            {upcomingSessions.length > 0 ? (
              <div className="space-y-2">
                {upcomingSessions.map((s: any) => (
                  <div key={s.id} className="p-3 border rounded">
                    <div className="font-medium">{s.title || "Session"}</div>
                    <div className="text-sm text-muted-foreground">{s.course?.title || "No course"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.scheduled_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm p-6 text-center">No upcoming sessions.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <div>Unknown role</div>;
}

