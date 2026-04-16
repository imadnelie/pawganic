import { useEffect, useMemo, useRef, useState } from "react";

import why01 from "../../imgs/Why/why01.jpeg";
import why02 from "../../imgs/Why/why02.jpeg";
import why03 from "../../imgs/Why/why03.jpeg";
import why04 from "../../imgs/Why/why04.jpeg";

const AUTOPLAY_MS = 4500;
const RESUME_AFTER_INTERACTION_MS = 7000;

const slides = [
  { src: why01, alt: "Pawganic ingredients and preparation" },
  { src: why02, alt: "Fresh, human-grade food for dogs" },
  { src: why03, alt: "Balanced nutrition made with care" },
  { src: why04, alt: "Healthy meals supporting visible results" },
];

export default function WhySlider({ fill = false }) {
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
    <div
      className={`group relative overflow-hidden rounded-3xl border border-forest/10 bg-white shadow-soft ${
        fill ? "h-full" : ""
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={pauseTemporarily}
    >
      <div
        className={`relative w-full overflow-hidden bg-cream ${
          fill ? "h-full min-h-full" : "aspect-square"
        }`}
      >
        <div
          className="flex h-full w-full transition-transform duration-700 ease-out"
          style={slideOffset}
        >
          {slides.map((slide) => (
            <div key={slide.src} className="h-full min-w-full">
              <img
                src={slide.src}
                alt={slide.alt}
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Previous image"
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
          aria-label="Next image"
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
            aria-label={`Go to image ${index + 1}`}
            aria-current={currentIndex === index ? "true" : "false"}
            className={`h-2.5 w-2.5 rounded-full transition ${
              currentIndex === index ? "bg-white" : "bg-white/55 hover:bg-white/75"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

