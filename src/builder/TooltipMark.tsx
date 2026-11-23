import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A mark explained by a Tooltip that opens on hover or focus: a row's mandatory or changed mark, the
 * toolbar's mandatory-missing count, a Saved Loadout's Repairs flag, a stat row's label. The mark is
 * focusable, so the explanation can be read without a mouse.
 */
export function TooltipMark({
  explanation,
  label,
  className,
  children,
}: {
  /** The Tooltip's text; a line break starts a new line. */
  explanation: string;
  /** The mark's accessible name, for a mark that is only a glyph. Without one, its text names it. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      onOpenChange={setOpen}
    >
      <TooltipTrigger
        aria-label={label}
        className={cn(
          "inline-flex cursor-help items-center gap-1 rounded-sm align-middle outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        {children}
      </TooltipTrigger>
      {/* Base UI gives the popup no role of its own. It is a tooltip only while open: one still
          fading out isn't, so it never stands beside the one now showing. */}
      <TooltipContent role={open ? "tooltip" : undefined} className="whitespace-pre-line">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}

/** The warning icon, drawn only: the warning's text says what it is. */
export function WarningGlyph() {
  return <TriangleAlert aria-hidden="true" className="size-4" />;
}
