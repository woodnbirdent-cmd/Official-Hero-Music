import Link from "next/link";
import { STREAMING } from "@/lib/constants";

type Props = {
  className?: string;
  includeHub?: boolean;
  hubLabel?: string;
};

export default function StreamingLinks({
  className = "",
  includeHub = false,
  hubLabel = "On-site players",
}: Props) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {STREAMING.map((platform, index) => (
        <a
          key={platform.name}
          href={platform.href}
          target="_blank"
          rel="noopener noreferrer"
          className={index === 0 ? "btn-primary" : "btn-ghost"}
        >
          {platform.name}
        </a>
      ))}
      {includeHub ? (
        <Link href="/music#players" className="btn-accent">
          {hubLabel}
        </Link>
      ) : null}
    </div>
  );
}
