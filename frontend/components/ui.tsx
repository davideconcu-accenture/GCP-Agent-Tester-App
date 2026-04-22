"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Componenti base ispirati a shadcn/ui, scritti a mano per tenere zero config.

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }
>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
      variant === "primary" &&
        "bg-accent text-white hover:bg-accent/90",
      variant === "outline" &&
        "border border-border2 text-text hover:bg-surface2",
      variant === "ghost" && "text-muted hover:text-text hover:bg-surface2",
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "rounded-lg border border-border bg-surface overflow-hidden",
      className,
    )}
    {...p}
  />
);

export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 py-3 border-b border-border flex items-center justify-between", className)} {...p} />
);

export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-sm font-semibold text-text", className)} {...p} />
);

export const CardBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5", className)} {...p} />
);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full rounded-md border border-border2 bg-surface2 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50",
      className,
    )}
    {...p}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...p }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-md border border-border2 bg-surface2 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y",
      className,
    )}
    {...p}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...p }, ref) => (
  <select
    ref={ref}
    className={cn(
      "w-full rounded-md border border-border2 bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50",
      className,
    )}
    {...p}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const Badge = ({
  className,
  children,
  ...p
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
      className,
    )}
    {...p}
  >
    {children}
  </span>
);

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("block text-xs font-medium text-muted mb-1.5", className)} {...p} />
);
