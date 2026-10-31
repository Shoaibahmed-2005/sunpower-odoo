import React, { ReactNode } from "react";
import { Loader2, LucideIcon } from "lucide-react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
}

const variantClasses = {
  primary: "bg-primary text-white border border-primary hover:brightness-110 active:brightness-95 shadow-sm",
  secondary: "bg-surface text-text border border-border hover:bg-surface-2 active:bg-border/30",
  danger: "bg-danger text-white border border-danger hover:brightness-110 active:brightness-95 shadow-sm",
  ghost: "bg-transparent text-primary hover:bg-surface-2 active:bg-border/20",
  accent: "bg-accent text-white border border-accent hover:brightness-105 active:brightness-95 shadow-sm",
} as const;

const sizeClasses = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-control px-4 text-sm gap-2",
  lg: "h-control-lg px-6 text-base gap-2.5",
} as const;

export default function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  disabledReason,
  loading = false,
  onClick,
  children,
  className = "",
  type = "button",
  icon: Icon,
  iconPosition = "left",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const buttonElement = (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={`relative inline-flex items-center justify-center rounded-md font-body font-medium select-none whitespace-nowrap transition-all duration-150 ${
        variantClasses[variant]
      } ${sizeClasses[size]} ${
        isDisabled
          ? "opacity-50 cursor-not-allowed hover:brightness-100 active:brightness-100 shadow-none pointer-events-auto"
          : "cursor-pointer"
      } ${loading ? "opacity-75" : ""} ${className}`}
      title={disabled && disabledReason ? disabledReason : undefined}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        Icon && iconPosition === "left" && <Icon className="w-4 h-4 shrink-0" />
      )}
      <span>{children}</span>
      {!loading && Icon && iconPosition === "right" && (
        <Icon className="w-4 h-4 shrink-0" />
      )}
    </button>
  );

  return buttonElement;
}
