import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label: string;
  variant?: "default" | "primary" | "danger";
}

export function ToolbarButton({ icon, label, variant = "default", ...props }: ToolbarButtonProps) {
  return (
    <button {...props} className={`toolbar-button ${variant}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
