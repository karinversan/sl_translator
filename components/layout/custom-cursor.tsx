"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

type CursorMode = "default" | "interactive" | "scroll";

export function CustomCursor() {
  const reducedMotion = usePrefersReducedMotion();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const pointerRef = useRef({ x: 0, y: 0 });
  const ringPosRef = useRef({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [mode, setMode] = useState<CursorMode>("default");
  const modeRef = useRef<CursorMode>("default");
  const visibleRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setEnabled(false);
      return;
    }

    const isDesktopPointer = window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 1024;
    setEnabled(isDesktopPointer);
  }, [reducedMotion]);

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove("custom-cursor-enabled");
      return;
    }

    document.body.classList.add("custom-cursor-enabled");

    const isInteractive = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          "a,button,[role='button'],input,textarea,select,label,summary,[data-cursor='interactive']"
        )
      );
    };

    const resolveMode = (target: EventTarget | null): CursorMode => {
      if (!(target instanceof Element)) return "default";
      const match = target.closest("[data-cursor='scroll']");
      if (match) return "scroll";
      if (isInteractive(target)) return "interactive";
      return "default";
    };

    const ensureAnimation = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    const onMove = (event: MouseEvent) => {
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
      const nextMode = resolveMode(event.target);
      if (nextMode !== modeRef.current) {
        modeRef.current = nextMode;
        setMode(nextMode);
      }
      ensureAnimation();
    };

    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    const onOver = (event: MouseEvent) => {
      const nextMode = resolveMode(event.target);
      if (nextMode !== modeRef.current) {
        modeRef.current = nextMode;
        setMode(nextMode);
      }
      ensureAnimation();
    };
    const onLeave = () => {
      visibleRef.current = false;
      setVisible(false);
    };

    const animate = () => {
      const lag = 0.88;
      ringPosRef.current.x += (pointerRef.current.x - ringPosRef.current.x) * lag;
      ringPosRef.current.y += (pointerRef.current.y - ringPosRef.current.y) * lag;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${pointerRef.current.x}px, ${pointerRef.current.y}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPosRef.current.x}px, ${ringPosRef.current.y}px, 0)`;
      }
      const dx = Math.abs(pointerRef.current.x - ringPosRef.current.x);
      const dy = Math.abs(pointerRef.current.y - ringPosRef.current.y);
      const keepRunning = dx > 0.2 || dy > 0.2;

      if (keepRunning) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = undefined;
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("mouseleave", onLeave, { passive: true });

    return () => {
      document.body.classList.remove("custom-cursor-enabled");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mouseleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="custom-cursor-dot"
        data-visible={visible}
      />
      <div
        ref={ringRef}
        aria-hidden
        className="custom-cursor-ring"
        data-visible={visible}
        data-mode={mode}
        data-pressed={pressed}
      />
    </>
  );
}
