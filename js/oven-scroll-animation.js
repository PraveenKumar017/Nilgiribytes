/**
 * NilgiriBytes — Artisan Baking Kitchen Scroll Hero
 * GSAP + ScrollTrigger scrubbed timeline
 * Middle deck oven on right -> 3D Ooty Varkey -> Card 1 landing
 */

(function () {
  "use strict";

  function initOvenScrollAnimation() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      console.warn("GSAP or ScrollTrigger not loaded yet.");
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const ovenStory = document.getElementById("ovenStory");
    const targetCard = document.getElementById("varkey-target-card");
    if (!ovenStory) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        desktop: "(min-width: 769px)",
        mobile: "(max-width: 768px)",
        reduceMotion: "(prefers-reduced-motion: reduce)"
      },
      (context) => {
        const { desktop, reduceMotion } = context.conditions;

        const stage = ovenStory.querySelector(".oven-stage");
        const ovenClosed = ovenStory.querySelector(".oven-closed");
        const ovenOpen = ovenStory.querySelector(".oven-open");
        const glow = ovenStory.querySelector(".oven-glow-spill");
        const varkey = ovenStory.querySelector(".varkey-flight");
        const varkeyRotator = ovenStory.querySelector(".varkey-rotator");
        const varkeyShadow = ovenStory.querySelector(".varkey-shadow-wrap");
        const heroCopy = ovenStory.querySelector(".hero-copy");
        const scrollHint = ovenStory.querySelector(".oven-scroll-hint");

        if (!ovenClosed || !ovenOpen || !varkey) return;

        // Accessible static state
        if (reduceMotion) {
          gsap.set(ovenOpen, { opacity: 0.95 });
          gsap.set(glow, { opacity: 0.4 });
          gsap.set(varkey, { opacity: 0 });
          if (targetCard) targetCard.classList.add("is-landed");
          return;
        }

        // -----------------------------------------------------------
        // MAIN HERO TIMELINE (Pinned across scroll distance)
        // -----------------------------------------------------------
        const scrollDistance = desktop ? 1600 : 700;

        const tl = gsap.timeline({
          defaults: { ease: "power1.inOut" },
          scrollTrigger: {
            trigger: ovenStory,
            start: "top top",
            end: () => `+=${scrollDistance}`,
            scrub: true,
            pin: stage,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          }
        });

        // -----------------------------------------------------------
        // Timeline is scrubbed 1:1 (scrub: true) over scrollDistance.
        // Every unit below maps proportionally onto the pin distance,
        // and there are no gaps — motion starts on the first pixel
        // of scroll and runs continuously to the end of the pin.
        //
        //   0.0 – 2.0   door opens + glow spills
        //   2.0 – 4.2   varkey emerges, rolls into 3D
        //   4.2 – 6.4   varkey flies down and docks onto Card 1
        // -----------------------------------------------------------

        // PHASE 1 — oven door opens, glow spills out
        tl.to(
          ovenOpen,
          {
            opacity: 1,
            duration: 2.0,
            ease: "power2.inOut"
          },
          0
        );

        tl.to(
          glow,
          {
            opacity: 1,
            scale: 1.25,
            duration: 1.8,
            ease: "sine.out"
          },
          0.2
        );

        // PHASE 2 — 3D volumetric varkey emerges from the oven
        tl.fromTo(
          varkey,
          {
            opacity: 0,
            scale: 0.22,
            x: 0,
            y: 0,
            filter: "brightness(1.35) drop-shadow(0 0 25px rgba(255,160,50,0.9))"
          },
          {
            opacity: 1,
            scale: desktop ? 1.25 : 1.05,
            x: desktop ? -220 : -60,
            y: desktop ? 40 : 25,
            filter: "brightness(1.0) drop-shadow(0 20px 35px rgba(0,0,0,0.7))",
            duration: 2.2,
            ease: "power2.out"
          },
          2.0
        );

        // Gentle 3D roll and pitch (keeps volumetric thickness, never paper-thin)
        tl.to(
          varkeyRotator,
          {
            rotationY: -16,
            rotationX: 14,
            rotationZ: 10,
            duration: 2.2,
            ease: "power1.out"
          },
          2.0
        );

        tl.to(
          varkeyShadow,
          {
            opacity: 0.75,
            scale: 1.2,
            duration: 1.8,
            ease: "power2.out"
          },
          2.3
        );

        // PHASE 3 — varkey swoops downward towards Card 1
        function computeCardVector() {
          if (!targetCard) return { x: desktop ? -480 : -120, y: desktop ? 320 : 180 };
          const stageRect = stage.getBoundingClientRect();
          const cardRect = targetCard.getBoundingClientRect();

          // Flight origin in viewport
          const varkeyOrigX = stageRect.left + stageRect.width * (desktop ? 0.74 : 0.55);
          const varkeyOrigY = stageRect.top + stageRect.height * (desktop ? 0.38 : 0.55);

          // Card 1 center target
          const cardCenterX = cardRect.left + cardRect.width * 0.5;
          const cardCenterY = stageRect.bottom - 40;

          return {
            x: cardCenterX - varkeyOrigX,
            y: cardCenterY - varkeyOrigY
          };
        }

        const vec = computeCardVector();

        tl.to(
          varkey,
          {
            x: vec.x,
            y: vec.y,
            scale: desktop ? 0.82 : 0.7,
            duration: 2.2,
            ease: "power2.in"
          },
          4.2
        );

        tl.to(
          varkeyRotator,
          {
            rotationY: 0,
            rotationX: 0,
            rotationZ: 0,
            duration: 2.2,
            ease: "power1.inOut"
          },
          4.2
        );

        tl.to(
          heroCopy,
          {
            opacity: 0.1,
            y: -30,
            duration: 1.4
          },
          4.4
        );

        if (scrollHint) {
          tl.to(
            scrollHint,
            {
              opacity: 0,
              duration: 0.6
            },
            4.0
          );
        }

        tl.to(
          glow,
          {
            opacity: 0.25,
            duration: 1.4
          },
          4.6
        );

        // -----------------------------------------------------------
        // DOCKING TRIGGER (Triggers when Card 1 scrolls into view)
        // -----------------------------------------------------------
        if (targetCard) {
          ScrollTrigger.create({
            trigger: targetCard,
            start: "top 85%",
            end: "bottom top",
            onEnter: () => {
              targetCard.classList.add("is-landed");
              gsap.to(varkey, { opacity: 0, duration: 0.3 });
            },
            onLeaveBack: () => {
              targetCard.classList.remove("is-landed");
              gsap.to(varkey, { opacity: 1, duration: 0.3 });
            }
          });
        }

        return () => {
          ScrollTrigger.getAll().forEach((st) => st.kill());
          tl.kill();
        };
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOvenScrollAnimation);
  } else {
    initOvenScrollAnimation();
  }
})();
