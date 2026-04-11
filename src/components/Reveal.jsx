import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils.js";

export default function Reveal({
  as: Comp = "div",
  className,
  children,
  delayMs = 0,
}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { root: null, threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Comp
      ref={ref}
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        "will-change-transform",
        isVisible ? "animate-fade-up" : "opacity-0 translate-y-3",
        className
      )}
    >
      {children}
    </Comp>
  );
}

