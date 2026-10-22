"use client";

import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms/ActionForm";
import { addressAction, forgotAction, loginAction, passwordAction, profileAction, registerAction, resetAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4" testId="login-form">
      {(s) => (
        <>
          <input type="hidden" name="next" value={next ?? "/account"} />
          <Field name="email" label="Email address" type="email" autoComplete="email" required state={s} />
          <Field name="password" label="Password" type="password" autoComplete="current-password" required state={s} />
          <div className="flex items-center justify-between text-sm">
            <Link href="/account/forgot-password" className="text-burgundy hover:underline">Forgot password?</Link>
          </div>
          <SubmitButton className="btn-burgundy w-full" pendingText="Signing in…">Sign in</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  return (
    <ActionForm action={registerAction} className="space-y-4" testId="register-form">
      {(s) => (
        <>
          <input type="hidden" name="next" value={next ?? "/account"} />
          <Field name="name" label="Full name" autoComplete="name" required state={s} />
          <Field name="email" label="Email address" type="email" autoComplete="email" required state={s} />
          <Field name="phone" label="Phone number (optional)" type="tel" autoComplete="tel" state={s} />
          <Field name="password" label="Password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters, including letters and numbers." state={s} />
          <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" required state={s} />
          <SubmitButton className="btn-burgundy w-full" pendingText="Creating account…">Create account</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={forgotAction} className="space-y-4">
      {(s) => (
        <>
          <Field name="email" label="Email address" type="email" autoComplete="email" required state={s} />
          <SubmitButton className="btn-burgundy w-full">Send reset link</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetAction} className="space-y-4">
      {(s) => (
        <>
          <input type="hidden" name="token" value={token} />
          <Field name="password" label="New password" type="password" autoComplete="new-password" required minLength={10} state={s} />
          <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required state={s} />
          <SubmitButton className="btn-burgundy w-full">Reset password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  return (
    <ActionForm action={profileAction} className="space-y-4">
      {(s) => (
        <>
          <Field name="name" label="Full name" defaultValue={name} required state={s} />
          <Field name="phone" label="Phone" type="tel" defaultValue={phone} state={s} />
          <SubmitButton>Save profile</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={passwordAction} className="space-y-4">
      {(s) => (
        <>
          <Field name="current" label="Current password" type="password" autoComplete="current-password" required state={s} />
          <Field name="next" label="New password" type="password" autoComplete="new-password" required minLength={10} state={s} />
          <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required state={s} />
          <SubmitButton className="btn-outline">Change password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function AddressForm({ states }: { states: string[] }) {
  return (
    <ActionForm action={addressAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
      {(s) => (
        <>
          <Field name="fullName" label="Full name" required state={s} />
          <Field name="phone" label="Phone" type="tel" required state={s} />
          <div className="sm:col-span-2"><Field name="line1" label="Street address" required state={s} /></div>
          <div className="sm:col-span-2"><Field name="line2" label="Apartment / landmark (optional)" state={s} /></div>
          <Field name="city" label="City" required state={s} />
          <div>
            <label htmlFor="addr-state" className="label">State</label>
            <select id="addr-state" name="state" className="input" required defaultValue="">
              <option value="" disabled>Choose</option>
              {states.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isDefault" className="accent-burgundy" /> Use as default address</label>
          <div className="sm:col-span-2"><SubmitButton className="btn-outline">Save address</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}
