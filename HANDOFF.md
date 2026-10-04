# HANDOFF — opencode-fluffyspace fork work (last updated 2026-10-04)

Local state of the `fluffyspace/opencode` fork and the custom approval-mode
work built on top of it, so a future session can continue without
re-discovering everything.

## What this repo is
- Clone of `https://github.com/fluffyspace/opencode`, branch `output-approval`,
  at `/home/kodba/opencode-fluffyspace`. Bun-workspaces + turbo monorepo.
- The fork's `output-approval` branch carries one custom commit ahead of upstream dev:
  `751fee493` "feat: add tool_result permission to approve tool output before sending to model".
- The rebuild of this branch is what is installed at `/usr/local/bin/opencode`
  (symlink → `packages/opencode/dist/opencode-linux-x64/bin/opencode`), version
  `0.0.0-output-approval-202609201208`, re-pointed 2026-10-04.
- After the 2026-09 SSD swap the box had a different `fix/stale-width-shrink` build
  installed (version `0.0.0-fix/stale-width-shrink-202608200952`, built 2026-08-20,
  which lacks the output-approval feature). That binary is backed up at
  `/home/kodba/backups/opencode-fix-stale-width-shrink-202608200952`; its source
  branch is not present in any local repo.
- The official npm install (`opencode-ai`) and `/usr/bin/opencode` / `/bin/opencode`
  no longer exist on this box, so there is no upstream rollback path anymore.

## How the custom binary is built & installed
- Build: `export PATH="/root/.bun/bin:$PATH"` then
  `cd /home/kodba/opencode-fluffyspace && bun install --frozen-lockfile && bun run --cwd packages/opencode script/build.ts --single`
- Output: `packages/opencode/dist/opencode-linux-x64/bin/opencode`
  (self-contained; embeds web UI).
- Install (re-point): `sudo ln -sf ~/opencode-fluffyspace/packages/opencode/dist/opencode-linux-x64/bin/opencode /usr/local/bin/opencode`
- `/usr/local/bin` precedes `/usr/bin` in both the user PATH and sudo `secure_path`,
  so `opencode` AND `sudo opencode` both resolve to the fork build. Current version
  string: `0.0.0-output-approval-202609201208` (rebuilt 2026-09-20).
- Rollback: `sudo rm /usr/local/bin/opencode` restores official upstream.
- The pre-push hook runs `bun typecheck`; bun lives at `/root/.bun/bin/bun` (build-only).

## Approval-mode feature (tool_result permission)
Commit `751fee493` adds a `tool_result` permission that gates whether a tool's
**output** is forwarded to the model after the tool runs (vs. gating whether the
tool runs). `approveOutput` in `packages/opencode/src/session/tools.ts` checks the
merged agent+session ruleset; on "ask" it fires a `tool_result` permission request and
the TUI offers **Send once / Always send / Withhold**. Withholding replaces the output
with `[Tool output withheld by the user]`.

Config (global `~/.config/opencode/opencode.json` or project `opencode.json`):
```json
{ "permission": { "tool_result": { "*": "ask" } } }
```
- `"ask"` — prompt before every result is sent
- `"deny"` — silently withhold (model gets the placeholder)
- `"allow"` — forward unchanged (default)
The project `nsfw-scan/opencode.json` has `tool_result: ask`.

## Mid-session output-approval toggle (`/permissions`) — reworked 2026-09-20
`/permissions` now toggles **output approval only** (session-scoped `tool_result` rule),
and its state is derived from the same effective-gate helper as the badge, so they can't
disagree. (The old version used a `*` wildcard that also flipped all tool-call
permissions and was off-by-one vs the config default.)

- **State model:** `outputGateMode(config.permission, session.permission)` in
  `packages/tui/src/util/output-gate.ts` (mirrors server `approveOutput`). `ask`/`deny`
  = gated; `allow`/absent = not gated.
- **Toggle:** on(`ask`) ⇄ off(`allow`); writes session
  `{permission:"tool_result", action, pattern:"*"}` through the `permissionMode` field.
  Does not change tool-call permissions. Toast states on/off; command title states the
  current state.
- **Server API** (`groups/session.ts`, `handlers/session.ts`): `permissionMode:
  "ask"|"allow"|"default"` → `permissionModeOverride()` maps to `tool_result`
  ask/allow (or clears). Replaces the session ruleset (never accumulates).
- **Mid-turn staleness fixed:** `approveOutput` (`session/tools.ts`) re-reads the session
  via `Session.Service` for each tool output, so a toggle applies to the remainder of the
  current turn. `session/prompt.ts` provides `Session.Service` to `SessionTools.resolve`.
- **Badge:** `component/prompt/index.tsx` renders `output: ask` / `output: withhold` next
  to the agent name; hidden when ungated or while yolo is on.

## Full-access toggle (`/yolo`)
`/yolo` (aliases `auto`, `full-access`) in `packages/tui/src/app.tsx` toggles
`local.permission.mode` ("auto", also the `--yolo` flag). In auto mode the TUI auto-replies
`once` to every `permission.asked` event (`context/sync.tsx`), including `tool_result`, so
nothing is gated. Toast reports on/off; the prompt already shows an `auto` badge.

