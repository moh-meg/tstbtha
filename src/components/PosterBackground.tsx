export function PosterBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
      style={{
        background:
          'linear-gradient(165deg, #0047F0 0%, #0040DF 48%, #0035C2 100%)',
      }}
    >
      {/* Subtle darker blue geometric watermark bands matching the poster backdrop */}
      <svg
        className="absolute inset-0 h-full w-full opacity-35"
        viewBox="0 0 1440 1024"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g fill="#00289E">
          <polygon points="-80,320 260,320 120,860 -220,860" />
          <polygon points="290,280 560,280 430,860 160,860" />
          <polygon points="610,300 940,300 810,880 480,880" />
          <polygon points="990,260 1320,260 1190,860 860,860" />
          <polygon points="1340,310 1560,310 1430,860 1210,860" />
        </g>
      </svg>

      {/* Top-right comic red/coral halftone flame splash */}
      <svg
        className="absolute -top-4 -right-4 h-[200px] w-[380px] sm:h-[290px] sm:w-[640px] md:h-[360px] md:w-[880px]"
        viewBox="0 0 780 340"
        fill="none"
        preserveAspectRatio="xMaxYMin slice"
      >
        <defs>
          <pattern
            id="halftone-top-right"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(24)"
          >
            <circle cx="5" cy="5" r="2.6" fill="#B81D18" />
          </pattern>
        </defs>
        <path
          d="M210,0 L780,0 L780,295 C756,282 745,256 720,256 C694,256 688,288 660,285 C636,282 642,240 612,226 C576,210 538,236 508,214 C478,192 490,152 452,135 C418,120 388,154 344,142 C308,132 296,95 256,88 C215,80 184,108 142,90 C106,75 112,48 74,42 C38,36 16,52 0,34 L0,18 C64,18 112,4 162,16 C188,22 198,6 210,0 Z"
          fill="#FF3B30"
        />
        <path
          d="M780,150 C742,144 714,175 680,165 C646,154 642,108 594,95 C556,84 522,108 486,88 C452,70 462,36 420,22 C360,4 328,36 284,26 C244,17 224,4 195,0 L780,0 Z"
          fill="url(#halftone-top-right)"
          opacity="0.72"
        />
        {/* Detached comic flame droplets */}
        <path
          d="M446,248 C462,240 478,248 476,262 C474,276 456,278 444,268 C436,261 438,252 446,248 Z"
          fill="#FF3B30"
        />
        <path
          d="M590,262 C608,255 628,272 620,290 C612,306 588,302 582,286 C577,274 580,266 590,262 Z"
          fill="#FF3B30"
        />
        <circle cx="718" cy="232" r="14" fill="url(#halftone-top-right)" opacity="0.85" />
      </svg>

      {/* Bottom-left comic red/coral halftone flame splash */}
      <svg
        className="absolute -bottom-4 -left-4 h-[190px] w-[300px] sm:h-[260px] sm:w-[430px] md:h-[300px] md:w-[510px]"
        viewBox="0 0 510 300"
        fill="none"
        preserveAspectRatio="xMinYMax slice"
      >
        <defs>
          <pattern
            id="halftone-bottom-left"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-22)"
          >
            <circle cx="5" cy="5" r="2.7" fill="#B81D18" />
          </pattern>
        </defs>
        <path
          d="M0,300 L0,115 C24,118 46,138 66,128 C92,115 80,68 112,48 C142,30 168,54 192,40 C216,26 208,6 226,12 C242,17 244,44 268,56 C296,70 330,66 346,94 C362,122 338,154 356,184 C372,210 412,202 428,228 C442,250 428,274 452,286 C472,296 492,294 506,300 Z"
          fill="#FF3B30"
        />
        <path
          d="M0,300 L0,158 C32,162 56,186 84,174 C118,160 118,108 156,96 C192,84 226,118 258,138 C286,156 296,192 324,218 C354,246 392,256 418,300 Z"
          fill="url(#halftone-bottom-left)"
          opacity="0.72"
        />
        {/* Detached comic flame droplets */}
        <path
          d="M126,20 C142,10 168,18 170,34 C172,50 150,62 132,52 C116,44 114,28 126,20 Z"
          fill="#FF3B30"
        />
        <path
          d="M276,22 C292,14 310,24 308,42 C306,58 286,62 274,50 C264,40 264,28 276,22 Z"
          fill="#FF3B30"
        />
        <path
          d="M368,144 C384,136 406,148 400,166 C394,182 372,182 362,168 C356,158 358,149 368,144 Z"
          fill="#FF3B30"
        />
      </svg>
    </div>
  );
}
