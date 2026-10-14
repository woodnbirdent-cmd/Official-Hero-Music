"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteMember } from "@/app/admin/members/actions";

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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const matches = typed.trim().toLowerCase() === member.email.trim().toLowerCase();

  function open() {
    setTyped("");
    setError("");
    dialog.current?.showModal();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || pending) return;
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
      <dialog ref={dialog} className="w-[min(100%-2rem,28rem)] border border-hero-gray bg-black p-6 text-white">
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight">Delete member</h2>
          <p className="text-sm text-hero-light">
            This cancels any active Stripe subscription immediately, then deletes {member.name || member.email}&apos;s
            account, sessions, and sign-in methods. Paid charges stay in Stripe unless you refund them from Orders.
          </p>
          <input type="hidden" name="userId" value={member.id} />
          {member.stripeCustomerId ? (
            <label className="flex items-start gap-2 text-sm text-hero-light">
              <input type="checkbox" name="deleteStripeCustomer" value="true" className="mt-1" />
              Also delete the Stripe customer
            </label>
          ) : (
            <p className="text-sm text-hero-muted">This member has no Stripe customer.</p>
          )}
          <label className="block text-sm">
            <span className="mb-2 block text-hero-muted">Type {member.email} to confirm</span>
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
            <button type="submit" className="btn-primary px-4 py-2 text-xs" disabled={!matches || pending}>
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
