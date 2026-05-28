import { useRef, useState, useEffect } from 'react';
import { Seo } from '@/components/Seo';

const PRINCIPLES = [
  {
    number: '01',
    title: 'Explicit Session',
    description:
      'GORKH is never "always on." Every session is deliberately created for a specific situation. You define the context, you start the session, you control when it ends. There is no ambient listening, no background surveillance, no passive data collection.',
  },
  {
    number: '02',
    title: 'Deterministic Over Chatty',
    description:
      'GORKH is built to avoid chatty interruption. In live mode, it emits precise, contextual cues that help you stay present in the room. Preparation and daily planning can be conversational; earbuds stay signal-only.',
  },
  {
    number: '03',
    title: 'Consent as Architecture',
    description:
      'Consent is not a checkbox in a terms-of-service dialog. It is the gate through which every system flows. No audio without consent. No memory without consent. No external action without consent. The architecture fails safe.',
  },
  {
    number: '04',
    title: 'Radical Transparency',
    description:
      'Every fact GORKH knows about you, you can review. Every session it stores, you can delete. Every action it proposes, you must approve. There are no hidden inference layers, no shadow profiles, no dark patterns.',
  },
  {
    number: '05',
    title: 'Support, Not Therapy',
    description:
      'GORKH provides in-the-moment grounding, breathing prompts, and pause suggestions. It does not diagnose, treat, or replace professional mental health care. Stress profile storage requires explicit opt-in. Boundaries are hard-coded.',
  },
];

export default function About() {
  const [inView, setInView] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.1 }
    );

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-pitch-black pt-32 lg:pt-40 pb-24">
      <Seo
        title="About GORKH | Consent-First AI Copilot"
        description="Learn how GORKH uses explicit sessions, consent gates, safe personalization, and approval-first actions for high-stakes moments."
        path="/about"
      />
      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        {/* Hero */}
        <div
          ref={headerRef}
          className={`mb-24 lg:mb-40 transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-neon-signal mb-6">
            Manifesto
          </p>
          <h1 className="font-geist font-black text-4xl sm:text-6xl lg:text-7xl text-pure-white tracking-tight leading-[1.05] max-w-4xl">
            We built GORKH because the room deserves
            <span className="text-ash-gray"> better tools</span>
          </h1>
          <p className="mt-8 text-ash-gray text-base max-w-2xl leading-relaxed">
            In a world of always-on AI assistants that surveil, store, and sell,
            we chose a different path. GORKH exists for the moments that matter —
            the negotiation, the doctor visit, the interview, the difficult conversation.
            Moments where precision, privacy, and presence are non-negotiable.
          </p>
        </div>

        {/* Origin story */}
        <div
          className={`mb-24 lg:mb-40 transition-all duration-700 delay-200 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            <div>
              <h2 className="font-geist font-black text-2xl lg:text-3xl text-pure-white tracking-tight mb-6">
                The Problem with "Always On"
              </h2>
              <div className="space-y-4 text-ash-gray text-sm leading-relaxed">
                <p>
                  Most AI assistants are designed to be omnipresent. They listen constantly,
                  store everything, and infer patterns you never agreed to share. This architecture
                  creates fundamental conflicts with privacy, autonomy, and trust.
                </p>
                <p>
                  For high-stakes situations — a bank meeting, a doctor visit, a salary negotiation —
                  this model is broken. You need a tool that is invisible until you need it,
                  exact when you activate it, and completely under your control.
                </p>
              </div>
            </div>
            <div>
              <h2 className="font-geist font-black text-2xl lg:text-3xl text-pure-white tracking-tight mb-6">
                The Explicit Session Model
              </h2>
              <div className="space-y-4 text-ash-gray text-sm leading-relaxed">
                <p>
                  GORKH inverts the paradigm. Instead of always-on surveillance,
                  you create explicit sessions for specific situations. You describe the context,
                  GORKH prepares, and when you enter the room, it provides real-time tactical support.
                </p>
                <p>
                  When the session ends, you decide what happens to the data.
                  Save it for future preparation, or discard it entirely.
                  No hidden memory writes. No shadow profiles. No surprises.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Principles */}
        <div className="mb-24 lg:mb-40">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-ash-gray mb-12">
            Design Principles
          </p>
          <div className="space-y-0">
            {PRINCIPLES.map((principle, index) => (
              <div
                key={principle.number}
                className={`group border-t border-white/5 py-10 lg:py-14 transition-all duration-700 ${
                  inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${(index + 3) * 100}ms` }}
              >
                <div className="grid grid-cols-12 gap-4 lg:gap-8">
                  <div className="col-span-2 lg:col-span-1">
                    <span className="font-mono text-[10px] tracking-wider text-ash-gray">
                      {principle.number}
                    </span>
                  </div>
                  <div className="col-span-10 lg:col-span-4">
                    <h3 className="font-geist font-bold text-xl lg:text-2xl text-pure-white group-hover:text-neon-signal transition-colors">
                      {principle.title}
                    </h3>
                  </div>
                  <div className="col-span-12 lg:col-span-7 lg:col-start-6">
                    <p className="text-ash-gray text-sm leading-relaxed">
                      {principle.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Closing statement */}
        <div
          className={`text-center transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="font-geist font-black text-3xl lg:text-5xl text-pure-white tracking-tight mb-6">
            The room is yours.
          </p>
          <p className="text-ash-gray text-sm max-w-lg mx-auto leading-relaxed">
            GORKH exists to make sure you never walk into it unprepared.
          </p>
        </div>
      </div>
    </main>
  );
}
