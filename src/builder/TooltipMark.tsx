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
  titled = true,
  onOpenChange,
  className,
  children,
}: {
  /** The Tooltip's text; a line break starts a new line. */
  explanation: string;
  /** The mark's accessible name, for a mark that is only a glyph. Without one, its text names it. */
  label?: string;
  /** Whether the mark keeps the explanation as its own title, as v1 had it. Off when a parent has it. */
  titled?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <TooltipTrigger
        aria-label={label}
        className={cn(
          "inline-flex cursor-help items-center rounded-sm align-middle outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        {/* The pointer passes through to the trigger, so the browser doesn't show the title beside
            the Tooltip. */}
        <span title={titled ? explanation : undefined} className="pointer-events-none inline-flex items-center gap-1">
          {children}
        </span>
      </TooltipTrigger>
      {/* Base UI gives the popup no role of its own. It is a tooltip only while open: one still
          fading out isn't, so it never stands beside the one now showing. */}
      <TooltipContent role={open ? "tooltip" : undefined} className="whitespace-pre-line">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}

/** The warning icon, with "⚠" beside it as text, as the warnings have always had it. */
export function WarningGlyph() {
  return (
    <>
      <TriangleAlert aria-hidden="true" className="size-4" />
      <span className="sr-only">⚠</span>
    </>
  );
}
