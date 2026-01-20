/**
 * @file components/cowork/SlideEditor.tsx
 * @purpose Presentation deck editor with slide management and vector elements.
 * @scope Slide creation, Element manipulation (Text, Shape, Image), History (Undo/Redo), Presentation Mode.
 * @out-of-scope Real-time presence (currently not implemented), complex transitions.
 * @failure-behavior Errors on save failure.
 */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    Type,
    Image as ImageIcon,
    Square,
    Play,
    Maximize2,
    Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { updateDeck } from "@/app/actions/cowork";
import { Button } from "@/components/ui/button";
import SlideProperties from "./SlideProperties";
import { SlideElement, Slide, DeckData } from "./types";
import { useHistory } from "./useHistory";
import { SLIDE_TEMPLATES } from "./templates";

import { TransformOverlay } from "./TransformOverlay";

// --- Transform Overlay Component ---
// Extracted to ./TransformOverlay.tsx

type TextAlign = 'left' | 'center' | 'right' | 'justify' | 'initial' | 'inherit';

interface SlideEditorProps {
    initialData: DeckData | undefined;
    readOnly?: boolean;
}

export default function SlideEditor({ initialData, readOnly = false }: SlideEditorProps) {
    const router = useRouter();

    // History State
    const {
        state: slides,
        setState: setSlides,
        undo,
        redo,
        canUndo,
        canRedo
    } = useHistory<Slide[]>(initialData ? initialData.slides : []);

    // --- State ---
    // const [slides, setSlides] = useState<Slide[]>(initialData ? initialData.slides : []); // Removed as useHistory manages this
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [title, setTitle] = useState(initialData ? initialData.title : "Untitled");
    const [selection, setSelection] = useState<string[]>([]);
    const [isPresenting, setIsPresenting] = useState(false);
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const [scale, setScale] = useState(1);
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

    // If no initial data, show loading/error AFTER hooks are initialized
    // if (!initialData) return <div>Data not found</div>; // Moved to end

    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false); // Template Menu State
    const [isImageMenuOpen, setIsImageMenuOpen] = useState(false); // Image Menu State
    const [isImageSearchOpen, setIsImageSearchOpen] = useState(false); // Image Search Popover State
    const [searchResults, setSearchResults] = useState<string[]>([
        'https://images.unsplash.com/photo-1557683316-973673baf926',
        'https://images.unsplash.com/photo-1550684848-fac1c5b4e853',
        'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
        'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
        'https://images.unsplash.com/photo-1497366216548-37526070297c',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
    ]);

    // Selection & Clipboard
    // const [selection, setSelection] = useState<string[]>([]); // Moved above
    const [clipboard, setClipboard] = useState<SlideElement[]>([]);

    const currentSlide = slides[currentSlideIndex];

    // Save logic
    const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
    const saveDeck = useCallback(async (newSlides: Slide[], newTitle: string) => {
        if (!initialData) return;
        setSaveStatus('saving');
        const res = await updateDeck(initialData.id, { title: newTitle, slides: newSlides });
        if (res.success) setSaveStatus('saved');
        else setSaveStatus('error');
    }, [initialData]); // updateDeck is stable (imported action)

    const debouncedSave = useCallback((newSlides: Slide[], newTitle: string) => {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => saveDeck(newSlides, newTitle), 1000);
    }, [saveDeck]);

    // Wrapped Setters to trigger Save
    const updateSlidesWithSave = (newSlides: Slide[]) => {
        setSlides(newSlides);
        debouncedSave(newSlides, title);
    };

    const updateSlide = (slideId: string, updates: Partial<Slide>) => {
        const newSlides = slides.map(s => s.id === slideId ? { ...s, ...updates } : s);
        updateSlidesWithSave(newSlides);
    };

    const updateElement = (elementId: string, updates: Partial<SlideElement>) => {
        const newSlides = slides.map(slide => {
            if (slide.id !== slides[currentSlideIndex].id) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => el.id === elementId ? { ...el, ...updates } : el)
            };
        });
        updateSlidesWithSave(newSlides);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        if (readOnly || isPresenting) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/texture
            if ((e.target as HTMLElement).isContentEditable || (e.target as HTMLElement).tagName === 'INPUT') return;

            const isCmd = e.metaKey || e.ctrlKey;

            // Undo / Redo
            if (isCmd && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (canRedo) redo();
                } else {
                    if (canUndo) undo();
                }
                return;
            }

            // Delete
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (selection.length > 0) {
                    e.preventDefault();
                    const newSlides = slides.map(slide => {
                        if (slide.id !== currentSlide.id) return slide;
                        return {
                            ...slide,
                            elements: slide.elements.filter(el => !selection.includes(el.id))
                        };
                    });
                    updateSlidesWithSave(newSlides);
                    setSelection([]);
                }
            }

            // Copy
            if (isCmd && e.key === 'c') {
                if (selection.length > 0) {
                    const elementsToCopy = currentSlide.elements.filter(el => selection.includes(el.id));
                    setClipboard(elementsToCopy);
                    // Native clipboard support could go here too
                }
            }

            // Paste
            if (isCmd && e.key === 'v') {
                if (clipboard.length > 0) {
                    e.preventDefault();
                    const newElements = clipboard.map(el => ({
                        ...el,
                        id: crypto.randomUUID(),
                        x: el.x + 20, // Offset paste
                        y: el.y + 20
                    }));

                    const newSlides = slides.map(slide => {
                        if (slide.id !== currentSlide.id) return slide;
                        return { ...slide, elements: [...slide.elements, ...newElements] };
                    });

                    updateSlidesWithSave(newSlides);
                    setSelection(newElements.map(el => el.id));
                }
            }

            // Duplicate (Cmd+D)
            if (isCmd && e.key === 'd') {
                e.preventDefault();
                if (selection.length > 0) {
                    const elementsToDup = currentSlide.elements.filter(el => selection.includes(el.id));
                    const newElements = elementsToDup.map(el => ({
                        ...el,
                        id: crypto.randomUUID(),
                        x: el.x + 20,
                        y: el.y + 20
                    }));

                    const newSlides = slides.map(slide => {
                        if (slide.id !== currentSlide.id) return slide;
                        return { ...slide, elements: [...slide.elements, ...newElements] };
                    });
                    updateSlidesWithSave(newSlides);
                    setSelection(newElements.map(el => el.id));
                }
            }

            // Nudge (Arrows)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (selection.length > 0) {
                    e.preventDefault();
                    const delta = e.shiftKey ? 10 : 1;
                    const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
                    const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;

                    const newSlides = slides.map(slide => {
                        if (slide.id !== currentSlide.id) return slide;
                        return {
                            ...slide,
                            elements: slide.elements.map(el => selection.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)
                        };
                    });
                    updateSlidesWithSave(newSlides);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slides, selection, clipboard, canUndo, canRedo, undo, redo, readOnly, isPresenting, currentSlide, title, debouncedSave]);
    // removed updateSlidesWithSave to break cycle or satisfy linter if it's stable wrapper


    // Slide Management Helpers
    const deleteSlide = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (slides.length <= 1) return; // Don't delete last slide
        const newSlides = slides.filter((_, i) => i !== index);
        setSlides(newSlides);
        if (currentSlideIndex >= newSlides.length) setCurrentSlideIndex(newSlides.length - 1);
        debouncedSave(newSlides, title);
    };

    const duplicateSlide = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const slideToClone = slides[index];
        const newSlide: Slide = {
            ...slideToClone,
            id: crypto.randomUUID(),
            elements: slideToClone.elements.map(el => ({ ...el, id: crypto.randomUUID() }))
        };
        const newSlides = [...slides.slice(0, index + 1), newSlide, ...slides.slice(index + 1)];
        setSlides(newSlides);
        setCurrentSlideIndex(index + 1);
        debouncedSave(newSlides, title);
    };

    // Layer Management
    const bringToFront = () => {
        if (selection.length === 0) return;
        const selectedId = selection[0]; // Simple single select for now for layers
        const currentElements = currentSlide.elements;
        const otherElements = currentElements.filter(el => el.id !== selectedId);
        const element = currentElements.find(el => el.id === selectedId);
        if (!element) return;

        const newElements = [...otherElements, element];

        const newSlides = slides.map(slide => {
            if (slide.id !== currentSlide.id) return slide;
            return { ...slide, elements: newElements };
        });
        updateSlidesWithSave(newSlides);
    };

    const sendToBack = () => {
        if (selection.length === 0) return;
        const selectedId = selection[0];
        const currentElements = currentSlide.elements;
        const otherElements = currentElements.filter(el => el.id !== selectedId);
        const element = currentElements.find(el => el.id === selectedId);
        if (!element) return;

        const newElements = [element, ...otherElements];

        const newSlides = slides.map(slide => {
            if (slide.id !== currentSlide.id) return slide;
            return { ...slide, elements: newElements };
        });
        updateSlidesWithSave(newSlides);
    };

    // Image Upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // For now, simpler base64 for quick prototype, valid for small images
        // Ideally -> Upload to Cloud Storage -> Get URL
        const reader = new FileReader();
        reader.onload = (event) => {
            const src = event.target?.result as string;
            const newElement: SlideElement = {
                id: crypto.randomUUID(),
                type: 'image',
                x: 100, y: 100, w: 300, h: 300,
                src,
                style: { backgroundColor: 'transparent' }
            };
            updateSlide(currentSlide.id, { elements: [...currentSlide.elements, newElement] });
            setSelection([newElement.id]);
        };
        reader.readAsDataURL(file);
    };

    const addElement = (type: SlideElement['type']) => {
        if (type === 'image') {
            fileInputRef.current?.click();
            return;
        }

        const newElement: SlideElement = {
            id: crypto.randomUUID(),
            type,
            x: 100, y: 100, w: 300, h: 200,
            content: type === 'text' ? 'Double click to edit' : '',
            style: {
                backgroundColor: type === 'shape' ? '#e2e8f0' : 'transparent',
                color: '#000000',
                fontSize: 24,
            }
        };

        // Set default sizing
        if (type === 'text') { newElement.w = 400; newElement.h = 60; }
        if (type === 'shape') { newElement.w = 200; newElement.h = 200; }

        updateSlide(currentSlide.id, { elements: [...currentSlide.elements, newElement] });
        setSelection([newElement.id]);
    };

    // Animation Helpers
    const getAnimationVariants = (anim?: SlideElement['animation']) => {
        if (!anim || anim.type === 'none') return {};

        const duration = anim.duration || 0.5;
        const delay = anim.delay || 0;

        const transition = { duration, delay, ease: "easeOut" as const };

        switch (anim.type) {
            case 'fade-in': return { initial: { opacity: 0 }, animate: { opacity: 1, transition } };
            case 'slide-up': return { initial: { opacity: 0, y: 50 }, animate: { opacity: 1, y: 0, transition } };
            case 'slide-down': return { initial: { opacity: 0, y: -50 }, animate: { opacity: 1, y: 0, transition } };
            case 'slide-left': return { initial: { opacity: 0, x: 50 }, animate: { opacity: 1, x: 0, transition } };
            case 'slide-right': return { initial: { opacity: 0, x: -50 }, animate: { opacity: 1, x: 0, transition } };
            case 'scale-up': return { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1, transition } };
            case 'pop': return { initial: { opacity: 0, scale: 0.5 }, animate: { opacity: 1, scale: [0.5, 1.1, 1], transition } };
            default: return {};
        }
    };

    const renderElement = (el: SlideElement) => {
        const isSelected = selection.includes(el.id);
        const textAlign = el.style?.textAlign || 'left';
        let justifyContent = 'flex-start';
        if (textAlign === 'center') justifyContent = 'center';
        if (textAlign === 'right') justifyContent = 'flex-end';

        const animationProps = isPresenting ? getAnimationVariants(el.animation) : {};

        return (
            <motion.div
                key={el.id}
                {...animationProps}
                className={cn("absolute group select-none", isSelected ? "z-50" : "z-10")}
                style={{
                    left: el.x, top: el.y, width: el.w, height: el.h,
                    ...el.style
                    // Note: el.style contains background etc.
                }}
                onMouseDown={(e) => {
                    if (isPresenting) return;
                    e.stopPropagation();
                    setSelection([el.id]);

                    // Simple move drag logic
                    const startX = e.clientX - el.x;
                    const startY = e.clientY - el.y;

                    const moveHandler = (moveEvent: MouseEvent) => {
                        updateElement(el.id, {
                            x: moveEvent.clientX - startX,
                            y: moveEvent.clientY - startY
                        });
                    };

                    const upHandler = () => {
                        window.removeEventListener('mousemove', moveHandler);
                        window.removeEventListener('mouseup', upHandler);
                    };

                    window.addEventListener('mousemove', moveHandler);
                    window.addEventListener('mouseup', upHandler);
                }}
            >
                {/* Content Rendering */}
                {el.type === 'text' ? (
                    <div
                        className="w-full h-full flex flex-col justify-center" // Vertically centered by default
                        style={{ justifyContent }} // Horizontal align via flex
                    >
                        <div style={{
                            fontFamily: el.style?.fontFamily || 'inherit',
                            fontSize: 'inherit',
                            fontWeight: 'inherit',
                            color: 'inherit',
                            textAlign: textAlign as TextAlign,
                            whiteSpace: 'pre-wrap'
                        }}>
                            {el.content}
                        </div>
                    </div>
                ) : el.type === 'image' && el.src ? (
                    <img src={el.src} alt="" className="w-full h-full object-cover pointer-events-none" />
                ) : (
                    <div className="w-full h-full" />
                )}

                {/* Text Editing Overlay */}
                {el.type === 'text' && isSelected && (
                    <div
                        contentEditable
                        suppressContentEditableWarning
                        className="absolute inset-0 outline-none cursor-text ring-1 ring-blue-400 border-0 bg-transparent text-transparent caret-black selection:bg-blue-200 z-[60]"
                        onBlur={(e) => updateElement(el.id, { content: e.currentTarget.innerText })}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center', // Match viewing vertical align
                            textAlign: textAlign as TextAlign,
                            fontSize: el.style?.fontSize, // Match viewing font size for caret
                            fontFamily: el.style?.fontFamily,
                            padding: 0 // Ensure exact overlap
                        }}
                    >
                        {el.content}
                    </div>
                )}

                {!isPresenting && <TransformOverlay element={el} onUpdate={updateElement} isSelected={isSelected} />}
            </motion.div>
        );
    };

    // ... (Rest of render, sidebar)
    if (!initialData) return <div>Data not found</div>;

    return (
        <div className={cn("flex flex-col h-[calc(100vh-64px)] bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden select-none", isPresenting && "fixed inset-0 z-[9999] bg-black")}>
            {/* (Header same as before) */}
            {!isPresenting && (
                <header className="h-14 bg-white border-b flex items-center px-4 justify-between z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <input
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); debouncedSave(slides, e.target.value); }}
                            className="text-lg font-bold bg-transparent outline-none ring-offset-2 focus:ring-2 rounded-md transition-all"
                        />
                        <div className="text-xs text-slate-400">
                            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsPresenting(true)}>
                            <Play className="w-4 h-4 mr-2" /> Present
                        </Button>
                    </div>
                </header>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                {!isPresenting && (
                    <aside className="w-56 bg-white border-r flex flex-col shrink-0">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {slides.map((slide, idx) => (
                                <div
                                    key={slide.id}
                                    onClick={() => setCurrentSlideIndex(idx)}
                                    className={cn(
                                        "aspect-video bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer relative group flex items-center justify-center text-xs text-slate-300",
                                        currentSlideIndex === idx ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-100 hover:border-slate-300"
                                    )}
                                >
                                    <span>Slide {idx + 1}</span>

                                    {/* Hover Actions */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex flex-col gap-1">
                                        <button
                                            onClick={(e) => duplicateSlide(e, idx)}
                                            className="p-1 bg-white shadow-sm border rounded text-slate-500 hover:text-indigo-600"
                                            title="Duplicate"
                                        >
                                            <span className="text-[10px] font-bold">D</span>
                                        </button>
                                        <button
                                            onClick={(e) => deleteSlide(e, idx)}
                                            className="p-1 bg-white shadow-sm border rounded text-slate-500 hover:text-red-600"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className="relative">
                                <button
                                    onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                                    className="w-full aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col gap-2 items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
                                >
                                    <Plus className="w-6 h-6" />
                                    <span className="text-xs">New Slide</span>
                                </button>

                                {isAddMenuOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white shadow-xl rounded-lg border p-1 z-50 flex flex-col gap-1">
                                        {SLIDE_TEMPLATES.map(tmpl => (
                                            <button
                                                key={tmpl.name}
                                                className="text-left px-3 py-2 hover:bg-slate-50 text-sm rounded flex items-center gap-2"
                                                onClick={() => {
                                                    const generated = tmpl.generate();
                                                    const newSlide: Slide = {
                                                        id: crypto.randomUUID(),
                                                        elements: [],
                                                        background: { type: 'solid', value: '#ffffff' },
                                                        layout: "blank", // Explicitly type or ensure it matches
                                                        ...generated
                                                    };
                                                    const newSlides = [...slides, newSlide];
                                                    updateSlidesWithSave(newSlides); // Use wrapper to save
                                                    setCurrentSlideIndex(newSlides.length - 1);
                                                    setIsAddMenuOpen(false);
                                                }}
                                            >
                                                <div className="w-4 h-3 border bg-slate-100 rounded-[1px]" />
                                                {tmpl.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                )}

                <main
                    className={cn("flex-1 bg-slate-100 relative flex items-center justify-center overflow-hidden", isPresenting && "bg-black")}
                    onMouseDown={() => setSelection([])}
                >
                    <div
                        className={cn(
                            "bg-white shadow-2xl relative transition-all duration-500 overflow-hidden shrink-0 origin-center",
                            // Removed w-screen h-screen for presentation, handling via style scale
                            !isPresenting && "w-[800px] h-[450px]"
                        )}
                        style={{
                            backgroundColor: currentSlide?.background?.type === 'solid' ? (currentSlide.background.value || '#ffffff') : '#ffffff',
                            backgroundImage: currentSlide?.background?.type === 'image'
                                ? `url(${currentSlide.background.value})`
                                : currentSlide?.background?.type === 'gradient' ? currentSlide.background.value : undefined,
                            backgroundSize: currentSlide?.background?.type === 'image' ? 'cover' : undefined,
                            backgroundPosition: currentSlide?.background?.type === 'image' ? 'center' : undefined,
                            // Presentation Scaling Logic
                            // FIX: Keep base resolution 800x450 to match element coordinates, just scale up visually.
                            width: 800,
                            height: 450,
                            transform: isPresenting ? `scale(${Math.min(window.innerWidth / 800, window.innerHeight / 450)})` : undefined
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {currentSlide?.elements.map(el => renderElement(el))}
                    </div>

                    {!isPresenting && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/20 p-2 flex items-center gap-2 ring-1 ring-black/5 z-[60]">
                            <Button variant="ghost" size="icon" onClick={() => addElement('text')} title="Text"><Type className="w-5 h-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => addElement('shape')} title="Shape"><Square className="w-5 h-5" /></Button>

                            {/* Image Tool with Dropdown */}
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsImageMenuOpen(!isImageMenuOpen)}
                                    title="Image"
                                    className={cn(isImageMenuOpen && "bg-slate-100 text-indigo-600")}
                                >
                                    <ImageIcon className="w-5 h-5" />
                                </Button>

                                {isImageMenuOpen && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-white shadow-xl rounded-lg border p-1 flex flex-col gap-1">
                                        <button
                                            onClick={() => { setIsImageMenuOpen(false); addElement('image'); }}
                                            className="text-left px-3 py-2 hover:bg-slate-50 text-xs rounded flex items-center gap-2"
                                        >
                                            Upload File
                                        </button>
                                        <button
                                            onClick={() => { setIsImageMenuOpen(false); setIsImageSearchOpen(true); }}
                                            className="text-left px-3 py-2 hover:bg-slate-50 text-xs rounded flex items-center gap-2"
                                        >
                                            Search Unsplash
                                        </button>
                                    </div>
                                )}

                                {/* Unsplash Search Popover */}
                                {isImageSearchOpen && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white shadow-xl rounded-lg border p-3 flex flex-col gap-2">
                                        <div className="flex items-center justify-between pb-2 border-b">
                                            <span className="text-xs font-bold text-slate-500">Unsplash Search</span>
                                            <button onClick={() => setIsImageSearchOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                                        </div>
                                        <input
                                            placeholder="Search..."
                                            className="w-full p-2 border rounded text-xs"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    // Update results based on keyword (Mock for now, as direct public API search requires key)
                                                    // We will just shuffle the results to simulate "searching"
                                                    const keyword = e.currentTarget.value;
                                                    // Ideally: fetch(`https://api.unsplash.com/search/photos?query=${keyword}...`)
                                                    // For demo: We keep the curated list but let user know we "searched"
                                                    setSearchResults(prev => [...prev].sort(() => 0.5 - Math.random()));
                                                }
                                            }}
                                        />
                                        <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto custom-scroll">
                                            {searchResults.map((url, i) => (
                                                <button
                                                    key={i}
                                                    className="aspect-square rounded overflow-hidden hover:opacity-80 border"
                                                    onClick={() => {
                                                        const newElement: SlideElement = {
                                                            id: crypto.randomUUID(),
                                                            type: 'image',
                                                            x: 100, y: 100, w: 400, h: 300,
                                                            src: `${url}?w=1600&q=80`,
                                                            style: { backgroundColor: 'transparent' }
                                                        };
                                                        updateSlide(currentSlide.id, { elements: [...currentSlide.elements, newElement] });
                                                        setSelection([newElement.id]);
                                                        setIsImageSearchOpen(false);
                                                    }}
                                                >
                                                    <img src={`${url}?w=100&q=80`} alt="img" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isPresenting && (
                        <>
                            <button onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))} className="absolute left-4 top-1/2 p-4 text-white/50"><ChevronLeft className="w-12 h-12" /></button>
                            <button onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))} className="absolute right-4 top-1/2 p-4 text-white/50"><ChevronRight className="w-12 h-12" /></button>
                            <button onClick={() => setIsPresenting(false)} className="absolute top-4 right-4 p-2 text-white/50"><Maximize2 className="w-6 h-6" /></button>
                        </>
                    )}

                </main>

                {!isPresenting && (
                    <SlideProperties
                        selection={selection}
                        elements={currentSlide?.elements || []}
                        currentSlide={currentSlide}
                        onUpdate={updateElement}
                        onLayerAction={(action) => action === 'front' ? bringToFront() : sendToBack()}
                        onSlideUpdate={(updates) => updateSlide(currentSlide.id, updates)}
                    />
                )}
            </div>

            {/* Hidden Inputs */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
            />
        </div>
    );
}
