"use client";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function GenderChart({ male, female }: { male: number; female: number }) {
  const chartData = [
    { name: 'Male', value: male, fill: '#6366F1' },
    { name: 'Female', value: female, fill: '#EC4899' },
  ];
  const maxVal = Math.max(male, female, 1);

  return (
    <div className="border rounded-lg p-4 bg-white flex flex-col items-center justify-center">
      <span className="mb-2 text-sm font-medium">Students Gender Ratio</span>
      <div className="w-[220px] h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius={70}
            outerRadius={100}
            barSize={18}
            data={chartData}
            startAngle={90}
            endAngle={-270}
            cx="50%"
            cy="50%"
          >
            <PolarAngleAxis type="number" domain={[0, maxVal]} tick={false} angleAxisId={0} />
            <RadialBar minAngle={15} clockWise={true} background dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1 mt-2 w-full px-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#6366F1" }} />
          <span className="w-16">Male</span>
          <span className="text-muted-foreground">{male}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#EC4899" }} />
          <span className="w-16">Female</span>
          <span className="text-muted-foreground">{female}</span>
        </div>
      </div>
    </div>
  );
}

