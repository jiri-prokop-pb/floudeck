/**
 * Rich demo markdown content for each block in the promo video.
 * The mock runner matches prompts to these responses.
 */

export const DEMO_BLOCKS = [
  {
    prompt: "Summarize my PR review queue and flag anything urgent",
    interval: 4,
    unit: "hours",
    markdown: `# PR Review Queue

## Urgent 🔴
- **#482** — Auth token rotation breaks mobile clients
  - Author: @sarah · 2 files changed · opened 3h ago
  - [Approve|green](/action/pr-482/approve) [Request changes|red](/action/pr-482/request-changes)

## Ready for review
- **#479** — Add rate limiting to /api/search · @mike · 4 files
- **#476** — Migrate user preferences to new schema · @alex · 11 files
- **#475** — Fix timezone offset in scheduled reports · @dana · 2 files

## Waiting on CI
- **#480** — Bump dependencies (March batch) · @dependabot

> 5 PRs total · 1 urgent · last checked 2 min ago`,
  },
  {
    prompt: "Check production health: errors, latency, deployment status",
    interval: 15,
    unit: "minutes",
    markdown: `# Production Health

| Metric | Status | Value |
|--------|--------|-------|
| Error rate | ✅ Normal | 0.02% (↓ from 0.05%) |
| P99 latency | ✅ Normal | 142ms |
| Active deploys | 🟡 In progress | v3.8.1 → canary (12%) |
| DB connections | ✅ Normal | 48/200 |
| Queue depth | ✅ Normal | 23 jobs |

**Recent incident:** Memory spike on worker-3 at 09:41 UTC — auto-scaled, resolved.

[View Grafana|blue](https://grafana.internal/d/prod) [Rollback canary|red](/action/deploy/rollback?version=3.8.0)`,
  },
  {
    prompt: "Daily standup prep: what did I do, what's next, any blockers",
    interval: 1,
    unit: "days",
    markdown: `# Standup Prep — Monday

## Yesterday (Friday)
- Merged **#471** — Search rewrite (finally 🎉)
- Code review for @sarah's auth PR
- Investigated flaky E2E test — root cause: race condition in SSE teardown

## Today
- Start **API rate limiting** (#479) — design doc ready
- Release v3.8.1 (blocked on canary metrics)
- 1:1 with Alex re: schema migration timeline

## Blockers
- ⚠️ Canary deploy at 12% — need 2h of clean metrics before full rollout
- Waiting on DevOps for staging environment refresh

[Open Linear board|purple](https://linear.app/team/ENG/board)`,
  },
  {
    prompt: "Track competitor product updates from their changelog RSS feeds",
    interval: 12,
    unit: "hours",
    markdown: `# Competitor Watch

## Acme Corp — v4.2 released today
- Added **real-time collaboration** (multiplayer cursors)
- New pricing tier: "Enterprise Plus" at $299/seat
- Deprecated their legacy API (sunset in 6 months)

## Widgetly — Blog post
- "How we reduced cold start by 80%" — moved to edge functions
- Interesting: they're using the same caching strategy we proposed in RFC-12

## Stackify — No updates since March 22

*Next check in 12 hours · [View all sources|blue](https://feeds.internal/competitors)*`,
  },
] as const;

/**
 * Map prompt substrings to demo markdown for the mock runner.
 */
export function getDemoMarkdown(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  for (const block of DEMO_BLOCKS) {
    if (lower.includes(block.prompt.slice(0, 30).toLowerCase())) {
      return block.markdown;
    }
  }
  return null;
}

/**
 * Try mode demo: returns a rich try result for the form capture.
 */
export const TRY_DEMO_PROMPT =
  "Check my calendar for today and list upcoming meetings with prep notes";

export const TRY_DEMO_MARKDOWN = `# Today's Meetings

## 10:00 — Sprint Planning (30 min)
- **Room:** Zoom · [Join|blue](https://zoom.us/j/123)
- **Prep:** Review backlog, 3 items flagged for discussion

## 14:00 — 1:1 with Alex (25 min)
- **Topic:** Schema migration timeline
- **Prep:** Check staging deploy status, review his RFC draft

## 16:30 — Demo Day (45 min)
- **Presenting:** Search rewrite (#471)
- **Prep:** Record 2-min screencast, update slides

*3 meetings · 1h 40min total · next free slot: 11:00–13:45*`;
