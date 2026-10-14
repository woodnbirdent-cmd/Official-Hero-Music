import type { MemberItem } from "@/lib/member-content";

export default function MemberFeed({
  items,
  empty,
}: {
  items: readonly MemberItem[];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card-surface">
        <p className="text-hero-light">{empty}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="card-surface">
          <h2 className="mb-2 text-lg font-black uppercase tracking-tight text-white">{item.title}</h2>
          <p className="text-sm text-hero-light">{item.body}</p>
          {item.href && (
            <a href={item.href} className="mt-4 inline-flex text-sm font-bold text-hero-accent underline">
              Download
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
