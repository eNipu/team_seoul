// Sign-in is part of the app: the same Venn account as in ChatGPT.
// An account is only ever created after the explicit second step.

import { useState } from "react";
import { api } from "../api";
import { ApiError, errorMessage } from "../errors";
import { BrandMark, Icon } from "../icons";
import { LIMITS, type SignInResult } from "../types";
import { Field, InlineError } from "../ui";

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <main className="auth__card">
        <div className="auth__brand">
          <BrandMark size={44} />
          <span className="brand__name">Venn</span>
        </div>
        {children}
      </main>
      <p className="auth__foot">
        <Icon name="lock" size={14} />
        Private by default. Venn never sends anything for you.
      </p>
    </div>
  );
}

export default function SignIn({
  passcodeRequired,
  onSignedIn,
}: {
  passcodeRequired: boolean;
  onSignedIn: (result: SignInResult) => void;
}) {
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [displayName, setDisplayName] = useState("");
  /** The username the server said has no account yet; shows the create-account step. */
  const [missing, setMissing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const creating = missing !== null && missing === username;

  const submit = async (create: boolean) => {
    const name = username.trim().toLowerCase();
    setError(null);
    setNameError(null);
    if (!USERNAME.test(name)) {
      setNameError("Use 2–32 characters: lower-case letters, digits, dots, underscores or hyphens.");
      return;
    }
    if (passcodeRequired && !passcode) {
      setError("Enter the passcode.");
      return;
    }
    if (create && !displayName.trim()) {
      setError("Enter the name Venn should call you.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.signIn({
        username: name,
        ...(passcodeRequired ? { passcode } : {}),
        ...(create ? { display_name: displayName.trim(), create: true } : {}),
      });
      onSignedIn(result);
    } catch (e) {
      if (!create && e instanceof ApiError && e.code === "NOT_FOUND") {
        setMissing(name);
        if (!displayName) setDisplayName(name.charAt(0).toUpperCase() + name.slice(1).replace(/[._-]+/g, " "));
      } else {
        setError(errorMessage(e));
      }
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h1>Sign in to Venn</h1>
      <p className="auth__lead">
        Use your Venn username: the one you chose when you connected Venn in ChatGPT. This is not your
        ChatGPT login.
      </p>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(creating);
        }}
      >
        <Field
          label="Venn username"
          error={nameError}
          hint="Not an email address. Lower-case letters, digits, dots, underscores and hyphens."
        >
          {(p) => (
            <input
              {...p}
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={32}
              autoFocus
              required
            />
          )}
        </Field>
        {passcodeRequired && (
          <Field label="Server passcode" hint="The shared passcode for this development server, not a personal password.">
            {(p) => (
              <input
                {...p}
                name="passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="current-password"
                required
              />
            )}
          </Field>
        )}
        {creating && (
          <div className="auth__create" role="status">
            <p className="auth__missing">
              <Icon name="info" size={18} />
              <span>No Venn account called “{missing}” yet.</span>
            </p>
            <Field label="Display name" hint="What Venn calls you. You can change it later.">
              {(p) => (
                <input
                  {...p}
                  name="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  maxLength={LIMITS.displayName}
                />
              )}
            </Field>
          </div>
        )}
        <InlineError message={error} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "One moment…" : creating ? "Create account" : "Sign in"}
        </button>
        {creating && (
          <p className="auth__hint">Or change the username above to sign in to an account you already have.</p>
        )}
      </form>
    </AuthFrame>
  );
}

export function SignInUnavailable() {
  return (
    <AuthFrame>
      <h1>Sign-in on this site isn't set up for this server.</h1>
    </AuthFrame>
  );
}

export function NotConnected({ onRetry, demoHref }: { onRetry: () => void; demoHref: string }) {
  return (
    <AuthFrame>
      <h1>This copy of the site isn't connected to a Venn server.</h1>
      <p className="auth__lead">You can still look around: the demo runs on sample data in this browser tab.</p>
      <div className="stack">
        <a className="btn btn--primary btn--block" href={demoHref}>
          Open the demo
        </a>
        <button type="button" className="btn btn--block" onClick={onRetry}>
          Try again
        </button>
      </div>
    </AuthFrame>
  );
}
