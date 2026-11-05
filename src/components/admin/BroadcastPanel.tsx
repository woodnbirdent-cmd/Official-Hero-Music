import BroadcastForm from "@/components/admin/BroadcastForm";
import { requireAdmin } from "@/lib/admin";
import { getBroadcastPageData } from "@/lib/broadcast-store";

export default async function BroadcastPanel({ heading }: { heading?: string }) {
  await requireAdmin();
  try {
    const data = await getBroadcastPageData();
    return (
      <section className="space-y-4">
        {heading ? <h2 className="text-lg font-black uppercase tracking-tight text-white">{heading}</h2> : null}
        <p className="text-sm text-hero-muted">
          The subject and message start as the note for Listen and Still There. Edit them before sending. Each person gets their own email and a one-click unsubscribe link.
        </p>
        <BroadcastForm
          counts={data.counts}
          total={data.total}
          fromAddress={data.fromAddress}
          configured={data.configured}
          databaseConfigured={data.databaseConfigured}
          alreadySent={data.alreadySent}
        />
      </section>
    );
  } catch {
    console.error("Broadcast panel failed");
    return (
      <section className="card-surface space-y-2">
        {heading ? <h2 className="text-lg font-black uppercase tracking-tight text-white">{heading}</h2> : null}
        <p className="text-sm text-hero-accent">Recipient counts could not be loaded.</p>
      </section>
    );
  }
}
