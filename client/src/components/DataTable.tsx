import { type ReactNode } from "react";
import { Search, Inbox } from "lucide-react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
}

interface KanbanConfig<T> {
  groupBy: string;
  groups: string[];
  card: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  kanban?: KanbanConfig<T>;
  emptyMessage?: string;
}

export default function DataTable<T extends object>({
  columns,
  rows,
  onRowClick,
  searchPlaceholder,
  onSearch,
  emptyMessage = "No data found",
}: DataTableProps<T>) {
  return (
    <div>
      {onSearch && (
        <div className="mb-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder={searchPlaceholder ?? "Search…"}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full h-control rounded-sm border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-2">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-sp3 py-sp3 text-muted text-xs uppercase font-semibold tracking-wider ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-16">
                <div className="flex flex-col items-center justify-center text-muted gap-2">
                  <Inbox className="w-10 h-10" />
                  <span className="text-sm">{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`bg-surface border-b border-border h-12 hover:bg-surface-2 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-sp3 text-sm ${
                      col.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
