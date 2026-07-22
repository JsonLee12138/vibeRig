# VB Wiki Index

<!--
Current-state retrieval catalog. Every canonical page appears exactly once,
sorted by repository-relative path using raw UTF-8 byte order. Regenerate this
file deterministically from committed canonical page frontmatter plus the
current operation's exact planned page bytes. This file is mutable and
rebuildable; git and log.md preserve history.

Format:
- [[relative/path-without-.md]] — one-line summary

Parse only the first literal `]] — ` delimiter; the remainder is the whole
normalized summary. Rich SEO fields stay in canonical page frontmatter/qmd.

This catalog routes retrieval only. Open the canonical page and check its
applicability, status, and invalidation signals before using a claim.
-->
