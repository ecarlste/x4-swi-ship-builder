# shadcn/ui on Tailwind and Base UI

v1's UI is hand-written CSS and hand-rolled widgets, so padding and spacing differ from control to control, and the widgets get behaviour wrong: the Equipment dropdown can't be operated from the keyboard at all. v2 moves the whole UI to shadcn/ui, on Tailwind, with Base UI as the primitive base, and uses shadcn's default theme as it comes: the default dark theme, fixed with a `dark` class on `<html>`, with no light mode or switcher. The only additions are two tokens in shadcn's own format, `success` and `warning`, because the builder uses colour to carry meaning (better or worse, changed since loading, Repairs) and the default palette has only `destructive`.

## Considered Options

- **Radix as the primitive base.** It's the base the author knows, and it's still maintained and fully supported by shadcn. Rejected because Radix has no Combobox, so shadcn's Combobox imports Base UI even in a Radix project, and the Ship picker needs it. We'd ship both libraries. Also, shadcn's Toast exists only for Base UI, and the Sonner fallback picks its theme from `next-themes`, so in this dark-only app its toasts would turn light on a light-mode OS.
- **Base UI with the existing plain CSS.** Rejected: it fixes behaviour but not spacing. The consistent spacing that shadcn's defaults give is half the reason for the change.
- **A styled package such as Mantine.** Rejected: its components are upgraded from npm, not owned. The dense Loadout table and the dropdown with a comparison popover beside it need markup changes that a packaged library resists.

## Consequences

- The component source lives in the repo and is ours to edit and review. shadcn updates arrive by re-running the CLI by hand, not through npm.
- Tailwind becomes the only styling system. By the end of the migration, `index.css` holds only theme tokens.
- Legacy CSS and shadcn can't share a page. Unlayered CSS beats Tailwind's layered utilities, and with v1's stylesheet loaded, a shadcn button rendered near-black text on a dark background. So the migration lands on one integration branch and merges to `main` once.
- The migration preserves behaviour. Apart from making every control keyboard-operable (the comparison popover follows the focused option as well as the hovered one), no v2 feature ships in it. Toasts, Software Families and the Ship picker changes come after, built on the new components. Software Families are a Select for a family of several wares and a Checkbox for an optional family of one, not the radio groups first planned, so that they are built from the same components as the rest of v2 (spec #122, #137).
- Desktop only for now. Designing for mobile and touch is a separate, later release.
