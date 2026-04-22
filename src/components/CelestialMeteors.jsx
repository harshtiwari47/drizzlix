import React, { useEffect, useRef } from 'react';

class Meteor {
  constructor(width, height) {
    this.reset(width, height);
  }

  reset(width, height) {
    this.x = Math.random() * width * 0.6 - width * 0.2;
    this.y = Math.random() * height * 0.4 - height * 0.2;

    this.length = Math.random() * 80 + 40;
    this.speed = Math.random() * 15 + 10;
    this.vx = this.speed;
    this.vy = this.speed;

    this.opacity = 0;
    this.maxOpacity = Math.random() * 0.4 + 0.3;
    this.fadeSpeed = 0.05;
    this.state = 'fading-in';
  }

  update(width, height) {
    this.x += this.vx;
    this.y += this.vy;

    if (this.state === 'fading-in') {
      this.opacity += this.fadeSpeed;
      if (this.opacity >= this.maxOpacity) this.state = 'falling';
    }

    if (this.x > width || this.y > height) {
      this.state = 'fading-out';
    }

    if (this.state === 'fading-out') {
      this.opacity -= this.fadeSpeed;
      return this.opacity <= 0;
    }

    return false;
  }

  draw(ctx) {
    const headX = this.x;
    const headY = this.y;
    const tailX = this.x - this.length * 0.707;
    const tailY = this.y - this.length * 0.707;

    const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.2, `rgba(147, 197, 253, ${this.opacity * 0.3})`);
    gradient.addColorStop(1, `rgba(255, 255, 255, ${this.opacity})`);

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.beginPath();
    const glow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 4);
    glow.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.arc(headX, headY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function CelestialMeteors({ active }) {
  const canvasRef = useRef(null);
  const meteorsRef = useRef([]);
  const animationRef = useRef(null);
  const startAnimationRef = useRef(() => {});
  const isPageVisibleRef = useRef(typeof document === 'undefined' ? true : !document.hidden);
  const activeRef = useRef(active);
  const reducedMotionRef = useRef(false);
  const viewportRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = window.innerWidth;
      const height = window.innerHeight;

      viewportRef.current = { width, height };
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const stopAnimation = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    const renderFrame = () => {
      if (!isPageVisibleRef.current) {
        animationRef.current = null;
        return;
      }

      const { width, height } = viewportRef.current;
      if (!width || !height) {
        animationRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = meteorsRef.current.length - 1; i >= 0; i -= 1) {
        const meteor = meteorsRef.current[i];
        const finished = meteor.update(width, height);
        if (finished) {
          meteorsRef.current.splice(i, 1);
        } else {
          meteor.draw(ctx);
        }
      }

      if (meteorsRef.current.length > 0) {
        animationRef.current = requestAnimationFrame(renderFrame);
      } else {
        animationRef.current = null;
      }
    };

    const startAnimation = () => {
      if (reducedMotionRef.current) return;
      if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(renderFrame);
      }
    };

    const updateMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
      if (reducedMotionRef.current) {
        meteorsRef.current = [];
        const { width, height } = viewportRef.current;
        ctx.clearRect(0, 0, width, height);
        stopAnimation();
      }
    };

    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      if (!isPageVisibleRef.current) {
        stopAnimation();
        return;
      }

      if (activeRef.current && meteorsRef.current.length > 0) {
        startAnimation();
      }
    };

    startAnimationRef.current = startAnimation;
    handleResize();
    updateMotionPreference();
    handleVisibilityChange();

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', updateMotionPreference);
    } else {
      motionQuery.addListener(updateMotionPreference);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (typeof motionQuery.removeEventListener === 'function') {
        motionQuery.removeEventListener('change', updateMotionPreference);
      } else {
        motionQuery.removeListener(updateMotionPreference);
      }
      stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof document !== 'undefined' && document.hidden) return undefined;
    if (!active || reducedMotionRef.current) return undefined;

    const { width, height } = viewportRef.current;
    const isCompact = width <= 760;
    const coreCount = Number(window.navigator?.hardwareConcurrency || 8);
    const coreScale = coreCount <= 2 ? 0.55 : coreCount <= 4 ? 0.72 : 1;
    const burstCount = Math.max(5, Math.round((isCompact ? 7 : 12) * coreScale));
    const delayStep = isCompact ? 105 : 80;

    const timeoutIds = [];
    for (let index = 0; index < burstCount; index += 1) {
      const timeoutId = window.setTimeout(() => {
        const current = viewportRef.current;
        meteorsRef.current.push(new Meteor(current.width || width, current.height || height));
        startAnimationRef.current();
      }, index * delayStep);
      timeoutIds.push(timeoutId);
    }

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
}
