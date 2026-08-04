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
    let lastFrame = 0;

    const LINK_DISTANCE = 150;
    const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE;
    // Link drawing is O(n²), so the node budget is what actually decides
    // whether this animation is free or eats a whole core on a phone.
    const MAX_NODES = window.innerWidth < 768 ? 28 : 52;
    const FRAME_MS = 1000 / 30;

    function resize() {
      // Above 1.5 the extra pixels are invisible on a blurred backdrop but
      // cost a fill-rate multiple on high-DPI phones.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(MAX_NODES, Math.max(16, Math.floor((width * height) / 32000)));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.8,
        hue: 200 + Math.random() * 100, // cyan → violet
      }));
    }

    function draw(now: number) {
      if (running) raf = requestAnimationFrame(draw);

      // 60fps buys nothing on a slow ambient drift and doubles the cost.
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;

      ctx!.clearRect(0, 0, width, height);
      ctx!.lineWidth = 0.7;

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
          // Compare squared lengths: Math.hypot is far slower than a multiply
          // and this runs n²/2 times per frame.
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DISTANCE_SQ) continue;

          const alpha = (1 - Math.sqrt(distSq) / LINK_DISTANCE) * 0.28;
          ctx!.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 90%, 65%, ${alpha})`;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }

        // The nodes sit behind a blur and a vignette, so the per-node
        // shadowBlur that used to be here was pure cost for no visible glow.
        ctx!.beginPath();
        ctx!.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${a.hue}, 95%, 72%, 0.85)`;
        ctx!.fill();
      }
    }

    resize();
    if (reduceMotion) {
      running = false;
      draw(0); // one static frame
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

    // Resize rebuilds every node, so a drag would otherwise rebuild dozens
    // of times a second.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      window.clearTimeout(resizeTimer);
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
