# scripts-parse

## Overview

Directory-based community: skills/mimo-v2-5-tts/scripts

- **Size**: 10 nodes
- **Cohesion**: 0.1099
- **Dominant Language**: python

## Members

| Name | Kind | File | Lines |
|------|------|------|-------|
| parse_args | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts.py | 32-51 |
| build_client | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts.py | 54-59 |
| main | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts.py | 62-87 |
| parse_args | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voiceclone.py | 21-39 |
| build_client | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voiceclone.py | 42-47 |
| encode_voice_file | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voiceclone.py | 50-70 |
| main | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voiceclone.py | 73-101 |
| parse_args | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voicedesign.py | 21-34 |
| build_client | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voicedesign.py | 37-42 |
| main | Function | /Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voicedesign.py | 45-70 |

## Execution Flows

- **main** (criticality: 0.61, depth: 1)
- **main** (criticality: 0.36, depth: 1)
- **main** (criticality: 0.36, depth: 1)

## Dependencies

### Outgoing

- `print` (12 edge(s))
- `add_argument` (11 edge(s))
- `exit` (9 edge(s))
- `get` (4 edge(s))
- `append` (4 edge(s))
- `Path` (4 edge(s))
- `OpenAI` (3 edge(s))
- `create` (3 edge(s))
- `getattr` (3 edge(s))
- `mkdir` (3 edge(s))
- `write_bytes` (3 edge(s))
- `b64decode` (3 edge(s))
- `ArgumentParser` (3 edge(s))
- `exists` (1 edge(s))
- `lower` (1 edge(s))

### Incoming

- `/Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voiceclone.py` (4 edge(s))
- `/Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts.py` (3 edge(s))
- `/Users/jsonlee/Projects/vb-plugin/skills/mimo-v2-5-tts/scripts/mimo_tts_voicedesign.py` (3 edge(s))
