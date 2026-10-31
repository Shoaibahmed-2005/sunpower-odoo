import React, { ReactNode } from "react";
import Logo from "./Logo";

interface PhoneLayoutProps {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function PhoneLayout({
  title,
  subtitle,
  headerAction,
  children,
  className = "",
}: PhoneLayoutProps) {
  return (
    <div className="min-h-screen bg-bg w-full">
      <div className={`w-full max-w-md mx-auto min-h-screen bg-bg flex flex-col shadow-card border-x border-border/40 ${className}`}>
        {/* Mobile Header (High contrast for sunlight) */}
        <header className="h-16 bg-primary text-white flex items-center justify-between px-4 gap-3 shrink-0 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shrink-0">
              <Logo variant="mark" size="sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-heading font-semibold text-lg leading-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/75 text-xs truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </header>

        {/* Content Body */}
        <main className="p-4 flex-1 space-y-4 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
