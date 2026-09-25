import { Slot } from "./slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] font-sans font-semibold uppercase tracking-[0.12em] transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-ink hover:opacity-90",
        mustard: "bg-mustard-400 text-pine-900 hover:bg-mustard-300",
        pine: "bg-pine-700 text-cream-100 hover:bg-pine-800",
        outline: "border border-current/40 text-ink hover:border-current",
        light: "border border-cream-100/50 text-cream-100 hover:border-cream-100 hover:bg-cream-100/5",
        ghost: "text-ink normal-case tracking-normal hover:bg-ink/5",
        link: "text-ink normal-case tracking-normal underline-offset-4 hover:underline px-0",
        danger: "bg-danger text-white hover:opacity-90",
        subtle: "bg-surface-2 text-ink normal-case tracking-normal hover:bg-line",
      },
      size: {
        sm: "h-8 px-3 text-[0.7rem]",
        md: "h-11 px-5 text-[0.75rem]",
        lg: "h-12 px-7 text-[0.8rem]",
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
