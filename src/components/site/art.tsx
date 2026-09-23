import { cn } from "@/lib/utils";

type ArtProps = { className?: string; title?: string; uid?: string };

const flameStyle = { transformBox: "fill-box", transformOrigin: "50% 100%" } as React.CSSProperties;

function Svg({ viewBox, className, title, children }: { viewBox: string; className?: string; title?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full", className)}
    >
      {children}
    </svg>
  );
}

function Pine({ x, y, h, className }: { x: number; y: number; h: number; className?: string }) {
  const w = h * 0.55;
  const d = [
    `M${x} ${y - h}`,
    `L${x + w * 0.32} ${y - h * 0.62}`,
    `L${x + w * 0.16} ${y - h * 0.62}`,
    `L${x + w * 0.42} ${y - h * 0.3}`,
    `L${x + w * 0.22} ${y - h * 0.3}`,
    `L${x + w * 0.5} ${y - h * 0.04}`,
    `L${x - w * 0.5} ${y - h * 0.04}`,
    `L${x - w * 0.22} ${y - h * 0.3}`,
    `L${x - w * 0.42} ${y - h * 0.3}`,
    `L${x - w * 0.16} ${y - h * 0.62}`,
    `L${x - w * 0.32} ${y - h * 0.62}`,
    "Z",
  ].join(" ");
  return (
    <g className={className}>
      <rect x={x - h * 0.025} y={y - h * 0.06} width={h * 0.05} height={h * 0.06} className="fill-timber-600" />
      <path d={d} />
    </g>
  );
}

function Steam({ x, y, uid }: { x: number; y: number; uid: string }) {
  return (
    <g className="stroke-ink-muted/60" fill="none" strokeWidth="2" strokeLinecap="round" key={uid}>
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${x + (i - 1) * 9} ${y} q-5 -8 0 -16 q5 -8 0 -16`}
          className="animate-steam"
          style={{ animationDelay: `${i * 0.9}s` }}
        />
      ))}
    </g>
  );
}

function Cup({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="34" ry="6" className="fill-cream-50 evening:fill-cream-200" />
      <path d={`M${x - 24} ${y - 28} H${x + 24} V${y - 16} Q${x + 24} ${y} ${x} ${y} Q${x - 24} ${y} ${x - 24} ${y - 16} Z`} className="fill-cream-50 evening:fill-cream-200" />
      <path d={`M${x + 23} ${y - 23} q14 0 12 10 q-2 8 -14 6`} fill="none" strokeWidth="4" className="stroke-cream-50 evening:stroke-cream-200" />
      <ellipse cx={x} cy={y - 28} rx="24" ry="4" className="fill-timber-500" />
    </g>
  );
}

// ---------------------------------------------------------------------------

export function HeroArt({ className, title, uid = "hero" }: ArtProps) {
  return (
    <Svg viewBox="0 0 400 500" className={className} title={title}>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sky-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--sky-bottom)" }} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor="#f5d27a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#f5d27a" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-glass`}>
          <path d="M88 392 V172 A112 112 0 0 1 312 172 V392 Z" />
        </clipPath>
      </defs>

      <rect width="400" height="500" className="fill-timber-500 evening:fill-timber-700" />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={i * 40 + 20} y1="0" x2={i * 40 + 20} y2="440" stroke="#000" strokeOpacity="0.12" />
      ))}

      <path d="M70 400 V170 A130 130 0 0 1 330 170 V400 Z" className="fill-timber-300 evening:fill-timber-400" />
      <g clipPath={`url(#${uid}-glass)`}>
        <rect x="80" y="40" width="240" height="360" fill={`url(#${uid}-sky)`} />
        <circle cx="252" cy="140" r="20" className="fill-cream-50 evening:fill-gold-300" />
        <path d="M80 320 Q140 285 205 312 T320 296 V400 H80 Z" className="fill-forest-300 opacity-60 evening:fill-forest-700" />
        <Pine x={120} y={396} h={150} className="fill-forest-700 evening:fill-forest-900" />
        <Pine x={170} y={396} h={104} className="fill-forest-600 evening:fill-forest-800" />
        <Pine x={218} y={396} h={78} className="fill-forest-500 evening:fill-forest-800" />
        <Pine x={268} y={396} h={170} className="fill-forest-700 evening:fill-forest-900" />
        <Pine x={308} y={396} h={116} className="fill-forest-600 evening:fill-forest-800" />
      </g>
      <line x1="200" y1="58" x2="200" y2="392" strokeWidth="6" className="stroke-timber-300 evening:stroke-timber-400" />
      <line x1="88" y1="250" x2="312" y2="250" strokeWidth="6" className="stroke-timber-300 evening:stroke-timber-400" />
      <rect x="54" y="392" width="292" height="16" className="fill-timber-200 evening:fill-timber-300" />

      {[42, 358].map((x) => (
        <g key={x}>
          <circle cx={x} cy="150" r="70" fill={`url(#${uid}-glow)`} className="opacity-25 evening:opacity-90 transition-opacity duration-700" />
          <line x1={x} y1="0" x2={x} y2="126" strokeWidth="1.5" className="stroke-timber-800" />
          <path d={`M${x - 20} 150 L${x - 8} 126 H${x + 8} L${x + 20} 150 Z`} className="fill-gold-400" />
          <ellipse cx={x} cy="151" rx="9" ry="3" className="fill-cream-50" />
        </g>
      ))}

      <rect y="440" width="400" height="60" className="fill-timber-600 evening:fill-timber-800" />
      <rect y="440" width="400" height="4" fill="#000" fillOpacity="0.15" />

      <g>
        <path d="M94 412 H130 L126 440 H98 Z" className="fill-timber-400" />
        <path d="M112 412 V372 M112 394 L98 382 M112 386 L126 372 M112 400 L128 390" strokeWidth="3" strokeLinecap="round" className="stroke-forest-500 evening:stroke-forest-300" fill="none" />
      </g>
      <rect x="170" y="424" width="70" height="16" className="fill-forest-600" />
      <rect x="176" y="414" width="60" height="10" className="fill-cream-200 evening:fill-timber-200" />
      <Cup x={300} y={440} />
      <Steam x={300} y={404} uid={`${uid}-steam`} />
    </Svg>
  );
}

