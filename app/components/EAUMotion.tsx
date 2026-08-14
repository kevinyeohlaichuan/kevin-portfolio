"use client";

import { useEffect } from "react";

export function EAUMotion() {
  useEffect(() => {
    let cleanup = () => {};

    void (async () => {
      const [{ gsap }, { ScrollTrigger }, { MotionPathPlugin }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/MotionPathPlugin"),
      ]);

      gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".hero-copy > *",
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.85, stagger: 0.09, ease: "power3.out" },
        );

        gsap.to(".flight-courier", {
          motionPath: {
            path: [
              { x: -120, y: 35 },
              { x: 180, y: -45 },
              { x: 520, y: 18 },
              { x: 920, y: -24 },
              { x: 1320, y: 20 },
            ],
            curviness: 1.35,
            autoRotate: true,
          },
          ease: "none",
          scrollTrigger: {
            trigger: ".flight-divider",
            start: "top 92%",
            end: "bottom 12%",
            scrub: 0.8,
          },
        });

        const core = document.querySelector<HTMLElement>(".cursor-core");
        const sword = document.querySelector<HTMLElement>(".cursor-sword");

        if (!core || !sword || !window.matchMedia("(pointer: fine)").matches) {
          return undefined;
        }

        const move = (event: PointerEvent) => {
          gsap.to(core, {
            x: event.clientX,
            y: event.clientY,
            duration: 0.08,
            overwrite: "auto",
          });
          gsap.to(sword, {
            x: event.clientX - 42,
            y: event.clientY + 24,
            rotation: -28 + Math.min(14, event.movementX * 0.7),
            duration: 0.42,
            ease: "power3.out",
            overwrite: "auto",
          });
        };

        const hide = () => gsap.to([core, sword], { opacity: 0, duration: 0.18 });
        const show = () => gsap.to([core, sword], { opacity: 1, duration: 0.18 });

        window.addEventListener("pointermove", move);
        document.addEventListener("pointerleave", hide);
        document.addEventListener("pointerenter", show);

        return () => {
          window.removeEventListener("pointermove", move);
          document.removeEventListener("pointerleave", hide);
          document.removeEventListener("pointerenter", show);
        };
      });

      cleanup = () => {
        media.revert();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    });

    return () => cleanup();
  }, []);

  return (
    <div className="cursor-system" aria-hidden="true">
      <span className="cursor-core" />
      <span className="cursor-sword"><i /></span>
    </div>
  );
}
