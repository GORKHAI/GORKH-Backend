import { useRef, useState, useEffect } from 'react';

const TRUST_ITEMS = [
  {
    quote: "Live sessions are explicit. The microphone path opens only after consent, and discarded sessions are wiped instead of used for memory.",
    name: 'Consent-first',
    role: 'Session privacy',
  },
  {
    quote: "Research answers are source-backed when a provider is configured. If research is unavailable, GORKH returns provider_not_configured instead of inventing citations.",
    name: 'No fake sources',
    role: 'Research integrity',
  },
  {
    quote: "External actions are proposal-first. Drafts, calendar ideas, connector actions, and learned skills require review before anything can move forward.",
    name: 'Approval required',
    role: 'Action control',
  },
];

const CAPABILITIES = [
  'Voice Gateway',
  'Adaptive Brain',
  'Daily Brief',
  'Research Quality',
  'Action Approval',
  'Read-only Calendar',
];

export default function SocialProof() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative w-full bg-ledger-white py-32 lg:py-40">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Capability marquee */}
        <div
          className={`mb-20 overflow-hidden transition-all duration-700 ${
            inView ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-ash-gray mb-8 text-center">
            Built for
          </p>
          <div className="relative">
            <div className="flex animate-marquee whitespace-nowrap">
              {[...CAPABILITIES, ...CAPABILITIES].map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="mx-8 lg:mx-12 font-geist font-black text-2xl lg:text-3xl text-pitch-black/10 tracking-tight"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Trust model */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {TRUST_ITEMS.map((t, index) => (
            <div
              key={t.name}
              className={`transition-all duration-700 ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${(index + 1) * 150}ms` }}
            >
              <blockquote className="text-pitch-black text-lg lg:text-xl leading-relaxed mb-6">
                {t.quote}
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pitch-black flex items-center justify-center">
                  <span className="text-pure-white font-geist font-bold text-sm">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-geist font-semibold text-sm text-pitch-black">
                    {t.name}
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-ash-gray">
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div
          className={`mt-24 lg:mt-32 pt-12 border-t border-pitch-black/10 transition-all duration-700 delay-500 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 'Live', label: 'API + gateway' },
              { value: 'Read-only', label: 'Calendar v0' },
              { value: 'Approval', label: 'External actions' },
              { value: 'Source-backed', label: 'Research rule' },
            ].map((metric) => (
              <div key={metric.label} className="text-center">
                <p className="font-geist font-black text-3xl lg:text-4xl text-pitch-black">
                  {metric.value}
                </p>
                <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mt-2">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
