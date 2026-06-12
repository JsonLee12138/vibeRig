# Global Coding Rules

## VibeRig Output Language

- Read `.vibeRig/project.yaml` before creating or updating VibeRig human-facing records.
- Use `.vibeRig/project.yaml` `output.language` for VibeRig issue titles, issue descriptions, comments, requirement documents, validation notes, proof packets, human acceptance records, retrospectives, and final summaries.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `.vibeRig/project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, or existing external labels/status names.
