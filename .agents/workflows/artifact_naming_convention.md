---
description: Naming convention for all plan, task, and walkthrough artifact files
---

# Artifact Naming Convention

All artifact markdown files (plan, task, walkthrough) MUST be named with the following format:

```
[type]_[version]_[feature_slug].md
```

## Rules

1. **Type prefix** must be one of:
   - `plan_` — for implementation plans
   - `task_` — for task checklists
   - `walkthrough_` — for completed feature walkthroughs
   - `reference_` — for reference documents (standards, prompts, guides)

2. **Version** must specify the exact version or scope, e.g.:
   - `v1_`, `v5_`, `v6_`
   - `v5_2_` for minor versions
   - `ai_voice_fix_` for one-off bug fixes not tied to a version

3. **Feature slug** is a short snake_case summary of what the file is about.

## Examples

| ✅ Good | ❌ Bad |
|---|---|
| `plan_v6_undercover_ui_zen.md` | `implementation_plan.md` |
| `task_v5_ai_personas.md` | `task.md` |
| `walkthrough_v3_supabase_realtime.md` | `walkthrough.md` |
| `reference_v5_ai_personas_and_prompt_design.md` | `v5_prompts_review.md` |

## Enforcement

When creating any plan, task, or walkthrough artifact file, ALWAYS apply this naming scheme. This applies to new conversations as well. The file must never be named generically as just `task.md`, `implementation_plan.md`, or `walkthrough.md`.
