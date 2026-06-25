"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

export interface PlatformUserRow {
  clerkId: string;
  email?: string;
  name?: string;
  role?: string;
  hmrcConnected: boolean;
  hmrcEori?: string;
}

interface PlatformUsersSectionProps {
  users: PlatformUserRow[];
  loading?: boolean;
  /** Collapsed row count before View All expands the table. */
  previewLimit?: number;
}

function matchesUserSearch(user: PlatformUserRow, term: string): boolean {
  if (!term) return true;
  const haystack = [user.email, user.name, user.role, user.clerkId, user.hmrcEori]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

export function PlatformUsersSection({
  users,
  loading,
  previewLimit = 7,
}: PlatformUsersSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return users.filter((user) => matchesUserSearch(user, term));
  }, [users, searchQuery]);

  const hasMore = filtered.length > previewLimit;
  const visible = expanded || !hasMore ? filtered : filtered.slice(0, previewLimit);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-medium text-black">Platform users</h2>
        </div>
        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[0.6875rem] font-semibold tracking-widest text-blue-600 uppercase transition hover:text-blue-700"
          >
            View All
          </button>
        )}
        {expanded && hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-[0.6875rem] font-semibold tracking-widest text-blue-600 uppercase transition hover:text-blue-700"
          >
            Show Less
          </button>
        )}
      </div>

      <div className="border-b border-slate-100 px-5 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search email, name, role…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 px-5 py-6">
          {Array.from({ length: previewLimit }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-slate-500">
          {searchQuery.trim()
            ? "No users match your search."
            : "No users synced from Clerk yet — sign in once to create your row in Convex."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  HMRC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((user) => (
                <tr key={user.clerkId} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <p className="text-xs font-medium text-slate-900">{user.email || "—"}</p>
                    {user.name && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{user.name}</p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs capitalize text-slate-600">{user.role || "user"}</td>
                  <td className="px-6 py-3 text-xs text-slate-600">
                    {user.hmrcConnected ? (
                      <span className="text-green-700">
                        Connected{user.hmrcEori ? ` · ${user.hmrcEori}` : ""}
                      </span>
                    ) : (
                      <span className="text-slate-400">Not connected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && !expanded && hasMore && (
        <div className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-500">
          Showing {visible.length} of {filtered.length}
          {searchQuery.trim() ? " matching" : ""} user{filtered.length === 1 ? "" : "s"}
        </div>
      )}
    </section>
  );
}