export function FireplaceArt({ className, title, uid = "fire" }: ArtProps) {
  return (
    <Svg viewBox="0 0 400 500" className={className} title={title}>
      <defs>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.75" r="0.6">
          <stop offset="0" stopColor="#f2a54a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f2a54a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" style={{ fill: "var(--surface-2)" }} />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1="0" y1={i * 26 + 6} x2="400" y2={i * 26 + 6} strokeOpacity="0.08" stroke="currentColor" className="text-ink" />
      ))}
      <rect width="400" height="500" fill={`url(#${uid}-glow)`} className="opacity-50 evening:opacity-100 transition-opacity duration-700" />

      <rect x="66" y="170" width="268" height="292" className="fill-timber-200 evening:fill-timber-400" />
      {[
        [66, 176, 60], [130, 176, 76], [210, 176, 58], [272, 176, 62],
        [66, 212, 42], [290, 212, 44], [66, 250, 42], [290, 250, 44],
        [66, 288, 42], [290, 288, 44], [66, 326, 42], [290, 326, 44],
        [66, 364, 42], [290, 364, 44], [66, 402, 42], [290, 402, 44],
      ].map(([x, y, w], i) => (
        <rect key={i} x={x + 3} y={y + 3} width={w - 6} height="30" rx="4" fill="none" strokeWidth="1.5" className="stroke-timber-300 evening:stroke-timber-500" />
      ))}

      <rect x="44" y="146" width="312" height="26" rx="2" className="fill-timber-500 evening:fill-timber-600" />
      <rect x="44" y="172" width="312" height="6" fill="#000" fillOpacity="0.2" />

      <path d="M116 462 V306 A84 84 0 0 1 284 306 V462 Z" fill="#1c130f" />
      <ellipse cx="200" cy="440" rx="80" ry="26" fill="#f2a54a" fillOpacity="0.35" />

      <g>
        <path className="animate-flicker" style={flameStyle} fill="#e0782f" d="M200 318 C228 362 250 392 236 424 C226 444 174 444 164 424 C150 392 174 362 200 318 Z" />
        <path className="animate-flicker-slow" style={{ ...flameStyle, animationDelay: "0.4s" }} fill="#ec9a3c" d="M168 360 C184 388 190 404 184 424 C178 436 158 436 154 424 C148 406 158 388 168 360 Z" />
        <path className="animate-flicker-slow" style={{ ...flameStyle, animationDelay: "0.9s" }} fill="#ec9a3c" d="M234 352 C250 384 256 404 248 424 C242 436 222 436 218 424 C212 404 224 384 234 352 Z" />
        <path className="animate-flicker" style={{ ...flameStyle, animationDelay: "0.2s" }} fill="#f6c453" d="M200 356 C216 384 224 404 216 424 C210 436 190 436 184 424 C176 404 186 384 200 356 Z" />
        <path className="animate-flicker" style={{ ...flameStyle, animationDelay: "0.6s" }} fill="#fcecc0" d="M200 388 C208 402 212 414 207 426 C204 432 196 432 193 426 C188 414 192 402 200 388 Z" />
      </g>
      <rect x="146" y="428" width="112" height="16" rx="8" transform="rotate(-6 202 436)" className="fill-timber-400" />
      <rect x="150" y="434" width="104" height="16" rx="8" transform="rotate(7 202 442)" className="fill-timber-600" />

      <rect x="80" y="112" width="8" height="34" className="fill-cream-50" />
      <rect x="96" y="120" width="8" height="26" className="fill-cream-50" />
      <ellipse cx="84" cy="108" rx="2.5" ry="5" className="fill-gold-400 animate-flicker" style={flameStyle} />
      <ellipse cx="100" cy="116" rx="2.5" ry="5" className="fill-gold-400 animate-flicker-slow" style={flameStyle} />
      <rect x="252" y="84" width="66" height="62" className="fill-cream-50 evening:fill-cream-200" strokeWidth="5" stroke="currentColor" color="#5c4033" />
      <Pine x={285} y={140} h={46} className="fill-forest-500" />

      <rect x="0" y="462" width="400" height="38" className="fill-timber-500 evening:fill-timber-700" />
      <path d="M352 500 V404 Q352 366 378 362 Q400 360 400 380 V500 Z" className="fill-forest-600 evening:fill-forest-700" />
      <rect x="340" y="430" width="30" height="70" rx="10" className="fill-forest-700 evening:fill-forest-800" />
    </Svg>
  );
}

