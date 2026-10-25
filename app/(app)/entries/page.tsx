"use client";
import { useEffect, useState } from "react";
import { useSiteId } from "@/components/Shell";
import {
  dayRange,
  fmtDateTime,
  fmtDwell,
  fmtNumber,
  getEntries,
  getErrorMessage,
  pickArray,
  pickNumber,
} from "@/lib/api";

const PAGE_SIZE = 10;
type Entry = Record<string, unknown>;

const asEntry = (value: unknown): Entry =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Entry)
    : {};

const displayValue = (value: unknown) =>
  typeof value === "number" ? fmtNumber(value) : typeof value === "string" ? value : "-";

export default function EntriesPage() {
  const siteId = useSiteId();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    getEntries(dayRange(0), page, PAGE_SIZE)
      .then((res) => {
        if (!active) return;
        const list = pickArray(res).map(asEntry);
        setRows(list);
        setTotal(pickNumber(res, ["total", "totalCount", "totalRecords", "totalElements"]) || list.length);
        setError("");
      })
      .catch((error: unknown) => {
        if (active) setError(getErrorMessage(error, "Failed to load entries"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, siteId]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goToPage = (nextPage: number) => {
    setLoading(true);
    setPage(nextPage);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Crowd Entries</h2>
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              {["Visitor Name", "Gender", "Entry Time", "Exit Time", "Dwell Time"].map((h, index) => (
                <th key={`${h}-${index}`} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No records</td></tr>
            ) : (
              rows.map((entry, index) => (
                <tr key={`${String(entry.id ?? "entry")}-${page}-${index}`} className="border-t">
                  <td className="px-4 py-3">{displayValue(entry.name ?? entry.visitorName ?? entry.personName)}</td>
                  <td className="px-4 py-3 capitalize">{displayValue(entry.gender)}</td>
                  <td className="px-4 py-3">{fmtDateTime(entry.entryTime ?? entry.entry ?? entry.entryUtc)}</td>
                  <td className="px-4 py-3">
                    {entry.exitTime ?? entry.exit ?? entry.exitUtc
                      ? fmtDateTime(entry.exitTime ?? entry.exit ?? entry.exitUtc)
                      : "Inside"}
                  </td>
                  <td className="px-4 py-3">{fmtDwell(entry.dwellTime ?? entry.dwell ?? entry.dwellMinutes)}</td>
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
            onClick={() => goToPage(page - 1)}
            className="rounded border bg-white px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page >= pages}
            onClick={() => goToPage(page + 1)}
            className="rounded border bg-white px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
