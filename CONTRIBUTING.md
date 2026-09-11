# Contributing

Contributions are welcome via Issues and Pull Requests. Search existing ones before opening a new one.

## Tests

```bash
yarn test        # single run with coverage
yarn test:watch  # re-run on change
yarn typecheck   # type-check src and tests
```

Tests live in `tests/` and run on [Vitest](https://vitest.dev/). They mount the custom elements into a DOM and assert
what gets rendered; `@nanopub/nanopub-js` is mocked in `tests/nanopub-js-mock.ts`, so nothing touches the network.

The DOM environment is **jsdom, not happy-dom**: `nanopub-table` takes a bare `<tr>` inside a `<template>`, and only
jsdom implements the HTML parser's "in template" insertion mode that keeps such a row intact. happy-dom silently drops
it, which makes the table's template rendering untestable.

The timezone is pinned to UTC in `vitest.config.js` so the `data-format` date assertions are reproducible.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) — they drive automated versioning and the
changelog, so the format matters:

```text
<type>[optional scope]: <description>
```

| Type | Use for | Version bump |
| --- | --- | --- |
| `feat` | A new feature | minor (`0.2.0` → `0.3.0`) |
| `fix` | A bug fix | patch (`0.2.0` → `0.2.1`) |
| `docs`, `refactor`, `chore`, `ci` | Everything else | none |

Breaking changes use `!` (`feat!: ...`) or a `BREAKING CHANGE:` footer and trigger a major bump.

Only `feat`, `fix`, and breaking changes produce a release. If you squash-merge, the **PR title** becomes the commit
message, so it must follow this format too.

## Releases

Automated with [release-please](https://github.com/googleapis/release-please) — don't bump the version or edit
`CHANGELOG.md` by hand. Merging conventional commits to `main` opens a release PR; merging that PR tags, releases, and
publishes to npm.