export function StudyArt({ className, title, uid = "study" }: ArtProps) {
  const shelfBooks = (y: number, seed: number) => {
    const colors = ["fill-forest-600", "fill-timber-400", "fill-gold-400", "fill-cream-200", "fill-forest-400", "fill-timber-600"];
    let x = 40;
    const books: React.ReactNode[] = [];
    let i = 0;
    while (x < 350) {
      const w = 10 + ((i * 7 + seed) % 12);
      const h = 44 + ((i * 13 + seed) % 26);
      books.push(<rect key={`${y}-${i}`} x={x} y={y - h} width={w} height={h} className={colors[(i + seed) % colors.length]} />);
      x += w + 2 + (i % 5 === 4 ? 18 : 0);
      i++;
    }
    return books;
  };

  return (
    <Svg viewBox="0 0 400 500" className={className} title={title}>
      <defs>
        <linearGradient id={`${uid}-cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5d27a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#f5d27a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" style={{ fill: "var(--surface-2)" }} />
      {shelfBooks(110, 1)}
      <rect x="28" y="110" width="344" height="8" className="fill-timber-500" />
      {shelfBooks(212, 3)}
      <rect x="28" y="212" width="344" height="8" className="fill-timber-500" />

      <polygon points="70,296 150,296 214,362 6,362" fill={`url(#${uid}-cone)`} className="opacity-40 evening:opacity-100 transition-opacity duration-700" />
      <ellipse cx="110" cy="360" rx="30" ry="6" className="fill-gold-400" />
      <rect x="107" y="286" width="5" height="74" className="fill-gold-400" />
      <path d="M62 298 Q110 246 158 298 Z" className="fill-forest-500 evening:fill-forest-600" />
      <line x1="62" y1="298" x2="158" y2="298" strokeWidth="3" className="stroke-gold-400" />

      <rect x="0" y="360" width="400" height="18" className="fill-timber-500" />
      <rect x="0" y="378" width="400" height="122" className="fill-timber-600 evening:fill-timber-700" />

      <path d="M176 358 Q206 344 236 350 V358 Q206 354 176 362 Z" className="fill-cream-50" />
      <path d="M236 350 Q266 344 296 358 V362 Q266 354 236 358 Z" className="fill-cream-100 evening:fill-cream-200" />
      <line x1="236" y1="350" x2="236" y2="358" strokeWidth="1" className="stroke-timber-300" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={186 + i * 4} y1={356 - i * 3} x2={226} y2={352 - i * 3} strokeWidth="1" className="stroke-timber-200" />
      ))}

      <Cup x={338} y={360} />
      <Steam x={338} y={324} uid={`${uid}-steam`} />

      <rect x="296" y="408" width="40" height="28" rx="4" className="fill-cream-100 evening:fill-cream-300" />
      <rect x="306" y="416" width="4" height="10" rx="1" className="fill-timber-600" />
      <rect x="322" y="416" width="4" height="10" rx="1" className="fill-timber-600" />
      <path d="M316 428 L313 433 H317 L314 438" fill="none" strokeWidth="1.2" className="stroke-gold-600" />
      <path d="M310 426 C290 450 250 420 240 378" fill="none" strokeWidth="2.5" className="stroke-timber-800" />
    </Svg>
  );
}

