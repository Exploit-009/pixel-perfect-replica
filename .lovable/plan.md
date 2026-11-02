# XPLO AI: evidence-based audit and phased roadmap

## Scope and verdict

Audit dated **2 November 2026**. The **Code review** skill shaped this assessment. No application code, data, migrations, settings, dependencies, or publication was changed. Only this audit/plan was written. Existing tests and read-only browser/database checks were run; no account session was minted, AI request sent as a user, or command executed.

**Verdict:** the current source contains an invite-only guided cybersecurity assistant—not the previously described working execution terminal. `/terminal` reproducibly returns **404**. Execution tables and a pending scope exist in the live backend, but their UI, command policy, and service adapter are absent from this checkout. Do not advertise real execution or treat earlier completion messages as current evidence.

Preserve every existing feature and record. No rewrite, destructive cleanup, main-app-server command execution, or automatic publication is proposed.

## Evidence and verification boundaries

- **Runtime:** localhost browser, desktop 1280×1800 and mobile 390×844; signed-out navigation, sign-in appearance, 404, unsigned API rejection. Screenshots inspected: `/tmp/xplo-audit-desktop.png` and `/tmp/xplo-audit-mobile.png`.
- **Tests:** existing Vitest suite: **3 files, 12 tests passed**. Latest available check: `build OK`, **16:22:10 UTC**. No manual build, typecheck, install, or migration run.
- **Backend:** read-only live catalog/policy/effective-grant queries, aggregate row counts, and hosted auth settings. This confirms configuration, not two-account isolation or signed-in end-to-end behavior.
- **Security:** designated scan results only; no independent vulnerability assessment. Deep/database scans: **15:16:31 UTC**, no findings returned, explicitly **outdated**. Dependency scan: **15:31:02 UTC**, no findings, marked current. These results do not establish security of the latest changes. Run a fresh deep scan from the **Security tab** before release; no scan was started during this audit.
- **AI:** gateway request listing returned no requests in its reported window, 1–2 November. Source integration is present; current successful generation, model access, cost, and latency are unverified.
- No product-advisor review has been generated; recommendations below derive from inspected evidence.

## Verified features versus missing capabilities

| Surface | Confirmed implementation | Verification level / limitation |
|---|---|---|
| `/auth` | Email/password sign-in, inline rejection, internal return path | Sign-in page rendered; no successful login attempted |
| `/` | Home, eight specialist presets plus Security Core, 14 specialties | Source verified; signed-out redirect verified |
| `/assessment` | Objective/scope/context, authorization attestation, planner prompt | Source and validator tests; not a reviewed execution authorization |
| `/tools` | Eight tool-guide starters | Prompt launchers, **not installed or executable tool integrations** |
| `/setup` | Experience/environment/specialties in React state | Source verified; no configurable automatic execution mode |
| `/chat/$threadId` | In-memory threads, streamed text, Stop/Clear, errors | Source verified; current authenticated generation untested |
| `POST /api/chat` | Server bearer validation, same-origin check, schema validation, AI Gateway NDJSON | Unsigned 401 and foreign-origin 403 reproduced |
| `/terminal` | No route or nav item | **404 reproduced**; no command preview, approval, output, or lifecycle UI |
| Execution backend | Five execution tables, owner-read policies, audit privilege restrictions | Live structure exists; no execution sessions/commands recorded |
| Profiles | Profile trigger/policies, header name read | One account and one profile exist; no profile editor |
| Media/local engines | Documented bridge requirements | No adapter or live connection verified |
| PWA | Manifest and icons | No service worker/offline shell found; offline behavior not claimed |

Every existing content page has its own title, description, Open Graph text, type, and Twitter card. The protected index owns `/`; there is no placeholder home page.

Sources: `src/routes/_authenticated/{index,assessment,tools,setup}.tsx`; `chat.$threadId.tsx:14–110`; `auth.tsx:8–56`; `api/chat.ts:7–40`; `src/lib/xplo.ts:3–35`; `public/manifest.webmanifest`.

## Backend, auth, and authorization facts

**Hosted settings read successfully:** public signup disabled, anonymous users disabled, email/password enabled, social providers disabled, automatic email confirmation disabled. Password-breach checking and current-password enforcement were not exposed by this endpoint and remain unverified.

**Live records, counts only:** users 1; profiles 1; execution permissions 0; scopes 1; sessions 0; commands 0; audit entries 1. The scope is pending, training, network `none`. Its existence is not proof of a working current submission flow or runner.

**RLS and effective grants:** all six public tables have RLS enabled. Execution policies allow authenticated users to SELECT only their own rows. Anonymous roles have no execution table access; authenticated roles cannot directly insert/update/delete execution rows. The service role can manage execution records, while audit UPDATE/DELETE/TRUNCATE are revoked and SELECT/INSERT retained. Profiles have own-read/own-update policies; effective table grants are broader than the migration's explicit grants, so policies remain the row boundary. No cross-user access exploit was tested or asserted. Database-owner operations are outside an ordinary application-role append-only guarantee.

