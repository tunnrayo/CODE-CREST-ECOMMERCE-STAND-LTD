"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui";
import { SubmitButton } from "@/components/forms/ActionForm";
import { adminLoginAction } from "../actions";

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLoginAction, undefined);
  return (
    <form action={action} className="space-y-4" data-testid="admin-login-form">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <div>
        <label htmlFor="a-email" className="label">Email</label>
        <input id="a-email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="a-pass" className="label">Password</label>
        <input id="a-pass" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <SubmitButton className="btn-burgundy w-full" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
