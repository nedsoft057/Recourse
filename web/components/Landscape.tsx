/** Original hero illustration: soft painted sky, clouds, hills and a little market stall. Pure SVG. */
export function Landscape() {
  return (
    <svg
      className="landscape"
      viewBox="0 0 1440 460"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5f6f7" stopOpacity="0" />
          <stop offset="0.28" stopColor="#d7e8fa" />
          <stop offset="0.7" stopColor="#a9cdf2" />
          <stop offset="1" stopColor="#8fbcec" />
        </linearGradient>
        <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9c9e0" />
          <stop offset="1" stopColor="#c9d8ea" />
        </linearGradient>
        <linearGradient id="mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fbf72" />
          <stop offset="1" stopColor="#86ab57" />
        </linearGradient>
        <linearGradient id="front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b7cf74" />
          <stop offset="1" stopColor="#9cbb5c" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="softer" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      <rect width="1440" height="460" fill="url(#sky)" />

      {/* clouds: white with a warm blush underneath */}
      <g filter="url(#soft)">
        <g opacity="0.95">
          <ellipse cx="250" cy="170" rx="110" ry="38" fill="#f4d9df" />
          <ellipse cx="220" cy="150" rx="80" ry="40" fill="#ffffff" />
          <ellipse cx="300" cy="145" rx="70" ry="34" fill="#ffffff" />
          <ellipse cx="180" cy="168" rx="60" ry="22" fill="#fbe6ea" />
        </g>
        <g opacity="0.9">
          <ellipse cx="760" cy="215" rx="90" ry="26" fill="#f2d4dc" />
          <ellipse cx="740" cy="198" rx="62" ry="28" fill="#ffffff" />
          <ellipse cx="800" cy="200" rx="50" ry="22" fill="#ffffff" />
        </g>
        <g opacity="0.95">
          <ellipse cx="1240" cy="160" rx="130" ry="40" fill="#f3d6dd" />
          <ellipse cx="1210" cy="138" rx="90" ry="42" fill="#ffffff" />
          <ellipse cx="1300" cy="140" rx="70" ry="32" fill="#ffffff" />
        </g>
        <ellipse cx="520" cy="120" rx="60" ry="16" fill="#ffffff" opacity="0.7" />
        <ellipse cx="1010" cy="110" rx="50" ry="14" fill="#ffffff" opacity="0.65" />
      </g>

      {/* distant mountains */}
      <path
        d="M0 330 L120 290 L210 305 L330 255 L420 290 L520 268 L640 300 L760 262 L880 295 L1000 270 L1120 300 L1240 266 L1350 292 L1440 280 L1440 460 L0 460 Z"
        fill="url(#far)"
        filter="url(#softer)"
      />
      <path d="M330 255 L350 268 L338 270 L320 264 Z M760 262 L778 274 L765 276 Z" fill="#eef3fa" opacity="0.8" />

      {/* mid hills */}
      <path
        d="M0 360 C180 320 320 330 470 345 C620 360 760 318 930 322 C1100 326 1250 350 1440 330 L1440 460 L0 460 Z"
        fill="url(#mid)"
      />

      {/* trees on the mid hills */}
      <g>
        <ellipse cx="120" cy="338" rx="34" ry="44" fill="#5f8a3e" />
        <ellipse cx="150" cy="350" rx="26" ry="32" fill="#7aa14c" />
        <rect x="117" y="368" width="6" height="20" fill="#6b4f37" />
        <ellipse cx="360" cy="330" rx="20" ry="30" fill="#d39a4f" />
        <rect x="358" y="352" width="4" height="12" fill="#6b4f37" />
        <ellipse cx="1080" cy="318" rx="18" ry="34" fill="#4f7a37" />
        <ellipse cx="1108" cy="324" rx="14" ry="26" fill="#6c9545" />
        <ellipse cx="1330" cy="322" rx="24" ry="34" fill="#c8843f" />
        <rect x="1328" y="348" width="4" height="14" fill="#6b4f37" />
      </g>

      {/* a little market stall */}
      <g transform="translate(1150 300)">
        <rect x="0" y="22" width="92" height="46" fill="#b88a5e" />
        <rect x="10" y="34" width="30" height="34" fill="#8a5a3c" />
        <rect x="50" y="34" width="32" height="18" fill="#f5efe4" />
        <path d="M-8 22 L100 22 L92 6 L0 6 Z" fill="#1a73e8" />
        <path d="M-8 22 L10 22 L4 30 L-8 30 Z M28 22 L46 22 L40 30 L22 30 Z M64 22 L82 22 L76 30 L58 30 Z" fill="#ffffff" />
        <path d="M10 22 L28 22 L22 30 L4 30 Z M46 22 L64 22 L58 30 L40 30 Z M82 22 L100 22 L94 30 L76 30 Z" fill="#1a73e8" />
      </g>

      {/* front meadow with a path */}
      <path
        d="M0 400 C220 370 420 378 640 392 C860 406 1080 380 1440 372 L1440 460 L0 460 Z"
        fill="url(#front)"
      />
      <path d="M690 460 C700 430 760 410 860 396 L900 396 C820 414 780 436 770 460 Z" fill="#e6dcc0" opacity="0.85" />

      {/* grass and flowers */}
      <g stroke="#7f9f45" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d="M80 440 l4 -14 M90 442 l-3 -12 M240 432 l3 -13 M410 438 l-4 -12 M560 444 l3 -14 M980 430 l-3 -12 M1180 436 l4 -13 M1320 440 l-3 -12" />
      </g>
      <g>
        <circle cx="300" cy="438" r="3" fill="#ffffff" />
        <circle cx="312" cy="444" r="2.5" fill="#f2c9d3" />
        <circle cx="1010" cy="434" r="3" fill="#ffffff" />
        <circle cx="1240" cy="440" r="2.5" fill="#f6e08b" />
        <circle cx="520" cy="446" r="2.5" fill="#ffffff" />
      </g>
      <ellipse cx="40" cy="420" rx="70" ry="60" fill="#6f9442" opacity="0.9" filter="url(#softer)" />
      <ellipse cx="1420" cy="410" rx="80" ry="70" fill="#7ea24d" opacity="0.85" filter="url(#softer)" />
    </svg>
  );
}