export function RooftopArt({ className, title, uid = "roof" }: ArtProps) {
  const strand = (p0: [number, number], p1: [number, number], p2: [number, number], n: number, offset: number) => {
    const bulbs = [];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
      const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
      bulbs.push(
        <g key={i}>
          <circle cx={x} cy={y + 6} r="9" fill="#f5d27a" className="opacity-0 evening:opacity-40" />
          <circle cx={x} cy={y + 6} r="3.6" className="fill-gold-300 animate-twinkle" style={{ animationDelay: `${((i + offset) % 5) * 0.5}s` }} />
        </g>,
      );
    }
    return (
      <g>
        <path d={`M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} fill="none" strokeWidth="1.2" className="stroke-timber-800 evening:stroke-cream-300/40" />
        {bulbs}
      </g>
    );
  };

  const buildings: [number, number, number][] = [
    [0, 250, 40], [44, 220, 30], [78, 270, 50], [132, 236, 34], [170, 206, 26], [200, 258, 44],
    [248, 226, 36], [288, 262, 40], [332, 214, 30], [366, 244, 34],
  ];

  return (
    <Svg viewBox="0 0 400 500" className={className} title={title}>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sky-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--sky-bottom)" }} />
        </linearGradient>
      </defs>
      <rect width="400" height="360" fill={`url(#${uid}-sky)`} />
      {[[40, 40], [90, 90], [150, 30], [230, 60], [340, 40], [370, 120], [190, 120], [60, 150]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.3" className="fill-cream-50 opacity-0 evening:opacity-80 transition-opacity duration-700" />
      ))}
      <circle cx="300" cy="100" r="20" className="fill-cream-50 evening:fill-gold-300" />
      {buildings.map(([x, top, w], i) => (
        <g key={i}>
          <rect x={x} y={top} width={w} height={360 - top} className="fill-forest-400/50 evening:fill-forest-900" />
          {Array.from({ length: Math.floor((360 - top) / 22) }, (_, r) =>
            Array.from({ length: Math.floor(w / 12) }, (_, c) =>
              (r + c + i) % 3 === 0 ? (
                <rect key={`${r}-${c}`} x={x + 4 + c * 12} y={top + 8 + r * 22} width="5" height="8" className="fill-gold-300 opacity-20 evening:opacity-80" />
              ) : null,
            ),
          )}
        </g>
      ))}

      {strand([-10, 40], [200, 190], [410, 50], 12, 0)}
      {strand([-10, 120], [190, 250], [410, 130], 10, 2)}

      <rect x="0" y="356" width="400" height="7" className="fill-timber-400" />
      {Array.from({ length: 17 }, (_, i) => (
        <rect key={i} x={i * 25 + 4} y="363" width="5" height="70" className="fill-timber-400/80" />
      ))}
      <rect x="0" y="430" width="400" height="70" className="fill-timber-600 evening:fill-timber-700" />
      {Array.from({ length: 4 }, (_, i) => (
        <line key={i} x1="0" y1={446 + i * 16} x2="400" y2={446 + i * 16} stroke="#000" strokeOpacity="0.15" />
      ))}

      {[46, 354].map((x) => (
        <g key={x}>
          <Pine x={x} y={406} h={120} className="fill-forest-600 evening:fill-forest-700" />
          <path d={`M${x - 26} 404 H${x + 26} L${x + 20} 446 H${x - 20} Z`} className="fill-timber-300 evening:fill-timber-400" />
        </g>
      ))}

      <ellipse cx="200" cy="410" rx="48" ry="8" className="fill-cream-100 evening:fill-cream-300" />
      <rect x="197" y="414" width="6" height="36" className="fill-timber-800" />
      <rect x="180" y="448" width="40" height="4" className="fill-timber-800" />
      {[134, 266].map((x, i) => (
        <g key={x} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-timber-800">
          <path d={i === 0 ? `M${x} 380 V452 M${x} 418 H${x + 30} V452` : `M${x} 380 V452 M${x} 418 H${x - 30} V452`} />
        </g>
      ))}
      <path d="M190 402 h8 v-10 h-8 z" className="fill-gold-400/80" />
    </Svg>
  );
}

export function CoffeeArt({ className, title, uid = "coffee" }: ArtProps) {
  return (
    <Svg viewBox="0 0 400 400" className={className} title={title}>
      <rect width="400" height="400" className="fill-forest-600 evening:fill-forest-800" />
      <circle cx="200" cy="230" r="130" fill="#000" fillOpacity="0.12" />
      <ellipse cx="200" cy="286" rx="112" ry="22" className="fill-cream-100" />
      <path d="M124 196 H276 V222 Q276 282 200 282 Q124 282 124 222 Z" className="fill-cream-50" />
      <path d="M274 208 q34 -2 32 26 q-2 24 -38 22" fill="none" strokeWidth="10" className="stroke-cream-50" />
      <ellipse cx="200" cy="196" rx="76" ry="14" className="fill-timber-500" />
      <path d="M200 206 C184 196 184 186 194 186 C198 186 200 190 200 192 C200 190 202 186 206 186 C216 186 216 196 200 206 Z" className="fill-cream-100" />
      <Steam x={200} y={170} uid={`${uid}-a`} />
      {[[70, 90, 20], [330, 320, -30], [90, 330, 50], [320, 80, -10]].map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx="12" ry="8" className="fill-timber-600" />
          <path d={`M${x - 10} ${y} q10 -4 20 0`} fill="none" strokeWidth="1.5" className="stroke-timber-300" />
        </g>
      ))}
    </Svg>
  );
}

