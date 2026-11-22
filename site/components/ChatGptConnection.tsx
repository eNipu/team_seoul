"use client";

import { useRef, useState } from "react";

const MCP_URL = "https://app.joinvennai.com/mcp";

export default function ChatGptConnection({ listingUrl }: { listingUrl: string | null }) {
  const field = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyServer() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
    } catch {
      field.current?.select();
      field.current?.focus();
    }
  }

  if (listingUrl) {
    return <a className="btn btn--primary" href={listingUrl}>Connect in ChatGPT</a>;
  }

  return (
    <details className="chatgpt-preview__connection">
      <summary>Set up a test connection</summary>
      <p>In ChatGPT Plugins, choose <strong>Add custom MCP server</strong>. Paste this URL and choose OAuth. This beta requires access to Venn’s test sign-in.</p>
      <div className="chatgpt-preview__copy">
        <input ref={field} aria-label="Venn MCP server URL" value={MCP_URL} readOnly />
        <button className="btn" type="button" onClick={() => void copyServer()}>{copied ? "Copied" : "Copy URL"}</button>
      </div>
      <a className="btn btn--primary" href="https://chatgpt.com/plugins">Open ChatGPT Plugins</a>
    </details>
  );
}
