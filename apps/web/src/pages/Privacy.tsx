import { useState, useRef, useEffect } from 'react';
import { Shield, Lock, Eye, Volume2, Database, FileKey, Fingerprint, Zap } from 'lucide-react';
import { Seo } from '@/components/Seo';

const PRIVACY_SECTIONS = [
  {
    id: 'consent',
    icon: Shield,
    label: 'Consent-First Architecture',
    color: 'text-neon-signal',
    content: `No session starts without explicit user consent. The system checks consent.granted === true before any session is created. If consent is false, no audio pipeline opens, no ASR starts, and no data is processed. Period.`,
    technical: `consent.granted === true required before session.create()`,
  },
  {
    id: 'retention',
    icon: Database,
    label: 'Retention by User Choice',
    color: 'text-cobalt-electric',
    content: `You control what GORKH remembers. When a session ends, you choose: save it for memory extraction, or discard it entirely. Discarded sessions are wiped — transcript, cues, suggestions, agent turns, and voice outputs are all deleted. No traces remain.`,
    technical: `stop.save=false → full session discard. stop.save=true → optional memory extraction.`,
  },
  {
    id: 'memory',
    icon: Lock,
    label: 'No Hidden Memory Writes',
    color: 'text-pure-white',
    content: `GORKH does not perform background autonomous memory writes. Discarded and interrupted sessions do not trigger reflection, profile extraction, or skill creation. Memory is only written when you explicitly approve it.`,
    technical: `Discarded sessions → zero memory side effects.`,
  },
  {
    id: 'profile',
    icon: Fingerprint,
    label: 'Human Model / Profile',
    color: 'text-neon-signal',
    content: `Only low-risk facts — occupation, projects, goals, preferences, workflows — may be confirmed. Inferred facts are proposed, never auto-confirmed. Sensitive facts (stress patterns, health, relationship, legal/financial distress) require explicit opt-in and confirmation. You can inspect, confirm, or reject every fact at any time.`,
    technical: `GET /human/profile/review — full transparency on all stored facts.`,
  },
  {
    id: 'stress',
    icon: Volume2,
    label: 'Stress Support Boundaries',
    color: 'text-cobalt-electric',
    content: `Transient support can be provided in the moment — grounding, breathing, pause suggestions. Stress profile storage requires explicit opt-in. Sensitive stress facts require individual confirmation. Support, not therapy. Opt-in only.`,
    technical: `Stress storage → explicit opt-in required. In-the-moment support → no storage.`,
  },
  {
    id: 'secrets',
    icon: FileKey,
    label: 'No Secrets in Runtime',
    color: 'text-pure-white',
    content: `Provider keys, JWT secrets, tokens, and database passwords are never printed in logs, API responses, or frontend state. Connector tokens (e.g., Google Calendar) are encrypted server-side. Raw tokens are never exposed to frontend, LLM providers, logs, or API responses.`,
    technical: `Token Vault: server-side encryption. Runtime: zero secret exposure.`,
  },
  {
    id: 'calendar',
    icon: Zap,
    label: 'External Actions',
    color: 'text-neon-signal',
    content: `Proposal-first and approval-first. The system cannot send emails, messages, create calendar events, submit forms, make purchases, or execute shell/code without your explicit approval. The Google Calendar connector uses read-only scope only — no event creation, updates, deletion, or invitation sending. Disconnect deletes encrypted token material.`,
    technical: `Google Calendar: calendar.events.readonly only. All actions: user approval required.`,
  },
  {
    id: 'research',
    icon: Eye,
    label: 'Research Integrity',
    color: 'text-cobalt-electric',
    content: `If no research provider is configured, the system returns provider_not_configured and never fabricates sources or citations. All research is live and source-backed. No fake citations. No hallucinated facts.`,
    technical: `No provider configured → honest error. No fabrication.`,
  },
  {
    id: 'audio',
    icon: Volume2,
    label: 'Audio / Microphone Safety',
    color: 'text-pure-white',
    content: `Browser microphone capture starts only after consent checkbox + accepted gateway start. PCM frames are sent only while the socket is open and consent is granted. Microphone tracks are stopped on Stop, Disconnect, or socket close. Raw audio is not retained; saved sessions may keep transcripts only when you choose to save.`,
    technical: `Microphone: consent + socket open required. Stops on any disconnect.`,
  },
];