export function TimberArt({ className, title }: ArtProps) {
  const planks = ["fill-timber-400", "fill-timber-500", "fill-timber-300", "fill-timber-500", "fill-timber-400"];
  return (
    <Svg viewBox="0 0 400 400" className={className} title={title}>
      {planks.map((c, i) => (
        <g key={i}>
          <rect x={i * 80} width="80" height="400" className={c} />
          {Array.from({ length: 7 }, (_, j) => (
            <path
              key={j}
              d={`M${i * 80 + 8 + j * 10} 0 C${i * 80 + 20 + j * 9} 120 ${i * 80 + j * 11} 240 ${i * 80 + 12 + j * 10} 400`}
              fill="none"
              stroke="#000"
              strokeOpacity="0.1"
            />
          ))}
          <line x1={i * 80} y1="0" x2={i * 80} y2="400" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
        </g>
      ))}
      <ellipse cx="130" cy="150" rx="12" ry="20" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="2" />
      <ellipse cx="130" cy="150" rx="5" ry="9" fill="#000" fillOpacity="0.2" />
      <ellipse cx="290" cy="280" rx="9" ry="15" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="2" />
      <rect x="0" y="0" width="400" height="400" className="fill-gold-400/0 evening:fill-gold-400/10" />
    </Svg>
  );
}

