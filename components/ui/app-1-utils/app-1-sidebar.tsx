"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPin,
  Radio,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/app-1-utils/sidebar"
import { app1User } from "@/components/ui/app-1-utils/app-1-data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface App1SidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab?: string
  onSelectTab?: (tab: string) => void
}

export function App1Sidebar({ activeTab = 'console', onSelectTab, ...props }: App1SidebarProps) {
  const navMain = [
    {
      id: "console",
      title: "Dashboard",
      url: "/admin",
      icon: LayoutDashboard,
    },
    {
      id: "telematics",
      title: "Active Telematics",
      url: "/field",
      icon: Radio,
    },
    {
      id: "centers",
      title: "Exam Centers",
      url: "#centers",
      icon: MapPin,
    },
    {
      id: "roster",
      title: "Monitor Roster",
      url: "#roster",
      icon: Users,
    },
    {
      id: "incidents",
      title: "Security Incidents",
      url: "#incidents",
      icon: Shield,
    },
  ]

  const navSectors = [
    { name: "Kumasi Metro Central", code: "05-KMA", color: "#1E2B7B" },
    { name: "Asokwa & Subin Post", code: "05-ASO", color: "#0D9488" },
    { name: "Kwadaso & Bantama", code: "05-KWA", color: "#F59E0B" },
  ]

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200/80 bg-white" {...props}>
      <SidebarHeader className="border-b border-slate-100 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-1 shrink-0 flex items-center justify-center shadow-xs">
              <Image
                src="/images/waec-logo.jpg"
                alt="WAEC Crest"
                width={30}
                height={30}
                className="size-full object-cover rounded-lg"
              />
            </div>
            <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 leading-tight">WAEC MOS</span>
              <span className="text-[11px] text-slate-400 font-medium">Fleet Command HQ</span>
            </div>
          </div>
          <button className="size-6 rounded-md hover:bg-slate-100 text-slate-400 flex items-center justify-center group-data-[collapsible=icon]:hidden">
            <ChevronLeft className="size-4" />
          </button>
        </div>

        {/* Clean Search Pill */}
        <div className="mt-3 relative group-data-[collapsible=icon]:hidden">
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            readOnly
            placeholder="Search console..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pl-8 pr-8 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
          <span className="absolute right-2 top-2 rounded bg-white px-1.5 py-0.5 text-[9px] font-mono text-slate-400 border border-slate-200 shadow-2xs">
            ⌘K
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 space-y-4">
        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2 mb-1">
            Main Menu
          </SidebarGroupLabel>
          <SidebarMenu>
            {navMain.map((item) => {
              const isActive = activeTab === item.id
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={item.title}
                    onClick={(e) => {
                      if (item.url.startsWith('#') || item.id === 'console' || item.id === 'roster' || item.id === 'centers' || item.id === 'incidents') {
                        if (onSelectTab && item.id !== 'telematics') {
                          e.preventDefault()
                          onSelectTab(item.id)
                        }
                      }
                    }}
                    asChild={item.id === 'telematics'}
                    className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#1E2B7B] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.id === 'telematics' ? (
                      <Link href={item.url} className="flex items-center gap-2.5">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <button type="button" className="w-full flex items-center gap-2.5 text-left">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </button>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Regional Hubs / Sectors */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2 mb-1">
            Ashanti Sectors
          </SidebarGroupLabel>
          <div className="space-y-1 px-1">
            {navSectors.map((sector) => (
              <button
                key={sector.code}
                onClick={() => onSelectTab && onSelectTab('centers')}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: sector.color }} />
                  <span className="truncate">{sector.name}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{sector.code}</span>
              </button>
            ))}
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-100 p-2.5">
        <div className="flex items-center gap-2 p-1 rounded-xl group-data-[collapsible=icon]:p-0">
          <Avatar className="size-9 shrink-0 border border-slate-200">
            <AvatarImage src={app1User.avatar} alt="Dr. Mensah Osei" />
            <AvatarFallback className="bg-[#1E2B7B] text-white font-bold text-xs">MO</AvatarFallback>
          </Avatar>
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-bold text-slate-900 truncate">Dr. Mensah Osei</span>
            <span className="text-[10px] text-slate-500 font-medium truncate">Regional Controller</span>
          </div>
          <Link
            href="/login"
            className="ml-auto text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition group-data-[collapsible=icon]:hidden"
            title="Log out"
          >
            <LogOut className="size-4" />
          </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
