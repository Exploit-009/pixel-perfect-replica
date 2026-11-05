<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Conversations live only in in-memory React context (`src/components/xplo-session.tsx`); never persist chats to storage or the database — the user chose no saved history.
- Model calls go through `/api/chat` using the AI Gateway SDK; chat instructions and model input live in `src/lib/xplo-chat.ts`, imported only by the API route and tests, while browser-safe data and validation stay in `src/lib/xplo.ts` — this prevents page imports from pulling in server instructions.
- Starter prompts are handed off through `XploSession.createThread` and consumed once by `takeFirstPrompt`, never browser storage — this keeps assessment details memory-only while preserving prompt launch behavior.
- External engines (generative-models, local models, tool runners) connect only through separate authenticated bridges; never vendor or modify the engine code here.
- Access is invite-only: public sign-up is disabled, pages live under `src/routes/_authenticated/`, and `/api/chat` validates the bearer token server-side (`src/lib/access.ts`); the owner adds users in the backend Users view.
- Command execution lives in `src/lib/execution-policy.ts` (browser-safe validation) and `src/lib/execution.functions.ts` (auth-gated server functions); commands only ever go to the external runner through `execution-runner.server.ts` and are refused when `XPLO_RUNNER_URL`/`XPLO_RUNNER_TOKEN` are unset — never execute on the app server. Execution tables are written only by the server with the admin client after verifying the caller; the browser has SELECT-only access.