export function GlowArt({ className, title, uid = "glow" }: ArtProps) {
  const lamps: [number, number][] = [[110, 190], [200, 250], [290, 160]];
  return (
    <Svg viewBox="0 0 400 400" className={className} title={title}>
      <defs>
        <radialGradient id={`${uid}-g`}>
          <stop offset="0" stopColor="#f5d27a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f5d27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" className="fill-timber-700 evening:fill-timber-800" />
      {lamps.map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y + 20} r="90" fill={`url(#${uid}-g)`} className="opacity-50 evening:opacity-90" />
          <line x1={x} y1="0" x2={x} y2={y - 30} strokeWidth="1.5" className="stroke-timber-300" />
          <path d={`M${x - 26} ${y + 6} Q${x} ${y - 44} ${x + 26} ${y + 6} Z`} className="fill-gold-400" />
          <ellipse cx={x} cy={y + 8} rx="10" ry="5" className="fill-cream-50" />
        </g>
      ))}
    </Svg>
  );
}

export function MusicArt({ className, title }: ArtProps) {
  return (
    <Svg viewBox="0 0 400 400" className={className} title={title}>
      <rect width="400" height="400" className="fill-cream-200 evening:fill-timber-700" />
      <g transform="rotate(-18 200 220)">
        <rect x="192" y="40" width="16" height="170" className="fill-timber-700 evening:fill-timber-800" />
        <rect x="186" y="22" width="28" height="36" rx="4" className="fill-timber-600" />
        <path d="M200 190 C150 190 140 236 158 256 C130 276 132 350 200 350 C268 350 270 276 242 256 C260 236 250 190 200 190 Z" className="fill-timber-400" />
        <circle cx="200" cy="256" r="18" className="fill-timber-800" />
        <rect x="182" y="318" width="36" height="6" className="fill-timber-800" />
        {[-5, -2, 1, 4].map((dx) => (
          <line key={dx} x1={200 + dx} y1="40" x2={200 + dx} y2="320" strokeWidth="0.8" className="stroke-cream-100" />
        ))}
      </g>
      {[[300, 110], [330, 170], [80, 130]].map(([x, y], i) => (
        <g key={i} className="fill-gold-400 stroke-gold-400">
          <ellipse cx={x} cy={y} rx="9" ry="7" transform={`rotate(-20 ${x} ${y})`} />
          <line x1={x + 8} y1={y - 2} x2={x + 8} y2={y - 42} strokeWidth="2.5" />
        </g>
      ))}
    </Svg>
  );
}

export const scenes = {
  hero: HeroArt,
  fireplace: FireplaceArt,
  study: StudyArt,
  rooftop: RooftopArt,
  coffee: CoffeeArt,
  timber: TimberArt,
  glow: GlowArt,
  music: MusicArt,
};

export type SceneName = keyof typeof scenes;
