"use client";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import StatCard from "@/components/StatCard";
import { useSiteId } from "@/components/Shell";
import {
  dayRange, fmtDwell, fmtTime, getDemographics, getDwell, getFootfall, getOccupancy,
  pickArray, pickNumber,
} from "@/lib/api";
import { closeSocket, getSocket } from "@/lib/socket";

const pct = (now: number, prev: number) => (prev ? ((now - prev) / prev) * 100 : null);

export default function Dashboard() {
  const siteId = useSiteId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState<number | null>(null);
  const [footfall, setFootfall] = useState(0);
  const [footDelta, setFootDelta] = useState<number | null>(null);
  const [dwell, setDwell] = useState(0);
  const [dwellDelta, setDwellDelta] = useState<number | null>(null);
  const [occ, setOcc] = useState<{ time: string; count: number }[]>([]);
  const [demo, setDemo] = useState<{ time: string; male: number; female: number }[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    setError("");
    const today = dayRange(0);
    const yest = dayRange(1);

    (async () => {
      try {
        const [d0, d1, f0, f1, o, dm] = await Promise.all([
          getDwell(today), getDwell(yest), getFootfall(today), getFootfall(yest),
          getOccupancy(today), getDemographics(today),
        ]);
        if (!active) return;

        const dw = pickNumber(d0, ["avgDwellMinutes", "averageDwellTime", "avgDwell", "dwell"]);
        const dwY = pickNumber(d1, ["avgDwellMinutes", "averageDwellTime", "avgDwell", "dwell"]);
        const ff = pickNumber(f0, ["footfall", "count", "total"]);
        const ffY = pickNumber(f1, ["footfall", "count", "total"]);
        setDwell(dw); setDwellDelta(pct(dw, dwY));
        setFootfall(ff); setFootDelta(pct(ff, ffY));

        const occSeries = pickArray(o).map((r: any) => ({
          time: fmtTime(r.time ?? r.timestamp ?? r.hour ?? r.label ?? r.bucket ?? r.from),
          count: Number(r.count ?? r.occupancy ?? r.value ?? r.avg ?? 0),
        }));
        setOcc(occSeries);
        if (occSeries.length) setLive(occSeries[occSeries.length - 1].count);

        setDemo(
          pickArray(dm).map((r: any) => ({
            time: fmtTime(r.time ?? r.timestamp ?? r.hour ?? r.label ?? r.bucket ?? r.from),
            male: Number(r.male ?? r.Male ?? r.maleCount ?? 0),
            female: Number(r.female ?? r.Female ?? r.femaleCount ?? 0),
          }))
        );
      } catch (e: any) {
        if (active) {
          setError(e?.response?.data?.message || e?.message || "Failed to load dashboard data");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    // ---- real-time ----
    const s = getSocket();
    const onLive = (p: any) => {
      const n = pickNumber(p, ["occupancy", "count", "liveOccupancy", "total"]);
      setLive(n);
      setOcc((prev) => [...prev.slice(-199), { time: fmtTime(Date.now()), count: n }]);
    };
    const onAlert = (p: any) => setAlerts((prev) => [{ ...p, _t: Date.now() }, ...prev].slice(0, 20));

    s.on("live_occupancy", onLive);
    s.on("live occupancy", onLive); // event name in the doc has a space
    s.on("alert", onAlert);
    return () => {
      active = false;
      s.off("live_occupancy", onLive);
      s.off("live occupancy", onLive);
      s.off("alert", onAlert);
      closeSocket();
    };
  }, [siteId]);

  const male = demo.reduce((a, b) => a + b.male, 0);
  const female = demo.reduce((a, b) => a + b.female, 0);
  const pie = [
    { name: "Male", value: male },
    { name: "Female", value: female },
  ];

  if (loading) return <p className="text-gray-500">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Overview</h2>
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Live Occupancy" value={live ?? "-"} hint="Updates in real time" />
        <StatCard title="Today's Footfall" value={footfall} delta={footDelta} />
        <StatCard title="Avg Dwell Time" value={fmtDwell(dwell)} delta={dwellDelta} />
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-medium">Occupancy Timeline</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={occ}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#0d9488" fill="#99f6e4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-3 font-medium">Demographics (Male vs Female)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={demo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="male" stroke="#2563eb" dot={false} />
                <Line type="monotone" dataKey="female" stroke="#db2777" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-medium">Gender Split</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
                  <Cell fill="#2563eb" />
                  <Cell fill="#db2777" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-medium">Live Alerts</h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-gray-400">No alerts yet. Waiting for entry/exit events…</p>
        ) : (
          <ul className="divide-y text-sm">
            {alerts.map((a,i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>
                  <b className="capitalize">{a.action ?? a.type ?? "event"}</b> · zone {a.zone ?? a.zoneName ?? "-"} ·
                  site {a.site ?? a.siteName ?? "-"}
                </span>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  {a.severity ?? "info"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
