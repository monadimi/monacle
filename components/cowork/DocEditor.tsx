/**
 * @file components/cowork/DocEditor.tsx
 * @purpose Collaborative document editor with rich text capabilities.
 * @scope Rich Text (TipTap), Real-time Sync (via PocketBase), Presence (Who is viewing), Page Layout.
 * @out-of-scope File Management (handled by Drive), Permissions (handled by CoworkInterface).
 * @failure-behavior Alerts on critical save failures. Gracefully handles network disconnects.
 */
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

// New Table & Export Imports
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";

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
  Trash2,
  FileText,
  ChevronDown,
  PlusCircle,
  Table as TableIcon,
  Download,
  FileDown
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { updateDoc, deleteDoc, toggleSharing } from "@/app/actions/cowork";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import pb from "@/lib/pocketbase";
import { Step } from "prosemirror-transform";

import { Page, CustomDoc } from "@/lib/tiptap-paging";
import { usePresence } from "./hooks/usePresence";

const lowlight = createLowlight(common);

interface Doc {
  id: string;
  title: string;
  content: string;
  author: string;
  updated: string;
  is_shared: boolean;
  share_type: string;
  share_team?: boolean;
  tVersion: number;
  lastClientId: string;
  parent_id?: string;
}

const ensurePaging = (html: string) => {
  if (!html) return '<div data-type="page"><p></p></div>';
  if (!html.includes('data-type="page"')) {
    return `<div data-type="page">${html}</div>`;
  }
  return html;
};

