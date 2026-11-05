# XPLO isolated runner protocol

XPLO never executes commands itself. A separately hosted runner (non-root, disposable containers, default-deny
networking, read-only base filesystem, CPU/memory/time limits) must implement this HTTPS API. All requests carry
`Authorization: Bearer <XPLO_RUNNER_TOKEN>`. Set `XPLO_RUNNER_URL` (https only) and `XPLO_RUNNER_TOKEN`.

- `POST /v1/sessions` body `{sessionId, tools[], expiresAt, network: "none"|"lab", allowedTargets[]}` -> `{id}`.
  Create a disposable sandbox. With `network: "none"` it must have no network at all; with `lab` it may reach only `allowedTargets`.
- `POST /v1/commands` body `{sessionId, commandId, argv[], timeoutSeconds}` -> `{exitCode, stdout, stderr, remoteJobId?}`.
  Run `argv` directly (no shell) with only tools from the session. Re-check targets independently of XPLO.
- `DELETE /v1/sessions/:id` destroy the sandbox.

Owner steps in the backend: set `execution_permissions.enabled = true` for the user, and set a scope's `status` to `approved`.
