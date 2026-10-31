import React from "react";
import { Check } from "lucide-react";

interface StatusBarProps {
  steps: string[];
  current: string;
  onStepClick?: (step: string) => void;
  className?: string;
}

export default function StatusBar({
  steps,
  current,
  onStepClick,
  className = "",
}: StatusBarProps) {
  const currentIdx = steps.findIndex(
    (s) => s.toLowerCase() === current.toLowerCase()
  );

  return (
    <div className={`w-full overflow-x-auto pb-1 mb-6 ${className}`}>
      <div className="flex items-center min-w-max border border-border rounded-md bg-surface p-1 shadow-xs">
        {steps.map((step, i) => {
          const isCompleted = currentIdx !== -1 && i < currentIdx;
          const isCurrent = currentIdx !== -1 && i === currentIdx;
          const isFuture = currentIdx === -1 || i > currentIdx;
          const isClickable = !!onStepClick;

          let stepStyle = "bg-transparent text-muted hover:text-text border-transparent";
          if (isCurrent) {
            stepStyle = "bg-primary text-white font-semibold shadow-xs";
          } else if (isCompleted) {
            stepStyle = "bg-surface-2 text-text font-medium";
          } else if (isFuture) {
            stepStyle = "text-muted/70 hover:text-muted";
          }

          return (
            <React.Fragment key={step}>
              {i > 0 && (
                <div className="w-4 h-full flex items-center justify-center text-border shrink-0 select-none">
                  <svg
                    className="w-3.5 h-6 text-border stroke-current fill-none"
                    viewBox="0 0 12 24"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 0 L8 12 L0 24"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              <button
                type="button"
                onClick={isClickable ? () => onStepClick(step) : undefined}
                disabled={!isClickable}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-xs md:text-sm transition-colors whitespace-nowrap select-none ${stepStyle} ${
                  isClickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {isCompleted ? (
                  <span className="w-4 h-4 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </span>
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full border border-muted/50 shrink-0" />
                )}
                <span>{step}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
