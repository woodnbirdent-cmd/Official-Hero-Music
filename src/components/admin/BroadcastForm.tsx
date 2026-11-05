"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { previewBroadcast, sendBroadcast } from "@/app/admin/email/actions";
import {
  AUDIENCE_LABELS,
  BROADCAST_CHOOSE,
  DEFAULT_AUDIENCES,
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  SELECTABLE_AUDIENCES,
  UNSUBSCRIBE_PREVIEW,
  broadcastFooter,
  type AudienceCounts,
  type AudienceId,
} from "@/lib/broadcast-copy";

function sameAudiences(left: readonly AudienceId[], right: readonly AudienceId[]): boolean {
  return left.length === right.length && right.every((audience) => left.includes(audience));
}

function people(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

export default function BroadcastForm({
  counts,
  total,
  fromAddress,
  configured,
  databaseConfigured,
  alreadySent,
}: {
  counts: AudienceCounts;
  total: number;
  fromAddress: string | null;
  configured: boolean;
  databaseConfigured: boolean;
  alreadySent: string | null;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const previewRequest = useRef(0);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [selected, setSelected] = useState<AudienceId[]>([...DEFAULT_AUDIENCES]);
  const [groupCounts, setGroupCounts] = useState(counts);
  const [currentTotal, setCurrentTotal] = useState(total);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [counting, setCounting] = useState(false);

  const draftIsDefault =
    subject.trim() === DEFAULT_SUBJECT && body.trim() === DEFAULT_BODY && sameAudiences(selected, DEFAULT_AUDIENCES);
  const priorSend = draftIsDefault ? alreadySent : null;
  const canSend =
    configured && databaseConfigured && selected.length > 0 && currentTotal > 0 && !priorSend && !pending && !counting;

  async function toggle(audience: AudienceId) {
    const next = selected.includes(audience)
      ? selected.filter((item) => item !== audience)
      : [...selected, audience];
    setSelected(next);
    setMessage("");
    setError("");
    const requestId = previewRequest.current + 1;
    previewRequest.current = requestId;
    if (next.length === 0) {
      setCurrentTotal(0);
      setCounting(false);
      setError(BROADCAST_CHOOSE);
      return;
    }
    setCounting(true);
    const result = await previewBroadcast(next);
    if (previewRequest.current !== requestId) return;
    setCounting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setGroupCounts(result.counts);
    setCurrentTotal(result.total);
  }

  function openConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setError("");
    setMessage("");
    dialog.current?.showModal();
  }

  async function confirmSend() {
    if (sending.current || !canSend) return;
    sending.current = true;
    setPending(true);
    setError("");
    setMessage("");
    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("body", body);
    formData.set("confirm", "send");
    for (const audience of selected) formData.append("audience", audience);
    const result = await sendBroadcast(formData);
    sending.current = false;
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dialog.current?.close();
    const failed = result.failed > 0 ? ` ${result.failed} could not be delivered. This broadcast will not be sent again.` : "";
    setMessage(`Sent to ${people(result.recipientCount)}.${failed}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!databaseConfigured ? (
        <p className="text-sm text-hero-accent" role="status">
          Database is not configured, so recipients cannot be counted.
        </p>
      ) : null}
      {!configured ? (
        <p className="text-sm text-hero-accent" role="status">
          Email is not configured. Set RESEND_API_KEY and ADMIN_EMAIL_FROM.
        </p>
      ) : null}
      <form onSubmit={openConfirm} className="card-surface space-y-5">
        <fieldset className="space-y-3">
          <legend className="section-label mb-2">Audience</legend>
          {SELECTABLE_AUDIENCES.map((audience) => (
            <label key={audience} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-hero-light">
                <input
                  type="checkbox"
                  name="audience"
                  value={audience}
                  checked={selected.includes(audience)}
                  onChange={() => toggle(audience)}
                />
                {AUDIENCE_LABELS[audience]}
              </span>
              <span className="font-bold text-white">{groupCounts[audience]}</span>
            </label>
          ))}
        </fieldset>

        <p className="text-sm text-hero-light" aria-live="polite">
          Total unique in the selected groups:{" "}
          <span className="font-black text-white">{counting ? "…" : currentTotal}</span>
          {". "}
          Someone in more than one selected group gets one email.
        </p>

        <label className="block text-sm" htmlFor="broadcast-subject">
          <span className="section-label mb-2 block">Subject</span>
          <input
            id="broadcast-subject"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setMessage("");
              setError("");
            }}
            maxLength={200}
            required
            autoComplete="off"
            className="input-field"
          />
        </label>
        <label className="block text-sm" htmlFor="broadcast-body">
          <span className="section-label mb-2 block">Message</span>
          <textarea
            id="broadcast-body"
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setMessage("");
              setError("");
            }}
            maxLength={8000}
            required
            rows={8}
            className="input-field"
          />
        </label>

        <div className="border border-hero-gray p-4 text-sm">
          <p className="section-label mb-3">Preview</p>
          <p className="text-hero-muted">From</p>
          <p className="text-white">{fromAddress ?? "Not configured"}</p>
          <p className="mt-3 text-hero-muted">To</p>
          <p className="text-white">{people(currentTotal)}, one email each. Addresses are not shown.</p>
          <p className="mt-3 text-hero-muted">Subject</p>
          <p className="text-white">{subject.trim() || "Add a subject."}</p>
          <p className="mt-3 whitespace-pre-wrap text-hero-light">{body.trim()}</p>
          <p className="mt-4 text-xs text-hero-muted">{broadcastFooter(selected)}</p>
          <p className="text-xs text-hero-muted">{UNSUBSCRIBE_PREVIEW}</p>
        </div>

        <p className="text-sm text-hero-muted">
          Sign in again if this admin session is more than 15 minutes old. Nothing is sent until you confirm.
        </p>
        {priorSend ? (
          <p className="text-sm text-hero-accent" role="status">
            {priorSend}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-hero-accent" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-hero-accent" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={!canSend}>
          Send
        </button>
      </form>

      <dialog ref={dialog} className="w-[min(100%-2rem,32rem)] border border-hero-gray bg-black p-6 text-white">
        <h2 className="text-lg font-black uppercase tracking-tight">Confirm send</h2>
        <p className="mt-3 text-sm text-hero-light">
          This sends one email to each of {people(currentTotal)}. The same subject, message, and groups cannot be sent again.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-hero-light">
          {selected.map((audience) => (
            <li key={audience}>
              {AUDIENCE_LABELS[audience]}: {groupCounts[audience]}
            </li>
          ))}
          <li className="font-bold text-white">Total unique: {currentTotal}</li>
        </ul>
        <p className="mt-4 text-sm text-white">{subject.trim()}</p>
        {error ? (
          <p className="mt-3 text-sm text-hero-accent" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-primary px-4 py-2 text-xs" onClick={confirmSend} disabled={pending || !canSend}>
            {pending ? "Sending" : `Confirm and send to ${people(currentTotal)}`}
          </button>
          <button type="button" className="btn-ghost px-4 py-2 text-xs" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
        </div>
      </dialog>
    </div>
  );
}
