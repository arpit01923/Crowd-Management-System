"use client";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import StatCard from "@/components/StatCard";
import { useSiteId } from "@/components/Shell";
import {
  dayRange, fmtDwell, fmtNumber, fmtTime, getDemographics, getDwell, getErrorMessage, getFootfall, getOccupancy,
  pickArray, pickNumber,
} from "@/lib/api";
import { closeSocket, getSocket } from "@/lib/socket";

type DataPoint = Record<string, unknown>;
type AlertItem = {
  id: number;
  payload: DataPoint;
};

const pct = (now: number, prev: number) => (prev ? ((now - prev) / prev) * 100 : null);

const asRecord = (value: unknown): DataPoint =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DataPoint)
    : {};

const pointValue = (point: DataPoint, ...keys: string[]) =>
  keys.map((key) => point[key]).find((value) => value !== undefined);

const displayValue = (value: unknown) =>
  typeof value === "number" ? fmtNumber(value) : typeof value === "string" ? value : "-";

const pointNumber = (point: DataPoint, ...keys: string[]) => {
  const value = Number(pointValue(point, ...keys) ?? 0);
  return Number.isFinite(value) ? value : 0;
};

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
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    const today = dayRange(0);
    const yest = dayRange(1);

    (async () => {
      try {
        const [d0, d1, f0, f1, o, dm] = await Promise.all([
          getDwell(today), getDwell(yest), getFootfall(today), getFootfall(yest),
          getOccupancy(today), getDemographics(today),
        ]);
        if (!active) return;

        setError("");
        const dw = pickNumber(d0, ["avgDwellMinutes", "averageDwellTime", "avgDwell", "dwell"]);
        const dwY = pickNumber(d1, ["avgDwellMinutes", "averageDwellTime", "avgDwell", "dwell"]);
        const ff = pickNumber(f0, ["footfall", "count", "total"]);
        const ffY = pickNumber(f1, ["footfall", "count", "total"]);
        setDwell(dw); setDwellDelta(pct(dw, dwY));
        setFootfall(ff); setFootDelta(pct(ff, ffY));

        const occSeries = pickArray(o).map((value) => {
          const point = asRecord(value);
          return {
            time: fmtTime(pointValue(point, "time", "timestamp", "hour", "label", "bucket", "from")),
            count: pointNumber(point, "count", "occupancy", "value", "avg"),
          };
        });
        setOcc(occSeries);
        if (occSeries.length) setLive(occSeries[occSeries.length - 1].count);

        setDemo(
          pickArray(dm).map((value) => {
            const point = asRecord(value);
            return {
              time: fmtTime(pointValue(point, "time", "timestamp", "hour", "label", "bucket", "from")),
              male: pointNumber(point, "male", "Male", "maleCount"),
              female: pointNumber(point, "female", "Female", "femaleCount"),
            };
          })
        );
      } catch (error: unknown) {
        if (active) {
          setError(getErrorMessage(error, "Failed to load dashboard data"));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    // ---- real-time ----
    const s = getSocket();
    const onLive = (payload: unknown) => {
      const n = pickNumber(payload, ["occupancy", "count", "liveOccupancy", "total"]);
      setLive(n);
      setOcc((prev) => [...prev.slice(-199), { time: fmtTime(Date.now()), count: n }]);
    };
    const onAlert = (payload: unknown) =>
      setAlerts((prev) => [{ id: Date.now(), payload: asRecord(payload) }, ...prev].slice(0, 20));

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
              <YAxis tickFormatter={fmtNumber} />
              <Tooltip formatter={(value) => fmtNumber(value)} />
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
                <YAxis tickFormatter={fmtNumber} />
                <Tooltip formatter={(value) => fmtNumber(value)} />
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
                <Pie
                  data={pie}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${fmtNumber(value)}`}
                >
                  <Cell fill="#2563eb" />
                  <Cell fill="#db2777" />
                </Pie>
                <Tooltip formatter={(value) => fmtNumber(value)} />
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
            {alerts.map(({ id, payload }, index) => (
              <li key={`${id}-${index}`} className="flex items-center justify-between py-2">
                <span>
                  <b className="capitalize">{displayValue(payload.action ?? payload.type ?? "event")}</b> · zone{" "}
                  {displayValue(payload.zone ?? payload.zoneName)} · site{" "}
                  {displayValue(payload.site ?? payload.siteName)}
                </span>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  {displayValue(payload.severity ?? "info")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
