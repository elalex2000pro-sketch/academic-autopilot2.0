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
        "inset-field flex h-9 w-full rounded-xl border border-white/60 bg-white/40 px-3 py-1 text-[13px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-150 ease-mac file:border-0 file:bg-transparent file:text-[13px] file:font-medium placeholder:text-slate-400 focus-visible:border-[#0066FF] focus-visible:bg-white/55 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0066FF]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:bg-white/[0.08]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
