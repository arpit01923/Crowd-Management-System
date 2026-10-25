"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  clearToken,
  getErrorMessage,
  getSiteId,
  getSites,
  setSiteId,
  type Site,
} from "@/lib/api";
import { closeSocket } from "@/lib/socket";

const SiteContext = createContext<string | null>(null);

export const useSiteId = () => useContext(SiteContext);

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/entries", label: "Crowd Entries" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState("");

  useEffect(() => {
    getSites()
      .then((availableSites) => {
        setSites(availableSites);
        const savedSiteId = getSiteId();
        const selectedSite = availableSites.find((site) => site.siteId === savedSiteId);
        if (selectedSite) {
          setSelectedSiteId(selectedSite.siteId);
        } else if (availableSites.length === 1) {
          setSiteId(availableSites[0].siteId);
          setSelectedSiteId(availableSites[0].siteId);
        } else {
          setSelectedSiteId(null);
        }
      })
      .catch((error: unknown) => {
        setSitesError(getErrorMessage(error, "Failed to load available sites."));
      })
      .finally(() => setSitesLoading(false));
  }, []);

  const logout = () => {
    closeSocket();
    clearToken();
    router.replace("/login");
  };

  return (
    <SiteContext.Provider value={siteId}>
      <div className="flex min-h-screen bg-gray-50 text-gray-800">
        <aside className="w-56 shrink-0 border-r bg-white p-4 flex flex-col">
          <h1 className="mb-6 text-lg font-bold text-teal-700">Crowd Management</h1>
          <nav className="flex flex-col gap-1">
            {links.map((l, index) => (
              <Link
                key={`${l.href}-${index}`}
                href={l.href}
                className={`rounded px-3 py-2 text-sm ${
                  path === l.href ? "bg-teal-600 text-white" : "hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <label className="mb-4 mt-6 block text-sm font-medium text-gray-700">
            Site
            <select
              value={siteId ?? ""}
              disabled={sitesLoading || sites.length === 0}
              onChange={(event) => {
                const selected = event.target.value;
                if (!selected) return;
                setSiteId(selected);
                setSelectedSiteId(selected);
                closeSocket();
              }}
              className="mt-1 w-full rounded border bg-white px-2 py-2 text-sm"
            >
              <option value="">
                {sitesLoading ? "Loading sites…" : sites.length ? "Select a site" : "No sites available"}
              </option>
              {sites.map((site, index) => (
                <option key={`${site.siteId}-${index}`} value={site.siteId}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          {sitesError && <p className="mb-4 text-xs text-red-600">{sitesError}</p>}
          <button onClick={logout} className="mt-auto rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
            Logout
          </button>
        </aside>
        <main className="flex-1 p-6 overflow-x-auto">
          {!siteId ? (
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
              Select a site to view its analytics.
            </p>
          ) : children}
        </main>
      </div>
    </SiteContext.Provider>
  );
}
