import { Icon } from "./icons";

interface Props {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  busy?: boolean;
}

/** "NOT_FOUND: connection not found" → "connection not found" (first letter capitalized). */
export function displayError(message: string): string {
  const m = /^[A-Z][A-Z0-9_]*:\s+([\s\S]+)$/.exec(message.trim());
  const text = (m ? m[1] : message).trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Something went wrong.";
}

/** Recoverable error message. Text is rendered as plain text (never HTML). */
export default function ErrorBanner({ message, onRetry, onDismiss, busy }: Props) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon" aria-hidden="true">
        <Icon name="alert" size={18} />
      </span>
      <p className="error-banner__text">{displayError(message)}</p>
      <div className="error-banner__actions">
        {onRetry && (
          <button type="button" className="btn btn--small" onClick={onRetry} disabled={busy}>
            {busy ? "Retrying…" : "Retry"}
          </button>
        )}
        {onDismiss && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onDismiss} aria-label="Dismiss error">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
