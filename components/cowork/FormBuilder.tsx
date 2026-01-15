"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Settings,
  Eye,
  Save,
  MoreVertical,
  Type,
  AlignLeft,
  CheckSquare,
  List,
  CircleDot,
  ArrowLeft,
  Share2,
  Copy,
  LayoutTemplate,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { updateForm, getFormResponses, toggleFormStatus } from "@/app/actions/cowork";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Form Types
type QuestionType = "short" | "paragraph" | "multiple" | "checkbox" | "dropdown" | "slider" | "text";

interface Question {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options?: string[]; // For multiple/checkbox/dropdown
  min?: number; // For slider
  max?: number; // For slider
  step?: number; // For slider
}

interface Form {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  isActive?: boolean;
}

export default function FormBuilder({ formId, initialData }: { formId: string, initialData?: Form }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'questions' | 'responses' | 'settings'>('questions');
  const [isSaving, setIsSaving] = useState(false);

  // Initialization
  const [form, setForm] = useState<Form>(initialData || {
    id: formId,
    title: "새로운 설문지",
    description: "설문지에 대한 설명을 입력해주세요.",
    questions: [
      { id: "q1", type: "short", title: "질문 1", required: false }
    ],
    isActive: true
  });

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>("q1");

  // Hover State for Inline Add Buttons
  const [activeAddButton, setActiveAddButton] = useState<{ id: string, position: 'top' | 'bottom' } | null>(null);

  // New States for Features
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [responses, setResponses] = useState<{ id: string, created: string, answers: Record<string, unknown> }[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);

  // Fetch Responses when tab changes
  useEffect(() => {
    if (activeTab === 'responses') {
      setIsLoadingResponses(true);
      getFormResponses(formId).then(res => {
        if (res.success) setResponses(res.responses || []);
        setIsLoadingResponses(false);
      });
    }
  }, [activeTab, formId]);

  // Handlers
  const addQuestion = (idx: number) => {
    const newId = `q_${Date.now()}`;
    const newQuestions = [...form.questions];
    newQuestions.splice(idx + 1, 0, { id: newId, type: "short", title: "", required: false });

    setForm(prev => ({
      ...prev,
      questions: newQuestions
    }));
    setActiveQuestionId(newId);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    }));
  };

  const deleteQuestion = (id: string) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
    if (activeQuestionId === id) setActiveQuestionId(null);
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    const newQuestions = [...form.questions];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (targetIdx < 0 || targetIdx >= newQuestions.length) return;

    // Swap
    [newQuestions[idx], newQuestions[targetIdx]] = [newQuestions[targetIdx], newQuestions[idx]];

    setForm(prev => ({
      ...prev,
      questions: newQuestions
    }));
  };

  const addOption = (qId: string) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === qId) {
          const options = q.options || ["옵션 1"];
          return { ...q, options: [...options, `옵션 ${options.length + 1}`] };
        }
        return q;
      })
    }));
  };

  const updateOption = (qId: string, idx: number, value: string) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === qId && q.options) {
          const newOptions = [...q.options];
          newOptions[idx] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    }));
  };

  const removeOption = (qId: string, idx: number) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === qId && q.options) {
          return { ...q, options: q.options.filter((_, i) => i !== idx) };
        }
        return q;
      })
    }));
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const threshold = rect.height / 2;
    const position = y < threshold ? 'top' : 'bottom';

    if (activeAddButton?.id !== id || activeAddButton?.position !== position) {
      setActiveAddButton({ id, position });
    }
  };

  const handleCardMouseLeave = () => {
    setActiveAddButton(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateForm(formId, {
        title: form.title,
        description: form.description,
        questions: form.questions as any
      });
      // alert("저장되었습니다."); 
    } catch {
      alert("저장 실패");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const newState = !form.isActive;
    setForm(prev => ({ ...prev, isActive: newState }));
    await toggleFormStatus(formId, newState);
  };

  // Share Logic
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/share/form/${formId}` : '';
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert("링크가 복사되었습니다!");
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Bar */}
      <header className="w-full h-16 px-6 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <input
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="font-bold text-lg bg-transparent hover:bg-slate-50 focus:bg-slate-100 rounded px-2 -ml-2 outline-none transition-colors text-slate-800"
            />
            <div className="flex items-center gap-6 text-sm text-slate-500 font-medium ml-1 mt-0.5">
              <button
                onClick={() => setActiveTab('questions')}
                className={cn("hover:text-purple-600 transition-colors relative", activeTab === 'questions' ? "text-purple-600 font-bold" : "")}
              >
                질문
              </button>
              <button
                onClick={() => setActiveTab('responses')}
                className={cn("hover:text-purple-600 transition-colors relative", activeTab === 'responses' ? "text-purple-600 font-bold" : "")}
              >
                응답
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={cn("hover:text-purple-600 transition-colors relative", activeTab === 'settings' ? "text-purple-600 font-bold" : "")}
              >
                설정
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => window.open(`/share/form/${formId}`, '_blank')} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" title="미리보기">
            <Eye className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-200" />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-slate-200 hover:shadow-indigo-200 disabled:opacity-50">
            <Save className="w-4 h-4" /> {isSaving ? "저장 중..." : "저장"}
          </button>
          <button
            onClick={() => setIsShareOpen(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-purple-200 flex items-center gap-2">
            <Share2 className="w-4 h-4" /> 보내기
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center relative bg-slate-50/50">
        <div className="w-full max-w-5xl flex items-start gap-6 pb-32">

          {/* Content Column */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">

            {/* Tab Content: Questions */}
            {activeTab === 'questions' && (
              <>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 flex flex-col gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 to-indigo-500" />
                  <input
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    className="text-4xl font-extrabold outline-none placeholder:text-slate-200 text-slate-900 bg-transparent"
                    placeholder="설문지 제목"
                  />
                  <input
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    className="text-slate-500 outline-none placeholder:text-slate-300 text-lg bg-transparent"
                    placeholder="설문지에 대한 설명"
                  />
                </div>

                {form.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="group/card relative"
                    onMouseMove={(e) => handleCardMouseMove(e, q.id)}
                    onMouseLeave={handleCardMouseLeave}
                  >
                    {/* Inline Added Button (Top of Card) */}
                    <div className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 z-30 transition-all duration-200",
                      activeAddButton?.id === q.id && activeAddButton.position === 'top'
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-2 pointer-events-none"
                    )}>
                      <button
                        onClick={() => addQuestion(idx - 1)}
                        className="bg-purple-600 text-white rounded-full p-1.5 shadow-lg flex items-center gap-2 text-xs font-bold hover:scale-110 transition-transform"
                        title="이 위치에 질문 추가"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div
                      onClick={() => setActiveQuestionId(q.id)}
                      className={cn(
                        "bg-white rounded-2xl p-8 relative transition-all duration-300",
                        activeQuestionId === q.id
                          ? "shadow-xl shadow-indigo-500/5 ring-2 ring-indigo-500/10 z-10 scale-[1.01]"
                          : "shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200"
                      )}
                    >
                      {activeQuestionId === q.id ? (
                        // Editing Mode
                        <div className="flex flex-col gap-6">
                          <div className="flex gap-6 items-start">
                            <div className="flex-1">
                              <label className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-1 block">질문 제목</label>
                              <input
                                value={q.title}
                                onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                                className="w-full bg-slate-50 rounded-xl border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none px-4 py-3 font-semibold text-lg transition-colors placeholder:text-slate-300"
                                placeholder="질문을 입력하세요"
                                autoFocus
                              />
                            </div>

                            <div className="w-52 shrink-0">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">질문 유형</label>
                              <div className="relative">
                                <select
                                  value={q.type}
                                  onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 pl-11 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer font-medium text-slate-700 transition-all shadow-sm"
                                >
                                  <option value="short">단답형</option>
                                  <option value="paragraph">장문형</option>
                                  <option value="multiple">객관식 질문</option>
                                  <option value="checkbox">체크박스</option>
                                  <option value="dropdown">드롭다운</option>
                                  <option value="slider">숫자 슬라이더</option>
                                  <option value="text">텍스트 (설명만 표시)</option>
                                </select>
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
                                  {q.type === 'short' && <Type className="w-5 h-5" />}
                                  {q.type === 'paragraph' && <AlignLeft className="w-5 h-5" />}
                                  {q.type === 'multiple' && <CircleDot className="w-5 h-5" />}
                                  {q.type === 'checkbox' && <CheckSquare className="w-5 h-5" />}
                                  {q.type === 'dropdown' && <List className="w-5 h-5" />}
                                  {q.type === 'slider' && <SlidersHorizontal className="w-5 h-5" />}
                                  {q.type === 'text' && <LayoutTemplate className="w-5 h-5" />}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Option Editors */}
                          {['multiple', 'checkbox', 'dropdown'].includes(q.type) && (
                            <div className="flex flex-col gap-3 pl-1">
                              {q.options?.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-4 group/opt animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="shrink-0 text-slate-300">
                                    {q.type === 'multiple' && <CircleDot className="w-5 h-5" />}
                                    {q.type === 'checkbox' && <CheckSquare className="w-5 h-5" />}
                                    {q.type === 'dropdown' && <span className="text-sm font-mono w-5 text-center block">{optIdx + 1}.</span>}
                                  </div>

                                  <input
                                    value={opt}
                                    onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                                    className="flex-1 outline-none border-b-2 border-slate-100 hover:border-slate-300 focus:border-indigo-500 transition-colors py-2 text-sm text-slate-700 bg-transparent placeholder:text-slate-300"
                                    placeholder={`옵션 ${optIdx + 1}`}
                                  />
                                  <button onClick={() => removeOption(q.id, optIdx)} className="opacity-0 group-hover/opt:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => addOption(q.id)}
                                className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 w-fit mt-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-all group/add"
                              >
                                <Plus className="w-4 h-4 group-hover/add:scale-110 transition-transform" />
                                <span>옵션 추가</span>
                              </button>
                            </div>
                          )}

                          {/* Slider Editor */}
                          {q.type === 'slider' && (
                            <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">최소값</label>
                                <input
                                  type="number"
                                  value={q.min || 0}
                                  onChange={(e) => updateQuestion(q.id, { min: parseInt(e.target.value) })}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">최대값</label>
                                <input
                                  type="number"
                                  value={q.max || 100}
                                  onChange={(e) => updateQuestion(q.id, { max: parseInt(e.target.value) })}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">간격 (Step)</label>
                                <input
                                  type="number"
                                  value={q.step || 1}
                                  onChange={(e) => updateQuestion(q.id, { step: parseInt(e.target.value) })}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          )}

                          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-2">
                            <button onClick={() => deleteQuestion(q.id)} className="p-2.5 text-slate-400 hover:bg-red-50 rounded-xl hover:text-red-600 transition-colors" title="삭제">
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <div className="w-px h-8 bg-slate-100 mx-2" />

                            {/* Required Toggle (Hide for Text type) */}
                            {q.type !== 'text' && (
                              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl">
                                <span className="text-sm font-medium text-slate-600">필수 응답</span>
                                <button
                                  onClick={() => updateQuestion(q.id, { required: !q.required })}
                                  className={cn(
                                    "w-11 h-6 rounded-full relative transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                                    q.required ? "bg-indigo-600" : "bg-slate-300"
                                  )}
                                >
                                  <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm", q.required ? "left-6" : "left-1")} />
                                </button>
                              </div>
                            )}

                            {/* More Actions Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl hover:text-slate-600 outline-none">
                                  <MoreVertical className="w-5 h-5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-white/90 backdrop-blur-xl border-slate-200">
                                <DropdownMenuLabel>질문 관리</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="cursor-pointer">
                                  <ArrowUp className="w-4 h-4 mr-2" /> 위로 이동
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => moveQuestion(idx, 'down')} disabled={idx === form.questions.length - 1} className="cursor-pointer">
                                  <ArrowDown className="w-4 h-4 mr-2" /> 아래로 이동
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => deleteQuestion(q.id)} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer">
                                  <Trash2 className="w-4 h-4 mr-2" /> 삭제
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                          </div>
                        </div>
                      ) : (
                        // Viewing Mode (Collapsed)
                        <div className="flex flex-col gap-3">
                          <div className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                            {q.title || <span className="text-slate-400 italic">제목 없는 질문</span>}
                            {q.required && q.type !== 'text' && <span className="text-red-500 text-xs font-bold bg-red-50 px-1.5 py-0.5 rounded ml-2">필수</span>}
                          </div>

                          {q.type === 'text' && <div className="text-sm text-slate-400 ml-8 font-mono bg-slate-50 p-2 rounded w-fit">설명 텍스트 (응답 없음)</div>}

                          {['multiple', 'checkbox', 'dropdown'].includes(q.type) && (
                            <div className="flex flex-col gap-2 pl-8 mt-1">
                              {q.options?.map((opt, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm text-slate-500">
                                  {q.type === 'multiple' && <CircleDot className="w-4 h-4 text-slate-300" />}
                                  {q.type === 'checkbox' && <CheckSquare className="w-4 h-4 text-slate-300" />}
                                  {q.type === 'dropdown' && <span className="text-xs text-slate-300 font-mono w-4">{i + 1}.</span>}
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {q.type === 'slider' && (
                            <div className="ml-8 mt-1 flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-50 w-fit px-3 py-1 rounded-full border border-slate-100">
                              <span>Min: {q.min || 0}</span>
                              <span>Max: {q.max || 100}</span>
                              <span>Step: {q.step || 1}</span>
                            </div>
                          )}

                          {q.type === 'short' && <div className="ml-8 border-b-2 border-slate-100 w-1/3 h-8" />}
                          {q.type === 'paragraph' && <div className="ml-8 border-b-2 border-slate-100 w-2/3 h-8" />}
                        </div>
                      )}
                    </div>

                    {/* Inline Added Button (Bottom of Card) */}
                    <div className={cn(
                      "absolute -bottom-3 left-1/2 -translate-x-1/2 z-30 transition-all duration-200",
                      activeAddButton?.id === q.id && activeAddButton.position === 'bottom'
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 -translate-y-2 pointer-events-none"
                    )}>
                      <button
                        onClick={() => addQuestion(idx)}
                        className="bg-purple-600 text-white rounded-full p-1.5 shadow-lg flex items-center gap-2 text-xs font-bold hover:scale-110 transition-transform"
                        title="이 다음에 질문 추가"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Empty State Add Button (if no questions) */}
                {form.questions.length === 0 && (
                  <div className="flex items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <button
                      onClick={() => addQuestion(-1)}
                      className="flex flex-col items-center gap-3 text-slate-400 hover:text-purple-600 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 group-hover:border-purple-200">
                        <Plus className="w-8 h-8" />
                      </div>
                      <span className="font-bold">첫 번째 질문 추가하기</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Tab Content: Responses */}
            {activeTab === 'responses' && (
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-500">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{responses.length}개의 응답</h2>
                  {isLoadingResponses && <p>로딩 중...</p>}
                  {!isLoadingResponses && responses.length === 0 && <p className="mt-4">아직 응답이 없습니다.</p>}
                </div>

                {responses.map((res, i) => (
                  <div key={res.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <span className="bg-indigo-100 text-indigo-700 w-7 h-7 rounded-lg flex items-center justify-center text-sm">{responses.length - i}</span>
                      응답 #{i + 1}
                      <span className="text-xs font-normal text-slate-400 ml-auto">{new Date(res.created).toLocaleString()}</span>
                    </h3>
                    <div className="flex flex-col gap-3">
                      {Object.entries(res.answers).map(([key, val]) => {
                        const questionTitle = form.questions.find(q => q.id === key)?.title || "질문";
                        return (
                          <div key={key} className="text-sm">
                            <span className="font-semibold text-slate-600 block mb-1">{questionTitle}</span>
                            <div className="p-3 bg-slate-50 rounded-lg text-slate-800">
                              {Array.isArray(val) ? val.join(", ") : String(val)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab Content: Settings */}
            {activeTab === 'settings' && (
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">설문 설정</h2>
                  <div className="flex items-center justify-between py-4 border-b border-slate-50">
                    <div>
                      <div className="font-semibold text-slate-800">응답 받기</div>
                      <div className="text-sm text-slate-500">이 설문지의 응답 수집을 활성화합니다.</div>
                    </div>
                    <button
                      onClick={handleToggleActive}
                      className={cn(
                        "w-12 h-7 rounded-full relative transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                        form.isActive !== false ? "bg-indigo-600" : "bg-slate-300"
                      )}
                    >
                      <div className={cn("absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm", form.isActive !== false ? "left-6" : "left-1")} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-4 mt-4">
                    <div>
                      <div className="font-semibold text-red-600">설문지 삭제</div>
                      <div className="text-sm text-slate-500">이 설문지와 모든 응답 데이터를 영구적으로 삭제합니다.</div>
                    </div>
                    <button className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors">
                      삭제하기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Right Column is Removed as requested, buttons are now inline */}

        </div>
      </main>

      {/* Share Modal */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white/90 backdrop-blur-xl border-white/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">설문 보내기</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <label className="text-sm font-bold text-slate-500 mb-2 block">링크 공유</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-600 truncate text-sm">
                {shareUrl}
              </div>
              <button onClick={copyShareLink} className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors font-bold">
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={() => setIsShareOpen(false)} className="px-5 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-bold text-sm transition-colors">
              닫기
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
