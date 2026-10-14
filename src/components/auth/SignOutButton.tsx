"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void authClient.signOut().then(() => {
          router.push("/");
          router.refresh();
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
