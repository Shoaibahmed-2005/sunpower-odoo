import { type ReactNode } from "react";
import Logo from "./Logo";

interface PhoneLayoutProps {
  title: string;
  children: ReactNode;
}

export default function PhoneLayout({ title, children }: PhoneLayoutProps) {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-bg">
      <header className="h-14 bg-primary flex items-center px-4 gap-3">
        <Logo variant="mark" size="sm" />
        <span className="text-white font-heading font-semibold text-lg">{title}</span>
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}
