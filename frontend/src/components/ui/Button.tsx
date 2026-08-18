import type { ReactNode } from "react";

type ButtonProps = {
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
};

const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

export function Button({
  type = "button",
  variant = "primary",
  disabled,
  children,
  onClick,
}: ButtonProps) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`btn ${variants[variant]}`}>
      {children}
    </button>
  );
}
