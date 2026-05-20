import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { api } from "../../api/client.js";

const COLORS = ["#031634", "#334155", "#64748b", "#94a3b8", "#cbd5e1"];

export default function Analytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["studio-analytics"],
    queryFn: async () => (await api.get("/api/studio/analytics")).data,
  });

  if (isLoading) {
    return <p className="pt-6 text-sm animate-pulse text-on-surface-variant">Loading analytics…</p>;
  }

  const blogsPerWeek = data?.blogsPerWeek ?? [];
  const statusBreakdown = data?.statusBreakdown ?? [];
  const platformBreakdown = data?.platformBreakdown ?? [];
  const topProjects = data?.topProjects ?? [];
  const wordCountByWeek = data?.wordCountByWeek ?? [];

  return (
    <div className="pt-6 space-y-10 max-w-5xl">
      <div>
        <h1 className="font-headline text-2xl font-semibold text-primary">Studio analytics</h1>
        <p className="text-sm text-on-surface-variant mt-1">Blogging output only — no API marketplace metrics.</p>
      </div>

      <section className="bg-white border border-surface-variant rounded-md p-4">
        <h2 className="text-sm font-semibold text-primary mb-4">Blogs generated per week</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={blogsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#031634" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white border border-surface-variant rounded-md p-4">
          <h2 className="text-sm font-semibold text-primary mb-4">Publishing by platform</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformBreakdown} dataKey="count" nameKey="platform" cx="50%" cy="50%" outerRadius={70} label={({ platform }) => platform}>
                  {platformBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="bg-white border border-surface-variant rounded-md p-4">
          <h2 className="text-sm font-semibold text-primary mb-4">Content status</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({ status: s }) => s}>
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="bg-white border border-surface-variant rounded-md p-4">
        <h2 className="text-sm font-semibold text-primary mb-4">Top projects by output</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProjects} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="title" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#334155" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white border border-surface-variant rounded-md p-4">
        <h2 className="text-sm font-semibold text-primary mb-4">Average word count over time</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wordCountByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#031634" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
