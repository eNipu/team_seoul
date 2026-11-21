interface Props {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  busy?: boolean;
}

/** Recoverable error message. Text is rendered as plain text (never HTML). */
export default function ErrorBanner({ message, onRetry, onDismiss, busy }: Props) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon" aria-hidden="true">!</span>
      <p className="error-banner__text">{message}</p>
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
