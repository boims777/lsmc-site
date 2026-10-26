// Инициализация плавного скролла Lenis
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Интеграция Lenis с GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// Анимации появления (Staggered Text Reveal)
document.addEventListener("DOMContentLoaded", () => {
    // Анимация для Hero секции
    const tl = gsap.timeline();
    tl.to(".reveal-text h1", { y: 0, opacity: 1, duration: 1, ease: "power4.out", delay: 0.2 })
      .to(".reveal-text p", { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.6")
      .to(".reveal-btn", { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.6");

    // Анимация карточек при скролле
    gsap.utils.toArray('.about-card, .dept-card, .staff-card, .fleet-card, .shop-item').forEach(card => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: "top 85%",
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out"
        });
    });

    // Параллакс для баннера (если он есть)
    const banner = document.querySelector(".staff-banner");
    if (banner) {
        gsap.to(banner, {
            scrollTrigger: {
                trigger: banner,
                start: "top top",
                end: "bottom top",
                scrub: true
            },
            y: 100,
            ease: "none"
        });
    }
});