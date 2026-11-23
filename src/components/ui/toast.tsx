import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { CircleAlert, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

// Added for #138, on Base UI's Toast like shadcn's base-nova `toast` (`npx shadcn view toast`), but cut
// down to a plain stacked list of toasts in the corner, each with a Dismiss button, rather than
// shadcn's swipeable pile. `type: "error"` draws a toast in the `destructive` token.

/**
 * Holds the toasts. Add them with `useToastManager()` from inside it. Every toast is shown: Base UI
 * hides all but the newest three unless given a limit, so none is set.
 */
function ToastProvider(props: Omit<React.ComponentProps<typeof Toast.Provider>, "limit">) {
  return <Toast.Provider limit={Number.POSITIVE_INFINITY} {...props} />
}

/** The toast region: a polite live region that never takes focus. F6 moves focus into it. */
function Toaster() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport
        data-slot="toast-viewport"
        className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none"
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            data-slot="toast"
            className={cn(
              "grid grid-cols-[1fr_auto] items-start gap-2 rounded-lg bg-popover py-2 pr-2 pl-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring data-ending-style:opacity-0 data-starting-style:opacity-0 data-limited:hidden",
              toast.type === "error" && "text-destructive ring-destructive/40"
            )}
          >
            <Toast.Content className="flex items-start gap-2 self-center">
              {toast.type === "error" && <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
              <Toast.Description />
            </Toast.Content>
            <Toast.Close
              aria-label="Dismiss"
              render={<Button variant="ghost" size="icon-xs" />}
            >
              <X aria-hidden />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

const useToastManager = Toast.useToastManager

export { ToastProvider, Toaster, useToastManager }
