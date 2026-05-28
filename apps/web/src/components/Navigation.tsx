import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Privacy', path: '/privacy' },
  { label: 'Contact', path: '/contact' },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Desktop / Main Nav */}
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-pitch-black/90 backdrop-blur-md border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between px-6 lg:px-12 py-5">
          {/* Logo */}
          <Link
            to="/"
            className="text-pure-white font-geist font-black text-xl tracking-[0.2em] uppercase interactive"
            data-cursor-text=""
          >
            GORKH
          </Link>

          {/* Center pill button */}
          <Link
            to="/contact"
            className="hidden md:inline-flex pill-button pill-button-primary interactive"
            data-cursor-text=""
          >
            Request Access
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`font-mono text-[11px] tracking-[0.15em] uppercase transition-colors duration-300 interactive ${
                  location.pathname === item.path
                    ? 'text-pure-white'
                    : 'text-ash-gray hover:text-pure-white'
                }`}
                data-cursor-text=""
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 interactive"
            onClick={() => setMenuOpen(!menuOpen)}
            data-cursor-text=""
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-px bg-pure-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[3.5px]' : ''}`} />
            <span className={`block w-6 h-px bg-pure-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[3.5px]' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-40 bg-pitch-black transition-all duration-500 md:hidden ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center justify-center h-full gap-8">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMenuOpen(false)}
              className="font-geist font-black text-3xl tracking-[0.1em] uppercase text-pure-white interactive"
              data-cursor-text=""
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/contact"
            onClick={() => setMenuOpen(false)}
            className="mt-8 pill-button pill-button-primary interactive"
            data-cursor-text=""
          >
            Request Access
          </Link>
        </div>
      </div>
    </>
  );
}
