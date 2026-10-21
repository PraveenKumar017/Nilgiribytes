NilgiriBytes — Industrial Oven Scroll Animation
Developer implementation plan · HTML, CSS, JavaScript, GSAP
1. Experience overview
Build a cinematic, scroll-driven hero for NilgiriBytes featuring a photorealistic industrial tunnel baking oven, not a domestic kitchen appliance. The visitor scrolls to control the animation: the machine enters the scene, its industrial access door opens, one freshly baked cookie falls into the foreground, and the page transitions into the bakery's product collection.

Target experience
Desktop first, responsive everywhere

A wide cinematic scene with the machine on the right and brand messaging on the left.


Scroll controls the sequence

Scroll down to progress and scroll back up to reverse the animation.

Performance-conscious motion

Use optimized transparent assets, transform-based animation, and a reduced-motion fallback.

The most important technical decision is how to achieve the photorealistic appearance. Use a 3D-rendered oven split into independently animated layers, with GSAP controlling those layers. This provides realistic lighting and materials without requiring a full interactive 3D engine in the browser.
2. Scroll storyboard and timings
Use one pinned hero scene over approximately 2,400–3,000 px of desktop scroll. These percentages represent progress through the GSAP timeline, not elapsed seconds.

Phase 1 · 0–20% — Machine reveal

The oven moves upward and slightly forward into frame. Brand headline and supporting copy fade into view.

Phase 2 · 20–45% — Door opening

The door rotates around its actual hinge, revealing the glowing chamber. Add a soft amber light spill and subtle heat shimmer.


Phase 3 · 45–72% — Cookie drop

One cookie travels diagonally out of the chamber, rotates, falls toward the foreground, and casts a soft shadow.


Phase 4 · 72–100% — Product reveal

The cookie settles near the featured product section. The machine fades or moves aside while the cream-colored storefront comes into view.

3. Asset requirements
Prepare these assets before writing the animation code. The exact door split depends on the chosen oven design.
Asset	Format	Purpose
oven-body.webp	Transparent WebP/PNG	Main industrial machine
oven-door.webp	Transparent WebP/PNG	Independent door layer
oven-interior.webp	WebP/PNG	Baking chamber visible behind the door
oven-glow.webp	Transparent WebP/PNG	Warm light spill
cookie.webp	Transparent WebP/PNG	Single hero cookie
cookie-shadow.webp	Transparent WebP/PNG	Grounding shadow under the cookie
crumb-01.webp etc.	Transparent WebP/PNG	Optional small crumbs
hero-poster.webp	WebP	Static fallback image
Important for the 3D artist: Render the oven body and door from the same camera angle, lens, lighting, and perspective. Supply the door as a separate render with a transparent background and its hinge position aligned precisely. Otherwise, the door will appear to slide or detach instead of opening realistically.

A single photograph cannot convincingly produce this effect. For maximum realism, render the separate layers from Blender or another 3D application; use a short pre-rendered image sequence if the door's perspective and reflections need to change substantially during rotation.

Suggested asset sizes:
- Oven body: approximately 1,600–2,400 px wide.
- Door and interior: matching canvas dimensions to preserve alignment.
- Cookie: approximately 600–1,000 px wide.
- Mobile assets: use separately composed renders where possible.
4. HTML structure
Create a dedicated hero section, keep its visual layers separate, and place the product section immediately after it.

<main>
  <section class="oven-story" id="ovenStory">
    <div class="oven-stage">

      <div class="hero-copy">
        <p class="eyebrow">NILGIRIBYTES · BAKED WITH CARE</p>
        <h1>Crafted by Heat.<br />Made to Delight.</h1>
        <p>Freshly baked favourites, made for life's sweetest moments.</p>
        <a href="#products" class="hero-cta">
          Explore Our Bakery
        </a>
      </div>

      <div class="oven-scene" aria-hidden="true">
        <img class="oven-interior"
             src="assets/images/oven-interior.webp" alt="" />

        <img class="oven-body"
             src="assets/images/oven-body.webp" alt="" />

        <img class="oven-door"
             src="assets/images/oven-door.webp" alt="" />

        <img class="oven-glow"
             src="assets/images/oven-glow.webp" alt="" />

        <div class="cookie-flight">
          <img class="hero-cookie"
               src="assets/images/cookie.webp" alt="" />
        </div>
      </div>

      <div class="scroll-hint">SCROLL TO DISCOVER ↓</div>
    </div>
  </section>

  <section class="products" id="products">
    <p class="eyebrow">FRESH FROM OUR BAKERY</p>
    <h2>Discover Our Favourites</h2>
    <!-- Product cards go here -->
  </section>
