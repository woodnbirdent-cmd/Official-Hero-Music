import { SOCIALS } from "@/lib/constants";

export default function SocialIcons({
  className = "",
  singleLine = false,
}: {
  className?: string;
  /** On small screens, shrink the links so all five stay on one row. */
  singleLine?: boolean;
}) {
  return (
    <ul
      className={`flex gap-3 ${
        singleLine ? "w-full flex-nowrap gap-1 sm:w-auto sm:flex-wrap sm:gap-3" : "flex-wrap"
      } ${className}`}
    >
      {SOCIALS.map((s) => (
        <li key={s.name} className={singleLine ? "min-w-0 flex-1 sm:flex-none" : undefined}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex w-full items-center justify-center border border-hero-surface font-bold uppercase text-white transition hover:border-white hover:bg-white hover:text-black ${
              singleLine
                ? "overflow-hidden whitespace-nowrap px-px py-1.5 text-[8px] leading-none tracking-tight min-[380px]:px-0.5 min-[380px]:text-[10px] min-[380px]:tracking-normal sm:min-w-[5.5rem] sm:overflow-visible sm:px-3 sm:py-2 sm:text-xs sm:leading-normal sm:tracking-wider"
                : "min-w-[5.5rem] px-3 py-2 text-xs tracking-wider"
            }`}
            aria-label={s.label}
          >
            {s.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
