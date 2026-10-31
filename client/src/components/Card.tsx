import React, { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export default function Card({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = "",
  onClick,
  hoverable,
}: CardProps) {
  const isClickable = !!onClick || hoverable;

  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-border rounded-card shadow-card p-5 md:p-6 transition-all duration-150 ${
        isClickable ? "cursor-pointer hover:shadow-pop hover:border-primary/40" : ""
      } ${className}`}
    >
      {(title || actions || Icon) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/80 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="font-heading text-base md:text-lg font-semibold text-text truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
