"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  FileText,
  Table,
  Presentation,
  FormInput,
  LayoutDashboard,
  Filter,
  Grid,
  List as ListIcon,
  Star,
  Trash2,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { createForm, createDoc, deleteForm, deleteDoc, createBoard, deleteBoard, createDeck, deleteDeck } from "@/app/actions/cowork";
import { createSheet, deleteSheet } from "@/app/actions/sheets";

const templates = [
  { id: "t1", title: "빈 문서", type: "doc", icon: FileText, color: "bg-blue-500" },
  { id: "t2", title: "회의록", type: "doc", icon: FileText, color: "bg-blue-500" },
  { id: "t3", title: "프로젝트 트래커", type: "sheet", icon: Table, color: "bg-emerald-500" },
  { id: "t4", title: "피치 데크", type: "slide", icon: Presentation, color: "bg-amber-500" },
  { id: "t5", title: "피드백 설문", type: "form", icon: FormInput, color: "bg-purple-500" },
  { id: "t6", title: "아이디어 보드", type: "board", icon: LayoutDashboard, color: "bg-pink-500" },
];

export default function CoworkInterface({ initialItems = [] }: { initialItems?: Record<string, any>[] }) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [items, setItems] = useState(() =>
    initialItems
      .sort((a, b) => {
        const dateA = new Date(a.updated || a.created || 0).getTime();
        const dateB = new Date(b.updated || b.created || 0).getTime();
        return dateB - dateA;
      })
      .map(item => {
        const date = new Date(item.updated || item.created);
        const dateStr = isNaN(date.getTime()) ? "방금 전" : date.toLocaleDateString();

        return {
          id: item.id,
          title: item.title,
          type: item.slides ? 'slide' : (item.elements ? 'board' : (item.questions ? 'form' : (item.data && item.data.columns ? 'sheet' : 'doc'))),
          owner: 'Me',
          updated: dateStr,
          starred: false
        };
      })
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'doc': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'sheet': return <Table className="w-5 h-5 text-emerald-500" />;
      case 'slide': return <Presentation className="w-5 h-5 text-amber-500" />;
      case 'form': return <FormInput className="w-5 h-5 text-purple-500" />;
      case 'board': return <LayoutDashboard className="w-5 h-5 text-pink-500" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  const handleCreate = async (type: string) => {
    if (type === 'form') {
      const result = await createForm();
      if (result.success && result.id) router.push(`/dashboard/cowork/form/${result.id}`);
      else alert("설문지 생성 실패: " + result.error);
    } else if (type === 'doc') {
      const result = await createDoc();
      if (result.success && result.id) router.push(`/dashboard/cowork/doc/${result.id}`);
      else alert("문서 생성 실패: " + result.error);
    } else if (type === 'board') {
      const result = await createBoard();
      if (result.success && result.id) router.push(`/dashboard/cowork/board/${result.id}`);
      else alert("보드 생성 실패: " + result.error);
    } else if (type === 'slide') {
      const result = await createDeck();
      if (result.success && result.id) router.push(`/dashboard/cowork/slides/${result.id}`);
      else alert("프레젠테이션 생성 실패: " + result.error);
    } else if (type === 'sheet') {
      const result = await createSheet();
      if (result.success && result.id) router.push(`/dashboard/cowork/sheets/${result.id}`);
      else alert("스프레드시트 생성 실패: " + result.error);
    } else {
      alert(`${type} 생성 기능은 준비 중입니다!`);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm("정말로 삭제하시겠습니까?")) return;

    let res: { success: boolean; error?: string } = { success: false, error: "Unknown error" };
    if (type === 'form') res = await deleteForm(id) || res;
    else if (type === 'board') res = await deleteBoard(id);
    else if (type === 'slide') res = await deleteDeck(id);
    else if (type === 'sheet') res = await deleteSheet(id);
    else res = await deleteDoc(id);

    if (res.success) {
      setItems(prev => prev.filter(item => item.id !== id));
    } else {
      alert("삭제 실패: " + res.error);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC] relative">
      {/* Header */}
      <header className="h-18 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0 z-40 bg-[#F8FAFC]/80 backdrop-blur-md border-b border-transparent">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Cowork
          </h1>
        </div>

        <div className="flex-1 max-w-xl px-8">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="문서, 스프레드시트, 설문 검색..."
              className="w-full h-12 pl-11 pr-4 bg-white border border-transparent shadow-sm hover:shadow-md focus:shadow-lg focus:ring-0 focus:border-transparent rounded-2xl outline-none transition-all text-sm placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full bg-white shadow-sm hover:shadow-md border border-slate-100 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Scroll Area */}
      <main className="flex-1 overflow-y-auto pb-20">

        {/* Templates Section - Premium Cards */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500">새 파일 만들기</h2>
            <button className="text-sm text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">템플릿 갤러리</button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
            {/* Blank Template */}
            <div className="flex flex-col gap-3 group cursor-pointer shrink-0" onClick={() => handleCreate('doc')}>
              <div className="w-40 h-32 bg-white rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-300 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Plus className="w-8 h-8 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-600 text-center transition-colors">빈 문서</span>
            </div>

            {templates.map(tpl => (
              <div key={tpl.id} className="flex flex-col gap-3 group cursor-pointer shrink-0" onClick={() => handleCreate(tpl.type)}>
                <div className="w-40 h-32 bg-white rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute inset-0 p-4 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="w-full h-2 rounded-full bg-slate-100 mb-2" />
                    <div className="w-2/3 h-2 rounded-full bg-slate-100 mb-4" />
                    <div className="space-y-1.5">
                      <div className="w-full h-1.5 rounded-full bg-slate-50" />
                      <div className="w-full h-1.5 rounded-full bg-slate-50" />
                      <div className="w-4/5 h-1.5 rounded-full bg-slate-50" />
                    </div>
                  </div>

                  <div className={cn("absolute top-3 right-3 p-1.5 rounded-lg text-white shadow-sm opacity-80 group-hover:opacity-100 transition-opacity", tpl.color)}>
                    <tpl.icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-600 text-center transition-colors">
                  {tpl.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Files Section */}
        <div className="px-8 mt-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">최근 문서</h2>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
              <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}>
                <ListIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('grid')} className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}>
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {items.map(file => (
              <div key={file.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col overflow-hidden h-64 relative">
                {/* Preview Area */}
                <div
                  className="flex-1 bg-slate-50/50 relative p-6 flex flex-col gap-3 group-hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    if (file.type === 'form') router.push(`/dashboard/cowork/form/${file.id}`);
                    else if (file.type === 'doc') router.push(`/dashboard/cowork/doc/${file.id}`);
                    else if (file.type === 'board') router.push(`/dashboard/cowork/board/${file.id}`);
                    else if (file.type === 'slide') router.push(`/dashboard/cowork/slides/${file.id}`);
                    else if (file.type === 'sheet') router.push(`/dashboard/cowork/sheets/${file.id}`);
                  }}
                >
                  <div className="w-full h-3 bg-slate-200/50 rounded-full" />
                  <div className="w-3/4 h-3 bg-slate-200/50 rounded-full" />
                  <div className="space-y-2 mt-4">
                    <div className="w-full h-2 bg-slate-100 rounded-full" />
                    <div className="w-full h-2 bg-slate-100 rounded-full" />
                    <div className="w-full h-2 bg-slate-100 rounded-full" />
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur text-indigo-600 px-4 py-2 rounded-full font-medium text-sm shadow-md transform scale-95 group-hover:scale-100 transition-all">
                      열기
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-4 border-t border-slate-50 bg-white relative z-10">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-slate-800 text-sm truncate flex-1 group-hover:text-indigo-600 transition-colors">{file.title}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" collisionPadding={10} className="rounded-xl min-w-[120px] bg-white/95 backdrop-blur-xl border-slate-100 shadow-xl z-[70]">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.type); }} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer p-2.5 rounded-lg">
                          <Trash2 className="w-4 h-4 mr-2" /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-slate-50 rounded shrink-0">
                        {getIcon(file.type)}
                      </div>
                      <span>{file.updated}</span>
                    </div>
                    <button onClick={(e) => e.stopPropagation()} className="hover:text-amber-400 transition-colors p-1 -mr-1">
                      <Star className={cn("w-4 h-4", file.starred ? "text-amber-400 fill-amber-400" : "")} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Floating Action Button */}
      <div className="fixed right-8 bottom-8 z-[60]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-16 h-16 bg-slate-900 hover:bg-indigo-600 rounded-full shadow-2xl shadow-indigo-500/30 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 group">
              <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={15}
            collisionPadding={20}
            className="w-64 p-2 rounded-2xl border-slate-100 shadow-2xl bg-white/95 backdrop-blur-xl z-[70] max-h-[calc(100vh-100px)] overflow-y-auto custom-scroll"
          >
            <DropdownMenuItem className="p-3 cursor-pointer rounded-xl focus:bg-blue-50 focus:text-blue-700 transition-colors" onClick={() => handleCreate('doc')}>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4 text-blue-600 shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">새 문서</span>
                <span className="text-[11px] text-slate-400">리치 텍스트 문서</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer rounded-xl focus:bg-emerald-50 focus:text-emerald-700 transition-colors" onClick={() => handleCreate('sheet')}>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mr-4 text-emerald-600 shadow-sm">
                <Table className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">새 스프레드시트</span>
                <span className="text-[11px] text-slate-400">데이터 정리 및 분석</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer rounded-xl focus:bg-purple-50 focus:text-purple-700 transition-colors" onClick={() => handleCreate('form')}>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mr-4 text-purple-600 shadow-sm">
                <FormInput className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">새 설문지</span>
                <span className="text-[11px] text-slate-400">설문조사 및 퀴즈</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer rounded-xl focus:bg-pink-50 focus:text-pink-700 transition-colors" onClick={() => handleCreate('board')}>
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center mr-4 text-pink-600 shadow-sm">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">새 아이디어 보드</span>
                <span className="text-[11px] text-slate-400">무한 캔버스 화이트보드</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer rounded-xl focus:bg-amber-50 focus:text-amber-700 transition-colors" onClick={() => handleCreate('slide')}>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mr-4 text-amber-600 shadow-sm">
                <Presentation className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">새 프레젠테이션</span>
                <span className="text-[11px] text-slate-400">디자이너급 슬라이드</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