</main>



Keep oven-scene and its child layers positioned relative to a common container. Do not animate the pinned .oven-stage itself; animate the elements inside it.
5. CSS foundation

:root {
  --chocolate: #35170F;
  --gold: #C79A42;
  --cream: #FBF7EF;
  --ivory: #F2E4C5;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: auto;
}

body {
  margin: 0;
  color: var(--cream);
  background: var(--chocolate);
  font-family: Inter, Arial, sans-serif;
}

.oven-story {
  position: relative;
  background:
    radial-gradient(ellipse at 75% 48%,
      #68402A 0%, #35170F 42%, #21130F 100%);
}

.oven-stage {
  position: relative;
  height: 100svh;
  min-height: 620px;
  overflow: hidden;
  isolation: isolate;
}

.hero-copy {
  position: absolute;
  z-index: 5;
  left: 7%;
  top: 50%;
  width: min(42%, 560px);
  transform: translateY(-50%);
}

.hero-copy h1 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(2.8rem, 5.5vw, 5.8rem);
  line-height: 0.98;
  letter-spacing: -0.04em;
}

.eyebrow {
  color: var(--gold);
  letter-spacing: 0.18em;
  font-size: 0.75rem;
  font-weight: 700;
}

.oven-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.oven-body,
.oven-door,
.oven-interior,
.oven-glow {
  position: absolute;
  width: min(70vw, 1050px);
  right: -3%;
  bottom: 2%;
  height: auto;
  object-fit: contain;
  transform-origin: center;
}

.oven-interior {
  z-index: 1;
}

.oven-body {
  z-index: 3;
}

.oven-door {
  z-index: 4;
  transform-origin: 8% 50%; /* Tune to the rendered hinge */
}

.oven-glow {
  z-index: 2;
  opacity: 0;
  mix-blend-mode: screen;
}

.cookie-flight {
  position: absolute;
  z-index: 6;
  left: 65%;
  top: 47%;
  width: clamp(100px, 12vw, 190px);
  opacity: 0;
}

.hero-cookie {
  display: block;
  width: 100%;
  height: auto;
}

.products {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  padding: 100px 7%;
  color: var(--chocolate);
  background: var(--cream);
}

