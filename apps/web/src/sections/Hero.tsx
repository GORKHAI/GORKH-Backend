import { useEffect, useRef } from 'react';

const LEFT_TERMS = [
  'TRIGGER_CLASSIFY', 'LIVE_ASSIST', 'WHISPER_COPILOT', 'EARBUD_CUE', 'SESSION_START',
  'CONSENT_GRANTED', 'SITUATION_BRIEF', 'CONTEXT_MAP', 'MEMORY_EXTRACT', 'PROFILE_BUILD',
  'DETERMINISTIC', 'FAST_RESPONSE', 'NOISE_FILTER', 'SIGNAL_ONLY', 'ACTION_PROPOSE',
  'USER_APPROVE', 'DRAFT_CREATE', 'REMINDER_SET', 'CALENDAR_SYNC', 'FOLLOW_UP',
  'STRESS_DETECT', 'GROUNDING_EXERCISE', 'BREATHE_PROMPT', 'PAUSE_SUGGEST', 'CRISIS_BOUNDARY',
  'RESEARCH_LIVE', 'SOURCE_VERIFY', 'CITATION_REAL', 'RATE_CHECK', 'LAW_LOOKUP',
  'VISIT_PREP', 'COMPANY_BRIEF', 'INTERVIEW_READY', 'NEGOTIATION_SET', 'MEETING_PREP',
  'ADAPTIVE_BRAIN', 'DAILY_BRIEF', 'COMMIT_TRACK', 'TASK_INBOX', 'WEEKLY_REVIEW',
  'SKILL_BUILD', 'REFLECTION_LOG', 'FEEDBACK_LOOP', 'FACT_CONFIRM', 'PRIVACY_CORE',
];

const RIGHT_TERMS = [
  'AUDIO_PCM', 'SOCKET_OPEN', 'ASR_STREAM', 'MICROPHONE_SAFE', 'TRACK_STOP',
  'DISCONNECT_CLEAN', 'RETENTION_USER', 'SAVE_TRUE', 'SAVE_FALSE', 'DISCARD_WIPE',
  'NO_HIDDEN_WRITE', 'NO_AUTO_MEMORY', 'INTERRUPT_SAFE', 'PROPOSE_ONLY', 'NO_AUTONOMY',
  'TOKEN_ENCRYPT', 'VAULT_SECURE', 'NO_LOG_EXPOSE', 'JWT_SAFE', 'KEY_PROTECT',
  'GOOGLE_READ', 'NO_CREATE_CAL', 'DISCONNECT_DELETE', 'READONLY_SCOPE', 'EVENT_FETCH',
  'FACT_LOW_RISK', 'SENSITIVE_OPTIN', 'STRESS_OPTIN', 'PROFILE_REVIEW', 'REJECT_FREE',
  'CONFIRM_EXPLICIT', 'NO_INFER_AUTO', 'HEALTH_BOUNDARY', 'RELATIONSHIP_SAFE', 'FINANCIAL_GUARD',
  'PROVIDER_CHECK', 'NO_FABRICATE', 'SOURCE_BACKED', 'CITATION_REAL', 'RESEARCH_HONEST',
  'SESSION_EXPLICIT', 'CONSENT_FIRST', 'PRIVACY_ARCH', 'ZERO_SURVEIL', 'RADICAL_TRANS',
];

function buildColumn(terms: string[], offset: number) {
  let text = '';
  for (let i = 0; i < 40; i++) {
    const line = [];
    for (let j = 0; j < 6; j++) {
      line.push(terms[(i * 7 + j * 11 + offset) % terms.length]);
    }
    text += line.join('  ') + '  ';
  }
  return text;
}

