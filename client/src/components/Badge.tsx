interface BadgeProps {
  status: string;
}

const successStatuses = new Set(["DONE", "APPROVED", "PAID", "DELIVERED", "CLOSED", "Covered"]);
const warningStatuses = new Set(["IN_PROGRESS", "SENT", "DUE", "SUBMITTED", "IN_REPAIR"]);
const dangerStatuses = new Set(["REJECTED", "CANCELLED", "LOST", "Expired"]);
const infoStatuses = new Set(["NEW", "SCHEDULED", "ASSIGNED", "DRAFT", "READY"]);

function getStatusStyle(status: string): string {
  if (successStatuses.has(status))
    return "bg-[rgba(30,142,90,0.15)] text-success";
  if (warningStatuses.has(status))
    return "bg-[rgba(217,158,31,0.15)] text-warning";
  if (dangerStatuses.has(status))
    return "bg-[rgba(220,53,69,0.15)] text-danger";
  if (infoStatuses.has(status))
    return "bg-[rgba(37,99,235,0.15)] text-info";
  return "bg-[rgba(107,114,128,0.15)] text-muted";
}

export default function Badge({ status }: BadgeProps) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium ${getStatusStyle(status)}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
