import { fmtNumber } from "@/lib/api";

export default function StatCard({
  title,
  value,
  delta,
  hint,
}: {
  title: string;
  value: string | number;
  delta?: number | null; // % change vs yesterday
  hint?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold">
        {typeof value === "number" ? fmtNumber(value) : value}
      </p>
      {delta !== undefined && delta !== null && (
        <p className={`mt-1 text-sm ${up ? "text-green-600" : "text-red-600"}`}>
          {up ? "▲" : "▼"} {fmtNumber(Math.abs(delta))}% vs yesterday
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
