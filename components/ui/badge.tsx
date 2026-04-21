import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-foreground",
        cliffRed: "border-cliff-red/40 bg-cliff-red/10 text-cliff-red",
        cliffAmber: "border-cliff-amber/40 bg-cliff-amber/10 text-cliff-amber",
        cliffGreen: "border-cliff-green/40 bg-cliff-green/10 text-cliff-green",
        dlaRed: "border-dla-red/40 bg-dla-red/10 text-dla-red",
        dlaAmber: "border-dla-amber/40 bg-dla-amber/10 text-dla-amber",
        dlaGreen: "border-dla-green/40 bg-dla-green/10 text-dla-green",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
