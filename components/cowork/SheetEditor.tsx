/**
 * @file components/cowork/SheetEditor.tsx
 * @purpose Spreadsheet-like data editor with formula and chart support.
 * @scope Data Grid, Formulas (SUM/AVG), Charts (Bar/Line/Pie), Column/Row management.
 * @out-of-scope Complex cell formatting, pivot tables, real-time presence (currently not implemented).
 * @failure-behavior Alerts on formula errors or missing data for charts.
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { toggleSharing } from "@/app/actions/cowork";
import {
    Plus, Trash2, BarChart2,
    Wand2, Share2, Layout
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { updateSheet, SheetData } from "@/app/actions/sheets";

// Types
type SheetColumn = { id: string; label: string; type: 'text' | 'number' | 'category'; width?: number };
type SheetChart = { id: string; type: 'bar' | 'line' | 'pie' | 'area'; xKey: string; yKeys: string[]; title: string; color?: string };

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

// --- Formula Engine ---
const evaluateFormula = (formula: string, row: Record<string, unknown>, allRows: Record<string, unknown>[], columns: SheetColumn[]) => {
    try {
        let expression = formula.substring(1).trim(); // Remove '='

        // 0. Range Aggregates: SUM([Col], StartRow, EndRow)
        const rangeRegex = /(SUM|AVG|MIN|MAX)\(\[([^\]]+)\],\s*(\d+),\s*(\d+)\)/gi;
        expression = expression.replace(rangeRegex, (match, func, colLabel, start, end) => {
            const col = columns.find(c => c.label === colLabel);
            if (!col) return "0";

            const startIdx = parseInt(start) - 1;
            const endIdx = parseInt(end);

            const targetRows = allRows.slice(Math.max(0, startIdx), Math.min(allRows.length, endIdx));
            const values = targetRows.map(r => Number(r[col.id]) || 0);

            if (values.length === 0) return "0";

            switch (func.toUpperCase()) {
                case 'SUM': return values.reduce((a, b) => a + b, 0).toString();
                case 'AVG': return (values.reduce((a, b) => a + b, 0) / values.length).toString();
                case 'MAX': return Math.max(...values).toString();
                case 'MIN': return Math.min(...values).toString();
                default: return "0";
            }
        });

        // 1. Full Column Aggregates
        const aggRegex = /(SUM|AVG|MIN|MAX)\(\[([^\]]+)\]\)/gi;
        expression = expression.replace(aggRegex, (match, func, colLabel) => {
            const col = columns.find(c => c.label === colLabel);
            if (!col) return "0";
            const values = allRows.map(r => Number(r[col.id]) || 0);

            switch (func.toUpperCase()) {
                case 'SUM': return values.reduce((a, b) => a + b, 0).toString();
                case 'AVG': return (values.reduce((a, b) => a + b, 0) / values.length).toString();
                case 'MAX': return Math.max(...values).toString();
                case 'MIN': return Math.min(...values).toString();
                default: return "0";
            }
        });

        // 2. Row References
        const refRegex = /\[([^\]]+)\]/g;
        expression = expression.replace(refRegex, (match, colLabel) => {
            const col = columns.find(c => c.label === colLabel);
            if (!col) return "0";
            const val = row[col.id];
            return isNaN(Number(val)) ? JSON.stringify(val) : String(val);
        });

        return new Function('return ' + expression)();
    } catch (e) {
        console.error("Formula Error:", e);
        return "#ERROR";
    }
};

export default function SheetEditor({ initialData, readOnly = false }: { initialData: any, currentUser: any, readOnly?: boolean }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'data' | 'charts'>('data');
    const [title, setTitle] = useState(initialData.title);

    // Sharing State
    const [isShared, setIsShared] = useState(initialData.is_shared);


    // State
    const [columns, setColumns] = useState<SheetColumn[]>(initialData.data.columns || []);
    const [rows, setRows] = useState<Record<string, unknown>[]>(initialData.data.rows || []);
    const [charts, setCharts] = useState<SheetChart[]>(initialData.data.charts || []);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

    // Resizing State
    const [resizingCol, setResizingCol] = useState<string | null>(null);
    const resizingRef = useRef<{ startX: number, startWidth: number } | null>(null);

    // Share Handler
    const handleToggleShare = async () => {
        const nextShared = !isShared;
        const res = await toggleSharing("sheets", initialData.id, nextShared);
        if (res.success) setIsShared(nextShared);
    };

    const copyShareLink = () => {
        const url = `${window.location.origin}/share/sheet/${initialData.id}`;
        navigator.clipboard.writeText(url);
        alert("Link copied!");
    };

    // Debounced Save
    const debouncedSave = useCallback((newColumns: SheetColumn[], newRows: Record<string, unknown>[], newCharts: SheetChart[], newTitle: string) => {
        if (readOnly) return;
        setSaveStatus('saving');
        const data: SheetData = { columns: newColumns, rows: newRows, charts: newCharts };
        updateSheet(initialData.id, { title: newTitle, data }).then(res => {
            if (res.success) setSaveStatus('saved');
            else setSaveStatus('error');
        });
    }, [initialData.id, readOnly]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (readOnly) return;
        setTitle(e.target.value);
        debouncedSave(columns, rows, charts, e.target.value);
    };

    // --- Resizing Logic ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingCol || !resizingRef.current) return;
            const diff = e.clientX - resizingRef.current.startX;
            const newWidth = Math.max(50, resizingRef.current.startWidth + diff);
            setColumns(cols => cols.map(c => c.id === resizingCol ? { ...c, width: newWidth } : c));
        };

        const handleMouseUp = () => {
            if (resizingCol) {
                setResizingCol(null);
                resizingRef.current = null;
                debouncedSave(columns, rows, charts, title); // Save final width
            }
        };

        if (resizingCol) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingCol, columns, rows, charts, title, debouncedSave]);

    const startResize = (e: React.MouseEvent, colId: string, currentWidth: number) => {
        e.preventDefault();
        setResizingCol(colId);
        resizingRef.current = { startX: e.clientX, startWidth: currentWidth || 150 };
    };

    // --- Data Logic ---
    const addRow = () => {
        if (readOnly) return;
        const newRow = { id: crypto.randomUUID(), ...Object.fromEntries(columns.map(c => [c.id, c.type === 'number' ? 0 : ''])) };
        const newRows = [...rows, newRow];
        setRows(newRows);
        debouncedSave(columns, newRows, charts, title);
    };

    const updateCell = (rowId: string, colId: string, value: unknown) => {
        if (readOnly) return;
        const newRows = rows.map(r => r.id === rowId ? { ...r, [colId]: value } : r);
        setRows(newRows);
        debouncedSave(columns, newRows, charts, title);
    };

    const addColumn = () => {
        if (readOnly) return;
        const newCol: SheetColumn = { id: `col_${crypto.randomUUID().slice(0, 4)}`, label: '새 열', type: 'text', width: 150 };
        const newColumns = [...columns, newCol];
        setColumns(newColumns);
        const newRows = rows.map(r => ({ ...r, [newCol.id]: '' }));
        setRows(newRows);
        debouncedSave(newColumns, newRows, charts, title);
    };

    // --- Chart Logic ---
    const addChart = (type: SheetChart['type']) => {
        if (readOnly) return;
        const xKey = columns.find(c => c.type === 'category' || c.type === 'text')?.id || columns[0].id;
        const yKey = columns.find(c => c.type === 'number')?.id;
        if (!yKey) { alert("먼저 숫자 데이터 열을 추가해주세요!"); return; }
        const newChart: SheetChart = { id: crypto.randomUUID(), type, xKey, yKeys: [yKey], title: '새 차트' };
        const newCharts = [...charts, newChart];
        setCharts(newCharts);
        debouncedSave(columns, rows, newCharts, title);
    };

    const autoChart = () => {
        if (readOnly) return;
        const numCols = columns.filter(c => c.type === 'number');
        const textCols = columns.filter(c => c.type === 'text' || c.type === 'category');

        if (numCols.length === 0) { alert("차트를 생성할 수 없습니다: 숫자 형식이 포함된 열이 없습니다."); return; }

        const xKey = textCols.length > 0 ? textCols[0].id : columns[0].id;
        // Heuristic: If 1 number col -> Bar. If multiple -> Line or Area.
        const type = numCols.length > 1 ? 'line' : 'bar';

        const newChart: SheetChart = {
            id: crypto.randomUUID(),
            type,
            xKey,
            yKeys: numCols.map(c => c.id),
            title: `자동 분석: ${numCols.map(c => c.label).join(' vs ')}`
        };

        const newCharts = [...charts, newChart];
        setCharts(newCharts);
        setActiveTab('charts');
        debouncedSave(columns, rows, newCharts, title);
    };

    // Rendering Helper
    const getDisplayValue = (row: any, col: SheetColumn) => {
        const val = row[col.id];
        if (typeof val === 'string' && val.startsWith('=')) {
            return evaluateFormula(val, row, rows, columns);
        }
        return val;
    };

    return (
        <div className="flex flex-col w-full h-full bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b px-6 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Layout className="w-5 h-5" />
                    </div>
                    <div>
                        <input
                            value={title}
                            readOnly={readOnly}
                            onChange={handleTitleChange}
                            className={cn(
                                "font-bold text-lg outline-none bg-transparent placeholder:text-slate-400",
                                readOnly ? "cursor-default" : ""
                            )}
                            placeholder="제목 없는 시트"
                        />
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            {!readOnly && <span>{saveStatus === 'saving' ? '저장 중...' : '저장됨'}</span>}
                            {readOnly && <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">읽기 전용</span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Share Button (Only for Owners/Editors) */}
                    {!readOnly && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleToggleShare}
                                className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all", isShared ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}
                            >
                                <Share2 className="w-4 h-4" />
                                {isShared ? "공유 중" : "공유"}
                            </button>
                            {isShared && (
                                <button onClick={copyShareLink} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg text-slate-600 font-medium">
                                    링크 복사
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setActiveTab('data')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'data' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>데이터</button>
                        <button onClick={() => setActiveTab('charts')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'charts' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>차트</button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative bg-white">

                {/* Data View */}
                <div className={cn("absolute inset-0 transition-opacity duration-300 overflow-auto", activeTab === 'data' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                    <div className="w-full h-full bg-slate-50 flex flex-col">
                        {/* Toolbar */}
                        <div className="h-10 bg-white border-b flex items-center px-4 gap-2 text-sm text-slate-600">
                            <Button variant="ghost" size="sm" onClick={addRow} className="gap-2 h-7"><Plus className="w-3 h-3" /> 행 추가</Button>
                            <div className="w-px h-4 bg-slate-200 mx-2" />
                            <Button variant="ghost" size="sm" onClick={autoChart} className="gap-2 h-7 text-indigo-600 font-medium hover:text-indigo-700 hover:bg-indigo-50"><Wand2 className="w-3 h-3" /> 자동 분석</Button>
                            <div className="flex-1" />
                            <div className="text-xs text-slate-400">
                                팁: <code>=SUM([Value])</code> 또는 <code>=[가격]*[수량]</code>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-white">
                            <table className="w-full text-sm text-left border-collapse table-fixed">
                                <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        <th className="w-12 p-0 text-center border-r border-b bg-slate-50 select-none">#</th>
                                        {columns.map(col => (
                                            <th key={col.id} className="p-0 border-r border-b group relative bg-slate-50 align-top" style={{ width: col.width || 150 }}>
                                                <div className="px-3 py-2 flex items-center justify-between">
                                                    <input
                                                        value={col.label}
                                                        onChange={(e) => {
                                                            const newCols = columns.map(c => c.id === col.id ? { ...c, label: e.target.value } : c);
                                                            setColumns(newCols);
                                                            debouncedSave(newCols, rows, charts, title);
                                                        }}
                                                        className="bg-transparent outline-none w-full font-semibold focus:text-indigo-600 text-xs uppercase tracking-wide"
                                                    />
                                                </div>
                                                {/* Resizer */}
                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 group-hover:bg-slate-300 transition-colors z-10"
                                                    onMouseDown={(e) => startResize(e, col.id, col.width || 150)}
                                                />
                                            </th>
                                        ))}
                                        <th className="w-12 text-center border-b bg-slate-50 p-2">
                                            <button onClick={addColumn} className="p-1 hover:bg-slate-200 rounded text-slate-400"><Plus className="w-4 h-4" /></button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row, idx) => (
                                        <tr key={row.id as string} className="group hover:bg-slate-50/50">
                                            <td className="p-0 h-10 text-center text-slate-400 font-mono border-r bg-slate-50/30 text-xs">{idx + 1}</td>
                                            {columns.map(col => {
                                                const cellValue = row[col.id];
                                                const isFormula = (typeof cellValue === 'string' && cellValue.startsWith('='));
                                                const displayValue = getDisplayValue(row, col);
                                                return (
                                                    <td key={`${row.id}-${col.id}`} className={cn("p-0 border-r border-b relative", isFormula ? "bg-indigo-50/20" : "")}>
                                                        <input
                                                            className={cn(
                                                                "w-full h-full px-3 bg-transparent outline-none focus:bg-indigo-50/10 focus:ring-1 focus:ring-inset focus:ring-indigo-500/50 transition-all font-medium text-slate-700 text-xs truncate",
                                                                isFormula ? "text-indigo-600 font-mono" : ""
                                                            )}
                                                            value={String(row[col.id] || '')}
                                                            type="text" // Always text to allow formulas
                                                            onChange={(e) => updateCell(row.id as string, col.id, e.target.value)} // Don't force number parsing immediately
                                                            onBlur={(e) => {
                                                                // Try parse number if column is number AND not formula
                                                                if (col.type === 'number' && !e.target.value.startsWith('=')) {
                                                                    const val = Number(e.target.value);
                                                                    if (!isNaN(val)) updateCell(row.id as string, col.id, val);
                                                                }
                                                            }}
                                                        />
                                                        {isFormula && (
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-indigo-400 bg-white/80 px-1 rounded border shadow-sm">
                                                                {displayValue}
                                                            </div>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                            <td className="p-0 border-b text-center">
                                                <button onClick={() => {
                                                    const newRows = rows.filter(r => r.id !== row.id);
                                                    setRows(newRows);
                                                    debouncedSave(columns, newRows, charts, title);
                                                }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-2">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="p-20 text-center text-slate-300 text-sm">
                                (데이터 끝)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts View */}
                <div className={cn("absolute inset-0 transition-opacity duration-300 bg-slate-50 p-8 overflow-auto", activeTab === 'charts' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                    <div className="w-full h-full space-y-8">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-slate-900">데이터 시각화</h2>
                            <div className="flex gap-2">
                                <Button variant="default" size="sm" onClick={autoChart} className="gap-2 bg-indigo-600 hover:bg-indigo-700"><Wand2 className="w-4 h-4" /> 매직 차트</Button>
                                <Button variant="outline" size="sm" onClick={() => addChart('bar')} className="gap-2"><BarChart2 className="w-4 h-4" /> 막대</Button>
                                <Button variant="outline" size="sm" onClick={() => addChart('line')} className="gap-2">선형</Button>
                                <Button variant="outline" size="sm" onClick={() => addChart('pie')} className="gap-2">파이</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                            {charts.map((chart, idx) => (
                                <div key={chart.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                                    <div className="flex items-center justify-between mb-6">
                                        <input value={chart.title} onChange={(e) => {
                                            const newCharts = charts.map(c => c.id === chart.id ? { ...c, title: e.target.value } : c);
                                            setCharts(newCharts);
                                            debouncedSave(columns, rows, newCharts, title);
                                        }} className="font-bold text-lg outline-none bg-transparent" />
                                        <button onClick={() => {
                                            const newCharts = charts.filter(c => c.id !== chart.id);
                                            setCharts(newCharts);
                                            debouncedSave(columns, rows, newCharts, title);
                                        }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {chart.type === 'pie' ? (
                                                <PieChart>
                                                    <Pie
                                                        data={rows.map(r => ({
                                                            ...r, ...Object.fromEntries(columns.map(c => {
                                                                const val = r[c.id];
                                                                if (typeof val === 'string' && val.startsWith('=')) return [c.id, evaluateFormula(val, r, rows, columns)];
                                                                return [c.id, val];
                                                            }))
                                                        }))}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey={chart.yKeys[0]}
                                                        nameKey={chart.xKey}
                                                    >
                                                        {rows.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                                </PieChart>
                                            ) : (
                                                <BarChart data={rows.map(r => ({
                                                    ...r, ...Object.fromEntries(columns.map(c => {
                                                        const val = r[c.id];
                                                        if (typeof val === 'string' && val.startsWith('=')) return [c.id, evaluateFormula(val, r, rows, columns)];
                                                        return [c.id, val];
                                                    }))
                                                }))}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey={chart.xKey} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                                                    {chart.type === 'line' ? chart.yKeys.map((key, i) => <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />) :
                                                        chart.type === 'area' ? chart.yKeys.map((key, i) => <Area key={key} type="monotone" dataKey={key} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} />) :
                                                            chart.yKeys.map((key, i) => <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                                                </BarChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
