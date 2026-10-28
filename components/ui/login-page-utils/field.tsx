import * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export function FieldGroup({ className, ...props }: FieldGroupProps) {
  return <div className={cn("flex flex-col gap-5", className)} {...props} />;
}

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Field({ className, ...props }: FieldProps) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground",
        className
      )}
      {...props}
    />
  );
}

export interface FieldDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

export function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <p
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export interface FieldSeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function FieldSeparator({
  className,
  children,
  ...props
}: FieldSeparatorProps) {
  return (
    <div
      className={cn(
        "relative my-2 flex items-center justify-center text-xs uppercase",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      {children && (
        <span className="relative bg-background px-2 text-muted-foreground">
          {children}
        </span>
      )}
    </div>
  );
}
