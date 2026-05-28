import { useState, useRef, useEffect } from 'react';
import { Brain, Shield, FileCheck, Lock } from 'lucide-react';

const FEATURES = [
  {
    icon: Brain,
    label: 'Live Assist',
    title: 'Whisper Copilot',
    description:
      'Real-time cues during active conversations. Deterministic, fast, earbud-optimized. No noise — only signal when you need it.',
  },
  {
    icon: Shield,
    label: 'Adaptive Brain',
    title: 'Safe Personalization',
    description:
      'Confirmed profile facts, proposed skills, reflections, and feedback loops. No hidden memory writes. You approve every fact.',
  },
  {
    icon: FileCheck,
    label: 'Daily Brain',
    title: 'Life Intelligence',
    description:
      'Daily briefs, commitment tracker, personal task inbox, follow-up detector, meeting prep & recap packs, weekly review.',
  },
  {
    icon: Lock,
    label: 'Action Approval',
    title: 'Proposal-First',
    description:
      'Proposals, not autonomous actions. Drafts, calendar event ideas, reminders — all require explicit user approval before execution.',
  },
];

function PaperLedger({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const Icon = feature.icon;

  const sliceCount = 4;
  const sliceWidth = 100 / sliceCount;

  return (
    <div
      ref={cardRef}
      className="relative"
      style={{ perspective: '2000px' }}
    >
      <div
        className={`relative transition-all duration-700`}
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
          transitionDelay: `${index * 100}ms`,
        }}
      >
        {/* Front face with slices */}
        <div
          className="relative w-full h-[320px] lg:h-[380px]"
          style={{
            backfaceVisibility: 'visible',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Slice panels */}
          {Array.from({ length: sliceCount }).map((_, sliceIdx) => (
            <div
              key={sliceIdx}
              className="absolute top-0 h-full overflow-hidden"
              style={{
                left: `${sliceIdx * sliceWidth}%`,
                width: `${sliceWidth}%`,
                transformStyle: 'preserve-3d',
                transformOrigin: sliceIdx < sliceCount / 2 ? 'left center' : 'right center',
                transform: flipped
                  ? `rotateY(${sliceIdx < sliceCount / 2 ? '-' : ''}${2 + sliceIdx * 0.5}deg)`
                  : 'rotateY(0deg)',
                transition: `transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${sliceIdx * 30}ms`,
              }}
            >
              <div
                className="h-full bg-newsprint-gray border border-pitch-black flex flex-col justify-center p-6 lg:p-8"
                style={{
                  width: `${100 * sliceCount}%`,
                  marginLeft: `${-sliceIdx * 100}%`,
                }}
              >
                {sliceIdx === 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <Icon className="w-5 h-5 text-pitch-black" strokeWidth={1.5} />
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ash-gray">
                        {feature.label}
                      </span>
                    </div>
                    <h3 className="font-geist font-black text-2xl lg:text-3xl text-pitch-black tracking-tight mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-pitch-black/60 text-sm leading-relaxed max-w-xs">
                      {feature.description}
                    </p>
                    <div className="mt-6 flex items-center gap-2">
                      <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-ash-gray">
                        Click to explore
                      </span>
                      <span className="w-4 h-px bg-ash-gray" />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Back face */}
          <div
            className="absolute inset-0 bg-pure-white border border-pitch-black flex flex-col justify-center p-6 lg:p-8"
            style={{
              backfaceVisibility: 'visible',
              transform: 'rotateY(-180deg)',
            }}
          >
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-neon-signal mb-4">
              {feature.label} — Technical Spec
            </span>
            <h4 className="font-geist font-black text-xl text-pitch-black mb-4">
              Architecture Details
            </h4>
            <ul className="space-y-2">
              {[
                'Consent-gated session start',
                'Deterministic fast paths before LLM calls',
                'Screen-only reports for long research',
                'Reviewable memory, skills, and action proposals',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-pitch-black/70">
                  <span className="w-1 h-1 rounded-full bg-neon-signal mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Click handler overlay */}
        <button
          onClick={() => setFlipped(!flipped)}
          className="absolute inset-0 z-10 bg-transparent interactive"
          data-cursor-text={flipped ? 'CLOSE' : 'OPEN'}
          aria-label={`Toggle ${feature.title} details`}
        />
      </div>
    </div>
  );
}

export default function MemoryArchitecture() {
  const [headerInView, setHeaderInView] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHeaderInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="relative w-full bg-ledger-white py-32 lg:py-40">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div
          ref={headerRef}
          className={`mb-20 lg:mb-28 transition-all duration-700 ${
            headerInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-ash-gray mb-4">
            The Memory Architecture
          </p>
          <h2 className="font-geist font-black text-4xl sm:text-5xl lg:text-6xl text-pitch-black tracking-tight max-w-3xl">
            Intelligence that remembers,
            <br />
            <span className="text-ash-gray">without surveillance</span>
          </h2>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {FEATURES.map((feature, index) => (
            <PaperLedger key={feature.label} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
