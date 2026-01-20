'use client';

import { useEffect, useRef } from 'react';

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle system
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      color: string;
      baseOpacity: number;
      time: number;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.radius = Math.random() * 2.5 + 0.8;
        this.baseOpacity = Math.random() * 0.4 + 0.2;
        this.opacity = this.baseOpacity;
        this.time = Math.random() * Math.PI * 2;
        
        // Use primary color with variations
        const colors = [
          'rgba(99, 102, 241, 0.5)',
          'rgba(168, 85, 247, 0.4)',
          'rgba(59, 130, 246, 0.4)',
          'rgba(139, 92, 246, 0.4)',
          'rgba(236, 72, 153, 0.3)',
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.time += 0.02;
        this.x += this.vx;
        this.y += this.vy;

        // Pulsing opacity
        this.opacity = this.baseOpacity + Math.sin(this.time) * 0.2;

        // Bounce off edges
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        
        // Keep particles in bounds
        this.x = Math.max(0, Math.min(canvas.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height, this.y));
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
        
        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // Create particles
    const particles: Particle[] = [];
    const particleCount = Math.floor((canvas.width * canvas.height) / 12000);
    
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Connection lines
    const maxDistance = 180;

    const drawConnections = () => {
      if (!ctx) return;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const opacity = (1 - distance / maxDistance) * 0.2;
            // Vary line color based on distance
            const colors = [
              `rgba(99, 102, 241, ${opacity})`,
              `rgba(168, 85, 247, ${opacity * 0.8})`,
              `rgba(59, 130, 246, ${opacity * 0.7})`,
            ];
            ctx.strokeStyle = colors[Math.floor(Math.random() * colors.length)];
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    // Animation loop
    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      drawConnections();

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <>
      <div className="animated-grid" />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
        style={{ mixBlendMode: 'screen' }}
      />
    </>
  );
}
