"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  CalendarRange,
  FolderOpen,
  Library,
  NotebookPen,
  Target,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { DASHBOARD_ITEM } from "@/lib/dashboard";

type QuickLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: string;
};

const QUICK_LINKS: QuickLink[] = [
  { href: "/library", label: "Biblioteca", icon: BookOpen, tone: "from-[#5aa7ff] to-[#0066d6]" },
  { href: "/studio", label: "IA Studio", icon: Wand2, tone: "from-[#c47dff] to-[#7b2fe0]" },
  { href: "/notebooks", label: "Cuadernos", icon: NotebookPen, tone: "from-[#ffb340] to-[#e07800]" },
  { href: "/planner", label: "Planificador", icon: CalendarRange, tone: "from-[#ff7b72] to-[#d62b23]" },
  { href: "/academics", label: "Académico", icon: Library, tone: "from-[#5ddc82] to-[#1a9e3a]" },
  { href: "/focus", label: "Enfoque", icon: Target, tone: "from-[#5fe0d5] to-[#0a8a83]" },
  { href: "/review", label: "Repaso", icon: Brain, tone: "from-[#8f8dff] to-[#4a48d6]" },
  { href: "/classes", label: "Clases", icon: Users, tone: "from-[#ff7ba6] to-[#d61a5b]" },
  { href: "/files", label: "Archivos", icon: FolderOpen, tone: "from-[#a1a1aa] to-[#55555c]" },
];

export function QuickDock() {
  return (
    <motion.section variants={DASHBOARD_ITEM} aria-labelledby="quick-dock-title" className="mt-6">
      <h2 id="quick-dock-title" className="sr-only">
        Acceso rápido
      </h2>
      <div className="flex justify-center">
        <div className="app-glass hide-scrollbar flex max-w-full items-start gap-0.5 overflow-x-auto rounded-3xl p-2">
          {QUICK_LINKS.map(({ href, label, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className="group flex w-[60px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.055]"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-b ${tone} text-white shadow-[0_3px_9px_-3px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.28)] transition-transform duration-200 ease-mac group-hover:-translate-y-1 group-active:translate-y-0`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="max-w-full truncate text-[9px] font-medium tracking-[-0.01em] text-slate-500 transition-colors group-hover:text-slate-800 dark:text-white/35 dark:group-hover:text-white/70">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
