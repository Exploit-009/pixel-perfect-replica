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
- Model calls go through the `/api/chat` server route using the AI Gateway SDK; prompts and safety instructions stay server-side in `src/lib/xplo.ts`.
- External engines (generative-models, local models, tool runners) connect only through separate authenticated bridges; never vendor or modify the engine code here.
- Access is invite-only: public sign-up is disabled, pages live under `src/routes/_authenticated/`, and `/api/chat` validates the bearer token server-side (`src/lib/access.ts`); the owner adds users in the backend Users view.
