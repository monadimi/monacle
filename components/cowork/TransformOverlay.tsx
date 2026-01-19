"use client";

import { cn } from "@/lib/utils";
import { SlideElement } from "./types";

interface TransformOverlayProps {
  element: SlideElement;
  onUpdate: (id: string, updates: Partial<SlideElement>) => void;
  isSelected: boolean;
}

interface HandleProps {
  cursor: string;
  position: string;
  onResize: (e: React.MouseEvent) => void;
}

const Handle = ({ cursor, position, onResize }: HandleProps) => (
  <div 
      className={cn("absolute w-3 h-3 bg-white border border-indigo-500 rounded-full z-50 pointer-events-auto", position)}
      style={{ cursor }}
      onMouseDown={(e) => {
          e.preventDefault(); // Prevent text selection during drag
          e.stopPropagation();
          onResize(e);
      }}
  />
);

export const TransformOverlay = ({ element, onUpdate, isSelected }: TransformOverlayProps) => {
    if (!isSelected) return null;

    const startResize = (e: React.MouseEvent, direction: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = element.w;
        const startH = element.h;
        const startPosX = element.x;
        const startPosY = element.y;

        const moveHandler = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            
            let newW = startW;
            let newH = startH;
            let newX = startPosX;
            let newY = startPosY;

            if (direction.includes('e')) newW = Math.max(10, startW + dx);
            if (direction.includes('s')) newH = Math.max(10, startH + dy);
            if (direction.includes('w')) {
                newW = Math.max(10, startW - dx);
                newX = startPosX + (startW - newW);
            }
            if (direction.includes('n')) {
                newH = Math.max(10, startH - dy);
                newY = startPosY + (startH - newH);
            }

            onUpdate(element.id, { x: newX, y: newY, w: newW, h: newH });
        };

        const upHandler = () => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    };

    return (
        <div 
            className="absolute inset-0 pointer-events-none border-2 border-indigo-500 z-50"
            style={{ left: -2, top: -2, right: -2, bottom: -2 }}
        >
            {/* Corners */}
            <Handle cursor="nw-resize" position="-top-1.5 -left-1.5" onResize={(e) => startResize(e, 'nw')} />
            <Handle cursor="ne-resize" position="-top-1.5 -right-1.5" onResize={(e) => startResize(e, 'ne')} />
            <Handle cursor="sw-resize" position="-bottom-1.5 -left-1.5" onResize={(e) => startResize(e, 'sw')} />
            <Handle cursor="se-resize" position="-bottom-1.5 -right-1.5" onResize={(e) => startResize(e, 'se')} />
            
            {/* Sides */}
            <Handle cursor="n-resize" position="-top-1.5 left-1/2 -translate-x-1/2" onResize={(e) => startResize(e, 'n')} />
            <Handle cursor="s-resize" position="-bottom-1.5 left-1/2 -translate-x-1/2" onResize={(e) => startResize(e, 's')} />
            <Handle cursor="w-resize" position="top-1/2 -translate-y-1/2 -left-1.5" onResize={(e) => startResize(e, 'w')} />
            <Handle cursor="e-resize" position="top-1/2 -translate-y-1/2 -right-1.5" onResize={(e) => startResize(e, 'e')} />
        </div>
    );
};
