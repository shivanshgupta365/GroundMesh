"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[0.7rem] border text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ink)] disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border-[var(--lime)] bg-[var(--lime)] text-[var(--lime-ink)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--lime)_32%,transparent),0_8px_24px_color-mix(in_oklab,var(--lime)_13%,transparent)] hover:bg-[var(--lime-bright)]",
        secondary:
          "border-[var(--line-strong)] bg-[var(--panel-strong)] text-[var(--text)] hover:border-[var(--muted)] hover:bg-[var(--panel-hover)]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--panel-hover)] hover:text-[var(--text)]",
        danger:
          "border-[color-mix(in_oklab,var(--red)_65%,var(--line))] bg-[color-mix(in_oklab,var(--red)_13%,var(--panel))] text-[var(--red-soft)] hover:bg-[color-mix(in_oklab,var(--red)_20%,var(--panel))]",
        quiet:
          "border-[var(--line)] bg-[var(--panel)] text-[var(--text-secondary)] hover:border-[var(--line-strong)] hover:text-[var(--text)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-5",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
  {
    variants: {
      tone: {
        neutral:
          "border-[var(--line)] bg-[var(--panel)] text-[var(--text-secondary)]",
        verified:
          "border-[color-mix(in_oklab,var(--lime)_38%,var(--line))] bg-[color-mix(in_oklab,var(--lime)_10%,transparent)] text-[var(--lime-soft)]",
        updating:
          "border-[color-mix(in_oklab,var(--blue)_40%,var(--line))] bg-[color-mix(in_oklab,var(--blue)_10%,transparent)] text-[var(--blue-soft)]",
        warning:
          "border-[color-mix(in_oklab,var(--amber)_40%,var(--line))] bg-[color-mix(in_oklab,var(--amber)_10%,transparent)] text-[var(--amber-soft)]",
        danger:
          "border-[color-mix(in_oklab,var(--red)_42%,var(--line))] bg-[color-mix(in_oklab,var(--red)_10%,transparent)] text-[var(--red-soft)]",
        violet:
          "border-[color-mix(in_oklab,var(--violet)_42%,var(--line))] bg-[color-mix(in_oklab,var(--violet)_10%,transparent)] text-[var(--violet-soft)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[0.7rem] border border-[var(--line-strong)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--lime-muted)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--lime)_17%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-24 w-full resize-y rounded-[0.7rem] border border-[var(--line-strong)] bg-[var(--field)] px-3 py-2.5 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--lime-muted)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--lime)_17%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "center" | "right";
  }
>(({ className, children, side = "center", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[rgba(3,5,8,0.76)] backdrop-blur-[5px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "dialog-content fixed z-50 border border-[var(--line-strong)] bg-[var(--panel-solid)] text-[var(--text)] shadow-[0_30px_100px_rgba(0,0,0,0.65)] outline-none",
        side === "center" &&
          "dialog-content-center left-1/2 top-1/2 max-h-[min(88vh,760px)] w-[min(92vw,740px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.1rem]",
        side === "right" &&
          "dialog-content-right bottom-0 right-0 top-0 w-[min(94vw,560px)] overflow-y-auto border-y-0 border-r-0",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 z-20 grid size-8 place-items-center rounded-lg border border-transparent text-[var(--text-tertiary)] outline-none transition hover:border-[var(--line)] hover:bg-[var(--panel-hover)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        aria-label="Close dialog"
      >
        <X className="size-4" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogTitle = forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold tracking-[-0.025em]", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-6 text-[var(--text-secondary)]", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton overflow-hidden rounded-lg bg-[var(--panel-hover)]",
        className,
      )}
      {...props}
    />
  );
}
