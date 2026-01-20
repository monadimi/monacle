/**
 * @file components/cowork/hooks/useFormSession.ts
 * @purpose Managing form session state (fetching, answers, navigation, submission).
 * @scope State management for FormViewer.
 * @out-of-scope UI rendering.
 */
import { useState, useEffect, useCallback } from "react";
import { getForm, submitResponse } from "@/app/actions/cowork";

// --- Types (Duplicated temporarily, should be shared) ---
export type QuestionType =
  | "short"
  | "paragraph"
  | "multiple"
  | "checkbox"
  | "dropdown"
  | "slider"
  | "text";

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export interface Form {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  isActive?: boolean;
}

export function useFormSession(formId: string, initialData?: Form) {
  const [form, setForm] = useState<Form | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialData);

  // Navigation
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);

  // Data
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState(false);

  // Fetch Logic
  useEffect(() => {
    if (!initialData) {
      setLoading(true);
      getForm(formId)
        .then((res) => {
          if (res.success && res.form) {
            setForm(res.form as Form);
          } else {
            setError(res.error || "Form not found");
          }
        })
        .finally(() => setLoading(false));
    }
  }, [formId, initialData]);

  const handleAnswer = useCallback(
    (val: string | number | string[]) => {
      if (!form) return;
      const currentQ = form.questions[currentStep - 1];
      if (!currentQ) return;
      setAnswers((prev) => ({ ...prev, [currentQ.id]: val }));
    },
    [form, currentStep],
  );

  const submit = useCallback(async () => {
    if (!form) return;
    setIsSubmitting(true);
    try {
      await submitResponse(form.id, answers);
      // Success is handled by navigating to outro step usually,
      // but here we just complete the flow.
    } catch {
      alert("제출 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }, [form, answers]);

  const handleNext = useCallback(
    (overrideValue?: string | number | string[]) => {
      if (!form) return;

      // Validation
      if (currentStep > 0 && currentStep <= form.questions.length) {
        const q = form.questions[currentStep - 1];

        if (q.type !== "text") {
          const val =
            overrideValue !== undefined ? overrideValue : answers[q.id];
          const isEmpty =
            val === undefined ||
            val === "" ||
            (Array.isArray(val) && val.length === 0);

          if (q.required && isEmpty) {
            setErrorState(true);
            setTimeout(() => setErrorState(false), 2000);
            return;
          }
        }
      }

      if (currentStep < form.questions.length + 1) {
        setDirection(1);
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);

        if (nextStep === form.questions.length + 1) {
          submit();
        }
      }
    },
    [form, currentStep, answers, submit],
  );

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  return {
    form,
    error,
    loading,
    currentStep,
    direction,
    answers,
    errorState,
    handleAnswer,
    handleNext,
    handlePrev,
    isSubmitting,
  };
}
