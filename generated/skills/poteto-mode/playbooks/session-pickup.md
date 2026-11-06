Read [the Pi adapter](../../../docs/harness/pi.md) before following these instructions. Its native mappings take precedence over host-specific source vocabulary. Mandatory evidence and authority gates remain blocking.

### Session pickup

**You own the resume point. Read the prior trail, don't redo it.**

1. Locate the prior trail. Use the Pi adapter's session acquisition procedure before reading history. Scope reads to the current Pi session or exact authorized retained session paths supplied by the operator or a retained native run record. Cross-chat mining without an authorized corpus is blocked. Never search a sessions tree or use Cursor transcripts as a fallback. A supplied branch or retained native run report can provide separate evidence, but is not a transcript. Read the metadata overview and last messages first, then scan back for the decision points. Parse a long transcript in a subagent and keep the reduced timeline in the main thread (the **principle-guard-the-context-window** skill). Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section.
2. Reconstruct operational state. The branch and worktree, what already landed (`git log`, `git diff` against the base), the open todos, the decisions made. The prior trail is authoritative input. Resist the bias to re-derive it.
3. Diff done vs pending. Compare what shipped against what was planned, name the resume point, do not re-run the prior repro or redo completed work. A "let me verify from scratch" pass means you're treating the trail as untrustworthy when it's authoritative.
4. Route the remaining work to the matching playbook and pick the verdict: continue the execution, ship a finished recommendation, ratify or override a prior conclusion, or postmortem a failed run. The pickup playbook ends here. The routed playbook owns the rest.
5. Verify the inherited claims against the original goal on the real artifact (the **principle-prove-it-works** skill). A passing prior self-report is not the proof.

**Reply:** where the prior agent stopped, what you inherited vs redid (ideally nothing redone), the resume point, and the outcome.
