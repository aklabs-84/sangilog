import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  shape: 'rect' | 'circle' | 'star';
}

const COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98FB98', '#F0E68C', '#FF69B4',
];

const random = (min: number, max: number) => Math.random() * (max - min) + min;

interface ConfettiEffectProps {
  duration?: number; // ms, default 4000
  intensity?: 'normal' | 'heavy'; // heavy for 1st place
}

const ConfettiEffect = ({ duration = 4000, intensity = 'normal' }: ConfettiEffectProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = intensity === 'heavy' ? 200 : 120;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: random(0, canvas.width),
      y: random(-100, -10),
      vx: random(-3, 3),
      vy: random(3, 8),
      color: COLORS[Math.floor(random(0, COLORS.length))],
      size: random(6, 14),
      rotation: random(0, Math.PI * 2),
      rotationSpeed: random(-0.1, 0.1),
      life: 1,
      shape: ['rect', 'circle', 'star'][Math.floor(random(0, 3))] as Particle['shape'],
    }));

    const startTime = Date.now();
    let rafId: number;

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      const points = 5;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? size : size * 0.4;
        i === 0 ? ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle))
                : ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const fadeRatio = Math.max(0, 1 - elapsed / duration);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.rotation += p.rotationSpeed;
        p.life = fadeRatio;

        if (p.y > canvas.height + 20) {
          p.y = random(-50, -10);
          p.x = random(0, canvas.width);
          p.vy = random(3, 8);
        }

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
        }

        ctx.restore();
      });

      if (elapsed < duration + 500) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [duration, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />
  );
};

export default ConfettiEffect;
