import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Controles de 28–32 px con radio de 6 px, como los botones nativos de macOS.
 * El relleno azul lleva un brillo interior de un píxel para dar volumen.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-[13px] font-medium leading-none transition-[background-color,box-shadow,filter] duration-150 ease-mac focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-button hover:brightness-[1.07] active:brightness-[0.95] active:shadow-pressed",
        destructive:
          "bg-destructive text-destructive-foreground shadow-button hover:brightness-[1.07] active:brightness-[0.95]",
        outline:
          "border border-white/60 bg-white/40 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl hover:bg-white/55 active:bg-white/35 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.1]",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary/50",
        ghost: "text-foreground hover:bg-foreground/[0.055] active:bg-foreground/[0.09]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8 rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
