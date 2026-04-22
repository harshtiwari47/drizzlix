import React, { useEffect, useRef } from 'react';

const Starfield = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowCapabilityMode = document.documentElement.classList.contains('low-end-device-ui');
    if (prefersReducedMotion || lowCapabilityMode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId;

    let w, h;
    const stars = [];
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const coreCount = Number(window.navigator?.hardwareConcurrency || 8);
    const baseStarCount = isCoarsePointer ? 80 : 150;
    const compactScale = window.innerWidth <= 760 ? 0.8 : 1;
    const cpuScale = coreCount <= 2 ? 0.58 : coreCount <= 4 ? 0.72 : 1;
    const starCount = Math.max(40, Math.round(baseStarCount * compactScale * cpuScale));
    let mouseX = 0;
    let mouseY = 0;
    let isPaused = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initStars = () => {
      stars.length = 0;
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * 1.5,
          opacity: Math.random() * 0.5 + 0.2,
          parallax: Math.random() * 0.05 + 0.01 // Depth effect
        });
      }
    };

    const draw = () => {
      if (isPaused) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      
      stars.forEach(star => {
        // Calculate interactive position
        const targetX = star.x + (mouseX - w / 2) * star.parallax;
        const targetY = star.y + (mouseY - h / 2) * star.parallax;

        ctx.beginPath();
        ctx.arc(targetX, targetY, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
        
        // Twinkle effect
        if (Math.random() > 0.98) {
          star.opacity = Math.random() * 0.5 + 0.2;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleVisibilityChange = () => {
      isPaused = document.hidden;
    };

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (!isCoarsePointer) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    
    resize();
    initStars();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (!isCoarsePointer) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        opacity: 0.45
      }}
    />
  );
};

export default Starfield;

