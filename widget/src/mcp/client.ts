// Thin wrapper around the MCP Apps bridge (`@modelcontextprotocol/ext-apps`).
// Exposes a small, feature-detected surface used by the UI. The same
// `HostBridge` interface is implemented by the local mock (see ../mock.ts).

import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  type McpUiHostContext,
  type McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps";

/** Standard MCP CallToolResult, as typed by ext-apps. */
export type CallToolResult = McpUiToolResultNotification["params"];

export type ToolOutcome =
  | { ok: true; data: unknown; errorText?: undefined }
  | { ok: false; data?: undefined; errorText: string };

export interface HostBridge {
  readonly isMock: boolean;
  /** Call a tool on the Heldly MCP server (proxied by the host). Never throws. */
  callTool(name: string, args: Record<string, unknown>): Promise<ToolOutcome>;
  /** Update the model's context for future turns. Resolves false if unsupported/failed. */
  updateModelContext(text: string): Promise<boolean>;
  /** Send a user message into the conversation. Resolves false if unsupported/failed. */
  sendMessage(text: string): Promise<boolean>;
  /** Ask the host to open an external link. Resolves false if unsupported/denied/failed. */
  openLink(url: string): Promise<boolean>;
}

export interface BridgeHandlers {
  onToolInput(args: Record<string, unknown> | undefined): void;
  onToolResult(result: CallToolResult): void;
  onToolCancelled(): void;
  onHostContext(ctx: McpUiHostContext): void;
}

/** Extract human-readable error text from a CallToolResult's content blocks. */
export function extractText(result: Pick<CallToolResult, "content"> | undefined): string {
  const blocks = Array.isArray(result?.content) ? result!.content : [];
  const parts: string[] = [];
  for (const b of blocks) {
    if (b && typeof b === "object" && b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
    }
  }
  return parts.join("\n").trim();
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

/** Apply host theme (or OS preference) to the document. */
export function applyTheme(theme: unknown): void {
  if (theme === "light" || theme === "dark") {
    applyDocumentTheme(theme);
    return;
  }
  const prefersDark =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyDocumentTheme(prefersDark ? "dark" : "light");
}

class ExtAppsBridge implements HostBridge {
  readonly isMock = false;
  private ctx: McpUiHostContext = {};

  constructor(private readonly app: App) {}

  mergeContext(partial: McpUiHostContext): McpUiHostContext {
    this.ctx = { ...this.ctx, ...partial };
    return this.ctx;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
    try {
      const result = await this.app.callServerTool({ name, arguments: args });
      if (result.isError) {
        return { ok: false, errorText: extractText(result) || `Tool ${name} failed.` };
      }
      return { ok: true, data: result.structuredContent ?? null };
    } catch (e) {
      return { ok: false, errorText: errMessage(e) };
    }
  }

  async updateModelContext(text: string): Promise<boolean> {
    // Feature-detect: method present and host advertises the capability.
    if (typeof this.app.updateModelContext !== "function") return false;
    const caps = this.app.getHostCapabilities();
    if (caps && !caps.updateModelContext) return false;
    try {
      await this.app.updateModelContext({ content: [{ type: "text", text }] });
      return true;
    } catch {
      return false;
    }
  }

  async sendMessage(text: string): Promise<boolean> {
    if (typeof this.app.sendMessage !== "function") return false;
    const caps = this.app.getHostCapabilities();
    if (caps && !caps.message) return false;
    try {
      const res = await this.app.sendMessage({ role: "user", content: [{ type: "text", text }] });
      return !res?.isError;
    } catch {
      return false;
    }
  }

  async openLink(url: string): Promise<boolean> {
    if (typeof this.app.openLink !== "function") return false;
    const caps = this.app.getHostCapabilities();
    if (caps && !caps.openLinks) return false;
    try {
      const res = await this.app.openLink({ url });
      return !res?.isError;
    } catch {
      return false;
    }
  }
}

/**
 * Create the ext-apps App, register handlers (before connecting, so one-shot
 * notifications like tool-input/tool-result are not missed), and connect to
 * the host over postMessage.
 */
export async function connectToHost(handlers: BridgeHandlers): Promise<HostBridge> {
  const app = new App({ name: "heldly-widget", version: "1.0.0" }, {}, { autoResize: true });
  const bridge = new ExtAppsBridge(app);

  app.ontoolinput = (params) => handlers.onToolInput(params.arguments);
  app.ontoolresult = (result) => handlers.onToolResult(result);
  app.ontoolcancelled = () => handlers.onToolCancelled();
  app.onhostcontextchanged = (partial) => {
    const ctx = bridge.mergeContext(partial);
    if (partial.theme) applyTheme(partial.theme);
    handlers.onHostContext(ctx);
  };

  await app.connect(new PostMessageTransport(window.parent, window.parent));

  const initial = app.getHostContext();
  if (initial) {
    const ctx = bridge.mergeContext(initial);
    applyTheme(ctx.theme);
    handlers.onHostContext(ctx);
  } else {
    applyTheme(undefined);
  }
  return bridge;
}
