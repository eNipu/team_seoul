// Sign-in and sign-up are part of the app: the same Venn account as in ChatGPT.
// Signing in never creates an account silently; users either choose Sign up directly
// or confirm account creation when a username isn't found.

import { useState } from "react";
import { api } from "../api";
import { ApiError, errorMessage } from "../errors";
import { BrandMark, Icon } from "../icons";
import { LIMITS, type SignInResult } from "../types";
import { Field, InlineError } from "../ui";

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

type AuthMode = "signin" | "signup";

function initialMode(): AuthMode {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "signup" ? "signup" : "signin";
}

function suggestDisplayName(username: string): string {
  return username
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <main className="auth__card">
        <div className="auth__brand">
          <BrandMark size={36} />
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
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [displayName, setDisplayName] = useState("");
  /** Username the server reported missing on Sign in, used to offer one-click switch to Sign up. */
  const [missing, setMissing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  const isSignUp = mode === "signup";
  const showMissingNotice = !isSignUp && missing !== null && missing === username;

  const switchMode = (next: AuthMode, prefillUsername?: string) => {
    setMode(next);
    setError(null);
    setNameError(null);
    setDisplayNameError(null);
    if (next === "signup") {
      const target = prefillUsername ?? username.trim().toLowerCase();
      if (target && !displayName.trim()) setDisplayName(suggestDisplayName(target));
      setMissing(null);
    } else {
      setMissing(null);
    }
  };

  const submit = async () => {
    const name = username.trim().toLowerCase();
    setError(null);
    setNameError(null);
    setDisplayNameError(null);

    if (isSignUp && !displayName.trim()) {
      setDisplayNameError("Enter the name Venn should call you.");
      return;
    }
    if (!USERNAME.test(name)) {
      setNameError("Use 2–32 characters: lower-case letters, digits, dots, underscores or hyphens.");
      return;
    }
    if (passcodeRequired && !passcode) {
      setError("Enter the server passcode.");
      return;
    }

    setBusy(true);
    try {
      const result = await api.signIn({
        username: name,
        ...(passcodeRequired ? { passcode } : {}),
        ...(isSignUp ? { display_name: displayName.trim(), create: true } : {}),
      });
      onSignedIn(result);
    } catch (e) {
      if (!isSignUp && e instanceof ApiError && e.code === "NOT_FOUND") {
        setMissing(name);
      } else {
        setError(errorMessage(e));
      }
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <div className="auth__tabs" role="tablist" aria-label="Account access">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignUp}
          className={`auth__tab${!isSignUp ? " auth__tab--on" : ""}`}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignUp}
          className={`auth__tab${isSignUp ? " auth__tab--on" : ""}`}
          onClick={() => switchMode("signup")}
        >
          Sign up
        </button>
      </div>

      <div className="auth__header">
        <h1>{isSignUp ? "Create your Venn account" : "Sign in to Venn"}</h1>
        <p className="auth__lead">
          {isSignUp
            ? "Choose your display name and Venn username. Use the same username to connect Venn in ChatGPT."
            : "Use your Venn username — the one you chose when you created your account or connected Venn in ChatGPT."}
        </p>
      </div>

      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {isSignUp && (
          <Field
            label="Display name"
            error={displayNameError}
            hint="What Venn calls you. You can change this anytime."
          >
            {(p) => (
              <input
                {...p}
                name="display_name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (displayNameError) setDisplayNameError(null);
                }}
                placeholder="e.g. Maya Chen"
                autoComplete="name"
                enterKeyHint="next"
                maxLength={LIMITS.displayName}
                autoFocus
                required
              />
            )}
          </Field>
        )}

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
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. maya"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={passcodeRequired ? "next" : "done"}
              maxLength={32}
              autoFocus={!isSignUp}
              required
            />
          )}
        </Field>

        {passcodeRequired && (
          <Field
            label="Server passcode"
            hint="The shared passcode for this development server, not a personal password."
          >
            {(p) => (
              <div className="passcode-wrap">
                <input
                  {...p}
                  name={isSignUp ? "new-passcode" : "passcode"}
                  type={showPasscode ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  enterKeyHint="done"
                  required
                />
                <button
                  type="button"
                  className="passcode-wrap__toggle"
                  aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
                  aria-pressed={showPasscode}
                  onClick={() => setShowPasscode((v) => !v)}
                >
                  {showPasscode ? "Hide" : "Show"}
                </button>
              </div>
            )}
          </Field>
        )}

        {showMissingNotice && (
          <div className="auth__missing" role="status">
            <Icon name="info" size={18} />
            <div className="auth__missing-body">
              <span>No Venn account called “{missing}” yet.</span>
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode("signup", missing ?? undefined)}
              >
                Create an account as “{missing}”
              </button>
            </div>
          </div>
        )}

        <InlineError message={error} />

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy
            ? isSignUp
              ? "Creating account…"
              : "Signing in…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>

        <p className="auth__switch">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Venn?{" "}
              <button type="button" className="link-btn" onClick={() => switchMode("signup")}>
                Create an account
              </button>
            </>
          )}
        </p>
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
