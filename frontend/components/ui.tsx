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
      "inline-flex items-center justify-center gap-1.5 font-medium tracking-tight transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap",
      size === "sm" && "h-7 px-2.5 text-[12px] rounded",
      size === "md" && "h-8 px-3 text-[13px] rounded",
      variant === "primary" &&
        "bg-accent text-accent-fg hover:bg-fg-muted",
      variant === "secondary" &&
        "bg-bg-subtle text-fg border border-border hover:bg-bg hover:border-border-strong",
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
  "w-full bg-bg border border-border rounded px-2.5 py-1.5 text-[13px] text-fg placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:outline-none focus:border-fg focus:ring-0";

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
    <select ref={ref} className={cn(fieldBase, "cursor-pointer appearance-none bg-[position:right_8px_center] bg-no-repeat pr-7", className)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
      {...p}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("block text-[11px] font-medium text-fg-muted mb-1.5 tracking-wide", className)} {...p} />
);

// ═══ Badge ══════════════════════════════════════════════════════════════════
export const Badge = ({
  variant = "neutral",
  className,
  children,
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "neutral" | "success" | "danger" | "warning" | "accent" }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded font-mono uppercase tracking-wider",
      variant === "neutral" && "bg-bg-subtle text-fg-muted border border-border",
      variant === "success" && "bg-bg-subtle text-success border border-success/30",
      variant === "danger" && "bg-bg-subtle text-danger border border-danger/30",
      variant === "warning" && "bg-bg-subtle text-warning border border-warning/30",
      variant === "accent" && "bg-accent text-accent-fg",
      className,
    )}
    {...p}
  >
    {children}
  </span>
);

// ═══ Section (al posto di Card) ═════════════════════════════════════════════
// Invece di card con bordi spessi usiamo sezioni con un singolo divider top + header.
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
  <section className={cn("border border-border rounded bg-bg overflow-hidden", className)}>
    <header className="h-9 px-3 flex items-center justify-between border-b border-border bg-bg-subtle">
      <h2 className="text-[12px] font-medium tracking-tight text-fg">{title}</h2>
      {action}
    </header>
    <div>{children}</div>
  </section>
);

// ═══ KeyValue row (metadata compatta) ═══════════════════════════════════════
export const KeyValue = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start gap-4 py-1.5 text-[13px]">
    <span className="w-32 shrink-0 text-fg-subtle font-mono text-2xs uppercase tracking-wider pt-0.5">{k}</span>
    <span className="flex-1 text-fg">{v}</span>
  </div>
);

// ═══ Dot (status indicator) ═════════════════════════════════════════════════
export const Dot = ({ variant = "neutral", pulse = false }: { variant?: "neutral" | "success" | "danger" | "warning" | "running"; pulse?: boolean }) => (
  <span
    className={cn(
      "inline-block w-1.5 h-1.5 rounded-full",
      variant === "neutral" && "bg-fg-subtle",
      variant === "success" && "bg-success",
      variant === "danger" && "bg-danger",
      variant === "warning" && "bg-warning",
      variant === "running" && "bg-fg",
      pulse && "animate-pulse",
    )}
  />
);
