"use client"
import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRect: DOMRect | null;
  setTriggerRect: React.Dispatch<React.SetStateAction<DOMRect | null>>;
} | null>(null);

// Helper to manage checking and setting refs safely
function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref && typeof ref === "object" && "current" in ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    refs.forEach((ref) => setRef(ref, node));
  };
}

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // If clicking a portal, we might need more logic, but standard click outside check:
        const menus = document.querySelectorAll('[data-radix-menu-content]');
        let clickedInsideMenu = false;
        menus.forEach(menu => {
          if (menu.contains(event.target as Node)) clickedInsideMenu = true;
        });
        if (!clickedInsideMenu) setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRect, setTriggerRect }}>
      <div ref={containerRef} className="inline-block">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
  const ctx = React.useContext(DropdownMenuContext);
  const ref = React.useRef<HTMLDivElement>(null);

  if (!ctx) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ref.current) {
      ctx.setTriggerRect(ref.current.getBoundingClientRect());
    }
    ctx.setOpen(!ctx.open);
  };

  if (asChild && React.isValidElement(children)) {
    // Determine the child's ref type to properly forward it
    const childCmp = children as React.ReactElement<any>;
    const childRef = (childCmp as any).ref;

    return React.cloneElement(childCmp, {
      ref: composeRefs(childRef, ref),
      onClick: (e: React.MouseEvent) => {
        childCmp.props.onClick?.(e);
        toggle(e);
      }
    });
  }

  return (
    <div ref={ref} onClick={toggle} className="cursor-pointer">
      {children}
    </div>
  );
};

export const DropdownMenuContent = ({
  children,
  className,
  align = "end",
  side = "bottom",
  sideOffset = 4,
  collisionPadding = 20
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  sideOffset?: number;
  collisionPadding?: number;
}) => {
  const ctx = React.useContext(DropdownMenuContext);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!ctx || !ctx.open || !ctx.triggerRect || !mounted) return null;

  const rect = ctx.triggerRect;
  let top = side === 'bottom' ? rect.bottom + sideOffset : rect.top - sideOffset;
  const left = align === 'start' ? rect.left : align === 'end' ? rect.right : rect.left + rect.width / 2;

  // Simple collision detection for 'top' vs 'bottom'
  const viewportHeight = window.innerHeight;
  const menuEstimatedHeight = 200; // Fallback estimate

  let finalSide = side;
  if (side === 'bottom' && top + menuEstimatedHeight > viewportHeight - collisionPadding) {
    finalSide = 'top';
    top = rect.top - sideOffset;
  } else if (side === 'top' && top - menuEstimatedHeight < collisionPadding) {
    finalSide = 'bottom';
    top = rect.bottom + sideOffset;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    top: top,
    left: left,
    zIndex: 9999,
    transform: align === 'end' ? 'translateX(-100%)' : align === 'center' ? 'translateX(-50%)' : 'none',
    marginTop: finalSide === 'bottom' ? 0 : 0,
    marginBottom: finalSide === 'top' ? 0 : 0,
  };

  if (finalSide === 'top') {
    style.top = undefined;
    style.bottom = window.innerHeight - rect.top + sideOffset;
  }

  return createPortal(
    <div
      data-radix-menu-content
      style={style}
      className={cn(
        "w-48 rounded-xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none animate-in fade-in zoom-in-95 duration-100 border border-slate-100 overflow-hidden",
        className
      )}
    >
      <div className="py-1">{children}</div>
    </div>,
    document.body
  );
}

export const DropdownMenuItem = ({ children, onClick, className, disabled }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; className?: string; disabled?: boolean }) => {
  const ctx = React.useContext(DropdownMenuContext);
  return (
    <button
      disabled={disabled}
      className={cn(
        "text-slate-700 flex w-full items-center px-4 py-2.5 text-sm font-medium transition-colors text-left",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 cursor-pointer",
        className
      )}
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onClick?.(e);
        ctx?.setOpen(false);
      }}
    >
      {children}
    </button>
  )
}

export const DropdownMenuLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("px-4 py-2 text-sm font-semibold text-slate-500", className)}>
      {children}
    </div>
  )
}

export const DropdownMenuSeparator = () => <div className="border-t border-slate-100 my-1" />
