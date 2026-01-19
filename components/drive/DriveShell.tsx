"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Terminal, Play, Pause, Square, AlertTriangle, ArrowRight, 
  Check, X, Loader2, ChevronUp, ChevronDown, Command, File as FileIcon, Eye, HelpCircle, BookOpen, Folder as FolderIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateFile, deleteFile, updateFileShare, updateFolder, deleteFolder } from "@/app/actions/cloud";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

type FileRecord = {
  id: string;
  name: string;
  folder: string; // parent ID
  file: string | string[];
  [key: string]: any;
};

type FolderRecord = {
  id: string;
  name: string;
  parent: string;
  [key: string]: any;
};

type ShellItem = (FileRecord | FolderRecord) & { kind: 'file' | 'folder' };

type OperationNode = 
  | { type: 'selection'; command: string; args: any; count: number; description: string; preview?: ShellItem[] }
  | { type: 'transform'; command: string; args: any; description: string; preview?: ShellItem[] }
  | { type: 'action'; command: string; args: any; description: string; requiresConfirmation?: boolean }
  | { type: 'help'; command: string; args: any; description: string };

type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped';

type LogItem = {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
};

interface DriveShellProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileRecord[];
  viewFolders: FolderRecord[]; // New prop for current view folders
  allFolders: FolderRecord[]; // Need all folders for path resolution
  currentFolder: FolderRecord | null;
  onRefresh: () => void;
  user: { id: string };
}

// --- Helpers ---

const resolveFolderId = (path: string, currentFolder: FolderRecord | null, allFolders: FolderRecord[]) => {
  if (!path || path === "/" || path === ".") return ""; // Root
  
  // Simple resolution:
  // 1. Check if it's a direct ID
  const direct = allFolders.find(f => f.id === path);
  if (direct) return direct.id;

  // 2. Check by Name
  const parentId = currentFolder ? currentFolder.id : "";
  const child = allFolders.find(f => f.name === path && f.parent === parentId);
  if (child) return child.id;
  
  // Global search fallback (risky but allowed for convenience)
  const globalMatch = allFolders.find(f => f.name === path);
  if (globalMatch) return globalMatch.id;

  throw new Error(`폴더를 찾을 수 없습니다: ${path}`);
};

const tokenizeCommand = (input: string) => {
  const segments = input.split('|').map(s => s.trim()).filter(Boolean);
  return segments;
};

const parseArgs = (segment: string) => {
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const args = [];
  let match;
  
  while ((match = regex.exec(segment)) !== null) {
    if (match[1] !== undefined) args.push(match[1]);
    else if (match[2] !== undefined) args.push(match[2]);
    else if (match[3] !== undefined) args.push(match[3]);
  }
  
  if (args.length === 0) return { cmd: "", args: [] };
  const [cmd, ...rest] = args;
  return { cmd, args: rest };
};

// --- Component ---

