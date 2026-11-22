// Sign-in and sign-up prioritize Google Single Sign-On (no server passcode required).
// Developer/server username sign-in remains available as a collapsed secondary option on Sign in.

import { useEffect, useState } from "react";
import { DEMO, api, googleAuthStartUrl } from "../api";
import { ApiError, errorMessage } from "../errors";
import { BrandMark, Icon } from "../icons";
import { LIMITS, type SignInResult } from "../types";
import { Field, InlineError } from "../ui";

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

type AuthMode = "signin" | "signup";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Try again whenever you're ready.",
  invalid_state: "Your sign-in session expired. Please try continuing with Google again.",
  google_failed: "Google couldn't complete sign-in. Please try again in a moment.",
  email_unverified: "Your Google account needs a verified email address to sign in to Venn.",
  google_not_configured: "Google Single Sign-On isn't configured on this server yet.",
};

function initialMode(): AuthMode {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "signup" ? "signup" : "signin";
}

function initialAuthError(): string | null {
  const code = new URLSearchParams(window.location.search).get("auth_error");
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? "Sign-in didn't finish. Please try again.";
}

function GoogleMark() {
  return (
    <svg className="google-mark" width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3a7.2 7.2 0 0 1-10.72-3.78H1.34v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.34 14.31a7.18 7.18 0 0 1 0-4.62V6.6H1.34a12 12 0 0 0 0 10.8l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.34 6.6l4 3.09A7.17 7.17 0 0 1 12 4.75z"
      />
    </svg>
  );
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
  googleSsoAvailable,
  devSignInAvailable,
  passcodeRequired,
  onSignedIn,
}: {
  googleSsoAvailable: boolean;
  devSignInAvailable: boolean;
  passcodeRequired: boolean;
  onSignedIn: (result: SignInResult) => void;
}) {
  // Arriving from an invite link: the code stays in the URL, and Google returns here after sign-in.
  const invited = window.location.pathname.replace(/\/+$/, "").endsWith("/join");
  const [mode, setMode] = useState<AuthMode>(invited ? "signup" : initialMode);
  const [authError, setAuthError] = useState<string | null>(initialAuthError);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Optional developer/server sign-in fallback state
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [missing, setMissing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth_error")) {
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const isSignUp = mode === "signup";
  const creatingDev = missing !== null && missing === username;

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setAuthError(null);
    setError(null);
    setNameError(null);
    setMissing(null);
  };

  const startGoogle = async () => {
    setAuthError(null);
    setError(null);
    if (DEMO && api.signInWithGoogle) {
      setGoogleBusy(true);
      try {
        const result = await api.signInWithGoogle(mode);
        onSignedIn(result);
      } catch (e) {
        setAuthError(errorMessage(e));
        setGoogleBusy(false);
      }
      return;
    }
    setGoogleBusy(true);
    window.location.assign(googleAuthStartUrl(mode));
  };

  const submitServerSignIn = async (create: boolean) => {
    const name = username.trim().toLowerCase();
    setError(null);
    setNameError(null);
    if (!USERNAME.test(name)) {
      setNameError("Use 2–32 characters: lower-case letters, digits, dots, underscores or hyphens.");
      return;
    }
    if (passcodeRequired && !passcode) {
      setError("Enter the server passcode.");
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

  // Show the server sign-in option on Sign in (collapsed when Google SSO is available),
  // or automatically expanded if Google SSO is not configured on this server yet.
  const showServerFallback = devSignInAvailable && (!isSignUp || !googleSsoAvailable);

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
        <h1>{invited ? "A friend invited you to Venn." : isSignUp ? "Build your inner circle." : "Open your Venn."}</h1>
        <p className="auth__lead">
          {isSignUp
            ? "Use your Google account to get started in one click — no server passcode needed."
            : "Continue with Google to open your Venn circle, memories and plans."}
        </p>
      </div>

      <div className="stack">
        <button
          type="button"
          className="btn btn--google btn--block"
          disabled={!googleSsoAvailable || googleBusy}
          onClick={() => void startGoogle()}
        >
          <GoogleMark />
          <span>
            {googleBusy
              ? "Connecting to Google…"
              : isSignUp
                ? "Sign up with Google"
                : "Continue with Google"}
          </span>
        </button>

        {!googleSsoAvailable && (
          <p className="auth__note">
            Google Single Sign-On isn’t configured on this server yet. Set{" "}
            <code className="mono">GOOGLE_CLIENT_ID</code> and <code className="mono">GOOGLE_CLIENT_SECRET</code> to
            enable it.
          </p>
        )}

        <InlineError message={authError} />
      </div>

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

      {showServerFallback && (
        <>
          <div className="auth__divider" aria-hidden="true">
            <span>or</span>
          </div>
          <details className="auth__alt" open={!googleSsoAvailable}>
            <summary>Use server sign-in instead</summary>
            <form
              className="stack auth__alt-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submitServerSignIn(creatingDev);
              }}
            >
              <Field
                label="Venn username"
                error={nameError}
                hint="For developer accounts created with a username and server passcode."
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
                    required
                  />
                )}
              </Field>

              {passcodeRequired && (
                <Field
                  label="Server passcode"
                  hint="Optional shared passcode for this server."
                >
                  {(p) => (
                    <div className="passcode-wrap">
                      <input
                        {...p}
                        name="passcode"
                        type={showPasscode ? "text" : "password"}
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        autoComplete="current-password"
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

              {creatingDev && (
                <div className="auth__create" role="status">
                  <div className="auth__missing">
                    <Icon name="info" size={18} />
                    <span>No server account called “{missing}” yet.</span>
                  </div>
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

              <button type="submit" className="btn btn--block" disabled={busy}>
                {busy ? "One moment…" : creatingDev ? "Create server account" : "Sign in with server username"}
              </button>
            </form>
          </details>
        </>
      )}
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
