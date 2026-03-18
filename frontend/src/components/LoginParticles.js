import React, { useRef, useEffect } from 'react';

const N_PARTICLES = 65;
const LINK_DIST   = 145;
const REPEL_DIST  = 105;
const MAX_SPEED   = 1.4;

export default function LoginParticles({ destroying = false }) {
  const canvasRef     = useRef(null);
  const rafRef        = useRef(null);
  const mouseRef      = useRef({ x: -9999, y: -9999 });
  const pRef          = useRef([]);
  const destroyRef    = useRef(false);

  /* ── Init ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    pRef.current = Array.from({ length: N_PARTICLES }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      r:  Math.random() * 1.3 + 0.5,
      a:  Math.random() * 0.28 + 0.08,
    }));

    const tick = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const ps   = pRef.current;
      const mx   = mouseRef.current.x;
      const my   = mouseRef.current.y;
      const dest = destroyRef.current;
      let   alive = false;

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];

        if (dest) {
          /* Accelerate outward from center + random scatter */
          const cx = W / 2, cy = H / 2;
          p.vx += (p.x - cx) / (W * 0.7) + (Math.random() - 0.5) * 0.35;
          p.vy += (p.y - cy) / (H * 0.7) + (Math.random() - 0.5) * 0.35;
          p.vx *= 1.075;
          p.vy *= 1.075;
          p.a  -= 0.013;
        } else {
          /* Mouse repulsion */
          const dx = p.x - mx, dy = p.y - my;
          const d  = Math.hypot(dx, dy);
          if (d < REPEL_DIST && d > 0) {
            const f = (REPEL_DIST - d) / REPEL_DIST;
            p.vx += (dx / d) * f * 0.55;
            p.vy += (dy / d) * f * 0.55;
          }
          /* Drift + damping */
          p.vx = p.vx * 0.972 + (Math.random() - 0.5) * 0.018;
          p.vy = p.vy * 0.972 + (Math.random() - 0.5) * 0.018;
          /* Speed cap */
          const spd = Math.hypot(p.vx, p.vy);
          if (spd > MAX_SPEED) { p.vx /= spd / MAX_SPEED; p.vy /= spd / MAX_SPEED; }
          /* Torus wrap */
          if (p.x < -20) p.x = W + 20;
          else if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20;
          else if (p.y > H + 20) p.y = -20;
          alive = true;
        }

        p.x += p.vx;
        p.y += p.vy;
        if (p.a <= 0) continue;
        alive = true;

        /* Connections */
        if (!dest) {
          for (let j = i + 1; j < ps.length; j++) {
            const q  = ps[j];
            const d2 = Math.hypot(p.x - q.x, p.y - q.y);
            if (d2 < LINK_DIST) {
              const alpha = (1 - d2 / LINK_DIST) * Math.min(p.a, q.a) * 0.55;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = `rgba(148,197,253,${alpha})`;
              ctx.lineWidth   = 0.65;
              ctx.stroke();
            }
          }
        }

        /* Dot */
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,197,253,${p.a})`;
        ctx.fill();
      }

      if (alive) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const onMove  = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = ()  => { mouseRef.current = { x: -9999, y: -9999 }; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  useEffect(() => {
    if (destroying) destroyRef.current = true;
  }, [destroying]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
