## 2026-11-22 · born · converted from the paper-intake skill's step 1
- **Reason:** a paper's folder is `<first-author>-<year>-<short-topic>` and its PDF is named after
  the folder; both are static path signatures. The skill prose stays whole: it also tells the agent
  how to place the paper (git mv, working from the scratchpad), which the check does not.
- **Actor:** Claudinite task claudinite/prose-to-checks-sweep.
- **Mechanism:** a coded check, because it reads tracked paths against a slug pattern.
- **Landed:** pending
