"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ═══ Button ═════════════════════════════════════════════════════════════════
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md";
  }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 font-medium tracking-tight transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20",
      size === "sm" && "h-7 px-2.5 text-[12px] rounded-md",
      size === "md" && "h-9 px-3.5 text-[13px] rounded-md",
      variant === "primary" &&
        "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover hover:shadow active:scale-[0.98]",
      variant === "secondary" &&
        "bg-bg-elevated text-fg border border-border shadow-sm hover:bg-bg-hover hover:border-border-strong",
      variant === "ghost" &&
        "text-fg-muted hover:text-fg hover:bg-bg-subtle",
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

// ═══ Input / Textarea / Select ══════════════════════════════════════════════
const fieldBase =
  "w-full bg-bg-elevated border border-border rounded-md px-3 py-2 text-[13px] text-fg placeholder:text-fg-subtle transition-all duration-150 hover:border-border-strong focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 shadow-sm";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(fieldBase, className)} {...p} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(fieldBase, "resize-y leading-relaxed", className)} {...p} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...p }, ref) => (
    <select ref={ref} className={cn(fieldBase, "cursor-pointer appearance-none bg-[position:right_10px_center] bg-no-repeat pr-8", className)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
      {...p}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("block text-[11px] font-medium text-fg-muted mb-1.5 tracking-wide uppercase", className)} {...p} />
);

// ═══ Kbd ════════════════════════════════════════════════════════════════════
export const Kbd = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <kbd className={cn(
    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-2xs font-mono text-fg-muted bg-bg-elevated border border-border rounded shadow-sm",
    className,
  )}>
    {children}
  </kbd>
);

// ═══ Badge ══════════════════════════════════════════════════════════════════
export const Badge = ({
  variant = "neutral",
  className,
  children,
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "neutral" | "success" | "danger" | "warning" | "accent" | "info" }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-md font-mono uppercase tracking-wider",
      variant === "neutral" && "bg-bg-subtle text-fg-muted border border-border",
      variant === "success" && "bg-success-soft text-success border border-success/20",
      variant === "danger" && "bg-danger-soft text-danger border border-danger/20",
      variant === "warning" && "bg-warning-soft text-warning border border-warning/20",
      variant === "info" && "bg-info-soft text-info border border-info/20",
      variant === "accent" && "bg-accent text-accent-fg shadow-sm",
      className,
    )}
    {...p}
  >
    {children}
  </span>
);

// ═══ Section (card elevata con header) ══════════════════════════════════════
export const Section = ({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={cn("border border-border rounded-lg bg-bg-elevated shadow-sm overflow-hidden", className)}>
    <header className="h-10 px-3.5 flex items-center justify-between border-b border-border bg-bg-subtle/50">
      <h2 className="text-[12px] font-semibold tracking-tight text-fg">{title}</h2>
      {action}
    </header>
    <div>{children}</div>
  </section>
);

// ═══ Panel (contenitore morbido senza header) ═══════════════════════════════
export const Panel = ({
  children,
  className,
  elevated = false,
}: {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}) => (
  <div className={cn(
    "border border-border rounded-lg overflow-hidden",
    elevated ? "bg-bg-elevated shadow-sm" : "bg-bg-subtle/40",
    className,
  )}>
    {children}
  </div>
);

// ═══ KeyValue row (metadata compatta) ═══════════════════════════════════════
export const KeyValue = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start gap-4 py-2 text-[13px]">
    <span className="w-28 shrink-0 text-fg-subtle font-mono text-2xs uppercase tracking-wider pt-0.5">{k}</span>
    <span className="flex-1 text-fg">{v}</span>
  </div>
);

// ═══ Dot (status indicator con alone) ═══════════════════════════════════════
export const Dot = ({ variant = "neutral", pulse = false }: { variant?: "neutral" | "success" | "danger" | "warning" | "running"; pulse?: boolean }) => (
  <span className="relative inline-flex items-center justify-center w-2 h-2">
    {pulse && (
      <span
        className={cn(
          "absolute inset-0 rounded-full animate-ping opacity-60",
          variant === "running" && "bg-info",
          variant === "success" && "bg-success",
          variant === "danger" && "bg-danger",
          variant === "warning" && "bg-warning",
          variant === "neutral" && "bg-fg-subtle",
        )}
      />
    )}
    <span
      className={cn(
        "relative inline-block w-2 h-2 rounded-full",
        variant === "neutral" && "bg-fg-subtle",
        variant === "success" && "bg-success",
        variant === "danger" && "bg-danger",
        variant === "warning" && "bg-warning",
        variant === "running" && "bg-info",
      )}
    />
  </span>
);

// ═══ Chevron (icona riusabile) ══════════════════════════════════════════════
export const Chevron = ({ open = false, className }: { open?: boolean; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn(
      "w-3.5 h-3.5 transition-transform duration-200",
      open ? "rotate-90" : "rotate-0",
      className,
    )}
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);
