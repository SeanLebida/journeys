## What changed
GitHub account renamed Seanl686 → SeanLebida. Docs, clone URLs, badges, package.json repository fields, and marketplace manifests now use the new owner.

## Why it mattered
Hardcoded owner URLs stop resolving once someone claims the old username and creates a matching repository. Logseq marketplace `repo:` keys and the WordPress GitHub updater look up releases by owner name.

## Gotchas / pitfalls
GitHub Pages hosts at `seanlebida.github.io` (lowercase). The profile README repo had to be renamed from `Seanl686` to `SeanLebida`. Historical `learnings/` entries that quote the old author string were left as written.

## Verification
`gh api user --jq .login` returns `SeanLebida`. Grep of this commit's files shows `SeanLebida` and no `Seanl686`.
