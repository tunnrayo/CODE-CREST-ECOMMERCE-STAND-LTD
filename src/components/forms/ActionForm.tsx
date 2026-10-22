"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import { Notice } from "@/components/ui";

export type ActionState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;

export function SubmitButton({ children, className, pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={clsx(className ?? "btn-burgundy")} disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Generic form bound to a server action; renders status + passes field errors to children. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  testId,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: (state: ActionState) => React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  testId?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      data-testid={testId}
      key={resetOnSuccess && state?.ok ? `ok-${state.message}-${Date.now()}` : undefined}
    >
      {state?.error && <Notice kind="error" className="mb-4">{state.error}</Notice>}
      {state?.ok && state.message && <Notice kind="success" className="mb-4">{state.message}</Notice>}
      {children(state)}
    </form>
  );
}

export function Field({ name, label, state, type = "text", defaultValue, required, autoComplete, placeholder, hint, ...rest }: { name: string; label: string; state?: ActionState; type?: string; defaultValue?: string | number | null; required?: boolean; autoComplete?: string; placeholder?: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  const err = state?.fieldErrors?.[name];
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={name} type={type} defaultValue={defaultValue ?? undefined} required={required} autoComplete={autoComplete} placeholder={placeholder} className="input" aria-invalid={!!err} aria-describedby={err ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
      {hint && !err && <p id={`${id}-hint`} className="mt-1 text-xs text-grey-500">{hint}</p>}
      {err && <p id={`${id}-err`} className="field-error">{err}</p>}
    </div>
  );
}
