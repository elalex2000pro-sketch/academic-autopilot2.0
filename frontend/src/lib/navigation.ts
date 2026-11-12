import {
  BookOpen,
  Brain,
  CalendarRange,
  Files,
  FilePenLine,
  GraduationCap,
  Home,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Navegación completa de escritorio, agrupada por contexto. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tu día",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/planner", label: "Planificador", icon: CalendarRange },
      { href: "/focus", label: "Modo Enfoque", icon: Target },
    ],
  },
  {
    label: "Estudia",
    items: [
      { href: "/library", label: "Biblioteca", icon: BookOpen },
      { href: "/academics", label: "Académico", icon: GraduationCap },
      { href: "/documents", label: "Documentos", icon: Files },
      { href: "/office", label: "Academic Office", icon: FilePenLine },
      { href: "/review", label: "Repaso", icon: Brain },
    ],
  },
  {
    label: "Comparte",
    items: [
      { href: "/classes", label: "Aulas", icon: Users },
      { href: "/chat", label: "Chat", icon: MessageCircle },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Ajustes", icon: Settings };

export const ALL_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_ITEM,
];

/** Los cinco accesos de la barra inferior móvil. */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/planner", label: "Planificador", icon: CalendarRange },
  { href: "/documents", label: "Documentos", icon: Files },
  { href: "/classes", label: "Aulas", icon: Users },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

/** Secciones que no caben en la barra inferior y siguen en la cabecera móvil. */
export const SECONDARY_NAV_ITEMS = ALL_ITEMS.filter(
  (item) => !PRIMARY_NAV_ITEMS.some((primary) => primary.href === item.href),
);

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/planner") {
    return (
      pathname.startsWith("/planner") ||
      pathname.startsWith("/calendar") ||
      pathname.startsWith("/schedule")
    );
  }
  if (href === "/academics") {
    return (
      pathname.startsWith("/academics") ||
      pathname.startsWith("/subjects") ||
      pathname.startsWith("/exams")
    );
  }
  if (href === "/documents") {
    return (
      pathname.startsWith("/documents") ||
      pathname.startsWith("/notebooks")
    );
  }
  if (href === "/classes") {
    return pathname.startsWith("/classes") || pathname.startsWith("/files");
  }
  return pathname.startsWith(href);
}