- **Docs** (`packages/web/src/content/docs/permissions.mdx`): documented.
- SDK was regenerated (`./script/generate.ts`) earlier so `@opencode-ai/sdk/v2` exposes
  `permissionMode`.
- **Note:** rebuild with the command above after source changes.

## Repo conventions (see root AGENTS.md)
- Default branch `dev` (a local `main` may not exist). Branch names ≤3 words,
  hyphen-separated, no `feat/` prefixes. Conventional commits (`type(scope): summary`).
- `bun typecheck` = `tsgo --noEmit` (never bare `tsc`); `bun lint` = oxlint.
- Tests run from package dirs, never the root (`test.root` guard).
- TUI lives in `packages/tui` (CONTRIBUTING.md still points at the old location).
- The repo has many per-package AGENTS.md files — read the one for the package you touch.

## Session log
- **2026-10-04 — reinstalled bun, re-pointed binary, committed + pushed:**
  - After the SSD swap: `bun` was missing and `/usr/local/bin/opencode` was a stale
    `fix/stale-width-shrink` build (2026-08-20) that lacks the output-approval feature;
    the local fork build `0.0.0-output-approval-202609201208` was intact.
  - Re-pointed `/usr/local/bin/opencode` → local dist build; backed the old binary up
    to `/home/kodba/backups/opencode-fix-stale-width-shrink-202608200952`.
  - Reinstalled `bun@1.3.14` at `/root/.bun/bin/bun`. No `unzip` on the box, so the
    release zip was extracted with python3 instead of the bun.sh installer.
  - Committed the 2026-09-20 working-tree work as `170ff1901` and pushed it to
    `origin/output-approval` (fast-forward from `751fee493`). The pre-push
    `bun turbo typecheck` passed.
  - Gotcha: the pre-push hook runs `bun turbo typecheck` over 30 packages; on this
    4-core/16 GB box the concurrent `tsgo` workers (~1.3 GB each) thrash swap. Run
    the push with `TURBO_CONCURRENCY=2` (or `--concurrency` on turbo) so it completes.
- **2026-09-20 — fixed `/permissions` (output-approval toggle) + added `/yolo`:**
  - **Root causes found:** (1) badge/effective gating used config `tool_result` + session
    rules, but `sessionPermissionMode` only looked at the session `*` wildcard → first
    press did `default→ask` (still on) instead of off (off-by-one, misleading toast);
    (2) `/permissions` used a `*` wildcard, so it also flipped all tool-call permissions;
    (3) `runLoop` snapshots the session once (prompt.ts:1086) so mid-turn toggles didn't
    affect the running turn ("still asks sometimes").
  - **New shared logic:** `packages/tui/src/util/output-gate.ts` — `outputGateMode(config,
    session)` mirrors server `SessionTools.approveOutput`; used by the badge AND the
    command so they can't disagree. `nextOutputApproval()` = on(ask)↔off(allow).
  - **`/permissions`** now toggles **output approval only**: on→writes session
    `{permission:"tool_result",action:"allow",pattern:"*"}` (off), off→writes
    `tool_result` ask (on); toast says "Output approval: on/off". Does NOT touch tool-call
    permissions. Title describes current state.
  - **Server:** `permissionModeOverride` (handlers/session.ts) now maps ask/allow to
    `tool_result` rules; `default` clears. Updated group schema comment + test
    (httpapi-session: 21 pass; "persisted session directory" is a pre-existing 5s-timeout
    flake under parallel load, passes alone).
  - **Mid-turn staleness:** `approveOutput` now re-reads the session via `Session.Service`
    per tool output (tools.ts); prompt.ts provides `Session.Service` to
    `SessionTools.resolve`. Toggles apply to remaining outputs in the same turn.
  - **New `/yolo` slash command** (aliases `auto`, `full-access`) in app.tsx toggles
    `local.permission.mode` auto-approve (auto-replies to *all* permission asks incl.
    `tool_result`); shows a toast; the `output:` badge is hidden while yolo is on (the
    existing `auto` badge remains). Command value stays `permission.mode`.
  - Verified `bun typecheck` (tui + opencode); oxlint 0 errors. Binary rebuilt →
    `0.0.0-output-approval-202609201208`. **Restart opencode to pick it up.**
- **2026-09-19 — persistent output-gating indicator + `/permissions` toast:**
  - `packages/tui/src/component/prompt/index.tsx`: renders a persistent
    `output: ask` / `output: withhold` badge in the prompt metadata row (next to the
    agent name, normal mode only), driven by `outputGateMode()`. Hides when output is
    ungated. Reacts to session updates.
  - `packages/tui/src/routes/session/index.tsx`: `/permissions` shows a toast.
  - Binary rebuilt → `0.0.0-output-approval-202609191903` (superseded above).
- **2026-09-07 — enabled tool_result approval by default:** added
  `"permission": { "tool_result": { "*": "ask" } }` to the global config
  `/root/.config/opencode/opencode.json`. Takes effect on restart (config read at
  startup); mid-session toggle via `/permissions` slash command in the TUI.

## Open items
- The 2026-09-20 changes are now committed + pushed (`170ff1901`). Consider rebasing
  onto the latest upstream `dev` (the fork was ~18 commits behind at clone time).
- The pre-push hook must run with `TURBO_CONCURRENCY=2` on this box to avoid swap
  thrash (see 2026-10-04 session log).
