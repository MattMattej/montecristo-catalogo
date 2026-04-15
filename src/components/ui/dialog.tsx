import * as React from "react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function useDialog() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog context missing");
  return ctx;
}

export function Dialog({
  open,
  onOpenChange,
  children
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = typeof open === "boolean";
  const valueOpen = isControlled ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    if (valueOpen) {
      window.addEventListener("keydown", onKey);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [valueOpen]);

  return (
    <DialogContext.Provider value={{ open: valueOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen } = useDialog();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm md:items-center md:p-6"
      onClick={() => setOpen(false)}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={cn(
          "relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/50 bg-card/95 p-4 shadow-soft transition-transform md:max-h-[90vh] md:p-6",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex items-start justify-between gap-4">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

export function DialogClose({
  children
}: {
  children: React.ReactNode;
}) {
  const { setOpen } = useDialog();
  return (
    <button
      type="button"
      onClick={() => setOpen(false)}
      className="rounded-full p-1 text-muted-foreground hover:bg-muted"
      aria-label="Cerrar"
    >
      {children}
    </button>
  );
}