export default function DocEditor({ docId, initialData, readOnly = false, currentUser = null }: { docId: string, initialData: Doc, readOnly?: boolean, currentUser?: Record<string, unknown> | null }) {
  const router = useRouter();
  const [clientId] = useState(() => typeof window !== 'undefined' ? crypto.randomUUID() : "server");
  const [title, setTitle] = useState(initialData.title);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isShared, setIsShared] = useState(initialData.is_shared);
  const [shareType, setShareType] = useState<"view" | "edit">(initialData.share_type === "edit" ? "edit" : "view");
  const [shareTeam, setShareTeam] = useState(!!initialData.share_team);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!readOnly);
  const { activeEditors } = usePresence(docId, currentUser, 'doc');

  const [tVersion, setTVersion] = useState(initialData.tVersion || 0);
  const [pageCount, setPageCount] = useState(1);
  const pendingStepsRef = useRef<Record<string, unknown>[]>([]);
  const isApplyingRemoteRef = useRef(false);

  const editor = useEditor({
    extensions: [
      CustomDoc,
      Page,
      StarterKit.configure({ heading: false, codeBlock: false, document: false }),
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
      Table.configure({ resizable: true, HTMLAttributes: { class: "border-collapse table-auto w-full my-4" } }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: "bg-slate-50 border border-slate-300 px-4 py-2 font-bold text-left" } }),
      TableCell.configure({ HTMLAttributes: { class: "border border-slate-300 px-4 py-2" } }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: ensurePaging(initialData.content),
    immediatelyRender: false,
    editable: !readOnly && !!currentUser,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-slate max-w-none focus:outline-none w-full max-w-[816px] mx-auto",
          readOnly && "cursor-default"
        ),
      },
      handleKeyDown: () => {
        if (readOnly) return true;
        // Optimization: Handle enter/delete for pagination
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      if (isApplyingRemoteRef.current) return;
      // updateHeight(); // Removed in favor of paging height
      if (!readOnly) {
        schedulePagination();
        debouncedSave({ content: editor.getHTML() });
      }
    },
  });

  const updatePageCount = useCallback(() => {
    if (!editor) return;
    const nextCount = editor.state.doc.childCount || 1;
    setPageCount((prev) => (prev === nextCount ? prev : nextCount));
  }, [editor]);

  const buildAvatarUrl = useCallback((user?: { id?: string; avatar?: string }) => {
    if (!user?.avatar || !user?.id) return undefined;
    if (user.avatar.startsWith("http")) return user.avatar;
    return `https://monadb.snowman0919.site/api/files/users/${user.id}/${user.avatar}`;
  }, []);

  const buildEditorChip = useCallback((user: { id: string; name?: string; email?: string; avatar?: string }) => ({
    userId: user.id,
    name: user.name || user.email || "User",
    avatarUrl: buildAvatarUrl({ id: user.id, avatar: user.avatar }),
    updated: new Date().toISOString(),
  }), [buildAvatarUrl]);

  const runRemoteApply = useCallback((fn: () => void) => {
    isApplyingRemoteRef.current = true;
    fn();
    setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
  }, []);

  // Real-time Sync & Save Refs
  const titleRef = useRef(title);
  const saveStatusRef = useRef(saveStatus);
  const versionRef = useRef(tVersion);
  const pendingUpdates = useRef<{ title?: string, content?: string }>({});
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { saveStatusRef.current = saveStatus; }, [saveStatus]);
  useEffect(() => { versionRef.current = tVersion; }, [tVersion]);
  useEffect(() => {
    const user = currentUser as { token: string } | null;
    if (user?.token) {
      pb.authStore.save(user.token, currentUser as any);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!editor || readOnly) return;
    const handleTransaction = ({ transaction }: { transaction: any }) => {
      if (!transaction.docChanged) return;
      if (isApplyingRemoteRef.current) return;
      if (!transaction.steps?.length) return;
      pendingStepsRef.current.push(...transaction.steps.map((step: any) => step.toJSON()));
    };
    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, readOnly]);

  useEffect(() => {
    if (editor && !readOnly) {
      // Optional: Notify presence that we are typing/active if we wanted to track "typing..." state
      // usePresence handles general "online" state automatically.
    }
  }, [editor, readOnly]);

  // Save Protection (Data Loss Prevention)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  const debouncedSave = useCallback((updates: { title?: string, content?: string }) => {
    setSaveStatus("saving");
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const currentUpdates = { ...pendingUpdates.current };
      pendingUpdates.current = {};

      const nextVersion = versionRef.current + 1;
      const res = await updateDoc(docId, {
        title: currentUpdates.title || titleRef.current,
        content: currentUpdates.content || editor?.getHTML(),
        tVersion: versionRef.current,
        lastClientId: clientId
      }) as { success: boolean; conflict?: boolean; updated?: Doc; latestDoc?: Doc; error?: string };
      if (!res) return;

      if (res.success) {
        setSaveStatus("saved");
        setTVersion(nextVersion);
        pendingStepsRef.current = [];
      } else if ((res as { conflict?: boolean; latestDoc?: Doc }).conflict && (res as { latestDoc?: Doc }).latestDoc) {
        setSaveStatus("saving");
        const latest = (res as { latestDoc: Doc }).latestDoc;
        const stepsToReapply = [...pendingStepsRef.current];
        pendingStepsRef.current = [];

        runRemoteApply(() => {
          if (editor) {
            editor.commands.setContent(ensurePaging(latest.content), { emitUpdate: true });
          }
        });
        setTVersion(latest.tVersion);

        if (stepsToReapply.length && editor) {
          const { state, view } = editor;
          let tr = state.tr;
          let appliedSteps = 0;
          const reappliedSteps: any[] = [];
          for (const stepJson of stepsToReapply) {
            try {
              const step = Step.fromJSON(state.schema, stepJson);
              const result = step.apply(tr.doc);
              if (result.doc) {
                tr = tr.step(step);
                appliedSteps += 1;
                reappliedSteps.push(stepJson);
              }
            } catch {
              // Skip invalid steps on conflict reapply
            }
          }
          if (appliedSteps > 0) {
            runRemoteApply(() => {
              view.dispatch(tr);
            });
          }
          pendingStepsRef.current = reappliedSteps;
        }

        if (editor) {
          debouncedSave({ content: editor.getHTML() });
        }
      } else {
        setSaveStatus("error");
      }
      saveTimerRef.current = null;
    }, 3000);
  }, [docId, clientId, editor, runRemoteApply, titleRef]);

  const isPagingRef = useRef(false);
  const lastSplitRef = useRef<{ pos: number, time: number } | null>(null);
  const paginationFrameRef = useRef<number | null>(null);

  const getCurrentPageInfo = useCallback(() => {
    if (!editor) return null;
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "page") {
        return { node, pos: $from.before(depth) };
      }
    }
    return null;
  }, [editor]);

  const isPageEmpty = useCallback((node: any) => {
    if (node.childCount !== 1) return false;
    const child = node.firstChild;
    return !!child && child.isTextblock && child.content.size === 0;
  }, []);

  // Advanced Pagination Logic
  const handlePagination = useCallback(async () => {
    if (!editor || readOnly || isPagingRef.current) return;

    // Check if we just tried splitting nearby to prevent rapid loops
    const now = Date.now();
    if (lastSplitRef.current && now - lastSplitRef.current.time < 500) return;

    const MAX_HEIGHT = 930; // Reliable threshold for A4 content area
    let docChanged = false;

    isPagingRef.current = true;
    try {
      const pageInfo = getCurrentPageInfo();
      if (!pageInfo) return;

      const { node, pos } = pageInfo;
      const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
      if (!dom) return;

      let totalContentHeight = 0;
      let splitPos = -1;
      const children = Array.from(dom.childNodes);
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        const childHeight = child.offsetHeight || 0;

        // Skip style calculations if already over split pos to save perf
        let fullHeight = childHeight;
        if (splitPos === -1) {
          const style = window.getComputedStyle(child);
          const margins = parseFloat(style.marginTop) + parseFloat(style.marginBottom);
          fullHeight += margins;
        }

        if (totalContentHeight + fullHeight > MAX_HEIGHT && splitPos === -1) {
          splitPos = pos + 1;
          for (let j = 0; j < i; j++) {
            splitPos += node.child(j).nodeSize;
          }
        }
        totalContentHeight += fullHeight;
      }

      // Only split if content actually overflows and we have a valid split point
      // Also check if we're not just splitting at the same spot repeatedly
      if (totalContentHeight > MAX_HEIGHT + 10 && splitPos !== -1 && splitPos < pos + node.nodeSize - 1) {
        // PROTECTION: If there's only one child and it overflows, splitting at the start of it
        // will just push that one child to the next page, causing an infinite loop.
        if (children.length <= 1) return;

        if (lastSplitRef.current?.pos === splitPos && now - lastSplitRef.current.time < 2000) {
          return;
        }

        const pageType = editor.state.schema.nodes.page;
        if (pageType) {
          const tr = editor.state.tr.split(splitPos, 1);
          editor.view.dispatch(tr);
        }

        lastSplitRef.current = { pos: splitPos, time: Date.now() };
        docChanged = true;
      }

      if (!docChanged) {
        const doc = editor.state.doc;
        while (doc.childCount > 1) {
          const lastIndex = doc.childCount - 1;
          const lastNode = doc.child(lastIndex);
          if (lastNode.type.name !== "page" || !isPageEmpty(lastNode)) break;
          let posCursor = 0;
          for (let i = 0; i < lastIndex; i++) {
            posCursor += doc.child(i).nodeSize;
          }
          editor.commands.deleteRange({ from: posCursor, to: posCursor + lastNode.nodeSize });
          docChanged = true;
          break;
        }
      }

      if (docChanged) {
        debouncedSave({ content: editor.getHTML() });
      }
    } finally {
      // Small delay before unlocking to allow DOM to settle
      setTimeout(() => { isPagingRef.current = false; }, 100);
    }
  }, [editor, readOnly, debouncedSave, getCurrentPageInfo, isPageEmpty]);

  const schedulePagination = useCallback(() => {
    if (paginationFrameRef.current !== null) return;
    paginationFrameRef.current = window.requestAnimationFrame(() => {
      paginationFrameRef.current = null;
      handlePagination();
    });
  }, [handlePagination]);

  const addPage = useCallback(() => {
    if (!editor) return;
    editor.chain()
      .focus()
      .insertContentAt(editor.state.doc.content.size, { type: 'page', content: [{ type: 'paragraph' }] })
      .run();
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    updatePageCount();
    editor.on("update", updatePageCount);
    return () => {
      editor.off("update", updatePageCount);
    };
  }, [editor, updatePageCount]);

  useEffect(() => {
    return () => {
      if (paginationFrameRef.current !== null) {
        cancelAnimationFrame(paginationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!editor) return;

    // Subscribe to all changes to this document
    pb.collection("docs").subscribe(docId, (e) => {
      if (e.action === "update") {
        const remote = e.record;
        if (remote.lastClientId === clientId) return;
        if (remote.tVersion <= versionRef.current) return;

        if (remote.title !== titleRef.current) setTitle(remote.title);

        const currentHTML = editor.getHTML();
        const shouldSync = readOnly || (remote.content !== currentHTML && saveStatusRef.current === "saved");

        if (shouldSync && remote.content !== currentHTML) {
          const { from, to } = editor.state.selection;
          const stepsToReapply = pendingStepsRef.current.length ? [...pendingStepsRef.current] : [];
          runRemoteApply(() => {
            editor.commands.setContent(ensurePaging(remote.content), { emitUpdate: false });
          });
          if (stepsToReapply.length) {
            const { state, view } = editor;
            let tr = state.tr;
            let appliedSteps = 0;
            for (const stepJson of stepsToReapply) {
              try {
                const step = Step.fromJSON(state.schema, stepJson);
                const result = step.apply(tr.doc);
                if (result.doc) {
                  tr = tr.step(step);
                  appliedSteps += 1;
                }
              } catch {
                // Skip invalid steps on remote sync
              }
            }
            if (appliedSteps > 0) {
              runRemoteApply(() => {
                view.dispatch(tr);
              });
            }
          }
          if (!readOnly) {
            try { editor.commands.setTextSelection({ from, to }); } catch { }
          }
          setTVersion(remote.tVersion);
        }
      }
    });

    return () => { pb.collection("docs").unsubscribe(docId); };
  }, [docId, editor, readOnly, clientId, runRemoteApply]);

  const handleToggleShare = async (forceType?: "view" | "edit", forceTeam?: boolean) => {
    const nextShared = !isShared || forceType !== undefined || forceTeam !== undefined;
    const nextType = forceType || shareType;
    const nextTeam = forceTeam !== undefined ? forceTeam : shareTeam;

    const res = await toggleSharing("docs", docId, nextShared, nextType, nextTeam);
    if (res.success) {
      setIsShared(nextShared);
      setShareType(nextType);
      setShareTeam(nextTeam);
    }
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
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
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
          const proxiedUrl = `${window.location.origin}/api/proxy/file/cloud/${data.record.id}/${file.name}`;
          editor.chain().focus().setImage({ src: proxiedUrl }).run();
          setSaveStatus("saved");
        }
      } catch {
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

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/doc/${docId}` : "";

  if (!editor) return null;

  // Track page nodes for shortcuts
  const pageNodesCount = pageCount;

  return (
    <div className="flex w-full h-[100dvh] bg-[#F1F5F9] overflow-hidden relative">
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
              {Array.from({ length: pageNodesCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const pageEl = document.querySelectorAll('.a4-page')[i];
                    if (pageEl) pageEl.scrollIntoView({ behavior: "smooth" });
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
                  readOnly={readOnly}
                  onChange={(e) => {
                    if (readOnly) return;
                    setTitle(e.target.value);
                    debouncedSave({ title: e.target.value });
                  }}
                  className={cn(
                    "font-bold text-slate-900 focus:outline-none bg-transparent h-6 text-sm w-full max-w-[300px]",
                    readOnly ? "cursor-default" : "cursor-text"
                  )}
                  placeholder="제목 없는 문서"
                />
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                  {!readOnly && (
                    <>
                      {saveStatus === "saving" && <span className="flex items-center gap-1"><Save className="w-2.5 h-2.5 animate-pulse" /> 저장 중</span>}
                      {saveStatus === "saved" && <span className="flex items-center gap-1 text-emerald-500 font-bold"><CheckCircle2 className="w-2.5 h-2.5" /> 저장됨</span>}
                      {saveStatus === "error" && <span className="flex items-center gap-1 text-red-500 font-bold"><CloudOff className="w-2.5 h-2.5" /> 저장 오류</span>}
                      <span>•</span>
                    </>
                  )}
                  <span className="text-slate-400">{pageNodesCount}쪽</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeEditors.length > 0 && (
                <div className="flex items-center gap-2">
                  {activeEditors.slice(0, 3).map((editor) => (
                    <div
                      key={editor.userId}
                      className="flex items-center gap-2 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600"
                      title={editor.name}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {editor.avatarUrl ? (
                          <img src={editor.avatarUrl} alt={editor.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{editor.name?.[0]?.toUpperCase() || "U"}</span>
                        )}
                      </div>
                      <span className="max-w-[80px] truncate">{editor.name}</span>
                    </div>
                  ))}
                  {activeEditors.length > 3 && (
                    <div className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 border border-slate-200">
                      +{activeEditors.length - 3}
                    </div>
                  )}
                </div>
              )}
              {!readOnly ? (
                <>
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
                </>
              ) : (
                <div className="px-5 py-2 rounded-2xl bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  읽기 전용
                </div>
              )}
            </div>
          </header>

          {/* Toolbar */}
          {!readOnly && (
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
              <button onClick={addPage} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all flex items-center gap-1.5 px-3">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-bold text-slate-600">페이지 추가</span>
              </button>

              <div className="w-px h-5 bg-slate-100 mx-2" />

              <button
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"
                title="표 삽입 (3x3)"
              >
                <TableIcon className="w-4 h-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all" title="내보내기">
                    <Download className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40 z-[1000] bg-white rounded-xl shadow-xl border-slate-200">
                  <DropdownMenuItem onClick={() => {
                    try {
                      console.log("Exporting Markdown...");
                      console.log("Editor Storage:", editor.storage);
                      console.log("Markdown Extension:", (editor.storage as any).markdown);
                      const md = (editor.storage as any).markdown?.getMarkdown();
                      console.log("Generated Markdown:", md);

                      if (!md) {
                        alert("Markdown content is empty. Check console for details.");
                        return;
                      }

                      const blob = new Blob([md], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${title || "document"}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error("Markdown export failed:", e);
                      alert("Export failed: " + e);
                    }
                  }} className="gap-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-slate-500" /> Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    // PDF Export via Print
                    const style = document.createElement('style');
                    style.innerHTML = `
                        @media print {
                          @page { margin: 20mm; size: A4; }
                          body { background: white; -webkit-print-color-adjust: exact; }
                          aside, header, .z-50, .fixed, .sticky { display: none !important; }
                          .prose { max-width: none !important; margin: 0 !important; width: 100% !important; }
                          .ProseMirror { padding: 0 !important; border: none !important; min-height: 0 !important; }
                          /* Hide paging markers if any */
                          .page-break, .page-number { display: none; } 
                        }
                      `;
                    document.head.appendChild(style);
                    window.print();
                    document.head.removeChild(style);
                  }} className="gap-2 cursor-pointer">
                    <FileDown className="w-4 h-4 text-slate-500" /> PDF (Print)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
          )}
        </div>

        {/* Scrollable Main Viewport */}
        <main id="editor-main" className="flex-1 overflow-y-auto bg-slate-200 relative p-4 md:p-12 pb-96 custom-scroll flex flex-col items-center gap-12">
          {/* Editor Core */}
          <div className="relative z-10 w-full flex flex-col items-center gap-12">
            <EditorContent editor={editor} className="paging-editor" />
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
                  onClick={() => handleToggleShare()}
                  className={cn("w-14 h-8 rounded-full relative transition-all duration-300", isShared ? "bg-indigo-600" : "bg-slate-200")}
                >
                  <div className={cn("absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm", isShared ? "left-7" : "left-1")} />
                </button>
              </div>

              {isShared && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-200/50">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800 text-xs uppercase tracking-widest">권한 설정</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleShare("view")}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all",
                            shareType === "view" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white text-slate-400 border border-slate-100"
                          )}
                        >
                          보기 전용
                        </button>
                        <button
                          onClick={() => handleToggleShare("edit")}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all",
                            shareType === "edit" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white text-slate-400 border border-slate-100"
                          )}
                        >
                          편집 가능
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-200/50">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800 text-xs uppercase tracking-widest">팀 대시보드</div>
                      <div className="text-[10px] text-slate-400 font-medium">구성원들의 Cowork 대시보드에 문서를 표시합니다.</div>
                    </div>
                    <button
                      onClick={() => handleToggleShare(undefined, !shareTeam)}
                      className={cn("w-14 h-8 rounded-full relative transition-all duration-300", shareTeam ? "bg-indigo-600" : "bg-slate-200")}
                    >
                      <div className={cn("absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm", shareTeam ? "left-7" : "left-1")} />
                    </button>
                  </div>

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
                        className="w-14 h-14 bg-indigo-600 text-white rounded-[20px] flex items-center justify-center active:scale-90 transition-all font-bold"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <style jsx global>{`
          .paging-editor { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 3rem; }
          .a4-page { 
            width: 816px; 
            height: 1122px; 
            max-width: 816px;
            background: white; 
            box-sizing: border-box;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border: 1px solid #e2e8f0;
            padding: 96px 80px;
            border-radius: 8px;
            position: relative;
            outline: none !important;
            transition: all 0.2s ease;
            margin: 0 auto;
            overflow: hidden;
          }
          .a4-page:focus-within { transform: scale(1.002); border-color: #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }

          .conflict-page { border: 2px dashed #ef4444 !important; background: #fffcfc !important; }

          .prose h1 { font-size: 3rem; font-weight: 900; margin-bottom: 2rem; color: #0f172a; line-height: 1.1; letter-spacing: -0.05em; }
          .prose h2 { font-size: 2rem; font-weight: 800; margin-top: 2.5rem; margin-bottom: 1rem; color: #1e293b; letter-spacing: -0.03em; }
          .prose h3 { font-size: 1.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #334155; }
          .prose p { line-height: 1.8; margin-bottom: 1.25rem; color: #475569; font-size: 1.05rem; }
          
          .custom-scroll::-webkit-scrollbar { width: 6px; }
          .custom-scroll::-webkit-scrollbar-track { background: transparent; }
          .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
          
          .ProseMirror { min-height: unset !important; padding: 0 !important; }

          @media print {
            header, aside, .z-40, button { display: none !important; }
            main { background: white !important; padding: 0 !important; overflow: visible !important; }
            #editor-main { padding: 0 !important; }
            .paging-editor { gap: 0 !important; }
            .a4-page { box-shadow: none !important; border: none !important; border-radius: 0 !important; page-break-after: always; }
          }
        `}</style>
      </div>
    </div>
  );
}
