# Connectors

## How tool references work in this skill

Plugin files use `~~design tool` as a placeholder for the design connector available to this skill.
In `uiux-design`, `~~design tool` means only **Figma** or **Pencil**.

## Connector behavior for uiux-design

- `~~design tool` means only **Figma** or **Pencil** in this skill.
- Figma/Pencil requests are executed through Pencil MCP.
- If there is no design-tool connection, HTML mode requires explicit user confirmation.
- Explicit user tool selection disables fallback to another tool path.

## Execution notes

- If the user explicitly chooses Figma, preserve that choice and use Pencil MCP as the execution interface.
- If the user explicitly chooses Pencil, preserve that choice and use Pencil MCP as the execution interface.
- If the user explicitly chooses HTML, stay in HTML mode.
- If no design-tool connection exists, ask before proceeding in HTML mode.
