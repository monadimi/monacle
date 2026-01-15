"use client";

import { cn } from "@/lib/utils";
import { HardDrive, Layout, Users, Settings, LogOut } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useRouter, usePathname } from "next/navigation";

export default function GlobalRail({ user }: { user?: { id: string; name: string; email: string; avatar?: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeService = pathname.includes('/pages') ? 'pages' : pathname.includes('/cowork') ? 'cowork' : 'drive';

  const services = [
    { id: 'drive', icon: HardDrive, label: 'Drive', path: '/dashboard/drive' },
    { id: 'pages', icon: Layout, label: 'Pages', path: '/dashboard/pages' },
    { id: 'cowork', icon: Users, label: 'Cowork', path: '/dashboard/cowork' },
  ] as const;

  const avatarUrl = user?.avatar
    ? (user.avatar.startsWith('http')
      ? user.avatar
      : `https://monadb.snowman0919.site/api/files/users/${user.id}/${user.avatar}`)
    : null;

  return (
    <div className="w-16 md:w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 z-50 shrink-0 h-screen sticky top-0">
      {/* Logo/Brand (Simple dot for now or small logo) */}
      <div className="w-10 h-10 mb-6 flex items-center justify-center">
        <img src="/monacle.svg" alt="Monacle Logo" className="w-full h-full object-contain" />
      </div>

      <div className="flex flex-col gap-4 w-full px-2">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => router.push(service.path)}
            className={cn(
              "group relative w-full aspect-square flex flex-col items-center justify-center rounded-2xl transition-all duration-300",
              activeService === service.id
                ? "bg-white/10 text-white shadow-inner"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )}
          >
            <service.icon className={cn(
              "w-6 h-6 mb-1 transition-transform duration-300",
              activeService === service.id ? "scale-100" : "group-hover:scale-110"
            )} />
            <span className="text-[10px] font-medium opacity-80">{service.label}</span>

            {activeService === service.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
            )}
          </button>
        ))
        }
      </div >

      {/* Profile Section */}
      < div className="mt-auto w-full px-2 flex justify-center" >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative w-10 h-10 rounded-full bg-slate-800 overflow-hidden border-2 border-slate-700 hover:border-indigo-500 transition-colors shadow-lg group">
              {/* Image or Initials */}
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-indigo-500 to-purple-600 group-hover:from-indigo-400 group-hover:to-purple-500">
                  {user?.name?.[0] || 'U'}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          {/* 
             Custom Positioning for Rail Menu:
             - left-[120%]: Move to the right of the button (rail width is small)
             - bottom-0: Align bottom of menu with bottom of button
             - ml-4: Add some spacing
             - origin-bottom-left: Animation origin
          */}
          <DropdownMenuContent
            className="w-60 left-[120%] bottom-0 ml-4 mb-2 origin-bottom-left"
            align="start"
            sideOffset={0}
          >
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none text-slate-800">{user?.name || 'Guest'}</p>
                <p className="text-xs leading-none text-slate-500">{user?.email || 'guest@monad.io.kr'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = 'https://id.monad.io.kr/dashboard'} className="p-2.5 cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              계정 관리
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/')} className="p-2.5 text-red-600 focus:text-red-700 from-red-50 focus:bg-red-50 cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div >
    </div >
  );
}
