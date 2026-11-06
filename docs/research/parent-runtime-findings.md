# Parent runtime findings

The completed implementation passed its 24 existing tests. Direct boundary probes then found two uncovered cases.

## Empty configuration

Create a zero-byte temporary models.json and call loadConfig(path) from extensions/pstack/config.ts. The observed result was `{"kind":"valid","original":"","config":{"version":"pi-mstack/1","roles":{}}}`. An existing invalid JSON file must not become default configuration or be overwritten by setup. The cause is the truthiness check on the original string rather than a missing-file check.

## Model identifiers containing colons

Call splitSelector with `openrouter/anthropic/claude-opus-5.5:batch` and `openrouter/anthropic/claude-opus-5.5:batch:high`. Both threw Invalid exact model selector. The model registry inspected earlier includes colon-bearing model IDs. Preserve the full identifier and separate only a recognized trailing thinking suffix, with exact registry validation rather than fuzzy matching.

These probes ran against the live completed implementation before runtime fixes. The isolated runtime lane owns regression tests and repairs. They do not establish a broader compatibility verdict.
