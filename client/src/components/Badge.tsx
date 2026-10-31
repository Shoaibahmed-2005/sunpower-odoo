import React from "react";

interface BadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
}

const successStatuses = new Set([
  "DONE", "APPROVED", "PAID", "DELIVERED", "CLOSED", "Covered", "WON", "QUALIFIED"
]);
const warningStatuses = new Set([
  "IN_PROGRESS", "SENT", "DUE", "SUBMITTED", "IN_REPAIR", "SURVEY_SCHEDULED", "CONTACTED"
]);
const dangerStatuses = new Set([
  "REJECTED", "CANCELLED", "LOST", "Expired", "OVERDUE", "FAILED"
]);
const infoStatuses = new Set([
  "NEW", "SCHEDULED", "ASSIGNED", "DRAFT", "READY", "SURVEY_APPROVED", "QUOTED", "PICKED"
]);

function getStatusStyle(status: string): string {
  const normalized = status.toUpperCase().replace(/\s+/g, "_");
  if (successStatuses.has(status) || successStatuses.has(normalized)) {
    return "bg-[#1E8E5A]/15 text-[#14663f] border border-[#1E8E5A]/30";
  }
  if (warningStatuses.has(status) || warningStatuses.has(normalized)) {
    return "bg-[#D97706]/15 text-[#965104] border border-[#D97706]/30";
  }
  if (dangerStatuses.has(status) || dangerStatuses.has(normalized)) {
    return "bg-[#D93F3F]/15 text-[#9c2525] border border-[#D93F3F]/30";
  }
  if (infoStatuses.has(status) || infoStatuses.has(normalized)) {
    return "bg-[#2F6FDE]/15 text-[#1b4fa7] border border-[#2F6FDE]/30";
  }
  return "bg-surface-2 text-muted border border-border";
}

export default function Badge({ status, size = "md", className = "", children }: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs";
  const displayLabel = children ?? status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm font-body font-medium select-none ${getStatusStyle(
        status
      )} ${sizeClass} ${className}`}
    >
      {displayLabel}
    </span>
  );
}
