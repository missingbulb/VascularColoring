## 2026-07-29 · born · the check lands (#44)
- **Mechanism:** a coded check.
- **Landed:** #44

## 2026-09-29 · moved · into its scope folder, off the manifest's list
- **Reason:** a data-only manifest lists no modules; the folder is what the loader reads for the
  scope.
- **Mechanism:** a coded check discovered from the pack's rule folder.
- **Actor:** @missingbulb (owner).
- **Model:** claude-opus-5-5

## 2026-10-09 · moved · ported from JavaScript to a Go check
- **Reason:** the repo moved off the Node engine onto cn, which runs no JavaScript checks.
- **Actor:** @missingbulb (owner), re-adoption request.
- **Model:** Claude.
- **Mechanism:** `checks/render_outputs_gitignored.go` replaces `worldRules/render-outputs-gitignored.mjs`, same id, behaviour, on_fail and
  original date; its cases moved from `pack.test.mjs` to the Go test beside it.
