import { Link } from 'react-router';

const FOOTER_LINKS = [
  { label: 'Privacy Policy', path: '/privacy' },
  { label: 'Support', path: '/contact' },
];

const SOCIAL_LINKS = [
  { label: 'API status', href: 'https://api.gorkh.com/health' },
  { label: 'Voice gateway', href: 'https://voice.gorkh.com/health' },
];

export default function Footer() {
  return (
    <footer className="bg-pitch-black border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link
              to="/"
              className="text-pure-white font-geist font-black text-2xl tracking-[0.2em] uppercase interactive"
              data-cursor-text=""
            >
              GORKH
            </Link>
            <p className="mt-4 text-ash-gray text-sm max-w-sm leading-relaxed">
              Real-time AI situational copilot for high-stakes moments.
              Explicit-session, consent-first, privacy-first.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <div className="border border-white/10 px-4 py-3 text-ash-gray text-xs leading-relaxed">
                iOS and Android apps come after live browser validation. The API, voice gateway,
                and durable worker are live today.
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-mono text-[11px] tracking-[0.15em] uppercase text-ash-gray mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.path}
                    className="text-sm text-pure-white/70 hover:text-pure-white transition-colors interactive"
                    data-cursor-text=""
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-mono text-[11px] tracking-[0.15em] uppercase text-ash-gray mb-4">
              Live Services
            </h4>
            <ul className="space-y-3">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-pure-white/70 hover:text-pure-white transition-colors interactive"
                    data-cursor-text=""
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-ash-gray text-xs font-mono">
            &copy; {new Date().getFullYear()} GORKH. All rights reserved.
          </p>
          <p className="text-ash-gray text-xs font-mono">
            External actions remain approval-gated.
          </p>
        </div>
      </div>
    </footer>
  );
}
