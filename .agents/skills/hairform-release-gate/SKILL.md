---
name: hairform-release-gate
description: Perform final HAIRFORM acceptance for a task, branch, or pull request by comparing requirements, diffs, developer reports, tests, browser evidence, multimodal evidence, privacy constraints, and release permissions. Use before marking source ready, opening or approving a PR, or deploying HAIRFORM.
---

# HAIRFORM Release Gate

Decide whether the exact reviewed revision is ready. Do not repair unrelated code during the gate.

## Collect evidence

Read:

- `AGENTS.md`, the original request, task file, and acceptance criteria;
- the complete diff and changed-file list;
- the developer report and actual test output;
- relevant browser screenshots/logs for visible changes;
- multimodal review only when authorized images are part of acceptance;
- `CHANGELOG.md` and affected public docs;
- database migrations, feature flags, model policy, privacy and deletion paths when affected.

Treat the developer report as a claim to verify, not proof by itself.

## Gate

1. Confirm every changed file is within task scope and unrelated user files are absent.
2. Run or independently verify `git diff --check`, `npm run lint`, and `npm test` unless the task documents a narrower justified gate.
3. Check backward compatibility, failure states, concurrency, retries, cost limits, redaction, expiry, and immediate deletion for affected surfaces.
4. Check desktop and narrow-screen behavior for visible H5 changes without using an unauthorized portrait.
5. Confirm GitHub push, runtime configuration, feature enablement, real-provider use, real-photo processing, mini-program update, and production deployment have separate explicit authorization.
6. Reject completion when evidence is missing, checks fail, the task exceeded scope, or a private fact entered a public artifact.

## Verdict

Return JSON compatible with `.ai-company/templates/review.json` using:

- `pass`: all blocking criteria are supported by evidence;
- `rework`: implementation can be corrected within the remaining repair limit;
- `blocked`: a required user decision, permission, credential, external state, or evidence is missing.

List blocking issues as concrete, testable statements. After two failed repair rounds, use `blocked` and request a human decision instead of starting another loop. A source-ready verdict does not imply a PR was merged or production was deployed.
