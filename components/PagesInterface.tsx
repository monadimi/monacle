"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Github,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
  ExternalLink,
  GitBranch
} from "lucide-react";
import { cn } from "@/lib/utils";
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

// Mock Data
const projects = [
  {
    id: "proj_1",
    name: "monacle-web",
    framework: "Next.js",
    status: "ready", // ready, building, error, queued
    url: "monacle-web.pages.dev",
    lastCommit: "feat: update dashboard ui",
    lastCommitTime: "2m ago",
    branch: "main"
  },
  {
    id: "proj_2",
    name: "landing-page-v2",
    framework: "React",
    status: "building",
    url: "landing-v2.pages.dev",
    lastCommit: "fix: mobile responsiveness",
    lastCommitTime: "15m ago",
    branch: "develop"
  },
  {
    id: "proj_3",
    name: "docs-site",
    framework: "Jekyll",
    status: "error",
    url: "docs.monad.io.kr",
    lastCommit: "docs: add api reference",
    lastCommitTime: "1h ago",
    branch: "main"
  }
];

export default function PagesInterface() {
  const [searchQuery, setSearchQuery] = useState("");

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return "text-emerald-500 bg-emerald-50 border-emerald-100";
      case 'building': return "text-amber-500 bg-amber-50 border-amber-100";
      case 'error': return "text-red-500 bg-red-50 border-red-100";
      default: return "text-slate-500 bg-slate-50 border-slate-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle2 className="w-4 h-4" />;
      case 'building': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'error': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50/50">
      {/* Sidebar (Visual Only) */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-rose-600 flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-pink-600" />
            </div>
            Monacle Pages
          </h2>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-pink-50 text-pink-700 transition-colors">
            <Globe className="w-4 h-4" />
            Overview
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-8 border-b border-slate-200/50 bg-white/50 backdrop-blur-xl flex items-center justify-between shrink-0">
          <h1 className="text-lg font-bold text-slate-800">Projects</h1>
          <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-slate-900/10">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {/* Search */}
            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-sm"
              />
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <div key={project.id} className="group bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-xl hover:border-pink-200 transition-all cursor-pointer relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                        {project.name[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 group-hover:text-pink-600 transition-colors">{project.name}</h3>
                        <p className="text-xs text-slate-500">{project.url}</p>
                      </div>
                    </div>
                    <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5", getStatusColor(project.status))}>
                      {getStatusIcon(project.status)}
                      {project.status}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span className="font-mono">{project.branch}</span>
                      <span className="text-slate-300">|</span>
                      <span className="truncate flex-1" title={project.lastCommit}>{project.lastCommit}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <Github className="w-3.5 h-3.5" />
                        {project.framework}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {project.lastCommitTime}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons Overlay */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* New Project Card */}
              <button className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-pink-400 hover:bg-pink-50/30 hover:text-pink-600 transition-all group">
                <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm">Create New Project</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
