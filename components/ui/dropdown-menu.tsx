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

  // If asChild is true, we should strictly cloneElement but for simplicity we wrap in div or just pass onClick
  // The usage in DriveInterface uses <button> child.
  // We wrap in a generic div acting as trigger wrapper to catch click.
  return (
    <div onClick={(e) => { e.stopPropagation(); ctx.setOpen(!ctx.open); }} className="cursor-pointer">
      {children}
    </div>
  );
};

export const DropdownMenuContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div className={cn("absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100 border border-slate-100", className)}>
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

export const DropdownMenuSeparator = () => <div className="border-t border-slate-100 my-1" />
