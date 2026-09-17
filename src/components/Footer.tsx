import Image from "next/image";
import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/constants";
import SocialIcons from "./SocialIcons";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-hero-surface bg-hero-dark">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <Image
            src="/logo-full.png"
            alt="#Hero"
            width={160}
            height={60}
            className="mb-4 h-12 w-auto"
          />
          <p className="text-sm text-hero-muted">
            {SITE.artist} · {SITE.location}
            <br />
            {SITE.label}
          </p>
          <p className="mt-3 text-sm italic text-hero-light">&ldquo;{SITE.tagline}&rdquo;</p>
        </div>

        <div>
          <p className="section-label mb-4">Navigate</p>
          <ul className="grid grid-cols-2 gap-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-hero-light hover:text-white hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="section-label mb-4">Connect</p>
          <SocialIcons />
          <p className="mt-6 text-xs text-hero-muted">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
            <br />
            {SITE.domain}
          </p>
        </div>
      </div>
    </footer>
  );
}
