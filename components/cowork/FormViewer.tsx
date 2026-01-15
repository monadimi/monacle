"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, ArrowRight, ArrowLeft, Check, Command, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getForm, submitResponse } from "@/app/actions/cowork";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---
type QuestionType = "short" | "paragraph" | "multiple" | "checkbox" | "dropdown" | "slider" | "text";

interface Question {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

interface Form {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  isActive?: boolean;
}

// --- Components ---

// 1. Shimmer Highlight Component (Clean Implementation)
const HighlightText = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*.*?\*\*)/);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return (
            <motion.span
              key={i}
              className="relative inline-block font-bold text-slate-900"
              initial={{ backgroundPosition: "200% center" }}
              animate={{ backgroundPosition: "-200% center" }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "linear"
              }}
              style={{
                backgroundImage: "linear-gradient(90deg, #1e293b 0%, #94a3b8 50%, #1e293b 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent"
              }}
            >
              {content}
            </motion.span>
          );
        }
        return part;
      })}
    </span>
  );
};

// 2. Aurora Background (Optimized CSS vs heavy motion)
const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#fafafc] pointer-events-none">
      {/* Optimized Blobs using standard CSS classes for simpler renders */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-yellow-100/60 rounded-full blur-[80px] animate-[pulse_10s_ease-in-out_infinite] opacity-60"
        style={{ willChange: 'transform, opacity' }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-slate-200/40 rounded-full blur-[80px] animate-[pulse_12s_ease-in-out_infinite_reverse] opacity-60"
        style={{ willChange: 'transform, opacity' }}
      />
      <div
        className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-orange-50/50 rounded-full blur-[60px] animate-[pulse_15s_ease-in-out_infinite] opacity-40"
        style={{ willChange: 'transform, opacity' }}
      />
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
    </div>
  );
};

