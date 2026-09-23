import { Slot } from "./slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-sm font-semibold tracking-wide transition-all duration-300 ease-[var(--ease-soft)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-ink hover:opacity-90 active:scale-[0.98]",
        outline: "border border-ink/25 text-ink hover:border-ink hover:bg-ink/5",
        ghost: "text-ink hover:bg-ink/5",
        link: "text-ink underline-offset-4 hover:underline px-0",
        danger: "bg-danger text-white hover:opacity-90",
        subtle: "bg-surface-2 text-ink hover:bg-line",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-sm",
        md: "h-11 px-5 rounded-sm",
        lg: "h-13 px-7 text-[0.95rem] rounded-sm",
        icon: "size-10 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = (asChild ? Slot : "button") as React.ElementType;
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
