"use client";

import { useEffect, useRef } from "react";

/** Keep floating chat within the visible viewport without scrolling the page or locking zoom. */
export function useChatViewport(open: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const viewport = window.visualViewport;
    let frame: number | null = null;
    let compact = false;
    let unfocusedHeight = viewport?.height || window.innerHeight;
    const properties = ["--leo-viewport-height", "--leo-viewport-width", "--leo-viewport-bottom", "--leo-viewport-right"];
    function update() {
      frame = null;
      const height = viewport?.height || window.innerHeight;
      const width = viewport?.width || window.innerWidth;
      const top = viewport?.offsetTop || 0;
      const left = viewport?.offsetLeft || 0;
      const active = document.activeElement;
      const editing = active instanceof HTMLElement && element!.contains(active) && active.matches("input,textarea,[contenteditable=true]");
      const compressed = height < 480 || Math.max(window.innerHeight, unfocusedHeight) - height > 100;
      compact = compressed && (editing || compact);
      if (!editing && !compact) unfocusedHeight = height;
      const values = [height, width, Math.max(0, window.innerHeight - top - height), Math.max(0, window.innerWidth - left - width)];
      properties.forEach((name, index) => {
        const value = `${values[index]}px`;
        if (element!.style.getPropertyValue(name) !== value) element!.style.setProperty(name, value);
      });
      // A layout hint from real focus/geometry, not a fabricated agent or provider state.
      element!.dataset.chatCompact = String(compact);
    }
    function schedule() { if (frame === null) frame = requestAnimationFrame(update); }
    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    element.addEventListener("focusin", schedule);
    element.addEventListener("focusout", schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      element.removeEventListener("focusin", schedule);
      element.removeEventListener("focusout", schedule);
      properties.forEach(name => element.style.removeProperty(name));
      delete element.dataset.chatCompact;
    };
  }, [open]);
  return ref;
}
