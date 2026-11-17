"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { NavItem } from "@/lib/navigation";
import type { SidebarSide } from "@/lib/layout-preferences";
import { cn } from "@/lib/utils";

export function SidebarLink({ item, active, collapsed, side, reduced, hovered, onHighlight }: {
  item: NavItem; active: boolean; collapsed: boolean; side: SidebarSide; reduced: boolean;
  hovered: boolean; onHighlight: (href: string | null) => void;
}) {
  const { href, label, icon: Icon } = item;
  const link = useRef<HTMLAnchorElement>(null);
  const tooltipId = useId();
  const [tooltip, setTooltip] = useState<{ top: number; edge: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!collapsed || !hovered) return;
    const dismiss = () => setTooltip(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [collapsed, hovered]);
  const show = () => {
    onHighlight(href);
    setDismissed(false);
    const rect = link.current?.getBoundingClientRect();
    if (rect) setTooltip({ top: rect.top + rect.height / 2, edge: side === "left" ? rect.right + 16 : innerWidth - rect.left + 16 });
  };
  const hide = () => { setTooltip(null); onHighlight(null); };
  const visible = collapsed && hovered && tooltip && !dismissed;
  return (
    <>
      <Link ref={link} href={href} aria-label={label} aria-current={active ? "page" : undefined} aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onKeyDown={event => { if (event.key === "Escape") setDismissed(true); }}
        className={cn("relative flex h-11 w-full shrink-0 items-center gap-3 rounded-2xl px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center px-0", active ? "font-semibold text-primary" : "text-foreground")}>
        {active && <motion.span aria-hidden="true" layoutId="sidebar-active" className="absolute inset-0 rounded-2xl border border-primary/25 bg-primary/10" transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }} />}
        <AnimatePresence>
          {hovered && <motion.span aria-hidden="true" layoutId="sidebar-hover" className="absolute inset-0 rounded-2xl border border-border bg-accent/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.16 }} />}
        </AnimatePresence>
        <Icon aria-hidden="true" className="relative z-10 h-[19px] w-[19px] shrink-0" strokeWidth={active ? 2.05 : 1.8} />
        {!collapsed && <span className="relative z-10 truncate">{label}</span>}
      </Link>
      {visible && createPortal(<span id={tooltipId} role="tooltip" className="pointer-events-none fixed z-[100] -translate-y-1/2 rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-glass" style={{ top: tooltip.top, [side === "left" ? "left" : "right"]: tooltip.edge }}>{label}</span>, document.body)}
    </>
  );
}