export default function FormViewer({ formId, initialData }: { formId: string, initialData?: Form }) {
  // State
  const [form, setForm] = useState<Form | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);

  // Navigation State
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);

  // Data State
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState(false); // New state for validation feedback
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Fetch Form Data if not provided
  useEffect(() => {
    if (!initialData) {
      getForm(formId).then(res => {
        if (res.success && res.form) {
          setForm(res.form as any);
        } else {
          setError(res.error || "Form not found");
        }
      });
    }
  }, [formId, initialData]);

  // Focus input on step change
  useEffect(() => {
    // Small timeout to ensure DOM is ready after animation start
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Handlers
  const handleAnswer = (val: any) => {
    if (!form) return;
    const currentQ = form.questions[currentStep - 1];
    setAnswers(prev => ({ ...prev, [currentQ.id]: val }));
  };

  const handleNext = (overrideValue?: any) => {
    if (!form) return;

    // Validation
    if (currentStep > 0 && currentStep <= form.questions.length) {
      const q = form.questions[currentStep - 1];

      // Skip validation for Text only type
      if (q.type === 'text') {
        // Just proceed
      } else {
        // Use override value if provided (for instant click-through), otherwise use state
        const val = overrideValue !== undefined ? overrideValue : answers[q.id];
        const isEmpty = val === undefined || val === "" || (Array.isArray(val) && val.length === 0);

        if (q.required && isEmpty) {
          setErrorState(true);
          const qContainer = document.getElementById('question-container');
          if (qContainer) {
            qContainer.animate([
              { transform: 'translateX(0)' },
              { transform: 'translateX(-6px)' },
              { transform: 'translateX(6px)' },
              { transform: 'translateX(-6px)' },
              { transform: 'translateX(6px)' },
              { transform: 'translateX(0)' }
            ], { duration: 300 });
          }
          // Auto-reset error state
          setTimeout(() => setErrorState(false), 2000);
          return;
        }
      }
    }

    if (currentStep < form.questions.length + 1) {
      setDirection(1);
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);

      // Check if next step is the last one (Outro) and trigger submit
      if (nextStep === form.questions.length + 1) {
        submit();
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const submit = async () => {
    if (!form) return;
    setIsSubmitting(true);
    await submitResponse(form.id, answers);
    setIsSubmitting(false);
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Arrow Key Navigation (Only when not focused on inputs)
      if (!isInput) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          handleNext();
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          handlePrev();
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        // Allow paragraphs to use Enter
        const isParagraph = form?.questions[currentStep - 1]?.type === 'paragraph';
        const isFocusedInTextarea = document.activeElement?.tagName === 'TEXTAREA';

        if (isParagraph && isFocusedInTextarea) return;

        e.preventDefault();
        if (currentStep === 0 || currentStep <= (form?.questions?.length || 0)) {
          handleNext();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, answers, form]);

  if (error) return <div className="flex items-center justify-center min-h-screen text-slate-500 font-medium">{error}</div>;
  if (!form) return <div className="flex items-center justify-center min-h-screen text-slate-400">Loading...</div>;

  const currentQ = currentStep > 0 && currentStep <= form.questions.length ? form.questions[currentStep - 1] : null;

  // Optimized Variants - Reduced blur/complexity
  const variants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 20 : -20,
      opacity: 0,
      filter: "blur(4px)" // Reduced blur for performance
    }),
    center: {
      zIndex: 1,
      y: 0,
      opacity: 1,
      filter: "blur(0px)"
    },
    exit: (direction: number) => ({
      zIndex: 0,
      y: direction < 0 ? 20 : -20,
      opacity: 0,
      filter: "blur(4px)"
    })
  };

  const totalSteps = form.questions.length + 2;
  const progress = (currentStep / (totalSteps - 1)) * 100;

  return (
    <div className="relative min-h-screen w-full font-sans text-slate-900 overflow-hidden selection:bg-slate-200 selection:text-slate-900">
      <AuroraBackground />

      {/* Progress Bar - Grayscale */}
      <div className="fixed top-0 left-0 w-full h-1 bg-slate-100 z-50">
        <motion.div
          className="h-full bg-slate-900"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "circOut" }}
        />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full p-6 md:p-12 max-w-4xl mx-auto">
        <AnimatePresence custom={direction} mode="wait">

          {/* STEP 0: INTRO */}
          {currentStep === 0 && (
            <motion.div
              key="intro"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: "easeOut" }} // Faster transition
              className="flex flex-col items-start gap-8 w-full max-w-2xl"
            >
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-tight">
                <HighlightText text={form.title} />
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed">
                {form.description}
              </p>
              <motion.button
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNext}
                className="mt-8 px-10 py-5 bg-slate-900 text-white rounded-2xl text-xl font-bold flex items-center gap-3 shadow-2xl hover:shadow-slate-400/20 transition-all border border-slate-900"
              >
                시작하기 <ArrowRight className="w-6 h-6" />
              </motion.button>
              <div className="opacity-40 text-sm mt-4 flex items-center gap-2 font-medium">
                <span className="bg-slate-200 px-2 py-1 rounded text-xs font-mono font-bold text-slate-700">Enter ↵</span> 키를 눌러서 시작
              </div>
            </motion.div>
          )}

          {/* QUESTIONS */}
          {currentQ && (
            <motion.div
              key={currentQ.id}
              id="question-container"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-2xl flex flex-col gap-8"
            >
              <div className="flex items-center gap-4 text-slate-500 font-bold mb-2 opacity-80">
                <span className="flex items-center justify-center w-8 h-8 rounded border border-slate-300 text-sm bg-white">
                  {currentStep}
                </span>
                <span className="text-xs uppercase tracking-widest text-slate-400">
                  of {form.questions.length}
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold leading-tight text-slate-900">
                <HighlightText text={currentQ.title} />
                {currentQ.required && currentQ.type !== 'text' && <span className="text-slate-400 text-2xl ml-2">*</span>}
                {currentQ.type === 'text' && <div className="text-base font-normal text-slate-500 mt-4 leading-relaxed font-sans">{currentQ.title}</div>}
              </h2>

              {/* Question Inputs */}
              <div className="mt-4">
                {/* Text Only Type Display (Hidden Input, just visual) */}
                {currentQ.type === 'text' && (
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-start gap-4">
                    <Info className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-slate-600">이 항목은 정보를 전달하는 텍스트입니다. 확인하셨으면 계속 버튼을 눌러주세요.</p>
                  </div>
                )}

                {currentQ.type === 'slider' && (
                  <div className="flex flex-col gap-6 py-6">
                    <div className="text-5xl font-black text-slate-900 text-center">
                      {answers[currentQ.id] as number || (currentQ.min || 0)}
                    </div>
                    <input
                      type="range"
                      min={currentQ.min || 0}
                      max={currentQ.max || 100}
                      step={currentQ.step || 1}
                      value={answers[currentQ.id] as number || (currentQ.min || 0)}
                      onChange={(e) => handleAnswer(Number(e.target.value))}
                      className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                    />
                    <div className="flex justify-between text-slate-400 font-mono text-sm px-1">
                      <span>{currentQ.min || 0}</span>
                      <span>{currentQ.max || 100}</span>
                    </div>
                  </div>
                )}


                {currentQ.type === 'short' && (
                  <input
                    ref={inputRef as any}
                    autoFocus
                    value={answers[currentQ.id] as string || ""}
                    onChange={(e) => handleAnswer(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-slate-200 focus:border-slate-800 outline-none text-2xl md:text-3xl py-4 transition-colors placeholder:text-slate-300 font-medium text-slate-800"
                    placeholder="답변을 입력해주세요..."
                  />
                )}

                {currentQ.type === 'paragraph' && (
                  <textarea
                    ref={inputRef as any}
                    autoFocus
                    value={answers[currentQ.id] as string || ""}
                    onChange={(e) => handleAnswer(e.target.value)}
                    rows={3}
                    className="w-full bg-transparent border-b-2 border-slate-200 focus:border-slate-800 outline-none text-xl md:text-2xl py-4 transition-colors placeholder:text-slate-300 font-medium text-slate-800 resize-none"
                    placeholder="내용을 입력해주세요..."
                  />
                )}

                {(currentQ.type === 'multiple' || currentQ.type === 'dropdown') && (
                  <div className="flex flex-col gap-3">
                    {currentQ.options?.map((opt, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.01, x: 4, backgroundColor: "#f8fafc" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          handleAnswer(opt);
                          // Auto advance for single choice
                          setTimeout(() => handleNext(opt), 300);
                        }}
                        className={cn(
                          "w-full text-left p-6 md:p-5 rounded-xl border-2 transition-all flex items-center gap-4 text-lg font-medium group relative overflow-hidden",
                          answers[currentQ.id] === opt
                            ? "border-slate-800 bg-slate-50 text-slate-900"
                            : "border-slate-100 bg-white hover:border-slate-300 text-slate-600"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          answers[currentQ.id] === opt ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 group-hover:border-slate-400 text-transparent"
                        )}>
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                        <span className="flex-1">{opt}</span>
                        <span className="opacity-0 group-hover:opacity-40 text-xs font-mono border border-slate-300 px-1.5 rounded bg-white text-slate-500">
                          {String.fromCharCode(65 + i)}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                )}

                {currentQ.type === 'checkbox' && (
                  <div className="flex flex-col gap-3">
                    {currentQ.options?.map((opt, i) => {
                      const currentAns = (answers[currentQ.id] as string[]) || [];
                      const isSelected = currentAns.includes(opt);
                      return (
                        <motion.button
                          key={i}
                          whileHover={{ scale: 1.01, x: 4, backgroundColor: "#f8fafc" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            const newAns = isSelected
                              ? currentAns.filter(a => a !== opt)
                              : [...currentAns, opt];
                            handleAnswer(newAns);
                          }}
                          className={cn(
                            "w-full text-left p-6 md:p-5 rounded-xl border-2 transition-all flex items-center gap-4 text-lg font-medium group",
                            isSelected
                              ? "border-slate-800 bg-slate-50 text-slate-900"
                              : "border-slate-100 bg-white hover:border-slate-300 text-slate-600"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 group-hover:border-slate-400 text-transparent"
                          )}>
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          {opt}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {errorState && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="text-red-500 text-sm font-bold flex items-center gap-2"
                  >
                    <Info className="w-4 h-4" /> 필수 문항입니다. 답변을 입력해주세요.
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-4 mt-8 pt-8 border-t border-slate-100 w-full">
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-slate-200 hover:shadow-slate-300"
                >
                  {currentStep === form.questions.length ? "제출하기" : "계속"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
                <div className="opacity-40 text-sm flex items-center gap-2 ml-4 font-medium text-slate-500">
                  Press <span className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-slate-700">Enter ↵</span>
                </div>
              </div>

            </motion.div>
          )}

          {/* OUTRO */}
          {currentStep === form.questions.length + 1 && (
            <motion.div
              key="outro"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center text-center gap-6 w-full max-w-2xl"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                  className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-2xl shadow-slate-200"
                >
                  <Check className="w-12 h-12" strokeWidth={4} />
                </motion.div>
              </div>

              <h2 className="text-4xl font-bold text-slate-900 mt-4">제출해주셔서 감사합니다!</h2>
              <p className="text-xl text-slate-500">
                모든 답변이 안전하게 기록되었습니다.
              </p>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.reload()}
                className="mt-8 px-6 py-2.5 text-slate-400 hover:text-slate-600 font-medium text-sm border-b border-transparent hover:border-slate-300 transition-colors"
              >
                새로운 응답 작성하기
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Global Navigation (Back/Next Fixed Buttons) */}
      <div className="fixed bottom-8 right-8 flex gap-2 z-50">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0 || currentStep > form.questions.length}
          className="p-3 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-slate-800 rounded-full shadow-lg border border-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleNext}
          disabled={currentStep > form.questions.length}
          className="p-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-white rounded-full shadow-lg transition-colors"
        >
          {currentStep === form.questions.length ? <Check className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
        </button>
      </div>

    </div>
  );
}
