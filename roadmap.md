# XPLO Cybersecurity Edition

- [x] Build the cybersecurity workspace, specialized agents, configuration, and authorization-gated assessment workflow.
- [x] Connect online AI with streaming, full conversation context, and session-only conversations.
- [x] Verify representative chat, configuration, and authorization flows on mobile.
- [x] Inspect generative-models repository and identify the bridge requirement.
- [ ] Connect image/video generation — blocked: needs a GPU host running the engine and a secured bridge address.
- [ ] Local model (Ollama) connection — blocked: needs a reachable, secured model address.
- [x] Review main flows, authorization safeguards and mobile UX; fix defects found.
- [ ] Publish XPLO AI — waiting: user declined the publish prompt; publish when ready.
- [x] Add invite-only sign-in, user profiles, sign-out, and protected AI access.
- [ ] Verify signed-out restrictions and invited-user access; first account must be invited by the owner.

## Phase 0 stabilization (2 Nov 2026)
- [x] Starter prompts held in memory only (no browser storage); launch handling shared through the conversation context.
- [x] Chat instructions split into a server-only module; browser pages import shared data only.
- [x] Composer keeps unsent drafts when a message is refused; replies stop when leaving a conversation; failed replies offer Try again; length-limit errors explain the limit and offer a new conversation.
- [x] Sign-in separates rejected credentials from service/network problems; sign-out ends the session on this device even if the service is unreachable.
- [x] Regression tests added (20 passing). Signed-in assessment launch, real AI reply, busy-draft handling and empty browser storage checked on a phone-sized preview.
- [ ] Execution provenance — blocked: terminal files and the first execution migration (0001) are not in local history; need a backup or original export. Live execution tables exist and were left untouched; no migration was rerun or reconstructed.
- [x] Native Terminal page: scopes, session, command preview, per-command confirmation, output and audit history; locked while no runner is connected.
- [ ] Connect an isolated runner — blocked: needs a separately hosted runner (protocol in docs/execution-runner.md) and the XPLO_RUNNER_URL / XPLO_RUNNER_TOKEN secrets.
- [ ] Owner grants: set execution permission and approve scopes in the backend (no in-app approval by design).
- [ ] Not yet verified: cancellation on leaving mid-stream in a browser, conversation-limit message in the UI, profile-load failure display, two-account data isolation, fresh deep security scan.

## Saved conversations (5 Nov 2026)
- [x] Opt-in "Save my conversations" switch in Setup (off by default); saved chats listed on Home, reopenable after reload, deletable one by one or all at once. Owner-only access in the database.
- [x] Placeholder added for the missing 0001 migration file (comment only) so new database changes can apply; live execution tables untouched.
- [ ] Not verified end to end: a saved reply from the live AI — the AI service returned "unavailable" during testing (503), so saving was tested directly against the database. Two-account isolation not tested.
- [ ] Terminal: still locked until permission, an approved scope and a connected runner exist (see Phase 0 notes).