function PrivacyAccordion({
  section,
  isOpen,
  onToggle,
}: {
  section: typeof PRIVACY_SECTIONS[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = section.icon;

  return (
    <div className="border-b border-white/5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-6 lg:py-8 text-left interactive group"
        data-cursor-text=""
      >
        <div className="flex items-center gap-4 lg:gap-6">
          <Icon className={`w-5 h-5 ${section.color} flex-shrink-0`} strokeWidth={1.5} />
          <span className="font-geist font-bold text-lg lg:text-xl text-pure-white group-hover:text-neon-signal transition-colors">
            {section.label}
          </span>
        </div>
        <div
          className={`w-8 h-8 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
            isOpen ? 'bg-neon-signal border-neon-signal rotate-45' : ''
          }`}
        >
          <span className={`text-sm ${isOpen ? 'text-pitch-black' : 'text-pure-white'}`}>+</span>
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-500 ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pb-8 pl-9 lg:pl-14">
          <p className="text-ash-gray text-sm leading-relaxed max-w-2xl mb-4">
            {section.content}
          </p>
          <code className="inline-block font-mono text-[10px] tracking-wider text-neon-signal/80 bg-neon-signal/5 px-3 py-1.5 border border-neon-signal/20">
            {section.technical}
          </code>
        </div>
      </div>
    </div>
  );
}

export default function Privacy() {
  const [openSection, setOpenSection] = useState<string | null>('consent');
  const [inView, setInView] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.2 }
    );

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-pitch-black pt-32 lg:pt-40 pb-24">
      <Seo
        title="GORKH Privacy | Consent, Memory, and Action Controls"
        description="Review GORKH privacy controls for explicit sessions, retention choices, profile review, encrypted connector tokens, and no fake citations."
        path="/privacy"
      />
      <div className="max-w-4xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div
          ref={headerRef}
          className={`mb-16 lg:mb-24 transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-neon-signal mb-4">
            Transparency Report
          </p>
          <h1 className="font-geist font-black text-4xl sm:text-5xl lg:text-6xl text-pure-white tracking-tight mb-6">
            Privacy Policy
          </h1>
          <p className="text-ash-gray text-sm max-w-lg leading-relaxed">
            GORKH's privacy architecture is not an afterthought — it is the foundation.
            Every design decision starts with the question: does this respect the user's autonomy?
            Below is our complete transparency report.
          </p>
        </div>

        {/* Status indicator */}
        <div
          className={`mb-12 flex items-center gap-3 p-4 border border-neon-signal/20 bg-neon-signal/5 transition-all duration-700 delay-200 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-neon-signal animate-pulse-glow" />
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-neon-signal">
            Privacy controls active — Last reviewed: {new Date().toLocaleDateString()}
          </span>
        </div>

        {/* Accordion */}
        <div className="border-t border-white/5">
          {PRIVACY_SECTIONS.map((section) => (
            <PrivacyAccordion
              key={section.id}
              section={section}
              isOpen={openSection === section.id}
              onToggle={() =>
                setOpenSection(openSection === section.id ? null : section.id)
              }
            />
          ))}
        </div>

        {/* Contact */}
        <div className="mt-20 pt-12 border-t border-white/5">
          <p className="text-ash-gray text-sm mb-4">
            Questions about our privacy practices?
          </p>
          <a
            href="mailto:privacy@gorkh.com"
            className="font-geist font-semibold text-pure-white hover:text-neon-signal transition-colors interactive"
            data-cursor-text=""
          >
            privacy@gorkh.com
          </a>
        </div>
      </div>
    </main>
  );
}
