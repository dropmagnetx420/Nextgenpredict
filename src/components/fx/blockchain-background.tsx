"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

/**
 * Canvas particle network. Nodes drift and draw glowing links to nearby
 * neighbours, evoking a settling blockchain.
 *
 * Runs on a single rAF loop, pauses when the tab is hidden, and renders
 * nothing for visitors with `prefers-reduced-motion`.
 */
export function BlockchainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let raf = 0;
    let running = true;

    const LINK_DISTANCE = 150;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Scale node count with viewport area, capped for low-end mobile.
      const target = Math.min(70, Math.max(22, Math.floor((width * height) / 24000)));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.8,
        hue: 200 + Math.random() * 100, // cyan → violet
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;

        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > width) a.vx *= -1;
        if (a.y < 0 || a.y > height) a.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE) continue;

          const alpha = (1 - dist / LINK_DISTANCE) * 0.28;
          ctx!.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 90%, 65%, ${alpha})`;
          ctx!.lineWidth = 0.7;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }

        ctx!.beginPath();
        ctx!.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${a.hue}, 95%, 72%, 0.85)`;
        ctx!.shadowBlur = 12;
        ctx!.shadowColor = `hsla(${a.hue}, 95%, 65%, 0.9)`;
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      if (running) raf = requestAnimationFrame(draw);
    }

    resize();
    if (reduceMotion) {
      draw();          // one static frame
      running = false;
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }

    function onVisibility() {
      if (reduceMotion) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    }

    const onResize = () => {
      resize();
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />

      {/* Drifting grid */}
      <div className="absolute inset-0 bg-grid opacity-60 [animation:gridPan_24s_linear_infinite]" />

      {/* Ambient colour blooms */}
      <div className="absolute -left-40 top-[-10%] h-[520px] w-[520px] rounded-full bg-primary/25 blur-[110px] [animation:glowPulse_9s_ease-in-out_infinite]" />
      <div className="absolute -right-32 top-1/4 h-[460px] w-[460px] rounded-full bg-secondary/20 blur-[110px] [animation:glowPulse_11s_ease-in-out_infinite_1s]" />
      <div className="absolute bottom-[-15%] left-1/3 h-[500px] w-[500px] rounded-full bg-accent/15 blur-[120px] [animation:glowPulse_13s_ease-in-out_infinite_2s]" />

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />

      {/* Vignette keeps foreground text legible over the animation */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-background)_100%)]" />
    </div>
  );
}
