# Vendored Skills

Skills copied from [mcollina/skills](https://github.com/mcollina/skills), MIT licensed
(see `LICENSE`).

- Upstream commit: `7cfdaf97386f51be412d5351aa2f0acbf958e067` (2026-07-26)
- Installed: 2026-08-01

These are checked in, not a submodule, so they don't track upstream automatically.
To refresh, re-clone the repo and copy `skills/*` over this directory.

## Excluded skills

Upstream's `nodejs-core` is deliberately not installed. It targets contributing to
and debugging Node.js itself (C++ addons, V8, libuv, node-gyp), which is out of
scope for this project. Don't re-add it on a refresh.

## Note on `fastify-best-practices`

Upstream stores this skill in a directory named `fastify`, but its `SKILL.md`
frontmatter declares `name: fastify-best-practices`. Claude Code requires the
directory name and the frontmatter `name` to match, so it is installed here under
the declared name. This is the only deviation from upstream layout.
