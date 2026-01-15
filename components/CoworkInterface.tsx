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
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { createForm } from "@/app/actions/cowork";

const templates = [
  { id: "t1", title: "빈 문서", type: "doc", icon: FileText, color: "bg-blue-500" },
  { id: "t2", title: "회의록", type: "doc", icon: FileText, color: "bg-blue-500" },
  { id: "t3", title: "프로젝트 트래커", type: "sheet", icon: Table, color: "bg-emerald-500" },
  { id: "t4", title: "피치 데크", type: "slide", icon: Presentation, color: "bg-amber-500" },
  { id: "t5", title: "피드백 설문", type: "form", icon: FormInput, color: "bg-purple-500" },
];

export default function CoworkInterface({ initialForms = [] }: { initialForms?: { id: string, title: string, updated: string }[] }) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Transform initialForms to match UI structure if needed, or unify types.
  // Assuming 'forms' come from PB.
  const forms = initialForms.map(f => ({
    id: f.id,
    title: f.title,
    type: 'form',
    owner: 'Me', // We know it's ours for now
    updated: new Date(f.updated).toLocaleDateString(),
    starred: false // PB doesn't have starred yet
  }));

  // Combine with other mock data? Or just show forms for now since that's what we have.
  // For demo, let's keep mock docs but prepend forms.
  const allFiles = [
    ...forms,
    ...[
      { id: "m1", title: "1분기 로드맵", type: "doc", owner: "Hugo", updated: "2시간 전", starred: true },
      { id: "m2", title: "2024년 예산안", type: "sheet", owner: "Finance", updated: "4시간 전", starred: false },
    ]
  ];

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
      // Call Server Action
      const result = await createForm();
      if (result.success && result.id) {
        router.push(`/dashboard/cowork/form/${result.id}`);
      } else {
        alert("설문지 생성 실패: " + result.error);
      }
    } else {
      alert(`${type} 생성 기능은 준비 중입니다!`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
      {/* Header */}
      <header className="h-18 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10 bg-[#F8FAFC]/80 backdrop-blur-md">
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
            <div className="flex flex-col gap-3 group cursor-pointer shrink-0" onClick={() => { }}>
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
            {allFiles.map(file => (
              <div key={file.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col overflow-hidden h-64">
                {/* Preview Area */}
                <div className="flex-1 bg-slate-50/50 relative p-6 flex flex-col gap-3 group-hover:bg-slate-50 transition-colors">
                  <div className="w-full h-3 bg-slate-200/50 rounded-full" />
                  <div className="w-3/4 h-3 bg-slate-200/50 rounded-full" />
                  <div className="space-y-2 mt-4">
                    <div className="w-full h-2 bg-slate-100 rounded-full" />
                    <div className="w-full h-2 bg-slate-100 rounded-full" />
                    <div className="w-full h-2 bg-slate-100 rounded-full" />
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => {
                        if (file.type === 'form') router.push(`/dashboard/cowork/form/${file.id}`);
                        else alert("준비 중입니다.");
                      }}
                      className="bg-white/90 backdrop-blur text-indigo-600 px-4 py-2 rounded-full font-medium text-sm shadow-md transform scale-95 group-hover:scale-100 transition-all">
                      열기
                    </button>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-4 border-t border-slate-50 bg-white relative z-10">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-slate-800 text-sm truncate flex-1 group-hover:text-indigo-600 transition-colors">{file.title}</h3>
                    <div className="p-1.5 bg-slate-50 rounded-lg shrink-0">
                      {getIcon(file.type)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>{file.updated}</span>
                    <button className="hover:text-amber-400 transition-colors p-1 -mr-1">
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
      <div className="absolute right-8 bottom-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-16 h-16 bg-slate-900 hover:bg-indigo-600 rounded-full shadow-2xl shadow-indigo-500/30 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 group">
              <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={20} className="w-64 p-2 rounded-2xl border-slate-100 shadow-xl bg-white/90 backdrop-blur-xl">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}
