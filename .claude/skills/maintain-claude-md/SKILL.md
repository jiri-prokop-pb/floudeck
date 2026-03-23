---
name: maintain-claude-md
description: Audit and clean up CLAUDE.md based on best practices from code.claude.com
disable-model-invocation: true
---

# Maintain CLAUDE.md

Audit and clean up CLAUDE.md for this project. $ARGUMENTS

## Core principle

CLAUDE.md is loaded every session and consumes context. For each line, ask: **"Would removing this cause Claude to make mistakes?"** If not, cut it. Bloated files cause Claude to ignore your actual instructions.

## What belongs in CLAUDE.md

- Bash commands Claude can't guess (build, test, lint, deploy)
- Code style rules that differ from language/framework defaults
- Testing instructions and preferred test runners
- Repository etiquette (branch naming, PR conventions)
- Architectural decisions that are non-obvious or counter-intuitive
- Developer environment quirks (required env vars, special setup)
- Common gotchas and non-obvious behaviors (things that burn time when missed)

## What does NOT belong

- Anything Claude can figure out by reading code (stack, project structure, file descriptions)
- Standard language/framework conventions Claude already knows
- Detailed API docs (link to them instead)
- Information that changes frequently (move to code comments or TODO)
- Long explanations or tutorials
- File-by-file descriptions of the codebase
- Self-evident practices like "write clean code" or "follow best practices"
- Implementation details that are visible in the source (e.g. which libraries are used, how routing works)

## Audit steps

1. Read the current CLAUDE.md
2. For each section and line, apply the "would removing this cause mistakes?" test
3. **Cut** entries that duplicate what's in code, package.json, or standard conventions
4. **Merge** related items — combine scattered gotchas, don't have overlapping sections
5. **Promote** critical rules with emphasis ("IMPORTANT", "YOU MUST") if Claude keeps ignoring them
6. **Move** domain knowledge or workflows that are only sometimes relevant into separate skills (`.claude/skills/`)
7. Check the total length — aim for under ~60 lines of actual content (excluding code blocks)
8. Verify the file is still human-readable and scannable

## Structure guidelines

Keep it flat and scannable:
- One-line project description at the top
- **Commands** section with runnable commands
- **Rules** section with non-obvious constraints (each rule = one bullet)
- **Gotchas** section for things that waste time when missed
- No tables describing every module (Claude can read the code)
- No "Decisions log" that grows unboundedly — graduate important decisions into Rules or Gotchas, delete the rest

## Anti-patterns to fix

- A "Decisions log" section that grows with every session → graduate useful entries into Rules/Gotchas, delete rest
- Testability architecture tables → one-liner about the DI pattern is enough
- Stack/technology listings → Claude reads package.json
- Frontend/backend rules that restate framework defaults → cut
- Duplicate information (same fact in Rules and Decisions) → deduplicate