@media (max-width: 760px) {
  .oven-stage {
    min-height: 720px;
  }

  .hero-copy {
    top: 12%;
    left: 7%;
    width: 86%;
    transform: none;
  }

  .oven-body,
  .oven-door,
  .oven-interior,
  .oven-glow {
    width: 115vw;
    right: -20%;
    bottom: 5%;
  }

  .cookie-flight {
    left: 55%;
    top: 63%;
    width: 100px;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}



The door's transform-origin is only an initial placeholder. Tune it using the actual hinge position in the final render; the correct value may be a left, right, top, or bottom hinge depending on the industrial door design.
6. GSAP + ScrollTrigger implementation
Include GSAP and ScrollTrigger in your page. For a simple static HTML project, CDN scripts are sufficient; alternatively, install GSAP through npm and bundle it with your existing build process. See the official ScrollTrigger documentation. 

Docs & Learning
+1




<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/ScrollTrigger.min.js"></script>
<script src="js/oven-scroll-animation.js"></script>




gsap.registerPlugin(ScrollTrigger);

const mm = gsap.matchMedia();

mm.add(
  {
    desktop: "(min-width: 761px)",
    mobile: "(max-width: 760px)",
    reduceMotion: "(prefers-reduced-motion: reduce)"
  },
  (context) => {
    const { desktop, reduceMotion } = context.conditions;

    const ovenBody = document.querySelector(".oven-body");
    const ovenDoor = document.querySelector(".oven-door");
    const interior = document.querySelector(".oven-interior");
    const glow = document.querySelector(".oven-glow");
    const cookie = document.querySelector(".cookie-flight");
    const copy = document.querySelector(".hero-copy");
    const products = document.querySelector(".products");

    if (!ovenBody || !ovenDoor || !cookie) return;

    // Accessible static state: don't pin or run the full sequence.
    if (reduceMotion) {
      gsap.set(
        [ovenBody, interior, ovenDoor],
        { clearProps: "transform,opacity" }
      );
      gsap.set(glow, { opacity: 0.15 });
      gsap.set(cookie, { opacity: 1, y: 0, rotation: 0 });
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: ".oven-story",
        start: "top top",
        end: () => `+=${desktop ? 2600 : 1700}`,
        scrub: 0.8,
        pin: ".oven-stage",
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    // 0–20%: machine moves into the scene.
    tl.fromTo(
      ovenBody,
      { y: 140, scale: desktop ? 0.88 : 0.82, opacity: 0.3 },
      { y: 0, scale: 1, opacity: 1, duration: 2 }
    );

    tl.fromTo(
      copy,
      { x: -35, opacity: 0 },
      { x: 0, opacity: 1, duration: 1 },
      0.5
    );

    // 20–45%: reveal the chamber and open the door.
    tl.to(glow, { opacity: 0.9, duration: 1 }, 1.7);

    tl.to(
      ovenDoor,
      { rotationY: -78, transformPerspective: 1200, duration: 2 },
      2
    );

    // 45–72%: one cookie drops out of the chamber.
    tl.fromTo(
      cookie,
      { x: 0, y: -20, rotation: -10, opacity: 0, scale: 0.75 },
      { x: desktop ? 130 : 50, y: 250, rotation: 300,
        opacity: 1, scale: 1, duration: 2.2 },
      3.6
    );

    // 72–100%: cookie settles and hero copy yields to products.
    tl.to(cookie, {
      x: desktop ? 210 : 70,
      y: desktop ? 420 : 330,
      rotation: 350,
      scale: 0.88,
      duration: 1.4
    }, 5.8);

    tl.to(copy, { opacity: 0, y: -30, duration: 1 }, 6.2);
    tl.to(glow, { opacity: 0.25, duration: 1 }, 6.3);

    // Products already follows the pinned hero in document flow.
    // This tween is optional; use it only if a separate visual
    // transition layer has been prepared.
    if (products) {
      tl.to(".oven-scene", { opacity: 0.25, duration: 1 }, 6.5);
    }

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }
);



Animation implementation notes
The code above is a starting scaffold, not a finished production animation. The final positions, door rotation, and cookie path must be tuned against the actual renders.
- Door perspective: CSS rotationY only looks convincing when the door layer's camera angle and hinge are aligned. For a door that swings outward toward the viewer, render a few intermediate door positions or use a 3D model/sequence.
- Cookie path: For a more natural fall, use gsap.to() with a carefully tuned curved path via GSAP MotionPathPlugin, or sequence several X/Y/rotation tweens. Make sure the cookie visibly emerges from the actual chamber opening.
- Product transition: The products section should remain in normal document flow after the pinned hero. Don't pin both sections unless a deliberate overlapping transition is required.
- Scroll length: Adjust end after testing. The 2,600 px setting is a starting point, not a requirement.
- Responsive setup: gsap.matchMedia() automatically manages media-query-specific animations and supports reduced-motion preferences. 
  
  Docs & Learning
  +1
7. How to get a truly photorealistic result
There are two practical implementation routes.
Option A — Rendered layers
Best starting point
Create the industrial oven, open-door, and cookie assets in Blender. Use transparent renders and animate them using GSAP. This is easier to optimize for a static website and gives you a controlled cinematic look.

Option B — Real 3D model
Use a properly optimized GLB model with Three.js or another WebGL renderer, then connect the camera, door hinge, lights, and cookie motion to scroll progress. This provides more natural perspective changes, but requires more development and performance testing.

For this project, start with Option A. If the door must swing fully into depth and reveal new surfaces, use pre-rendered door-angle frames or a real 3D model rather than trying to fake every reflection with CSS.
8. Performance and quality checklist
- [ ] Lazy-load non-hero product images, but preload the hero poster and critical oven assets.
- [ ] Export transparent assets with optimized dimensions and file sizes.
- [ ] Animate transform and opacity wherever possible.
- [ ] Avoid heavy continuous blur, full-screen video, or excessive particle effects.
- [ ] Provide a static hero fallback for reduced motion and weaker devices.
- [ ] Test touch scrolling, browser resizing, reverse scrolling, and mobile portrait layouts.
- [ ] Ensure the page works with JavaScript disabled at least as a static storefront.
- [ ] Test with real product images and on a mid-range phone before deployment.
Definition of done: The machine looks industrial and photorealistic; the door opens from the correct hinge; exactly one cookie emerges from the chamber; the sequence reverses naturally when scrolling upward; and the products section remains readable, accessible, and fast.