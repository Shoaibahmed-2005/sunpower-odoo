import { Check } from "lucide-react";

interface StatusBarProps {
  steps: string[];
  current: string;
}

export default function StatusBar({ steps, current }: StatusBarProps) {
  const currentIdx = steps.indexOf(current);

  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;

        return (
          <div key={step} className="flex-1 flex items-center">
            <div className="flex flex-col items-center flex-1">
              {/* Circle */}
              {isCompleted ? (
                <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              ) : isCurrent ? (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-border bg-surface" />
              )}

              {/* Label */}
              <span
                className={`mt-1 text-xs ${
                  isCompleted
                    ? "font-medium"
                    : isCurrent
                      ? "font-semibold text-primary"
                      : "text-muted"
                }`}
              >
                {step}
              </span>
            </div>

            {/* Connecting line */}
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 -mx-1 ${
                  i < currentIdx ? "bg-success" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
