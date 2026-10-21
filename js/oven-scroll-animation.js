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
        const scrollDistance = desktop ? 2400 : 1800;

        const tl = gsap.timeline({
          defaults: { ease: "power1.inOut" },
          scrollTrigger: {
            trigger: ovenStory,
            start: "top top",
            end: () => `+=${scrollDistance}`,
            scrub: 0.75,
            pin: stage,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          }
        });

        // -----------------------------------------------------------
        // PHASE 1 (0% – 25%): Kitchen Scene Established
        // -----------------------------------------------------------
        tl.fromTo(
          heroCopy,
          { y: 0, opacity: 1 },
          { y: 0, opacity: 1, duration: 2 },
          0
        );

        // -----------------------------------------------------------
        // PHASE 2 (25% – 50%): Middle Deck Door Swings Open & Glows
        // -----------------------------------------------------------
        tl.to(
          ovenOpen,
          {
            opacity: 1,
            duration: 2.2,
            ease: "power2.inOut"
          },
          1.8
        );

        tl.to(
          glow,
          {
            opacity: 1,
            scale: 1.25,
            duration: 1.8,
            ease: "sine.out"
          },
          2.0
        );

        // -----------------------------------------------------------
        // PHASE 3 (50% – 75%): 3D Volumetric Varkey Emerges to Center
        // Thick, golden-layered pastry flying out of the right-side oven
        // -----------------------------------------------------------
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
            duration: 2.5,
            ease: "power2.out"
          },
          3.5
        );

        // Gentle 3D roll and pitch (keeps volumetric thickness, never paper-thin)
        tl.to(
          varkeyRotator,
          {
            rotationY: -16,
            rotationX: 14,
            rotationZ: 10,
            duration: 2.5,
            ease: "power1.out"
          },
          3.5
        );

        tl.to(
          varkeyShadow,
          {
            opacity: 0.75,
            scale: 1.2,
            duration: 2.0,
            ease: "power2.out"
          },
          3.8
        );

        // -----------------------------------------------------------
        // PHASE 4 (75% – 100%): Varkey Swoops Downward Towards Card 1
        // -----------------------------------------------------------
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
            duration: 2.6,
            ease: "power2.in"
          },
          5.8
        );

        tl.to(
          varkeyRotator,
          {
            rotationY: 0,
            rotationX: 0,
            rotationZ: 0,
            duration: 2.6,
            ease: "power1.inOut"
          },
          5.8
        );

        tl.to(
          heroCopy,
          {
            opacity: 0.1,
            y: -30,
            duration: 1.5
          },
          6.0
        );

        tl.to(
          scrollHint,
          {
            opacity: 0,
            duration: 0.6
          },
          5.5
        );

        tl.to(
          glow,
          {
            opacity: 0.25,
            duration: 1.5
          },
          6.2
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
