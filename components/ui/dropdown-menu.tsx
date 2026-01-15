"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

const DropdownMenuContext = React.createContext<{ open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> } | null>(null);

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If we are dragging, don't close immediately? Standard click outside.
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.setOpen(!ctx.open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<unknown>, {
      onClick: (e: React.MouseEvent) => {
        // @ts-expect-error - we are calling an unknown prop, but we know it might exist on the child
        (children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick?.(e);
        toggle(e);
      }
    });
  }

  return (
    <div onClick={toggle} className="cursor-pointer">
      {children}
    </div>
  );
};

export const DropdownMenuContent = ({ children, className, align = "end", sideOffset = 4 }: { children: React.ReactNode; className?: string; align?: 'start' | 'center' | 'end'; sideOffset?: number }) => {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div
      style={{ marginTop: sideOffset }}
      className={cn(
        "absolute w-48 rounded-xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100 border border-slate-100",
        align === 'end' ? "right-0 origin-top-right" : align === 'start' ? "left-0 origin-top-left" : "left-1/2 -translate-x-1/2 origin-top",
        className
      )}
    >
      <div className="py-1">{children}</div>
    </div>
  );
}

export const DropdownMenuItem = ({ children, onClick, className }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; className?: string }) => {
  const ctx = React.useContext(DropdownMenuContext);
  return (
    <button
      className={cn("text-slate-700 flex w-full items-center px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors font-medium", className)}
      onClick={(e) => {
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