const LEFT_COLUMN = buildColumn(LEFT_TERMS, 3);
const RIGHT_COLUMN = buildColumn(RIGHT_TERMS, 9);

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      container.style.setProperty('--cursor-x', `${mouseRef.current.x}px`);
      container.style.setProperty('--cursor-y', `${mouseRef.current.y}px`);
    };

    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative w-full h-screen overflow-hidden bg-pitch-black">
      {/* SVG Filter for ink bleed effect */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter
            id="newsprint-distort"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            filterUnits="objectBoundingBox"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves="3"
              result="warp"
            />
            <feOffset dx="-10" in="SourceGraphic" result="domainOffset" />
            <feDisplacementMap
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
              in="domainOffset"
              in2="warp"
            />
            <feGaussianBlur stdDeviation="2" in="SourceGraphic" result="blur" />
            <feColorMatrix
              type="matrix"
              in="blur"
              values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>

      {/* Dual-column text grid */}
      <div
        ref={containerRef}
        className="hero-grid-container relative flex flex-row justify-around w-full h-full"
        style={{
          '--cursor-x': '50%',
          '--cursor-y': '50%',
        } as React.CSSProperties}
      >
        {/* Left column */}
        <div className="relative w-[40%] h-full font-mono text-[0.7rem] leading-relaxed text-pure-white/60 z-[1] p-8 overflow-hidden select-none">
          <div className="whitespace-pre-wrap break-all opacity-40">
            {LEFT_COLUMN}
          </div>
        </div>

        {/* Right column */}
        <div className="relative w-[40%] h-full font-mono text-[0.7rem] leading-relaxed text-pure-white/60 z-[1] p-8 overflow-hidden select-none">
          <div className="whitespace-pre-wrap break-all opacity-40">
            {RIGHT_COLUMN}
          </div>
        </div>

        {/* Newsprint scanner overlay */}
        <div
          className="newsprint-texture-layer absolute inset-0 pointer-events-none z-[3]"
          style={{
            backgroundImage: 'url(/textures/crisp_newsprint.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'contrast(1.2) brightness(0.9) sepia(30%)',
            opacity: 0.8,
            maskImage: `radial-gradient(circle 150px at var(--cursor-x) var(--cursor-y), black 20%, rgba(0, 0, 0, 0.85) 50%, rgba(0, 0, 0, 0.4) 70%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(circle 150px at var(--cursor-x) var(--cursor-y), black 20%, rgba(0, 0, 0, 0.85) 50%, rgba(0, 0, 0, 0.4) 70%, transparent 100%)`,
            mixBlendMode: 'multiply',
          }}
        />

        {/* Ink bleed distortion layer */}
        <div
          className="absolute inset-0 pointer-events-none z-[4]"
          style={{
            filter: 'url(#newsprint-distort)',
            opacity: 0.15,
            maskImage: `radial-gradient(circle 180px at var(--cursor-x) var(--cursor-y), black 10%, transparent 70%)`,
            WebkitMaskImage: `radial-gradient(circle 180px at var(--cursor-x) var(--cursor-y), black 10%, transparent 70%)`,
          }}
        />
      </div>

      {/* Hero content overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center pointer-events-auto">
          <img
            src="/images/logo.png"
            alt="GORKH"
            className="w-56 sm:w-72 lg:w-80 mx-auto mb-8 opacity-95"
          />
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-ash-gray mb-6">
            Real-time AI Situational Copilot
          </p>
          <h1 className="display-heading text-5xl sm:text-7xl lg:text-8xl text-pure-white mb-8">
            GORKH
            <br />
            <span className="text-neon-signal">The room is yours</span>
          </h1>
          <p className="text-ash-gray text-sm max-w-md mx-auto mb-10 leading-relaxed">
            In explicit, consented sessions, GORKH listens, classifies triggers, and emits tactical cues in real time.
            For bank meetings, doctor visits, negotiations, and the moments that matter.
          </p>
          <a
            href="/contact"
            className="pill-button pill-button-primary interactive"
            data-cursor-text=""
          >
            Request Access
          </a>
        </div>
      </div>

      {/* Bottom-right system badge */}
      <div className="absolute bottom-8 right-8 z-10 hidden lg:block">
        <div className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-signal animate-pulse-glow" />
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray">
            Backend: Live
          </span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-ash-gray">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-ash-gray to-transparent" />
        </div>
      </div>
    </section>
  );
}
