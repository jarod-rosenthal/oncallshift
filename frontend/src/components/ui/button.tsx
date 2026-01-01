import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary - Atlassian blue
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md",
        // Destructive - Danger red
        destructive:
          "bg-danger text-white shadow-sm hover:bg-danger/90 hover:shadow-md",
        // Outline - Border only
        outline:
          "border-2 border-neutral-300 bg-card text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50",
        // Secondary - Light background
        secondary:
          "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
        // Ghost - No background
        ghost:
          "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
        // Link - Text only, underline on hover
        link:
          "text-primary underline-offset-4 hover:underline hover:text-primary-hover",
        // Success - Green for positive actions
        success:
          "bg-success text-white shadow-sm hover:bg-success/90 hover:shadow-md",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
