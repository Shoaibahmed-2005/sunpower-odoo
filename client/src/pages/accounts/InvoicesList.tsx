/**
 * Invoices List page with Mark Paid action.
 * Owner: C (BUILD_PLAN §7, §9, §11 P1).
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, DollarSign } from "lucide-react";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatINR, formatDate, formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import { toast } from "../../components/Toast";
import { useAuth } from "../../auth/AuthContext";

interface InvoiceItem {
  id: number;
  ref: string;
  leadName: string;
  quotationRef?: string | null;
  ticketRef?: string | null;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
}

const STATUS_FILTERS = ["ALL", "DUE", "PAID"] as const;

export default function InvoicesList() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const { data: invoices = [], isLoading } = useQuery<InvoiceItem[]>({
    queryKey: qk.invoices,
    queryFn: async () => {
      const res = await api.get("/invoices");
      return res.data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/invoices/${id}/mark-paid`);
      return res.data;
    },
    onSuccess: (updated) => {
      toast.success(`Invoice ${updated.ref} marked as PAID`);
      queryClient.invalidateQueries({ queryKey: qk.invoices });
      queryClient.invalidateQueries({ queryKey: qk.quotations });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter((item) => {
      const matchesFilter =
        activeFilter === "ALL" || item.status === activeFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.ref.toLowerCase().includes(q) ||
        item.leadName.toLowerCase().includes(q) ||
        (item.quotationRef && item.quotationRef.toLowerCase().includes(q)) ||
        (item.ticketRef && item.ticketRef.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [invoices, activeFilter, search]);

  const canWrite = can("invoices:write");

  const columns = [
    {
      key: "ref",
      label: "Invoice Ref",
      render: (row: InvoiceItem) => (
        <span className="font-mono font-semibold text-primary">{row.ref}</span>
      ),
    },
    {
      key: "leadName",
      label: "Customer",
    },
    {
      key: "source",
      label: "Source Reference",
      render: (row: InvoiceItem) => (
        <span className="font-mono text-xs text-muted">
          {row.quotationRef || row.ticketRef || "-"}
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (row: InvoiceItem) => (
        <span className="px-2 py-0.5 rounded text-xs bg-bg border border-border">
          {row.type}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right" as const,
      render: (row: InvoiceItem) => (
        <span className="font-mono font-semibold text-text">
          {formatINR(row.amount)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: InvoiceItem) => <Badge status={row.status} />,
    },
    {
      key: "date",
      label: "Date",
      align: "right" as const,
      render: (row: InvoiceItem) => (
        <span className="text-xs text-muted">
          {formatDate(row.paidAt || row.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      align: "right" as const,
      render: (row: InvoiceItem) => {
        if (row.status === "DUE" && canWrite) {
          return (
            <Button
              variant="secondary"
              onClick={() => markPaidMutation.mutate(row.id)}
              loading={markPaidMutation.isPending}
              className="text-xs h-7 px-2.5 py-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-success" /> Mark Paid
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Invoices & Billing" />

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
            Loading invoices…
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredInvoices}
            searchPlaceholder="Search by invoice ref, customer, quote ref…"
            onSearch={setSearch}
            emptyMessage="No invoices found."
          />
        )}
      </div>
    </div>
  );
}
