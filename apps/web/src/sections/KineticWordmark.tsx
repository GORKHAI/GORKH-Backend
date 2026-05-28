import { useEffect, useRef } from 'react';

/*
 * Kinetic Perspective Wordmark
 * The word "GORKH" rendered as an SVG that physically bulges and warps
 * based on mouse proximity using bezier curve manipulation.
 */

// Letter path data (simplified SVG paths for "GORKH")
const LETTER_PATHS: number[][][] = [
  // G
  [[10,0],[0,0],[0,100],[10,100],[60,100],[60,55],[25,55],[25,70],[40,70],[40,85],[20,85],[20,15],[40,15],[40,35],[55,35],[55,0],[10,0]],
  // O
  [[70,50],[70,100],[120,100],[120,50],[120,0],[70,0],[70,50]],
  // R
  [[135,0],[135,100],[155,100],[155,60],[170,100],[195,100],[175,55],[195,50],[195,0],[135,0]],
  // K
  [[210,0],[210,100],[230,100],[230,60],[260,100],[285,100],[250,50],[285,0],[260,0],[230,40],[230,0],[210,0]],
  // H
  [[300,0],[300,100],[320,100],[320,60],[365,60],[365,100],[385,100],[385,0],[365,0],[365,40],[320,40],[320,0],[300,0]],
];

const LETTER_WIDTHS = [65, 55, 65, 80, 95];
const LETTER_SPACING = 30;
const MOUSE_RADIUS = 200;
const MOUSE_STRENGTH = 40;

function buildPath(points: number[][]): string {
  if (points.length === 0) return '';
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i][0]} ${points[i][1]}`;
  }
  return d;
}

export default function KineticWordmark() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const pointsRef = useRef<number[][][]>([]);
  const displayPointsRef = useRef<number[][][]>([]);

  useEffect(() => {
    // Initialize point arrays from letter paths
    pointsRef.current = LETTER_PATHS.map(letter =>
      letter.map(p => [...p])
    );
    displayPointsRef.current = LETTER_PATHS.map(letter =>
      letter.map(p => [...p])
    );

    const handleMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // Map mouse to SVG coordinate space (0-500 x 0-120)
      const scaleX = 500 / rect.width;
      const scaleY = 120 / rect.height;
      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const animate = () => {
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      let letterOffset = 0;
      let needsUpdate = false;

      pointsRef.current.forEach((letter, letterIdx) => {
        const baseOffset = letterOffset;

        letter.forEach((_point, pointIdx) => {
          const baseX = LETTER_PATHS[letterIdx][pointIdx][0] + baseOffset;
          const baseY = LETTER_PATHS[letterIdx][pointIdx][1];

          // Apply mouse displacement
          const dx = mouseX - baseX;
          const dy = mouseY - baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let targetX = baseX;
          let targetY = baseY;

          if (dist < MOUSE_RADIUS) {
            const force = Math.pow(1 - dist / MOUSE_RADIUS, 2);
            targetX -= (dx / dist) * force * MOUSE_STRENGTH;
            targetY -= (dy / dist) * force * MOUSE_STRENGTH;
          }

          // Lerp current display point toward target
          const currentX = displayPointsRef.current[letterIdx][pointIdx][0] + baseOffset;
          const currentY = displayPointsRef.current[letterIdx][pointIdx][1];
          const newX = currentX + (targetX - currentX) * 0.1;
          const newY = currentY + (targetY - currentY) * 0.1;

          if (Math.abs(newX - currentX) > 0.01 || Math.abs(newY - currentY) > 0.01) {
            needsUpdate = true;
          }

          displayPointsRef.current[letterIdx][pointIdx][0] = newX - baseOffset;
          displayPointsRef.current[letterIdx][pointIdx][1] = newY;
        });

        letterOffset += LETTER_WIDTHS[letterIdx] + LETTER_SPACING;
      });

      if (needsUpdate && pathRef.current) {
        let fullPath = '';
        displayPointsRef.current.forEach((letter) => {
          fullPath += buildPath(letter);
        });
        pathRef.current.setAttribute('d', fullPath);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Build initial path
  let initialPath = '';
  let offset = 0;
  LETTER_PATHS.forEach((letter, idx) => {
    const shiftedLetter = letter.map(p => [p[0] + offset, p[1]]);
    initialPath += buildPath(shiftedLetter);
    offset += LETTER_WIDTHS[idx] + LETTER_SPACING;
  });

  return (
    <section className="relative w-full min-h-screen bg-ledger-white flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-5xl mx-auto px-6 py-32">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-ash-gray mb-4">
            Kinetic Identity
          </p>
          <p className="text-pitch-black/60 text-sm max-w-md mx-auto">
            Move your cursor over the wordmark. The typography physically responds to your presence —
            just as GORKH responds to the room around you.
          </p>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 500 120"
          className="w-full h-auto"
          style={{ overflow: 'visible' }}
        >
          <path
            ref={pathRef}
            d={initialPath}
            fill="none"
            stroke="#111010"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="mt-16 flex items-center justify-center gap-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-signal" />
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray">
              Deterministic
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cobalt-electric" />
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray">
              Consent-First
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pitch-black" />
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ash-gray">
              Privacy-First
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
