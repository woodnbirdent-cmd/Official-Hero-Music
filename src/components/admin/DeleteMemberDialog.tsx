"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteMember } from "@/app/admin/members/actions";
import { CANCEL_SUBSCRIPTION_PHRASE, DELETE_CUSTOMER_PHRASE } from "@/lib/admin-security";

export default function DeleteMemberDialog({
  member,
  self = false,
}: {
  member: { id: string; email: string; name: string; stripeCustomerId: string | null };
  self?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [cancelPhrase, setCancelPhrase] = useState("");
  const [deleteCustomer, setDeleteCustomer] = useState(false);
  const [customerPhrase, setCustomerPhrase] = useState("");
  const [cancelSubscription, setCancelSubscription] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const emailMatches = typed.trim().toLowerCase() === member.email.trim().toLowerCase();
  const cancelMatches = !cancelSubscription || cancelPhrase.trim() === CANCEL_SUBSCRIPTION_PHRASE;
  const customerMatches = !deleteCustomer || customerPhrase.trim() === DELETE_CUSTOMER_PHRASE;
  const ready = emailMatches && cancelMatches && customerMatches;

  function open() {
    setTyped("");
    setCancelPhrase("");
    setCustomerPhrase("");
    setCancelSubscription(false);
    setDeleteCustomer(false);
    setError("");
    dialog.current?.showModal();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await deleteMember(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dialog.current?.close();
    router.refresh();
  }

  if (self) {
    return (
      <button type="button" className="btn-ghost px-3 py-2 text-xs" disabled title="You can't delete your own account.">
        Delete
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={open}>
        Delete
      </button>
      <dialog ref={dialog} className="w-[min(100%-2rem,32rem)] border border-hero-gray bg-black p-6 text-white">
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight">Delete member</h2>
          <p className="text-sm text-hero-light">
            This deletes {member.name || member.email}&apos;s account on this site. Stripe is not changed unless you
            confirm that separately. Sign in again if this admin session is more than 15 minutes old.
          </p>
          <input type="hidden" name="userId" value={member.id} />
          {member.stripeCustomerId ? (
            <div className="space-y-3 border border-hero-gray p-3">
              <label className="flex items-start gap-2 text-sm text-hero-light">
                <input
                  type="checkbox"
                  name="cancelSubscription"
                  value="true"
                  className="mt-1"
                  checked={cancelSubscription}
                  onChange={(event) => setCancelSubscription(event.target.checked)}
                />
                Cancel this member&apos;s Stripe subscription
              </label>
              {cancelSubscription && (
                <label className="block text-sm">
                  <span className="mb-2 block text-hero-muted">Type {CANCEL_SUBSCRIPTION_PHRASE} to confirm</span>
                  <input
                    name="cancelPhrase"
                    value={cancelPhrase}
                    onChange={(event) => setCancelPhrase(event.target.value)}
                    autoComplete="off"
                    className="input-field"
                  />
                </label>
              )}
              <label className="flex items-start gap-2 text-sm text-hero-light">
                <input
                  type="checkbox"
                  name="deleteStripeCustomer"
                  value="true"
                  className="mt-1"
                  checked={deleteCustomer}
                  onChange={(event) => setDeleteCustomer(event.target.checked)}
                />
                Delete the Stripe customer
              </label>
              {deleteCustomer && (
                <label className="block text-sm">
                  <span className="mb-2 block text-hero-muted">Type {DELETE_CUSTOMER_PHRASE} to confirm</span>
                  <input
                    name="deleteCustomerPhrase"
                    value={customerPhrase}
                    onChange={(event) => setCustomerPhrase(event.target.value)}
                    autoComplete="off"
                    className="input-field"
                  />
                </label>
              )}
            </div>
          ) : (
            <p className="text-sm text-hero-muted">This member has no Stripe customer. Nothing is canceled in Stripe.</p>
          )}
          <label className="block text-sm">
            <span className="mb-2 block text-hero-muted">Type {member.email} to delete the account</span>
            <input
              name="confirmEmail"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="input-field"
              autoFocus
            />
          </label>
          {error && (
            <p className="text-sm text-hero-accent" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary px-4 py-2 text-xs" disabled={!ready || pending}>
              {pending ? "Deleting" : "Delete member"}
            </button>
            <button type="button" className="btn-ghost px-4 py-2 text-xs" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
