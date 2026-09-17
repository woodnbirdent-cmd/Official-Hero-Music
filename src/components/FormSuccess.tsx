import Link from "next/link";

type Props = {
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
};

export default function FormSuccess({
  title,
  message,
  backHref = "/",
  backLabel = "Back home",
}: Props) {
  return (
    <div
      className="card-surface border-white text-center"
      role="status"
      aria-live="polite"
    >
      <p className="section-label mb-3">Submitted</p>
      <h2 className="mb-3 text-2xl font-black uppercase tracking-tight text-white">
        {title}
      </h2>
      <p className="mx-auto mb-8 max-w-md text-hero-light">{message}</p>
      <Link href={backHref} className="btn-primary">
        {backLabel}
      </Link>
    </div>
  );
}
