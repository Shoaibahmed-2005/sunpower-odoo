import React, { ReactNode } from "react";
import PhoneLayout from "./PhoneLayout";
import Button from "./Button";
import { LucideIcon } from "lucide-react";

interface PhonePageProps {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  primaryActionLabel?: string;
  primaryActionIcon?: LucideIcon;
  onPrimaryAction?: () => void;
  primaryActionDisabled?: boolean;
  primaryActionDisabledReason?: string;
  primaryActionLoading?: boolean;
  children: ReactNode;
  className?: string;
}

export default function PhonePage({
  title,
  subtitle,
  headerAction,
  primaryActionLabel,
  primaryActionIcon,
  onPrimaryAction,
  primaryActionDisabled,
  primaryActionDisabledReason,
  primaryActionLoading,
  children,
  className = "",
}: PhonePageProps) {
  return (
    <PhoneLayout
      title={title}
      subtitle={subtitle}
      headerAction={headerAction}
      className={className}
    >
      <div className="space-y-4">{children}</div>

      {primaryActionLabel && onPrimaryAction && (
        <div className="pt-2 sticky bottom-4 z-20">
          <Button
            variant="primary"
            size="lg"
            className="w-full shadow-pop font-semibold tracking-wide text-base h-12"
            icon={primaryActionIcon}
            onClick={onPrimaryAction}
            disabled={primaryActionDisabled}
            disabledReason={primaryActionDisabledReason}
            loading={primaryActionLoading}
          >
            {primaryActionLabel}
          </Button>
        </div>
      )}
    </PhoneLayout>
  );
}
