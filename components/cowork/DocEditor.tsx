"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Heading } from "@tiptap/extension-heading";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Placeholder } from "@tiptap/extension-placeholder";

import {
  ArrowLeft,
  Save,
  Share2,
  Undo,
  Redo,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
  CheckCircle2,
  CloudOff,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Palette,
  Highlighter,
  CheckSquare,
  Code,
  Quote,
  Trash2,
  FileText,
  ChevronDown
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { updateDoc, deleteDoc, toggleSharing } from "@/app/actions/cowork";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const lowlight = createLowlight(common);

interface Doc {
  id: string;
  title: string;
  content: string;
  author: string;
  updated: string;
  is_shared: boolean;
  share_type: string;
  parent_id?: string;
}

export default function DocEditor({ docId, initialData }: { docId: string, initialData: Doc }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isShared, setIsShared] = useState(initialData.is_shared);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [docHeight, setDocHeight] = useState(1056);
  const contentRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-indigo-600 underline cursor-pointer" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-2xl max-w-full my-8" } }),
      Placeholder.configure({ placeholder: "내용을 입력하세요..." }),
    ],
    content: initialData.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-slate max-w-none focus:outline-none min-h-[1056px] py-24 px-16 md:px-24 w-full max-w-[816px] mx-auto",
      },
      handleKeyDown: (view, event) => {
        // Force update on certain keys to ensure toolbar button states update
        if (['b', 'i', 'u'].includes(event.key.toLowerCase()) && (event.ctrlKey || event.metaKey)) {
          setTimeout(() => updateHeight(), 0);
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getHTML());
      updateHeight();
    },
    onTransaction: () => {
      // Force re-render of toolbar buttons on selection/transaction
      setForcedUpdate(prev => prev + 1);
    }
  });

  const [forcedUpdate, setForcedUpdate] = useState(0);

  const updateHeight = useCallback(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setDocHeight(Math.max(1056, height));
    }
  }, []);

  useEffect(() => {
    if (editor) {
      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      if (contentRef.current) observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
  }, [editor, updateHeight]);

  const debouncedSave = useCallback((content: string) => {
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      const res = await updateDoc(docId, { content });
      if (res.success) setSaveStatus("saved");
      else setSaveStatus("error");
    }, 2000);
    return () => clearTimeout(timer);
  }, [docId]);

  const handleToggleShare = async () => {
    const newShared = !isShared;
    const res = await toggleSharing("docs", docId, newShared);
    if (res.success) setIsShared(newShared);
  };

  const handleDelete = async () => {
    if (confirm("이 문서를 삭제하시겠습니까?")) {
      const res = await deleteDoc(docId);
      if (res.success) router.push("/dashboard/cowork");
    }
  };

  const addImage = async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      setSaveStatus("saving");
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("owner", initialData.author);
        formData.append("share_type", "view");
        formData.append("is_shared", "true");
        const res = await fetch("/api/drive/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.record?.id) {
          const proxiedUrl = `/api/proxy/file/${data.record.id}/${file.name}`;
          editor.chain().focus().setImage({ src: proxiedUrl }).run();
          setSaveStatus("saved");
        }
      } catch (err) {
        setSaveStatus("error");
      }
    };
    input.click();
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const pageHeight = 1122;
  const gapHeight = 40;
  const numPages = Math.max(1, Math.ceil((docHeight + 48) / pageHeight));

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/doc/${docId}` : "";

  if (!editor) return null;

  return (
    <div className="flex w-full h-[100dvh] bg-[#F8FAFC] overflow-hidden relative">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-30 shrink-0 h-full overflow-hidden",
        isSidebarOpen ? "w-64" : "w-0"
      )}>
        <div className="p-4 h-14 border-b border-slate-100 flex items-center justify-between shrink-0">
          <span className="font-bold text-slate-800 text-xs tracking-tight">문서 구조</span>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">현재 문서</div>
            <div className="p-3 bg-slate-50 text-slate-900 rounded-2xl text-xs font-bold flex items-center gap-3 border border-slate-200">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span className="truncate">{title}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">페이지 바로가기</div>
            <div className="grid grid-cols-1 gap-1">
              {Array.from({ length: numPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const mainElement = document.getElementById("editor-main");
                    if (mainElement) mainElement.scrollTo({ top: i * (pageHeight + gapHeight), behavior: "smooth" });
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all group text-left"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {i + 1}
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 group-hover:text-slate-900">{i + 1}쪽</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Sticky Header Wrapper */}
        <div className="z-40 bg-white shrink-0">
          {/* Top Header */}
          <header className="h-14 border-b border-slate-200 flex items-center justify-between px-6">
            <div className="flex items-center gap-4 flex-1">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-50 rounded-xl transition-all border border-slate-100">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </button>
              )}
              <div className="flex flex-col">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    updateDoc(docId, { title: e.target.value });
                  }}
                  className="font-bold text-slate-900 focus:outline-none bg-transparent h-6 text-sm w-full max-w-[300px]"
                  placeholder="제목 없는 문서"
                />
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                  {saveStatus === "saving" && <span className="flex items-center gap-1"><Save className="w-2.5 h-2.5 animate-pulse" /> 저장 중</span>}
                  {saveStatus === "saved" && <span className="flex items-center gap-1 text-emerald-500 font-bold"><CheckCircle2 className="w-2.5 h-2.5" /> 저장됨</span>}
                  <span>•</span>
                  <span className="text-slate-400">{numPages}쪽</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsShareOpen(true)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-2xl font-bold text-xs transition-all",
                  isShared ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Share2 className="w-4 h-4" />
                {isShared ? "공유 중" : "공유"}
              </button>
              <button onClick={handleDelete} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Toolbar */}
          <div className="h-12 bg-white border-b border-slate-100 p-1 flex items-center gap-1 px-6 z-50">
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 disabled:opacity-20"><Undo className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 disabled:opacity-20"><Redo className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-slate-100 mx-2" />

            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("heading", { level: 1 }) ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><Heading1 className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("heading", { level: 2 }) ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><Heading2 className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("heading", { level: 3 }) ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><Heading3 className="w-4 h-4" /></button>

            <div className="w-px h-5 bg-slate-100 mx-2" />
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("bold") ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><BoldIcon className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("italic") ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><ItalicIcon className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("underline") ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><UnderlineIcon className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("highlight") ? "bg-amber-400 text-amber-950" : "hover:bg-slate-50 text-slate-400")}><Highlighter className="w-4 h-4" /></button>

            <div className="w-px h-5 bg-slate-100 mx-2" />
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("bulletList") ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><ListIcon className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("orderedList") ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><ListOrderedIcon className="w-4 h-4" /></button>
            <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={cn("p-2 rounded-xl transition-all", editor.isActive("taskList") ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-400")}><CheckSquare className="w-4 h-4" /></button>

            <div className="w-px h-5 bg-slate-100 mx-2" />
            <button onClick={setLink} className={cn("p-2 rounded-xl transition-all", editor.isActive("link") ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-400")}><LinkIcon className="w-4 h-4" /></button>
            <button onClick={addImage} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><ImageIcon className="w-4 h-4" /></button>

            <div className="w-px h-5 bg-slate-100 mx-2" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all flex items-center gap-1 group">
                  <Palette className="w-4 h-4 group-hover:text-indigo-600 transition-colors" />
                  <ChevronDown className="w-3 h-3 text-slate-300 group-hover:text-indigo-300 transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="p-3 min-w-[200px] rounded-3xl bg-white border-slate-200 shadow-2xl z-[1000] animate-in fade-in zoom-in duration-200">
                <div className="grid grid-cols-5 gap-2">
                  {["#000000", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#64748b"].map(color => (
                    <button
                      key={color}
                      onClick={() => editor.chain().focus().setColor(color).run()}
                      className="w-8 h-8 rounded-xl border border-slate-100 hover:scale-110 active:scale-95 transition-all shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button onClick={() => editor.chain().focus().unsetColor().run()} className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-all">
                    <Type className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Scrollable Main Viewport */}
        <main id="editor-main" className="flex-1 overflow-y-auto bg-slate-50 relative p-4 md:p-12 pb-96 custom-scroll flex flex-col items-center gap-10">
          {/* Backdrop Sheets */}
          <div className="absolute inset-0 flex flex-col items-center pointer-events-none p-4 md:p-12 gap-10">
            {Array.from({ length: numPages }).map((_, i) => (
              <div
                key={i}
                className="w-full max-w-[816px] bg-white border border-slate-200/60 rounded-[48px] shrink-0"
                style={{ height: pageHeight }}
              />
            ))}
          </div>

          {/* Editor Core */}
          <div className="relative z-10 w-full flex flex-col items-center">
            <div ref={contentRef} className="w-full max-w-[816px]">
              <EditorContent editor={editor} />
            </div>
          </div>
        </main>

        {/* Share Dialog */}
        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
          <DialogContent className="max-w-md p-8 rounded-[40px] bg-white border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">문서 공유</DialogTitle>
            </DialogHeader>
            <div className="mt-8 space-y-8">
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-200/50">
                <div className="space-y-1">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-widest">링크 공유</div>
                  <div className="text-[10px] text-slate-400 font-medium">링크가 있는 모든 사용자가 문서를 볼 수 있습니다.</div>
                </div>
                <button
                  onClick={handleToggleShare}
                  className={cn("w-14 h-8 rounded-full relative transition-all duration-300", isShared ? "bg-indigo-600" : "bg-slate-200")}
                >
                  <div className={cn("absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm", isShared ? "left-7" : "left-1")} />
                </button>
              </div>

              {isShared && (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">비밀 링크</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white border border-slate-200 rounded-[20px] px-6 py-4 text-slate-800 truncate text-[10px] font-bold">
                      {shareUrl}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        alert("복사되었습니다!");
                      }}
                      className="w-14 h-14 bg-indigo-600 text-white rounded-[20px] flex items-center justify-center active:scale-90 transition-all"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <style jsx global>{`
          .prose h1 { font-size: 3.5rem; font-weight: 900; margin-bottom: 2rem; color: #0f172a; line-height: 1; letter-spacing: -0.05em; }
          .prose h2 { font-size: 2.25rem; font-weight: 800; margin-top: 3rem; margin-bottom: 1rem; color: #1e293b; letter-spacing: -0.03em; }
          .prose h3 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; color: #334155; }
          .prose p { line-height: 1.8; margin-bottom: 1.25rem; color: #475569; font-size: 1.1rem; }
          .prose ul:not([data-type="taskList"]) { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; }
          .prose ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.5rem; }
          .prose li { margin-bottom: 0.6rem; color: #475569; }
          .prose blockquote { border-left: 6px solid #e2e8f0; padding: 1rem 0 1rem 2rem; font-style: italic; color: #64748b; margin: 2.5rem 0; background: #f8fafc; border-radius: 0 1rem 1rem 0; }
          .prose pre { background: #1e293b; color: #f8fafc; padding: 2rem; border-radius: 1.5rem; font-size: 0.95rem; overflow-x: auto; margin: 2.5rem 0; }
          .prose code { color: #eb5757; background: #fff5f5; padding: 0.2rem 0.4rem; border-radius: 0.4rem; font-size: 0.85em; }
          .prose pre code { color: inherit; background: none; padding: 0; }
          .prose a { color: #4f46e5; text-decoration: underline; text-underline-offset: 6px; font-weight: 700; }
          .prose img { transition: all 0.4s ease; border-radius: 1rem; }
          .prose ul[data-type="taskList"] { list-style: none; padding: 0; }
          .prose ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.5rem; }
          .prose ul[data-type="taskList"] input[type="checkbox"] { width: 1.25rem; height: 1.25rem; border-radius: 0.375rem; border: 2px solid #cbd5e1; appearance: none; cursor: pointer; position: relative; top: 0.25rem; flex-shrink: 0; transition: all 0.2s; }
          .prose ul[data-type="taskList"] input[type="checkbox"]:checked { background-color: #4f46e5; border-color: #4f46e5; }
          .prose ul[data-type="taskList"] input[type="checkbox"]:checked::after { content: '✓'; color: white; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.75rem; font-weight: bold; }
          .prose .is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: #cbd5e1; pointer-events: none; height: 0; font-style: italic; }

          .custom-scroll::-webkit-scrollbar { width: 6px; }
          .custom-scroll::-webkit-scrollbar-track { background: transparent; }
          .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
          .custom-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
          
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    </div>
  );
}
