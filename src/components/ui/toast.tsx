import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { CircleAlert, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

// Added for #138 (shadcn's registry offers Sonner, not Base UI's Toast): a stacked list of toasts in
// the corner, each with a Dismiss button. `type: "error"` draws a toast in the `destructive` token.

/** Holds the toasts. Add them with `useToastManager()` from inside it. */
function ToastProvider(props: React.ComponentProps<typeof Toast.Provider>) {
  return <Toast.Provider {...props} />
}

/** The toast region: a polite live region that never takes focus. F6 moves focus into it. */
function Toaster({ className }: { className?: string }) {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport
        data-slot="toast-viewport"
        className={cn(
          "fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none",
          className
        )}
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
              <div>
                {toast.title && <Toast.Title className="font-medium" />}
                <Toast.Description />
              </div>
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