Page protection uses `auth.getUser()` in `_authenticated/route.tsx:4–12`. `/api/chat:7–19` independently revalidates the token and requires a confirmed, non-anonymous account (`access.ts:12–14`). The helper does **not** verify invitation provenance; admission depends on the verified disabled-signup settings and owner provisioning. No application auth-change subscriber was found. Existing backend permission/scope records are **not** wired into chat.

The assessment form rejects unattested/unknown-third-party plans in the browser (`xplo.ts:17–21`). Direct chat uses model instructions, not a server-side execution scope check. This is a planning safeguard—not authorization to launch tools, and not independent proof of permission.

## Confirmed gaps and their user impact

### P0: source/backend drift blocks execution readiness

1. **Missing terminal implementation.** No `terminal.tsx`, `execution.functions.ts`, or `execution-policy.ts`; generated route registry omits terminal. Users cannot access the claimed feature. Old dev logs mention those filenames, but logs do not recover their source or prove current behavior.
2. **Incomplete migration chain.** Journal references `0001_add_isolated_execution_controls`, but its SQL and snapshot are absent; `0002_restrict_execution_table_grants.sql:1–4` assumes those tables. Live tables exist. A fresh replay cannot be treated as reproducible. Do not rerun or recreate live tables to repair this evidence gap.
3. **No runnable bridge contract.** Source has no execution service endpoint adapter, capability discovery, job/output protocol, or lifecycle tests. A host address alone will not complete execution.

### P1: retention and chat reliability

4. **Prompt handoff violates strict memory-only handling.** Home, Tools and Assessment write starter prompts—including entered scope/objective—to `sessionStorage`; Chat consumes/deletes them. Interrupted handoff can leave content stored. Threads themselves remain in React memory. Remove this storage path without adding saved history (`index.tsx:25–28`; `tools.tsx:14`; `assessment.tsx:23–28`; `chat:83–86`).
5. **Hard conversation ceiling without recovery.** Schema permits 40 messages, 12,000 characters each; route caps request text at 120,000 characters. Client resends all history. With ordinary alternating replies, turn 21 submits 41 messages and is rejected; an oversized assistant reply can invalidate the next request. This boundary is confirmed in source, not reproduced with live AI (`xplo.ts:23`; `api/chat:20–24`; `chat:47–57`).
6. **Draft/request lifecycle gaps.** Composer resets before its callback; chat passes `void send(text)` and silently refuses busy submissions. No unmount abort cleanup exists. Draft loss during a busy submit and background generation after navigation require authenticated reproduction before fixing (`prompt-input.tsx:844–879`; `chat:41–43,80–87,105`).
7. **Weak recovery and visibility.** No thread list despite multiple in-memory threads; users rely on browser history. Sign-in lacks exception cleanup/recovery UI; sign-out clears local state before checking success. Profile errors fall back without surfacing the failure (`app-shell.tsx:20–38`; `auth.tsx:32–42`). No password-reset/invitation-completion screen exists; confirm the owner-provisioning workflow before choosing onboarding work.

### P2: architecture and maintainability

8. Shared `xplo.ts` combines browser data/validation with system instructions and is imported by client pages. Server-only separation is not explicit; production instruction leakage is **not established**. Three pages duplicate thread/prompt/navigation orchestration. Consolidate boundaries, not the whole app.
9. Gateway exceptions become generic messages without logging the original exception; auth/body failures sit outside the route's structured catch. Historical abort/500 logs are not a current reproduction (`api/chat:19–40`; `start.ts:6–17`).
10. Large shared composer (1,463 lines) contains unused-by-this-screen capabilities; app pages are small. Do not delete library exports merely for size. No confirmed v2/backup duplication or whole-table browser fetch was found; profile read is constrained to one user. Future execution history needs cursor pagination, not silent caps.

These are functional/architecture findings, not new security-scan findings. Quotas, approval/replay protection, service isolation, and cross-user denial are **release acceptance requirements**, not claims that a currently absent terminal is exploitable.

## Mobile, tests, and untested areas

Sign-in fits both tested viewports without horizontal overflow; no browser page errors occurred. All existing protected URLs redirected signed-out visitors correctly. `/terminal` and an unknown URL returned 404. No fresh blank-screen failure reproduced.

Authenticated Home/Chat/Assessment/Tools/Setup, virtual keyboard behavior, long code blocks, large text, screen readers, physical Android/iOS, and safe areas remain untested. Source uses fixed bottom navigation without safe-area spacing and chat height `100dvh − 8.5rem`; these are candidates to check, not proven overlap bugs. Setup's experience/environment controls lack selection semantics; some action targets are 36px.

The 12 tests cover assessment rules/modules (4), model-input role handling (2), access helpers (5), and root route matching (1). They do not test real sign-in/out, RLS between users, API streaming/cancellation, composer recovery, limits in the UI, terminal policy, bridge behavior, migration replay, or mobile interactions. Authenticated checks were deliberately not performed because this audit prohibits session/state changes. No new credentials are needed in chat.

## Prioritized implementation roadmap — approval required

### Phase 0: reconcile and stabilize the current assistant

