import { SOCIALS } from "@/lib/constants";

export default function SocialIcons({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-3 ${className}`}>
      {SOCIALS.map((s) => (
        <li key={s.name}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-[5.5rem] items-center justify-center border border-hero-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white hover:bg-white hover:text-black"
            aria-label={s.label}
          >
            {s.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
