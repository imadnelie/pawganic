import { useEffect, useMemo, useRef, useState } from "react";

import slide01 from "../../imgs/Slider/01.jpeg";
import slide02 from "../../imgs/Slider/02.jpeg";
import slide03 from "../../imgs/Slider/03.jpeg";
import slide04 from "../../imgs/Slider/04.jpeg";

const AUTOPLAY_MS = 4500;
const RESUME_AFTER_INTERACTION_MS = 7000;

const slides = [
  { src: slide01, alt: "Pawganic meal container" },
  { src: slide02, alt: "Prepared ingredients for Pawganic meals" },
  { src: slide03, alt: "Pawganic food close-up" },
  { src: slide04, alt: "Homemade organic dog food" },
];

export default function HomepageSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimeoutRef = useRef(null);

  const totalSlides = slides.length;

  const goToSlide = (nextIndex) => {
    setCurrentIndex((nextIndex + totalSlides) % totalSlides);
  };

  const pauseTemporarily = () => {
    setIsPaused(true);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, RESUME_AFTER_INTERACTION_MS);
  };

  useEffect(() => {
    if (isPaused || totalSlides <= 1) return undefined;
    const autoplay = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, AUTOPLAY_MS);
    return () => clearInterval(autoplay);
  }, [isPaused, totalSlides]);

  useEffect(
    () => () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    },
    []
  );

  const slideOffset = useMemo(
    () => ({ transform: `translateX(-${currentIndex * 100}%)` }),
    [currentIndex]
  );

  return (
    <section className="pt-4 sm:pt-6">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div
          className="group relative overflow-hidden rounded-3xl border border-forest/10 bg-white shadow-soft"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={pauseTemporarily}
        >
          <div className="relative w-full overflow-hidden bg-white aspect-[3/2]">
            <div
              className="flex h-full w-full transition-transform duration-700 ease-out"
              style={slideOffset}
            >
              {slides.map((slide) => (
                <div key={slide.src} className="h-full min-w-full">
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className="h-full w-full object-contain object-center"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => {
                pauseTemporarily();
                goToSlide(currentIndex - 1);
              }}
              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/85 text-slate-900 shadow-soft transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-white/60 sm:left-4"
            >
              <span aria-hidden="true">‹</span>
            </button>

            <button
              type="button"
              aria-label="Next slide"
              onClick={() => {
                pauseTemporarily();
                goToSlide(currentIndex + 1);
              }}
              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/85 text-slate-900 shadow-soft transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-white/60 sm:right-4"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur-sm sm:bottom-4">
            {slides.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => {
                  pauseTemporarily();
                  goToSlide(index);
                }}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={currentIndex === index ? "true" : "false"}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  currentIndex === index ? "bg-white" : "bg-white/55 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

