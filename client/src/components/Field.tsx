interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Field({ label, error, children, className = "" }: FieldProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-[13px] font-medium text-muted mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
