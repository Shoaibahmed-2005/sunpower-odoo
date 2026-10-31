/**
 * Quotation List page with status filtering and search.
 * Owner: C (BUILD_PLAN §7, §9, §11).
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatINR, formatDate } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";

interface QuotationItem {
  id: number;
  ref: string;
  leadName: string;
  packageCode: string;
  total: number;
  paid: number;
  status: string;
  createdAt: string;
}

const STATUS_FILTERS = ["ALL", "DRAFT", "SENT", "CONFIRMED", "CANCELLED"] as const;

export default function QuotationList() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const { data: quotations = [], isLoading } = useQuery<QuotationItem[]>({
    queryKey: qk.quotations,
    queryFn: async () => {
      const res = await api.get("/quotations");
      return res.data;
    },
  });

  const filteredQuotes = useMemo(() => {
    return quotations.filter((item) => {
      const matchesFilter =
        activeFilter === "ALL" || item.status === activeFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.ref.toLowerCase().includes(q) ||
        item.leadName.toLowerCase().includes(q) ||
        item.packageCode.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [quotations, activeFilter, search]);

  const columns = [
    {
      key: "ref",
      label: "Reference",
      render: (row: QuotationItem) => (
        <span className="font-mono font-medium text-primary hover:underline">
          {row.ref}
        </span>
      ),
    },
    {
      key: "leadName",
      label: "Customer / Lead",
    },
    {
      key: "packageCode",
      label: "Package",
      render: (row: QuotationItem) => (
        <span className="font-mono text-xs bg-bg px-2 py-0.5 rounded border border-border">
          {row.packageCode}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total Amount",
      align: "right" as const,
      render: (row: QuotationItem) => (
        <span className="font-medium text-text">{formatINR(row.total)}</span>
      ),
    },
    {
      key: "paid",
      label: "Paid",
      align: "right" as const,
      render: (row: QuotationItem) => (
        <span className={row.paid > 0 ? "text-success font-medium" : "text-muted"}>
          {formatINR(row.paid)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: QuotationItem) => <Badge status={row.status} />,
    },
    {
      key: "createdAt",
      label: "Created Date",
      align: "right" as const,
      render: (row: QuotationItem) => (
        <span className="text-muted text-xs">{formatDate(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Quotations" />

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex gap-1 border-b border-border pb-1">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              onClick={() => setActiveFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                activeFilter === st
                  ? "bg-primary text-white"
                  : "text-muted hover:text-text hover:bg-surface-2"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-card shadow-card border border-border p-4">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted">
            Loading quotations…
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredQuotes}
            onRowClick={(row) => navigate(`/quotations/${row.id}`)}
            searchPlaceholder="Search by ref, lead name, package…"
            onSearch={setSearch}
            emptyMessage="No quotations found."
          />
        )}
      </div>
    </div>
  );
}
