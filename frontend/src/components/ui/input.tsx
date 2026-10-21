import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Campo nativo: 32 px, radio 6, sombra interior y anillo azul al enfocar. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "inset-field flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-[13px] text-foreground transition-[border-color,box-shadow] duration-150 ease-mac file:border-0 file:bg-transparent file:text-[13px] file:font-medium placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
