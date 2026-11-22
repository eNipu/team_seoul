# T43 · ChatGPT preview and account entry

**Goal.** Show the actual Venn widget on the public site with sample data and make the profile
and connection paths visible.

- The website embeds the real welcome, reply and memory-review cards with a sandboxed, in-memory
  demo bridge. Sample approvals never call the production MCP server.
- Header and footer links open the account route directly. Signed-out visitors return to that route
  after sign-in. Keep the public waitlist separate from a Venn account.
- For beta users, give the documented custom server setup and a copyable HTTPS URL. When a public
  directory listing exists, set `CHATGPT_PLUGIN_URL` to replace that setup with the directory link.

## Public release gaps

- Confirm ownership and publication in the [OpenAI plugin portal](https://platform.openai.com/plugins).
  Finish real support and terms URLs and review the privacy policy for the whole linked product.
- Use one production identity provider for both ChatGPT OAuth and website sign-in. Provide a test
  account and complete a ChatGPT session with connect, read, review, approve, and disconnect.
- If `inapp.joinvennai.com` is the chosen profile hostname, provision DNS and TLS and verify the
  redirect and cross-entry session behavior before linking it. The current working URL is
  `https://app.joinvennai.com/app/account`.
- Test the site and widget together using an isolated database and then verify the published listing
  flow and public landing page without creating production demo accounts.
