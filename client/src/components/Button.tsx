import { Loader2 } from "lucide-react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
}

const variantClasses = {
  primary: "bg-primary text-white",
  secondary: "bg-surface text-primary border border-border",
  danger: "bg-danger text-white",
  ghost: "bg-transparent text-primary hover:bg-surface-2",
  accent: "bg-accent text-white",
} as const;

export default function Button({
  variant = "primary",
  disabled = false,
  loading = false,
  onClick,
  children,
  className = "",
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-md h-control px-4 font-body font-medium text-sm ${variantClasses[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-90"} ${loading ? "opacity-70 pointer-events-none" : ""} ${className}`}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
