# PDF4 Tasks Status

Source: `docs/MyplanMybudget_PDF4_Roadmap_Agent_Prompts (1).pdf` (extracted on 2026-02-20)

## Build status
- [x] Project builds successfully with `pnpm build`

## Route contract alignment
- [x] Added dedicated reminders route: `app/reminders/page.tsx`
- [x] Added alias routes required by PDF4 naming:
  - `app/transactions/page.tsx` -> `/track`
  - `app/budgets/page.tsx` -> `/plan`
  - `app/simulations/page.tsx` -> `/simulate`
  - `app/login/page.tsx` -> `/auth`
  - `app/signup/page.tsx` -> `/auth`
- [x] Middleware protection extended for these paths

## Data/repository alignment
- [x] Added reminders repository: `lib/data/reminders.ts`
- [x] Added validator module: `lib/validators/reminders.ts`
- [x] Added simulation engine contract path: `lib/sim/engine.ts`
- [x] Updated simulation repository import to use `lib/sim/engine.ts`

## UI alignment
- [x] Added reminders UI (create + list + mark done):
  - `app/reminders/client.tsx`
  - `app/reminders/actions.ts`
- [x] Added reminders to app navigation and quick actions

## Remaining gaps vs PDF4 prompt pack
- [ ] Dashboard prompt asked for Recharts-based charts with client-only dynamic import (`components/charts/*`).
- [ ] Prompt asks for strict shadcn primitives in all feature surfaces (some current pages still use native inputs/selects directly).
- [ ] Prompt suggests explicit app route groups (`app/(auth)`, `app/(app)`) and placeholder route set; current project uses flat route structure with working equivalents.

## Notes
- This update prioritizes compatibility and finishing the actionable instructions without breaking current working flows.
