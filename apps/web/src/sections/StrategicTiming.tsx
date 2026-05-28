import { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, Users, FileText } from 'lucide-react';

const CALENDAR_DAYS = [
  { day: 1, label: 'Mon', hasEvent: true },
  { day: 2, label: 'Tue', hasEvent: false },
  { day: 3, label: 'Wed', hasEvent: true },
  { day: 4, label: 'Thu', hasEvent: false },
  { day: 5, label: 'Fri', hasEvent: true },
  { day: 6, label: 'Sat', hasEvent: false },
  { day: 7, label: 'Sun', hasEvent: false },
];

const EVENTS = [
  {
    day: 1,
    time: '09:30',
    title: 'Bank Meeting — Loan Renegotiation',
    icon: Users,
    prep: ['APR questions', 'Fee checklist', 'Written terms to request'],
  },
  {
    day: 3,
    time: '14:00',
    title: 'Quarterly Review with Board',
    icon: FileText,
    prep: ['Key decisions', 'Open risks', 'Follow-up owners'],
  },
  {
    day: 5,
    time: '11:00',
    title: 'Medical Consultation — Cardiology',
    icon: Users,
    prep: ['Question list', 'Symptom timeline', 'Medication notes to verify'],
  },
];

export default function StrategicTiming() {
  const [flipped, setFlipped] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative w-full bg-pitch-black py-32 lg:py-40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div
          className={`mb-16 lg:mb-24 transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-ash-gray mb-4">
            Strategic Timing
          </p>
          <h2 className="font-geist font-black text-4xl sm:text-5xl lg:text-6xl text-pure-white tracking-tight max-w-3xl">
            Prepared before
            <br />
            <span className="text-neon-signal">you walk in</span>
          </h2>
          <p className="mt-6 text-ash-gray text-sm max-w-lg leading-relaxed">
            When you connect read-only calendar context or create a situation brief, GORKH helps
            prepare questions, risks, and tactical cues before the meeting starts.
          </p>
        </div>

        {/* 3D Paper Calendar */}
        <div
          className="relative max-w-4xl mx-auto"
          style={{ perspective: '2000px' }}
        >
          <div
            className="relative transition-transform duration-700"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateX(-5deg) rotateY(-180deg)' : 'rotateX(0deg) rotateY(0deg)',
            }}
          >
            {/* Front - Calendar */}
            <div
              className="relative bg-newsprint-gray border border-pitch-black p-8 lg:p-12"
              style={{
                backfaceVisibility: 'visible',
                transformStyle: 'preserve-3d',
                minHeight: '400px',
              }}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ash-gray">
                    This Week
                  </span>
                  <h3 className="font-geist font-black text-2xl text-pitch-black mt-1">
                    Upcoming Briefings
                  </h3>
                </div>
                <Calendar className="w-6 h-6 text-pitch-black" strokeWidth={1.5} />
              </div>

              <div className="grid grid-cols-7 gap-2 mb-8">
                {CALENDAR_DAYS.map(({ day, label, hasEvent }) => (
                  <div
                    key={day}
                    className={`aspect-square flex flex-col items-center justify-center border ${
                      hasEvent
                        ? 'border-pitch-black bg-pitch-black text-pure-white'
                        : 'border-pitch-black/20 text-pitch-black/40'
                    }`}
                  >
                    <span className="font-mono text-[8px] tracking-wider uppercase">{label}</span>
                    <span className="font-geist font-bold text-lg">{day}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {EVENTS.slice(0, 2).map((event) => {
                  const Icon = event.icon;
                  return (
                    <div
                      key={event.title}
                      className="flex items-center gap-4 p-4 border border-pitch-black/20 hover:border-pitch-black/60 transition-colors"
                    >
                      <Icon className="w-5 h-5 text-pitch-black flex-shrink-0" strokeWidth={1.5} />
                      <div className="flex-1 min-w-0">
                        <p className="font-geist font-semibold text-sm text-pitch-black truncate">
                          {event.title}
                        </p>
                        <p className="font-mono text-[10px] text-ash-gray mt-0.5">
                          {event.time} — {event.day} brief ready
                        </p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-neon-signal flex-shrink-0" />
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center gap-2">
                <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-ash-gray">
                  Click to reveal briefing notes
                </span>
                <span className="w-4 h-px bg-ash-gray" />
              </div>
            </div>

            {/* Back - Briefing notes */}
            <div
              className="absolute inset-0 bg-pure-white border border-pitch-black p-8 lg:p-12"
              style={{
                backfaceVisibility: 'visible',
                transform: 'rotateY(-180deg)',
              }}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-neon-signal">
                  Daily Brief
                  </span>
                  <h3 className="font-geist font-black text-2xl text-pitch-black mt-1">
                    Pre-Game Notes
                  </h3>
                </div>
                <Clock className="w-6 h-6 text-pitch-black" strokeWidth={1.5} />
              </div>

              <div className="space-y-6">
                {EVENTS.map((event) => (
                  <div key={event.title} className="border-l-2 border-neon-signal pl-4">
                    <h4 className="font-geist font-bold text-sm text-pitch-black mb-2">
                      {event.title}
                    </h4>
                    <ul className="space-y-1">
                      {event.prep.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 text-xs text-pitch-black/60"
                        >
                          <span className="w-1 h-1 rounded-full bg-cobalt-electric flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-newsprint-gray border border-pitch-black/20">
                <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mb-2">
                  Research Engine Status
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-neon-signal animate-pulse-glow" />
                  <span className="text-sm text-pitch-black">
                    Source-backed when research is configured
                  </span>
                </div>
              </div>
            </div>

            {/* Click handler */}
            <button
              onClick={() => setFlipped(!flipped)}
              className="absolute inset-0 z-10 bg-transparent interactive"
              data-cursor-text={flipped ? 'CLOSE' : 'FLIP'}
              aria-label="Toggle briefing notes"
            />
          </div>
        </div>

        {/* Stats row */}
        <div
          className={`mt-20 lg:mt-28 grid grid-cols-2 md:grid-cols-4 gap-8 transition-all duration-700 delay-300 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {[
            { value: 'Low-latency', label: 'Cue path' },
            { value: 'Zero', label: 'Hidden memory writes' },
            { value: '100%', label: 'Consent-gated sessions' },
            { value: 'Source-backed', label: 'Research only' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-geist font-black text-2xl lg:text-3xl text-pure-white">
                {stat.value}
              </p>
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mt-2">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
