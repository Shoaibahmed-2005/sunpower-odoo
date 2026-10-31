import React, { useState, useMemo, ReactNode } from "react";
import { Search, Inbox, LayoutList, LayoutGrid, X } from "lucide-react";
import Badge from "./Badge";
import Card from "./Card";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
}

export interface FilterChip {
  label: string;
  value: string;
}

export interface KanbanConfig<T> {
  groupBy: string; // key on row for grouping, e.g. "status"
  groups: string[];
  card: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  filterChips?: FilterChip[];
  activeFilter?: string;
  onFilterChange?: (val: string) => void;
  kanban?: KanbanConfig<T>;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  loading?: boolean;
  className?: string;
}

export default function DataTable<T extends object>({
  columns,
  rows,
  onRowClick,
  searchPlaceholder = "Search…",
  onSearch,
  filterChips,
  activeFilter = "ALL",
  onFilterChange,
  kanban,
  emptyMessage = "No records found",
  emptyAction,
  loading = false,
  className = "",
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  const handleSearchChange = (val: string) => {
    setInternalSearch(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  // Client-side search fallback if onSearch wasn't provided but search bar is shown
  const filteredRows = useMemo(() => {
    if (onSearch || !internalSearch.trim()) return rows;
    const term = internalSearch.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) =>
        String(v ?? "").toLowerCase().includes(term)
      )
    );
  }, [rows, internalSearch, onSearch]);

  const showToolbar = Boolean(
    onSearch !== undefined ||
    searchPlaceholder ||
    (filterChips && filterChips.length > 0) ||
    kanban
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border shadow-xs">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {/* Search Box */}
            <div className="relative w-full sm:w-64 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={internalSearch}
                placeholder={searchPlaceholder}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-bg/50 hover:bg-surface focus:bg-surface pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
              {internalSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            {filterChips && filterChips.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {filterChips.map((chip) => {
                  const isActive = activeFilter === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onFilterChange?.(chip.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors select-none ${
                        isActive
                          ? "bg-primary text-white shadow-xs"
                          : "bg-surface-2 text-muted hover:text-text hover:bg-border/60"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kanban / List Toggle */}
          {kanban && (
            <div className="flex items-center self-end sm:self-auto border border-border rounded-md p-0.5 bg-surface-2">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="List View"
                className={`p-1.5 rounded-sm transition-colors ${
                  viewMode === "table"
                    ? "bg-surface text-primary shadow-xs"
                    : "text-muted hover:text-text"
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                title="Kanban View"
                className={`p-1.5 rounded-sm transition-colors ${
                  viewMode === "kanban"
                    ? "bg-surface text-primary shadow-xs"
                    : "text-muted hover:text-text"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Kanban View */}
      {kanban && viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start overflow-x-auto pb-2">
          {kanban.groups.map((group) => {
            const groupRows = filteredRows.filter(
              (r) =>
                String((r as any)[kanban.groupBy] ?? "").toUpperCase() ===
                group.toUpperCase()
            );

            return (
              <div
                key={group}
                className="bg-surface-2/60 border border-border rounded-card p-3 min-w-[260px]"
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-xs font-semibold uppercase tracking-wider text-text">
                      {group.replace(/_/g, " ")}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-border/60 text-muted">
                      {groupRows.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {groupRows.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted">
                      Empty
                    </div>
                  ) : (
                    groupRows.map((row, idx) => (
                      <div
                        key={idx}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={onRowClick ? "cursor-pointer" : ""}
                      >
                        {kanban.card(row)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-muted text-xs font-semibold uppercase tracking-wider select-none">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className={`px-4 py-3 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 text-sm">
                {loading ? (
                  // Skeleton Rows
                  Array.from({ length: 5 }).map((_, rIdx) => (
                    <tr key={rIdx} className="h-12 animate-pulse">
                      {columns.map((col, cIdx) => (
                        <td key={cIdx} className="px-4 py-3">
                          <div className="h-4 bg-border/60 rounded-sm w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2.5 text-muted max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted">
                          <Inbox className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <p className="font-heading text-base font-semibold text-text">
                          {emptyMessage}
                        </p>
                        <p className="text-xs text-muted">
                          No matching records were found for the current query or filter.
                        </p>
                        {emptyAction && <div className="mt-2">{emptyAction}</div>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, i) => (
                    <tr
                      key={i}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={`h-11 md:h-12 hover:bg-surface-2/70 transition-colors ${
                        onRowClick ? "cursor-pointer" : ""
                      }`}
                    >
                      {columns.map((col) => {
                        const isRef =
                          col.key === "ref" ||
                          col.key.toLowerCase().includes("serial");
                        const isStatus = col.key.toLowerCase().includes("status");

                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 ${
                              col.align === "right"
                                ? "text-right tabular-nums"
                                : col.align === "center"
                                ? "text-center"
                                : "text-left"
                            } ${isRef ? "font-mono font-medium text-primary text-[13px]" : ""}`}
                          >
                            {col.render ? (
                              col.render(row)
                            ) : isStatus ? (
                              <Badge status={String((row as any)[col.key] ?? "")} />
                            ) : (
                              <span>{String((row as any)[col.key] ?? "—")}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
