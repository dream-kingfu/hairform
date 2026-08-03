---
name: hairform-maintenance
description: Maintain the HAIRFORM H5, server APIs, admin console, AI routing, D1/R2 persistence, reports, tests, public documentation, and release preparation. Use for HAIRFORM inspection, diagnosis, planning, modification, migration, testing, review, GitHub delivery, or deployment work in this repository.
---

# Maintain HAIRFORM

Maintain HAIRFORM from current repository evidence while preserving product, privacy, and release constraints.

## Start from current truth

1. Read `AGENTS.md`, the current task, `README.md`, the newest `CHANGELOG.md` entry, and relevant source files.
2. Inspect the current branch, recent commits, and `git status --short`. Treat existing changes as user-owned.
3. Read `.ai-company/architecture.md` and `.ai-company/model-routing.json` when planning, delegating, reviewing, or changing AI integrations.
4. Read ignored private context only when it exists on the current machine and the task requires it. Never copy private facts to public files or responses.
5. Treat source code and tests as more current than prose when facts conflict; surface the conflict rather than guessing.

## Route the work

- Let GPT own user intent, product decisions, architecture, task contracts, multimodal judgment, privacy review, and final acceptance.
- Route business code to the DeepSeek developer by default through `.ai-company/templates/task.md` and the `hairform-deepseek-developer` Skill.
- Let GPT modify collaboration rules and public workflow documents. Let GPT implement business code only when the task explicitly assigns `implementation_owner: gpt` or the user explicitly requests it.
- Keep the development role separate from HAIRFORM runtime providers. Never add or select a product model merely because it is the code worker.
- Require the developer report and deterministic checks before final acceptance. Stop after two failed repair rounds and request a human decision.

## Preserve product invariants

- Keep `text-first-v1`: analysis first, optional recommendation revision, explicit selection, final confirmation, then Image2.
- Preserve visual facts when revising recommendations and keep every style/color inside the fixed catalogs.
- Keep post-analysis consultation text-only; never resend the portrait, image URL, token, or hidden prompt.
- Keep provider choices server-side and snapshot them on job creation.
- Keep D1/R2 expiry and immediate deletion synchronized across all task data and assets.
- Never log secrets, portraits, tokens, raw IPs, full prompts, or private context.
- Keep medical, transplant, identity, attractiveness, ethnicity, and personality claims outside the product.

## Modify safely

- Follow existing patterns and the task's `allowed_paths`; do not widen scope silently.
- For D1 fields, update `db/schema.ts`, runtime compatibility in `lib/server/jobs.ts`, a new manual migration, and tests.
- Update deterministic presentation/report composition when stored recommendation data changes.
- Add automated coverage for every new state, route, schema constraint, concurrency rule, deletion behavior, or privacy boundary.
- Update `CHANGELOG.md` for material product or workflow changes. Do not bump the product version or deploy for collaboration-document-only changes.

## Validate and deliver

- Run `npm run lint` and `npm test` for the full deterministic gate.
- Perform focused desktop and narrow-screen checks for visible H5 changes without uploading a personal photo.
- Use `hairform-multimodal-review` only with explicitly authorized images and record limitations honestly.
- Use `hairform-release-gate` for final review.
- Treat GitHub push, production deployment, runtime configuration, real-provider calls, real-photo use, and mini-program updates as separate permissions.
- Report changed surfaces, evidence, unchanged surfaces, feature-flag state, release status, and blockers.
