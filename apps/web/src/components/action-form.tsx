"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, Notice, Spinner } from "./ui";
import type { ActionState } from "@/app/app/actions";

/** Wraps a server action with pending state and inline result messages. */
export function ActionForm({ action, children, submit, className, resetOnSuccess, variant = "primary" }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  resetOnSuccess?: boolean;
  variant?: "primary" | "accent" | "danger";
}) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={run} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SubmitButton label={submit} variant={variant} />
        {state?.error && <span className="text-sm text-bad">{state.error}</span>}
        {state?.ok && state.message && <span className="text-sm text-good">{state.message}</span>}
      </div>
      {state?.link && <Notice className="mt-3 break-all"><code>{state.link}</code></Notice>}
    </form>
  );
}

function SubmitButton({ label, variant }: { label: string; variant: "primary" | "accent" | "danger" }) {
  const { pending } = useFormStatus();
  return <Button variant={variant} disabled={pending}>{pending ? <Spinner /> : label}</Button>;
}