export default function DriveShell({ isOpen, onClose, files, viewFolders, allFolders, currentFolder, onRefresh, user }: DriveShellProps) {
  const [input, setInput] = useState("");
  const [pipeline, setPipeline] = useState<OperationNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Execution State Refs
  const shouldStopRef = useRef(false);
  const isPausedRef = useRef(false);

  // --- Parser ---

  useEffect(() => {
    if (!input.trim()) {
      setPipeline([]);
      setError(null);
      return;
    }

    try {
      const segments = tokenizeCommand(input);
      const nodes: OperationNode[] = [];

      // Unified Items: Tag with 'kind'
      let currentSet: ShellItem[] = [
        ...viewFolders.map(f => ({ ...f, kind: 'folder' as const })),
        ...files.map(f => ({ ...f, kind: 'file' as const }))
      ];

      segments.forEach((segment, index) => {
        const { cmd, args } = parseArgs(segment);
        const argsStr = args.join(" "); 
        
        let node: OperationNode | null = null;
        
        // --- Special Commands ---
        if (cmd === 'help' || cmd === '?') {
          node = {
            type: 'help',
            command: 'help',
            args: {},
            description: "명령어 가이드 보기"
          };
        }
        // --- Selection (First Block) ---
        else if (index === 0) {
          if (cmd === 'find') {
            const query = args[0] || ""; 
            const filtered = currentSet.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
            currentSet = filtered;
            
            node = {
              type: 'selection',
              command: 'find',
              args: { query },
              count: filtered.length,
              preview: filtered.slice(0, 5),
              description: `"${query}" 포함 항목 검색`
            };
          } else if (cmd === 'all' || cmd === '*') {
             node = {
              type: 'selection',
              command: 'all',
              args: {},
              count: currentSet.length,
              preview: currentSet.slice(0, 5),
              description: `전체 ${currentSet.length}개 항목 선택`
            };
          } else {
             throw new Error(`첫 명령어는 선택 명령(find, all)이어야 합니다.`);
          }
        } 
        // --- Transforms / Actions ---
        else {
          if (cmd === 'filter') {
            const raw = argsStr; 
            let desc = "필터 적용";
            
            if (raw.includes('type=img') || raw.includes('type=image')) {
               currentSet = currentSet.filter(item => item.kind === 'file' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.name));
               desc = "이미지 파일만 필터링";
            } else if (raw.includes('type=doc')) {
               currentSet = currentSet.filter(item => item.kind === 'file' && /\.(pdf|doc|docx|txt|md)$/i.test(item.name));
               desc = "문서 파일만 필터링";
            } else if (raw.includes('type=video')) {
               currentSet = currentSet.filter(item => item.kind === 'file' && /\.(mp4|mov|webm)$/i.test(item.name));
               desc = "동영상 파일만 필터링";
            } else if (raw.includes('type=folder') || raw.includes('type=dir')) {
               currentSet = currentSet.filter(item => item.kind === 'folder');
               desc = "폴더만 필터링";
            } else if (raw.includes('type=file')) {
               currentSet = currentSet.filter(item => item.kind === 'file');
               desc = "파일만 필터링";
            }
            
            node = {
              type: 'transform',
              command: 'filter',
              args: { raw },
              description: desc,
              preview: currentSet.slice(0, 5) 
            };
          } else if (cmd === 'move') {
            const dest = args[0] || "";
            node = {
              type: 'action',
              command: 'move',
              args: { dest },
              description: `"${dest}" 폴더로 이동`
            };
          } else if (cmd === 'rename') {
             const newName = args[0] || "";
             node = {
              type: 'action',
              command: 'rename',
              args: { newName },
              description: `"${newName}"으로 이름 변경`
            };
          } else if (cmd === 'share') {
             const type = args[0] || "view";
             node = {
              type: 'action',
              command: 'share',
              args: { type },
              description: `${type === 'edit' ? '편집' : '보기'} 권한으로 공유`
            };
          } else if (cmd === 'delete') {
             node = {
              type: 'action',
              command: 'delete',
              args: {},
              description: `항목 삭제`,
              requiresConfirmation: true
            };
          } else {
            throw new Error(`알 수 없는 명령어: ${cmd}`);
          }
        }
        
        if (node) nodes.push(node);
      });

      setPipeline(nodes);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setPipeline([]);
    }
  }, [input, files, viewFolders]); // Added viewFolders dependency

  // --- Execution Logic ---

  const addLog = (message: string, type: LogItem['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-99), { id: Math.random().toString(), timestamp: Date.now(), message, type }]);
  };

  const executePipeline = async () => {
    // Check for help command
    if (pipeline.length === 1 && pipeline[0].type === 'help') {
      setIsGuideOpen(true);
      setInput("");
      return;
    }

    if (status === 'running') return;
    
    // Safety Check
    const dangerous = pipeline.find(n => n.type === 'action' && n.requiresConfirmation);
    if (dangerous) {
      if (!confirm(`경고: 위험한 작업이 포함되어 있습니다 (${dangerous.command}).\n정말 진행하시겠습니까?`)) {
        return;
      }
    }

    shouldStopRef.current = false;
    isPausedRef.current = false;
    setStatus('running');
    setLogs([]);
    
    // 1. Initial Selection
    const selectionNode = pipeline[0];
    // Re-construct the initial set for execution (same as parser)
    let currentSet: ShellItem[] = [
      ...viewFolders.map(f => ({ ...f, kind: 'folder' as const })),
      ...files.map(f => ({ ...f, kind: 'file' as const }))
    ];

    if (selectionNode.command === 'find') {
      const q = selectionNode.args.query;
      currentSet = currentSet.filter(item => item.name.toLowerCase().includes(q.toLowerCase() || ""));
    }

    setProgress({ current: 0, total: currentSet.length, success: 0, failed: 0 });
    addLog(`작업 시작. 총 ${currentSet.length}개 항목 처리 예정...`, 'info');

    // 2. Iterate
    for (let i = 0; i < currentSet.length; i++) {
      if (shouldStopRef.current) {
        setStatus('stopped');
        addLog('사용자에 의해 작업이 중단되었습니다.', 'warning');
        break;
      }

      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (shouldStopRef.current) break;
      }

      const item = currentSet[i];
      let dropped = false;

      // Pipeline Steps
      for (let j = 1; j < pipeline.length; j++) {
        const node = pipeline[j];
        
        if (node.type === 'transform') {
           if (node.command === 'filter') {
             const raw = node.args.raw || "";
             let pass = true;
             
             if (item.kind === 'file') {
                if (raw.includes('type=img') || raw.includes('type=image')) {
                  pass = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.name);
                } else if (raw.includes('type=doc')) {
                  pass = /\.(pdf|doc|docx|txt|md)$/i.test(item.name);
                } else if (raw.includes('type=video')) {
                  pass = /\.(mp4|mov|webm)$/i.test(item.name);
                }
             }
             
             if (raw.includes('type=folder') && item.kind !== 'folder') pass = false;
             if (raw.includes('type=file') && item.kind !== 'file') pass = false;

             if (!pass) dropped = true;
           }
        } else if (node.type === 'action') {
           if (dropped) continue;
           
           addLog(`[${item.kind === 'folder' ? '📂' : '📄'} ${item.name}] 실행: ${node.command}`, 'info');
           try {
             if (node.command === 'move') {
               const destId = resolveFolderId(node.args.dest, currentFolder, allFolders);
               
               if (item.kind === 'file') {
                 const res = await updateFile(item.id, { folder: destId });
                 if (!res.success) throw new Error(res.error);
               } else {
                 if (item.id === destId) throw new Error("자기 자신으로 이동할 수 없습니다.");
                 const res = await updateFolder(item.id, { parent: destId });
                 if (!res.success) throw new Error(res.error);
               }
             } else if (node.command === 'delete') {
               if (item.kind === 'file') {
                 const res = await deleteFile(item.id);
                 if (!res.success) throw new Error(res.error);
               } else {
                 const res = await deleteFolder(item.id);
                 if (!res.success) throw new Error(res.error);
               }
             } else if (node.command === 'share') {
                if (item.kind === 'folder') throw new Error("폴더 공유는 아직 지원하지 않습니다.");
                const shareType = node.args.type === 'edit' ? 'edit' : 'view';
                const res = await updateFileShare(item.id, { is_shared: true, share_type: shareType });
                if (!res.success) throw new Error(res.error);
             } else if (node.command === 'rename') {
                const count = currentSet.length;
                let baseName = node.args.newName;
                
                let newName = baseName;

                if (item.kind === 'file') {
                   const originalExt = item.name.includes('.') ? item.name.split('.').pop() : '';
                   const hasNewExt = baseName.includes('.');
                   
                   if (count > 1) {
                      // Multi-file: treat baseName as prefix
                      // If baseName has extension, maybe use it? But usually multi-file implies pattern.
                      // Let's stick to prefixing + original extension for safety in multi-mode.
                      // If user explicitly provided extension in pattern? e.g. rename "pic.jpg" -> pic.jpg_1.jpg vs pic_1.jpg
                      // Safe bet: always append original extension for multi-file unless we want complex pattern replacement.
                      // Existing logic was: `${newName}_${i + 1}.${ext}`
                      
                      // Check if user provided extension in baseName, strip it to avoid double ext? 
                      // actually let's just use baseName as prefix as before, it is safer.
                      newName = `${baseName}_${i + 1}${originalExt ? `.${originalExt}` : ''}`;
                   } else {
                      // Single file
                      if (!hasNewExt && originalExt) {
                         newName = `${baseName}.${originalExt}`;
                      }
                   }
                   
                   const res = await updateFile(item.id, { name: newName });
                   if (!res.success) throw new Error(res.error);
                } else {
                   // Folder
                   if (count > 1) {
                      newName = `${baseName}_${i + 1}`;
                   }
                   const res = await updateFolder(item.id, { name: newName });
                   if (!res.success) throw new Error(res.error);
                }
             }
             
             setProgress(prev => ({ ...prev, success: prev.success + 1 }));
           } catch (e: any) {
             addLog(`오류 발생 (${item.name}): ${e.message}`, 'error');
             setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
           }
        }
      }

      setProgress(prev => ({ ...prev, current: i + 1 }));
      await new Promise(r => setTimeout(r, 100)); // 100ms
    }

    if (!shouldStopRef.current) {
        setStatus('completed');
        addLog('모든 작업이 완료되었습니다.', 'success');
    }
    onRefresh();
  };

  const handleStop = () => {
    shouldStopRef.current = true;
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 text-slate-200 border-t border-slate-700 shadow-2xl flex flex-col font-mono"
      style={{ height: isExpanded ? (isGuideOpen ? '500px' : '350px') : '48px' }}
    >
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-950/50">
         <div className="flex items-center gap-2 text-indigo-400 font-bold">
            <Terminal className="w-4 h-4" />
            <span>드라이브 쉘</span>
            <span className="text-xs px-2 py-0.5 bg-indigo-500/20 rounded text-indigo-300">실험적 기능</span>
         </div>
         <div className="flex items-center gap-2">
            <button 
               onClick={() => { setIsGuideOpen(!isGuideOpen); setIsExpanded(true); }}
               className={cn("p-1 hover:bg-slate-800 rounded flex items-center gap-1 px-2", isGuideOpen ? "text-indigo-400" : "text-slate-400")}
            >
               <BookOpen className="w-4 h-4" />
               <span className="text-xs">가이드</span>
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-slate-800 rounded">
               {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded">
               <X className="w-4 h-4" />
            </button>
         </div>
      </div>

      {isExpanded && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Guide Overlay */}
          <AnimatePresence>
            {isGuideOpen && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-md p-6 overflow-y-auto"
              >
                <div className="max-w-4xl mx-auto">
                   <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2"><BookOpen className="w-6 h-6 text-indigo-400"/> 명령어 가이드북</h2>
                      <button onClick={() => setIsGuideOpen(false)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300">닫기</button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                      <div>
                        <h3 className="text-indigo-400 font-bold mb-3 text-base">1. 파이프라인 구조</h3>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4 font-mono text-xs">
                          <span className="text-blue-400">[선택]</span> <span className="text-slate-500">→</span> <span className="text-purple-400">[변환]</span> <span className="text-slate-500">→</span> <span className="text-emerald-400">[실행]</span>
                          <br/><br/>
                          예시: <span className="text-blue-300">find "영수증"</span> | <span className="text-purple-300">filter --type=img</span> | <span className="text-emerald-300">move /Receipts</span>
                        </div>

                        <h3 className="text-blue-400 font-bold mb-2">선택 (Selection)</h3>
                        <ul className="space-y-2 mb-6">
                           <li>
                              <code className="bg-slate-800 px-1 py-0.5 rounded text-blue-200">find "검색어"</code>
                              <p className="text-slate-400 text-xs mt-1">이름에 "검색어"가 포함된 항목(파일+폴더)을 선택합니다.</p>
                           </li>
                           <li>
                              <code className="bg-slate-800 px-1 py-0.5 rounded text-blue-200">all</code> 또는 <code className="bg-slate-800 px-1 py-0.5 rounded text-blue-200">*</code>
                              <p className="text-slate-400 text-xs mt-1">현재 목록의 모든 항목을 선택합니다.</p>
                           </li>
                        </ul>

                        <h3 className="text-purple-400 font-bold mb-2">변환 (Transform)</h3>
                        <ul className="space-y-2">
                           <li>
                              <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-200">filter --type=[img|doc|video|folder]</code>
                              <p className="text-slate-400 text-xs mt-1">특정 타입(이미지, 문서, 동영상, 폴더)만 남깁니다.</p>
                           </li>
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="text-emerald-400 font-bold mb-2">실행 (Action)</h3>
                        <ul className="space-y-4">
                           <li>
                              <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-200">move /폴더명</code>
                              <p className="text-slate-400 text-xs mt-1">선택 항목을 지정된 폴더로 이동합니다.</p>
                           </li>
                           <li>
                              <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-200">rename "새이름"</code>
                              <p className="text-slate-400 text-xs mt-1">이름을 변경합니다. 중복 시 번호가 붙습니다.</p>
                           </li>
                           <li>
                              <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-200">share [view|edit]</code>
                              <p className="text-slate-400 text-xs mt-1">공유 권한을 설정합니다. (파일만 가능)</p>
                           </li>
                           <li>
                              <code className="bg-slate-800 px-1 py-0.5 rounded text-red-300 border border-red-900/50">delete</code>
                              <p className="text-slate-400 text-xs mt-1">항목을 삭제합니다. (실행 전 확인)</p>
                           </li>
                        </ul>

                        <div className="mt-8 p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                           <h4 className="font-bold text-indigo-300 mb-2">💡 팁</h4>
                           <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                              <li>파이프(|) 기호를 사용하여 여러 명령을 연결하세요.</li>
                              <li>폴더 필터링은 <code className="text-white">filter --type=folder</code>를 사용하세요.</li>
                              <li>실행 버튼을 누르기 전, 상단의 미리보기를 통해 대상을 확인하세요.</li>
                           </ul>
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>


          {/* Left: Editor & Pipeline */}
          <div className="flex-1 flex flex-col p-4 border-r border-slate-800 gap-4 overflow-y-auto w-full md:w-2/3">
             {/* Pipeline Viz */}
             <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-950/30 rounded-lg min-h-[100px]">
                {pipeline.length === 0 && <span className="text-slate-600 italic text-sm">명령어를 입력하세요... 예: find "프로젝트" | filter --type=folder | move /OldProjects</span>}
                {pipeline.map((node, i) => (
                  <div key={i} className="flex items-center gap-2 shrink-0 group relative">
                    <div className={cn(
                      "px-3 py-2 rounded border text-sm flex flex-col min-w-[140px] relative transition-all hover:bg-slate-800",
                      node.type === 'selection' ? "bg-blue-900/20 border-blue-800 text-blue-200" :
                      node.type === 'transform' ? "bg-purple-900/20 border-purple-800 text-purple-200" :
                      node.type === 'help' ? "bg-slate-800 border-slate-600 text-slate-300" :
                      "bg-emerald-900/20 border-emerald-800 text-emerald-200",
                      node.requiresConfirmation && "border-red-500/50 bg-red-900/10"
                    )}>
                       <span className="font-bold uppercase text-[10px] opacity-50 mb-1">{node.type}</span>
                       <span className="font-medium whitespace-nowrap">{node.command}</span>
                       
                       {(node.type === 'selection' || (node.type === 'transform' && node.preview)) && (
                         <div className="mt-2 text-xs opacity-70 flex flex-col gap-1">
                           <div className="flex items-center gap-1 font-bold"><Check className="w-3 h-3"/> {node.type === 'selection' ? node.count : node.preview?.length || 0}개 대상</div>
                           {/* Preview List */}
                           {node.preview && node.preview.length > 0 && (
                             <div className="text-[10px] text-slate-400 flex flex-col gap-0.5 mt-1 border-t border-white/10 pt-1">
                               {node.preview.map(f => (
                                 <div key={f.id} className="truncate max-w-[120px] flex items-center gap-1">
                                    {f.kind === 'folder' ? <FolderIcon className="w-2 h-2 text-amber-400" fill="currentColor"/> : <FileIcon className="w-2 h-2" />} {f.name}
                                 </div>
                               ))}
                               {(node.type === 'selection' ? node.count : node.preview.length) > 5 && <span>...외 {(node.type === 'selection' ? node.count : node.preview.length) - 5}개</span>}
                             </div>
                           )}
                         </div>
                       )}
                       
                       {node.description && <div className="text-[10px] opacity-60 truncate max-w-[150px] mt-1">{node.description}</div>}
                    </div>
                    {i < pipeline.length - 1 && <ArrowRight className="w-4 h-4 text-slate-600" />}
                  </div>
                ))}
             </div>

             {/* Input Area */}
             <div className="relative group">
                <div className="absolute left-3 top-3 text-emerald-500">➜</div>
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="파이프라인 명령어를 입력하세요... (도움말: help)"
                  className="w-full bg-slate-800 text-slate-200 p-3 pl-8 rounded-lg outline-none focus:ring-2 ring-indigo-500/50 resize-none font-mono text-sm shadow-inner min-h-[60px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      executePipeline();
                    }
                  }}
                />
                {error && (
                  <div className="absolute top-full left-0 mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {error}
                  </div>
                )}
             </div>
             
             {/* Controls */}
             <div className="flex items-center gap-4 mt-2">
                <button 
                  onClick={executePipeline}
                  disabled={!!error || pipeline.length === 0 || status === 'running'}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded flex items-center gap-2 text-sm font-bold transition-colors"
                >
                  {status === 'running' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current"/>}
                  실행 (Execute)
                </button>

                {status === 'running' && (
                  <button 
                    onClick={handleStop}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 rounded flex items-center gap-2 text-sm font-bold transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    중단 (Stop)
                  </button>
                )}
                
                {status !== 'idle' && (
                  <div className="flex items-center gap-4 text-xs ml-auto">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-400">진행률</span>
                      <span className="font-bold text-white">{Math.round((progress.current / (progress.total || 1)) * 100)}%</span>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-slate-400">성공</span>
                       <span className="font-bold text-emerald-400">{progress.success}</span>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-slate-400">실패</span>
                       <span className="font-bold text-red-400">{progress.failed}</span>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* Right: Logs */}
          <div className="flex-1 w-full md:w-1/3 bg-slate-950 p-4 overflow-y-auto font-mono text-xs space-y-1 border-l border-slate-800">
             <div className="sticky top-0 bg-slate-950 pb-2 mb-2 border-b border-slate-800 font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                <span>실행 로그</span>
                {status === 'running' && <span className="animate-pulse text-indigo-400">● 실행 중</span>}
             </div>
             {logs.length === 0 && <div className="text-slate-700 italic">명령 대기 중...</div>}
             {logs.map((log) => (
               <div key={log.id} className={cn(
                 "break-words",
                 log.type === 'error' ? "text-red-400" :
                 log.type === 'success' ? "text-emerald-400" :
                 log.type === 'warning' ? "text-amber-400" :
                 "text-slate-400"
               )}>
                 <span className="opacity-50 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                 {log.message}
               </div>
             ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
