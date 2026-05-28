import { useRef, useState, useEffect } from 'react';
import { Mail, MessageSquare, ArrowRight } from 'lucide-react';

export default function Contact() {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '');
    const email = String(data.get('email') ?? '');
    const subject = String(data.get('subject') ?? 'GORKH inquiry');
    const message = String(data.get('message') ?? '');
    const body = encodeURIComponent(`${message}\n\nFrom: ${name} <${email}>`);
    window.location.href = `mailto:hello@gorkh.ai?subject=${encodeURIComponent(subject)}&body=${body}`;
  };

  return (
    <main className="min-h-screen bg-pitch-black pt-32 lg:pt-40 pb-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div
          ref={headerRef}
          className={`mb-16 lg:mb-24 transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-neon-signal mb-4">
            Support
          </p>
          <h1 className="font-geist font-black text-4xl sm:text-5xl lg:text-6xl text-pure-white tracking-tight mb-6">
            Get in Touch
          </h1>
          <p className="text-ash-gray text-sm max-w-lg leading-relaxed">
            Have questions about GORKH? Need support? Want to partner?
            We're here. Reach out directly — a human will respond.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Contact info */}
          <div
            className={`transition-all duration-700 delay-200 ${
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-neon-signal" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-geist font-semibold text-pure-white mb-1">Email</p>
                  <a
                    href="mailto:support@gorkh.ai"
                    className="text-ash-gray text-sm hover:text-neon-signal transition-colors interactive"
                    data-cursor-text=""
                  >
                    support@gorkh.ai
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-cobalt-electric" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-geist font-semibold text-pure-white mb-1">General Inquiries</p>
                  <a
                    href="mailto:hello@gorkh.ai"
                    className="text-ash-gray text-sm hover:text-cobalt-electric transition-colors interactive"
                    data-cursor-text=""
                  >
                    hello@gorkh.ai
                  </a>
                </div>
              </div>
            </div>

            {/* Response time */}
            <div className="mt-12 p-6 border border-white/5 bg-white/[0.02]">
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mb-2">
                Response Time
              </p>
              <p className="text-pure-white text-sm">
                We typically respond within 24 hours during business days.
                For urgent issues, please include "URGENT" in the subject line.
              </p>
            </div>
          </div>

          {/* Contact form */}
          <div
            className={`transition-all duration-700 delay-300 ${
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full bg-transparent border border-white/10 px-4 py-3 text-pure-white text-sm focus:border-neon-signal focus:outline-none transition-colors"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full bg-transparent border border-white/10 px-4 py-3 text-pure-white text-sm focus:border-neon-signal focus:outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  className="w-full bg-transparent border border-white/10 px-4 py-3 text-pure-white text-sm focus:border-neon-signal focus:outline-none transition-colors"
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray mb-2">
                  Message
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  className="w-full bg-transparent border border-white/10 px-4 py-3 text-pure-white text-sm focus:border-neon-signal focus:outline-none transition-colors resize-none"
                  placeholder="Tell us what's on your mind..."
                />
              </div>

              <button
                type="submit"
                className="w-full pill-button pill-button-primary interactive disabled:opacity-50"
                data-cursor-text=""
              >
                <span className="flex items-center justify-center gap-2">
                  Open Email Draft
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
              <p className="text-ash-gray text-xs leading-relaxed">
                This form opens your email client. It does not submit data to GORKH or store
                message content in the browser.
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
