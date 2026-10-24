"use client";
import { useEffect, useState } from "react";
import { useSiteId } from "@/components/Shell";
import { dayRange, fmtDateTime, fmtDwell, getEntries, pickArray, pickNumber } from "@/lib/api";

const PAGE_SIZE = 10;

export default function EntriesPage() {
  const siteId = useSiteId();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    setLoading(true);
    setError("");
    getEntries(dayRange(0), page, PAGE_SIZE)
      .then((res) => {
        if (!active) return;
        const list = pickArray(res);
        setRows(list);
        setTotal(pickNumber(res, ["total", "totalCount", "totalRecords", "totalElements"]) || list.length);
      })
      .catch((e) => {
        if (active) setError(e?.response?.data?.message || "Failed to load entries");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, siteId]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Crowd Entries</h2>
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              {["Visitor Name", "Gender", "Entry Time", "Exit Time", "Dwell Time"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No records</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id ?? i} className="border-t">
                  <td className="px-4 py-3">{r.name ?? r.visitorName ?? r.personName ?? "-"}</td>
                  <td className="px-4 py-3 capitalize">{r.gender ?? "-"}</td>
                  <td className="px-4 py-3">{fmtDateTime(r.entryTime ?? r.entry ?? r.entryUtc)}</td>
                  <td className="px-4 py-3">
                    {r.exitTime ?? r.exit ?? r.exitUtc ? fmtDateTime(r.exitTime ?? r.exit ?? r.exitUtc) : "Inside"}
                  </td>
                  <td className="px-4 py-3">{fmtDwell(r.dwellTime ?? r.dwell ?? r.dwellMinutes)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Page {page} of {pages} · {total} records</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border bg-white px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border bg-white px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
