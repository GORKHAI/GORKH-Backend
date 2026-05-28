import { useRef, useState, useEffect } from 'react';

export default function CTASection() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-neon-signal py-32 lg:py-48 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
        <h2
          className={`font-geist font-black text-5xl sm:text-7xl lg:text-8xl text-pitch-black tracking-tight leading-none transition-all duration-1000 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          THE ROOM
          <br />
          IS YOURS
        </h2>

        <p
          className={`mt-8 text-pitch-black/60 text-sm max-w-md mx-auto leading-relaxed transition-all duration-1000 delay-200 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          GORKH is your consent-first partner for high-stakes conversations.
          Consent-first. Privacy-first. Exact when you need it.
        </p>

        <div
          className={`mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-400 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <a
            href="/contact"
            className="pill-button pill-button-inverse interactive"
            data-cursor-text=""
          >
            Request Access
          </a>
          <a
            href="/privacy"
            className="pill-button pill-button-outline interactive"
            data-cursor-text=""
          >
            Review Privacy
          </a>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-8 left-8 font-mono text-[10px] tracking-[0.2em] uppercase text-pitch-black/20">
          GORKH web
        </div>
        <div className="absolute bottom-8 right-8 font-mono text-[10px] tracking-[0.2em] uppercase text-pitch-black/20">
          API LIVE
        </div>
      </div>
    </section>
  );
}
