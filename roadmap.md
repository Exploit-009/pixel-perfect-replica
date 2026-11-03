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
- [ ] Terminal and execution service (Phase 1) — not started: needs a separately provisioned isolated runner and your approval.
- [ ] Not yet verified: cancellation on leaving mid-stream in a browser, conversation-limit message in the UI, profile-load failure display, two-account data isolation, fresh deep security scan.
