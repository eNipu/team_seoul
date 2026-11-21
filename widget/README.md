# Heldly widget (MCP Apps UI)

The embedded UI for **Heldly**, shown inside ChatGPT through the MCP Apps extension.
It's built with React 19, TypeScript, Vite 8 and `vite-plugin-singlefile`, and talks to the host with
[`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps) (v2.0.4).

## Build & dev

```bash
npm install
npm run build      # tsc --noEmit && vite build → dist/index.html (one self-contained file)
npm run typecheck
npm run dev        # local demo harness
```

The Python server reads `widget/dist/index.html` and serves it as MCP resource
`ui://heldly/app-v1.html` with mimeType `text/html;profile=mcp-app`.

### Demo mode

When the page isn't inside a host iframe (`window.parent === window`), the widget uses a local
mock bridge (`src/mock.ts`) instead of the ext-apps connection:

- `http://localhost:5173/?view=memory_review`
- `http://localhost:5173/?view=dashboard`
- no `view` → empty state
- add `&flaky=1` to make every other tool call fail, so you can test the error banner and Retry

Mock tool calls resolve locally with fake state changes. `updateModelContext` and `sendMessage` are
logged to the console.

## Views

The widget renders the `structuredContent` of the latest host tool result (`ontoolresult`) and picks
a view from its `view` field. All payloads are treated as untrusted: `src/types.ts` coerces them into
typed objects, and everything is rendered as text (no `dangerouslySetInnerHTML`). While a tool is
running (`ontoolinput`), the widget shows a loading skeleton. A tool result with `isError` shows an
error banner and keeps the previous view.

| `view` | What it shows |
| --- | --- |
| `memory_review` | Proposed memories. Each one has a checkbox (checked by default), an editable title and description, a visibility select and a category badge. Nothing is saved until the user clicks **Save selected**. |
| `dashboard` | Tabs: **Profile** (bio, goals, interest chips), **Memories** (visibility badges, delete with confirmation), **Connections** (connection cards, pending requests with Accept/Decline, **Invite a friend**). |
| anything else | Empty state: "Ask Heldly to get to know you, remember something, or show your dashboard" |

## Tool calls made by the widget

| Trigger | Tool | Arguments | Expected `structuredContent` |
| --- | --- | --- | --- |
| Save selected | `heldly_save_memories` | `{ proposal_id, approvals: [{ index, visibility, title, description }] }` (checked items only) | `{ saved: Memory[], count }` |
| Delete memory (after confirming) | `heldly_delete_memory` | `{ memory_id }` | `{ deleted: true, memory_id }` |
| Accept / Decline request | `heldly_respond_to_connection` | `{ request_id, accept }` | `{ request_id, status: "ACCEPTED"\|"REJECTED", connection_id }` |

Error text is taken from `content[].text` when the result has `isError: true`. Failed actions keep
the local state and show a banner with **Retry**.

## Host interactions (feature-detected)

- `updateModelContext`: after saving (`Saved N memories to Heldly profile: <titles>`) or discarding
  (`User discarded the proposed memories.`). Skipped if the host doesn't advertise `updateModelContext`.
- `sendMessage`: **Invite a friend** sends `Create a Heldly invite code so a friend can connect with me.`.
  If the host doesn't support `message`, the widget shows a hint to ask in chat instead.
- Theme: `hostContext.theme` is applied with `applyDocumentTheme`. Without it, the widget follows
  `prefers-color-scheme`.

## Layout

```
src/main.tsx               React entry
src/App.tsx                host connection / mock selection, view switching, loading & empty states
src/mcp/client.ts          wrapper around ext-apps App (HostBridge interface)
src/mock.ts                demo data + mock bridge
src/types.ts               data contract + defensive parsers
src/components/            MemoryReview, Dashboard, ConnectionCard, ErrorBanner
src/styles.css             all styles (light/dark)
```
