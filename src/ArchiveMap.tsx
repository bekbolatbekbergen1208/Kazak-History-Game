import { Compass, MapPin } from "lucide-react";
export function ArchiveMap({
  interactive = false,
  selected,
  visited = [],
  onSelect,
}: {
  interactive?: boolean;
  selected?: string;
  visited?: string[];
  onSelect?: (region: string) => void;
}) {
  return (
    <div className={`archive-map ${interactive ? "interactive" : ""}`}>
      <div className="map-caption">
        ҚАЗАҚ ДАЛАСЫ <span>ТАРИХИ ОҚИҒАЛАР АТЛАСЫ</span>
      </div>
      <svg
        viewBox="0 0 760 500"
        role="img"
        aria-label="Қазақстанның сызбалық картасы: Торғай солтүстік орталықта, Жетісу оңтүстік шығыста. Шекаралар шартты."
      >
        <defs>
          <pattern
            id="grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M50 0H0V50"
              fill="none"
              stroke="#827251"
              strokeWidth=".5"
              opacity=".28"
            />
          </pattern>
          <pattern
            id="terrain"
            width="42"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="m8 24 7-12 7 12m-3-5 8-13 10 18"
              fill="none"
              stroke="#89734e"
              strokeWidth=".65"
              opacity=".3"
            />
          </pattern>
          <linearGradient id="land" x2="1" y2="1">
            <stop stopColor="#dbcb9d" />
            <stop offset="1" stopColor="#b6a16e" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="6"
              floodColor="#514523"
              floodOpacity=".16"
            />
          </filter>
        </defs>
        <rect width="760" height="500" fill="url(#grid)" />
        <g fill="none" stroke="#a69267" opacity=".3">
          <path d="M-30 126Q140 12 360 102T800 53M-30 140Q140 26 360 116T800 67M-30 155Q140 40 360 131T800 82M-30 386Q140 272 360 362T800 313M-30 398Q140 284 360 374T800 325" />
          <ellipse cx="580" cy="305" rx="150" ry="74" />
          <ellipse cx="580" cy="305" rx="160" ry="84" />
        </g>
        <path
          d="M86 221 74 190 108 164 122 134 169 148 186 130 211 136 241 108 271 116 284 91 324 96 343 76 365 90 402 79 422 112 457 101 483 134 518 123 539 145 577 131 586 157 625 167 634 190 675 202 691 238 665 253 681 278 657 295 631 291 608 320 572 325 558 349 522 338 498 360 469 349 456 367 430 352 404 356 381 321 355 329 337 304 309 307 286 286 260 299 239 286 214 298 198 271 173 277 164 260 130 266 106 245 92 249Z"
          fill="url(#land)"
          stroke="#8c7952"
          strokeWidth="1.6"
          filter="url(#shadow)"
        />
        <path
          d="m425 145 17 18 41-4 20 33 62 12 25 39 35 4m-341-75 17 37-13 27 29 38m-133-12 32-23 34 10m152 44 41-22 41 20 30-19m59 51 10-33 36-8"
          fill="none"
          stroke="#8c7952"
          strokeDasharray="4 5"
          opacity=".6"
        />
        <path
          d="m548 268 20-17 23 8 8 23 27-7 14 17-31 17-39-1Z"
          fill="url(#terrain)"
        />
        <path
          d="M59 277q35-32 47-1l-4 28 21 19-8 40-27 10-26-22 7-35Z"
          fill="#9aab9c"
          opacity=".65"
        />
        <path
          d="m467 294 28-12 20 4 26-4 6 8-28 8-26-2-20 5Z"
          fill="#8a9b8d"
          opacity=".65"
        />
        <path
          d="M349 181Q367 227 435 245T579 282"
          fill="none"
          stroke="#845d36"
          strokeWidth="1.6"
          strokeDasharray="5 6"
        />
        <g fill="#75613e" fontFamily="Georgia,serif">
          <text x="245" y="228" fontSize="24" letterSpacing="9" opacity=".6">
            ҚАЗАҚСТАН
          </text>
          <text x="36" y="329" fontSize="10" transform="rotate(-80 36 329)">
            КАСПИЙ ТЕҢІЗІ
          </text>
          <text x="552" y="391" fontSize="13" letterSpacing="4" opacity=".6">
            ҚЫТАЙ
          </text>
          <text x="280" y="48" fontSize="12" letterSpacing="5" opacity=".5">
            РЕСЕЙ ИМПЕРИЯСЫ
          </text>
        </g>
        <g transform="translate(684 80)" stroke="#786541" fill="none">
          <circle r="23" />
          <path d="M0-37V37M-37 0H37M-15-15 15 15M-15 15 15-15" />
          <path d="m0-22 6 22-6 22-6-22Z" fill="#786541" />
          <text
            y="-43"
            stroke="none"
            fill="#786541"
            fontSize="10"
            textAnchor="middle"
          >
            С
          </text>
        </g>
      </svg>
      {["Торғай", "Жетісу"].map((name, i) => (
        <button
          key={name}
          type="button"
          className={`map-pin pin-${i} ${selected === name ? "active" : ""} ${visited.includes(name) ? "visited" : ""}`}
          onClick={() => onSelect?.(name)}
          aria-label={`${name} архивін ашу`}
          disabled={!interactive}
        >
          <span className="pin-dot">
            <MapPin size={17} />
          </span>
          <span>
            {name.toUpperCase()}
            <small>{visited.includes(name) ? "ЗЕРТТЕЛДІ" : "1916"}</small>
          </span>
        </button>
      ))}
      <div className="map-foot">
        <Compass size={15} />
        <span>Шекаралар мен орындар шартты түрде көрсетілген</span>
        <span>ЕКІ КӨТЕРІЛІС ОШАҒЫ</span>
      </div>
    </div>
  );
}
