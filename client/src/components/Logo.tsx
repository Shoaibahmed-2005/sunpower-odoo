import { useState } from "react";

interface LogoProps {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 w-auto",
  md: "h-10 w-auto",
  lg: "h-40 w-auto",
} as const;

export default function Logo({ variant = "full", size = "sm" }: LogoProps) {
  const [failed, setFailed] = useState(false);

  const src = variant === "full" ? "/brand/logo.jpg" : "/brand/logo-mark.jpg";

  if (failed) {
    return (
      <span className="font-heading font-semibold text-primary">Kiran</span>
    );
  }

  return (
    <img
      src={src}
      alt="Kiran"
      className={sizeClasses[size]}
      onError={() => setFailed(true)}
    />
  );
}
