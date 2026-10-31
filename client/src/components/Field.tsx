import React, { ReactNode } from "react";

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export default function Field({
  label,
  error,
  hint,
  required,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="text-[13px] font-medium text-muted mb-1.5 flex items-center gap-1 select-none">
          <span>{label}</span>
          {required && <span className="text-danger font-bold">*</span>}
        </label>
      )}
      <div className="relative">{children}</div>
      {error ? (
        <p className="text-xs text-danger mt-1 font-medium">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
  className = "",
}: FormSectionProps) {
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2";

  return (
    <div className={`mb-6 pb-6 border-b border-border/70 last:border-0 last:mb-0 last:pb-0 ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h4 className="font-heading text-base font-semibold text-text">
              {title}
            </h4>
          )}
          {description && (
            <p className="text-xs text-muted mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className={`grid gap-4 ${colClass}`}>{children}</div>
    </div>
  );
}
