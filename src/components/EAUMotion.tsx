import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";
import { OrnateSword } from "./OrnateSword";

export function EAUMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        ".hero-copy > *",
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.85, stagger: 0.09, ease: "power3.out" },
      );

      const divider = document.querySelector<HTMLElement>(".flight-divider");
      if (divider) {
        const distance = divider.clientWidth + 240;
        gsap.to(".flight-sword", {
          motionPath: {
            path: [
              { x: -120, y: 28 },
              { x: distance * 0.25, y: -42 },
              { x: distance * 0.52, y: 18 },
              { x: distance * 0.78, y: -26 },
              { x: distance, y: 16 },
            ],
            curviness: 1.35,
            autoRotate: true,
          },
          ease: "none",
          scrollTrigger: {
            trigger: divider,
            start: "top 92%",
            end: "bottom 12%",
            scrub: 0.8,
          },
        });
      }

      const sword = document.querySelector<HTMLElement>(".cursor-sword-anchor");

      if (!sword || !window.matchMedia("(pointer: fine)").matches) {
        return undefined;
      }

      let hasMoved = false;
      let lastX = 0;
      let lastY = 0;
      let rotation = -24;
      const move = (event: PointerEvent) => {
        if (!hasMoved) {
          hasMoved = true;
          lastX = event.clientX;
          lastY = event.clientY;
          gsap.set(sword, { x: event.clientX, y: event.clientY, rotation });
          gsap.to(sword, { opacity: 1, duration: 0.12 });
          return;
        }

        const deltaX = event.clientX - lastX;
        const deltaY = event.clientY - lastY;
        if (Math.hypot(deltaX, deltaY) > 1.5) {
          const nextRotation = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
          const shortestTurn = ((nextRotation - rotation + 540) % 360) - 180;
          rotation += shortestTurn;
        }

        gsap.set(sword, { x: event.clientX, y: event.clientY });
        gsap.to(sword, {
          rotation,
          duration: 0.14,
          ease: "power3.out",
          overwrite: "auto",
        });
        lastX = event.clientX;
        lastY = event.clientY;
      };

      const hide = () => gsap.to(sword, { opacity: 0, duration: 0.12 });
      const show = () => {
        if (hasMoved) gsap.to(sword, { opacity: 1, duration: 0.12 });
      };

      window.addEventListener("pointermove", move);
      document.addEventListener("pointerleave", hide);
      document.addEventListener("pointerenter", show);

      return () => {
        window.removeEventListener("pointermove", move);
        document.removeEventListener("pointerleave", hide);
        document.removeEventListener("pointerenter", show);
      };
    });

    return () => {
      media.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <div className="cursor-system" aria-hidden="true">
      <span className="cursor-sword-anchor"><OrnateSword /></span>
    </div>
  );
}
