<!--
Thanks for contributing to pi-web! Per CONTRIBUTING.md, please open an issue
first so we can discuss before code is written. Link that issue below.
-->

## Summary

<!-- What changed and why. Focus on the "why" — the motivation behind the change. -->

## Related issue

Closes #

## Type of change

<!-- Match your PR title's conventional-commit type. Check all that apply. -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — code change that neither fixes a bug nor adds a feature
- [ ] `style` — formatting / UI styling, no behavior change
- [ ] `test` — adding or updating tests
- [ ] `chore` — build, tooling, or maintenance

## Live vs. Export

<!--
If this PR touches session rendering, remember pi-web has two render paths
(see AGENTS.md): the live app and the static export/Gist snapshot.
-->

- [ ] Not applicable — this PR doesn't touch session rendering
- [ ] Considered both the live app and the export snapshot
- [ ] Kept `internal/ui/live_templates/` in sync with `web/src/session/` changes
- [ ] No live-only chrome (Vite scripts, active composer, SSE/API) leaked into export

## Testing

- [ ] `make check` passes (test + build + vet)
- [ ] Frontend tests (`vitest`) cover the change
- [ ] Go tests (`go test ./...`) cover the change
- [ ] UI changes verified in a browser
