# Contribution process

Read AGENTS.md and define observable contract changes before implementing them.
Use a branch/worktree and PR. Titles use an area prefix, such as wire: or test:.
Run node scripts/check.mjs and native package checks; squash a green PR to main.
Do not add attribution trailers or private dependencies. Release from main only,
rehearse the exact commit before the immutable version tag, and verify public
installation. Existing tags/releases are immutable; their source remains in Git.
