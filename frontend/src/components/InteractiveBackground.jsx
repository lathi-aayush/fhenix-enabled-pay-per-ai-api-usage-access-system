import React, { useRef, useEffect } from "react";

export default function InteractiveBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let particles = [];
    const mouse = { x: null, y: null, active: false };

    // Setup canvas size
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent && parent.clientWidth ? parent.clientWidth : window.innerWidth;
      canvas.height = parent && parent.clientHeight ? parent.clientHeight : 700;
      initParticles();
    };

    // Particle initialization
    const initParticles = () => {
      particles = [];
      const count = canvas.width < 768 ? 32 : 75;

      for (let i = 0; i < count; i++) {
        const radius = Math.random() * 2 + 1.5; // 1.5px to 3.5px
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const vx = (Math.random() - 0.5) * 0.45; // Smooth floating speeds
        const vy = (Math.random() - 0.5) * 0.45;

        particles.push({
          x,
          y,
          vx,
          vy,
          baseVx: vx,
          baseVy: vy,
          radius,
        });
      }
    };

    // Track mouse coordinates globally
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
      mouse.active = false;
    };

    // Attach listeners
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    resizeCanvas();

    // Main animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const maxConnectDistance = 110;
      const mouseInfluenceRadius = 180;

      // Draw dynamic mouse spotlight glow in the background
      if (mouse.active && mouse.x !== null && mouse.y !== null) {
        const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouseInfluenceRadius);
        glow.addColorStop(0, "rgba(99, 102, 241, 0.12)"); // Faint indigo glow at center
        glow.addColorStop(0.5, "rgba(99, 102, 241, 0.04)");
        glow.addColorStop(1, "rgba(99, 102, 241, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouseInfluenceRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update & Draw particles
      particles.forEach((p, index) => {
        // Apply mouse physics (attraction)
        if (mouse.active && mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouseInfluenceRadius) {
            // Gentle acceleration force towards cursor
            const force = (mouseInfluenceRadius - dist) / mouseInfluenceRadius;
            p.vx += (dx / dist) * force * 0.05;
            p.vy += (dy / dist) * force * 0.05;

            // Cap the speed to avoid particles launching away
            const maxSpeed = 1.3;
            const speed = Math.hypot(p.vx, p.vy);
            if (speed > maxSpeed) {
              p.vx = (p.vx / speed) * maxSpeed;
              p.vy = (p.vy / speed) * maxSpeed;
            }
          } else {
            // Slowly decelerate / return back to base speed
            p.vx += (p.baseVx - p.vx) * 0.02;
            p.vy += (p.baseVy - p.vy) * 0.02;
          }
        } else {
          // Return to base speed if mouse inactive
          p.vx += (p.baseVx - p.vx) * 0.02;
          p.vy += (p.baseVy - p.vy) * 0.02;
        }

        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Boundary checks (bounce)
        if (p.x < 0) {
          p.x = 0;
          p.vx *= -1;
          p.baseVx *= -1;
        } else if (p.x > canvas.width) {
          p.x = canvas.width;
          p.vx *= -1;
          p.baseVx *= -1;
        }

        if (p.y < 0) {
          p.y = 0;
          p.vy *= -1;
          p.baseVy *= -1;
        } else if (p.y > canvas.height) {
          p.y = canvas.height;
          p.vy *= -1;
          p.baseVy *= -1;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 0.45)"; // Highly visible indigo
        ctx.fill();

        // Connect to other particles
        for (let j = index + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p2.x - p.x, p2.y - p.y);

          if (dist < maxConnectDistance) {
            const alpha = (1 - dist / maxConnectDistance) * 0.75;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${(0.15 * alpha).toFixed(4)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Connect to mouse pointer
        if (mouse.active && mouse.x !== null && mouse.y !== null) {
          const mouseDist = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (mouseDist < mouseInfluenceRadius) {
            const alpha = (1 - mouseDist / mouseInfluenceRadius) * 0.95;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${(0.3 * alpha).toFixed(4)})`;
            ctx.lineWidth = 0.95;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none block z-0"
    />
  );
}
