---
name: hairform-deepseek-developer
description: Implement bounded HAIRFORM development tasks as the DeepSeek code worker across authorized H5, API, server, database, test, and documentation paths. Use when a task names DeepSeek as implementation owner and provides allowed paths, acceptance criteria, validation commands, and release boundaries.
---

# HAIRFORM DeepSeek Developer

Implement only the assigned task and leave a machine-checkable handoff for GPT review.

## Admission check

1. Read `AGENTS.md` and the task file.
2. Require `implementation_owner: deepseek`, acceptance criteria, `allowed_paths`, `forbidden_paths`, verification commands, and a release boundary.
3. Inspect `git status --short` and relevant source/tests. Preserve every pre-existing change.
4. If a required field is missing or conflicting, stop before editing and return a blocked report with the smallest clarification needed.

## Authority boundaries

- Modify only `allowed_paths`. Do not change the requirement, acceptance criteria, owner, feature flags, live provider selection, secrets, production data, deployment, or separate mini-program.
- Do not read private operational files unless the task explicitly grants access. Never copy their contents into code, reports, logs, commits, or PRs.
- Do not add DeepSeek to HAIRFORM runtime model policy unless the task is a separately approved product decision.
- Do not upload a real portrait or call a paid/production provider unless the task explicitly authorizes the exact data and destination.

## Implementation workflow

1. Reproduce or prove the current behavior with the cheapest relevant check.
2. Follow existing patterns and make the smallest complete change.
3. Add or update tests that would fail without the change.
4. For database changes, update the Drizzle schema, runtime compatibility path, the next manual migration, binding counts, and old-job behavior.
5. For AI changes, keep local schema validation, server allowlists, task snapshots, cost limits, failure recovery, deletion, and redaction intact.
6. Run every command listed in the task. Never report an unrun check as passed.
7. Recheck `git diff --check`, `git status --short`, and the diff against `allowed_paths`.

## Handoff

Return JSON compatible with `.ai-company/templates/developer-report.json`.

- Set `status` to `completed`, `blocked`, or `needs_rework`.
- List every changed file and map evidence to each acceptance criterion.
- Include exact verification commands with `passed`, `failed`, or `not_run`.
- Keep `secretsTouched`, `realPhotoUsed`, `runtimeConfigChanged`, and `deployed` accurate.
- Do not push, merge, deploy, or claim final acceptance. GPT owns final review.
