import type { UnreleasedTrack } from "@/lib/unreleased-tracks";

export default function UnreleasedTrackCard({
  track,
  canStream,
  ready,
}: {
  track: UnreleasedTrack;
  canStream: boolean;
  ready: boolean;
}) {
  return (
    <li className="card-surface">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-black uppercase tracking-tight text-white">{track.title}</h2>
        <span className="border border-hero-accent px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-hero-accent">
          Unreleased
        </span>
      </div>
      <p className="mt-2 text-sm text-hero-light">
        {track.artist}
        <span className="text-hero-muted"> · {track.duration}</span>
      </p>
      {canStream ? (
        <>
          {ready ? null : <p className="mt-4 text-sm text-hero-muted">Audio file not uploaded yet.</p>}
          <audio
            controls
            controlsList="nodownload"
            preload="none"
            src={`/api/stream/${track.id}`}
            aria-label={`Play ${track.title} by ${track.artist}`}
            className="mt-4 h-10 w-full accent-hero-accent"
          >
            Your browser cannot play this audio.
          </audio>
        </>
      ) : null}
    </li>
  );
}