Perform in small reviewed steps, leaving the app working after each:

1. Recover missing execution source/migration evidence from project history or approved artifacts. Compare against live catalog; record exact differences. Recover documentation only if provenance is established. **Do not apply migrations or overwrite tables.** Update roadmap/ledger to distinguish implemented, tested, and externally blocked work.
2. Replace starter-prompt browser storage with React-context handoff; consolidate the three launch paths. Separate shared constants/schemas from server instructions. Preserve all current prompts, settings, routes, model behavior, and session-only chats.
3. Add focused regression tests and fix reproduced draft/cancellation/auth error-handling issues; make current request limits actionable without silently discarding history. Keep the existing numerical limits unless a separate change is approved.
4. With explicit permission for authenticated test activity, verify a real invited-user chat and planning flow, expiry/sign-out, and mobile navigation. Review a fresh Security-tab scan; do not change settings or dependencies implicitly.

**Acceptance:** all 12 baseline tests plus targeted regressions pass; all six current pages retain behavior; no application prompt/chat content reaches browser storage; failure does not masquerade as success; no live records lost; missing schema provenance resolved or explicitly blocked; authenticated AI and mobile evidence recorded. No terminal readiness claim without Phase 1 evidence.

### Phase 1: genuine native terminal, training-first

Architecture: **native XPLO terminal → authenticated app control layer → separate authenticated disposable execution service**. Main app handles permission, scope, approval, state and audits only. Never spawn commands, mount workspaces, or run arbitrary shell on the app server. AI may propose commands but cannot authorize them.

Deliver in order:
1. Define versioned service contract, tool capabilities, quotas/time limits, health checks, job IDs, cancellation, ordered bounded output and idempotency. Establish owner approval/revocation workflow; never derive roles from editable profiles. Any necessary schema/RLS change requires separate review and additive migration approval.
2. Provision disposable non-root isolated sessions: read-only base, bounded workspace, CPU/memory/process/output/lifetime limits, no host mounts/socket/app secrets, network off by default. Approved lab networking only. Runner independently enforces tool/argument and scope policy; do not rely on string filtering or UI warnings.
3. Build `/terminal` inside XPLO: command input, exact preview and fresh one-use expiring confirmation for every command; real stdout/stderr, status/exit/duration, history, cancel, reset/destroy with extra confirmation. All interactions stay in XPLO. Persist execution audit separately from chats and paginate history.
4. Enforce ownership and permission on every action; deny expired/revoked scopes, altered/replayed approvals and unavailable services. Validate uncertain dispatch outcomes without duplicate execution. Expire/destroy abandoned sessions even when the app is closed. Render output safely; redact secrets from logs.
5. Prove training-lab execution before enabling real assessments. Real assessments need reviewed authorization, target/exclusion/time-window enforcement and restricted egress, including redirected/resolved destinations. Keep them disabled until those checks pass.

**Acceptance:** an invited permitted user previews/confirms a harmless approved command, sees genuine output from a disposable session, reloads execution history, cancels and destroys the session. Denial cases cover unsigned/cross-user/revoked/expired/out-of-scope/disallowed/duplicate commands. Runner-offline produces no fake output or host fallback. Independent evidence verifies isolation/resource/network controls and cleanup. Android keyboard/scroll and desktop output remain usable. Unconfigured service means unavailable—not a decorative success state.

**Dependencies:** separately provisioned execution infrastructure, service credentials supplied through Secrets, maintained tool images/licensing, operating budget/quotas, isolation evidence, authorized test accounts, and owner scope-review decisions. No runner address/capabilities/credentials are verified by this audit. No new package is preapproved.

Later: authenticated Ollama and GPU media bridges remain separate optional projects; neither is a prerequisite for a training terminal. Publishing remains a distinct explicit approval.

## Existing roadmap reconciliation

`roadmap.md` still leaves invited-user verification open and assumes the first account is absent; live counts now show one. Its earlier mobile/review checkboxes do not substitute for current authenticated evidence. Image/video, local model, and publication remain open. Execution is not represented there despite backend artifacts. Update only after implementation approval; do not mark blocked work complete.

## Lovable prompt for the first approved phase

> Implement **Phase 0 only** from this audit, one verified step at a time. Preserve every current route, feature, profile, execution record, and session-only conversation rule. First reconcile missing execution files/migration provenance with current source and live read-only evidence; do not invent or rerun missing migrations. Replace starter-prompt sessionStorage with in-memory context and consolidate launch handling; explicitly separate shared schemas/data from server-only prompts without changing AI behavior. Add regression tests before fixing reproduced composer, cancellation, auth error and conversation-limit recovery issues. Retain existing limits. Run relevant tests and verify each change in the preview before continuing. Authenticated/AI tests need explicit permission for their activity; report blocked checks honestly. Update roadmap and architecture documentation to match verified facts. Do not enable terminal execution, install/update packages, change auth/settings, migrate data, alter permissions, delete records, or publish. Stop at Phase 0 acceptance and report evidence plus blockers; Phase 1 requires separate approval.
