---
name: mimo-v2-5-tts
description: "MiMo V2.5 TTS 语音合成。当需要将文字转为语音、发送语音消息、朗读内容、或用户要求「说出来」「语音回复」时使用此 skill。支持预置音色、音色设计、音色克隆三种模式。"
license: MIT
metadata:
  version: 0.1.2
---

# MiMo V2.5 TTS

使用小米 MiMo V2.5 TTS 系列模型生成语音。支持中英文、预置音色、音色设计、音色克隆。

## Contract

Use this skill to generate speech audio using MiMo V2.5 TTS models and optionally send it to Feishu.

Do not use this skill for non-audio generation tasks mid-task; redirect to the appropriate skill if audio output is not the goal.

Stop and ask when `MIMO_API_KEY` is unset, the voice clone source file is unavailable, or the requested text is flagged for content filtering.

## Input Contract

Required:
- Text to synthesize (or enough context to write the text).
- Mode: preset voice, voice design, or voice clone.
- Voice ID / voice description / voice file path depending on mode.

Optional:
- Natural language style control (`--context`).
- Audio tags embedded in text.
- Output file path (default: `tmp/mimo-v2.5-tts/output.wav`).
- Feishu destination when sending audio to Feishu.

## Output Contract

Return:
- Generated audio file path.
- Script command used.
- Retry rationale if output quality was poor.

TTS has inherent randomness — regenerate when output quality is unsatisfactory.

## Model Selection

| Model ID | 用途 | 音色来源 | 特殊能力 |
|---|---|---|---|
| `mimo-v2.5-tts` | 预置音色语音合成 | 内置精品音色 | 支持唱歌 |
| `mimo-v2.5-tts-voicedesign` | 文本描述定制音色 | 文本描述生成 | — |
| `mimo-v2.5-tts-voiceclone` | 音频样本复刻音色 | 音频样本 | — |

- 快速生成 / 唱歌 → `mimo-v2.5-tts`
- 独特自定义音色 → `mimo-v2.5-tts-voicedesign`
- 模仿指定声音 → `mimo-v2.5-tts-voiceclone`

## Environment

| Variable | Required |
|---|---|
| `MIMO_API_KEY` | Yes |
| `MIMO_BASE_URL` | No (default: `https://api.xiaomimimo.com/v1`) |

Dependencies: `python3`, `openai` (`pip install openai`), `ffmpeg` (concatenation only), `curl` (Feishu only).

## Workflow

1. Confirm `MIMO_API_KEY` is set.
2. Choose the model (Model Selection table above).
3. For preset voice: read [voice-list.md](./references/voice-list.md) to select voice ID.
4. For style/emotion control: read [style-tags.md](./references/style-tags.md) or [natural-language-control.md](./references/natural-language-control.md).
5. For voice design: read [voice-design.md](./references/voice-design.md) to compose the voice description.
6. Enhance bare text with appropriate tags when needed: read [content-enhancement.md](./references/content-enhancement.md).
7. Run the appropriate script (see [script-usage.md](./references/script-usage.md) for examples).
8. For Feishu delivery: read [feishu-guide.md](./references/feishu-guide.md).
9. Report the output file path and command used.

## Context Loading

Read only when needed:

- `references/voice-list.md`: read when choosing preset voices for `mimo-v2.5-tts`.
- `references/style-tags.md`: read when audio tag or style label control is requested.
- `references/natural-language-control.md`: read when natural language or director mode control is needed.
- `references/voice-design.md`: read when writing voice descriptions for `voicedesign` model.
- `references/content-enhancement.md`: read when text needs tag insertion or enhancement.
- `references/script-usage.md`: read for script flag examples or long-text segmentation.
- `references/feishu-guide.md`: read when sending audio to Feishu.

Do not load all references at the start.

## Red Flags

- Running `mimo-v2.5-tts` without a voice ID → synthesis will fail; check [voice-list.md](./references/voice-list.md).
- Using audio tags `(情绪)` with `voicedesign` model → not supported; use `--context` instead.
- Text exceeds 2500 chars sent as a single call → segment and concatenate per [script-usage.md](./references/script-usage.md).
- Sending audio to Feishu via generic message tool → arrives as file, not voice message; use `scripts/feishu_send_audio.sh`.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "Audio tags and `--context` do the same thing" | Audio tags are inline style switches inside the text. `--context` is an external instruction. Only `--context` works with `voicedesign`; only audio tags work for per-sentence control in `mimo-v2.5-tts`. |
| "The text is long, but I'll try one call first" | Texts over 2500 chars risk truncation or uneven quality. Segment proactively — retrying after a bad result is more expensive. |
| "I can use the message tool to send audio to Feishu" | The message tool sends files, not voice messages. `feishu_send_audio.sh` handles the upload + audio-type send flow that produces a playable voice bubble. |

## Validation

```bash
# API key is set
[ -n "$MIMO_API_KEY" ] && echo "ok" || echo "MISSING MIMO_API_KEY"

# Output file was created after script runs
[ -f "<output-path>" ] && echo "ok" || echo "FILE NOT CREATED"
```

- [ ] Audio file plays without corruption.
- [ ] Correct model and voice ID / description / file were used.
- [ ] For Feishu: received as voice message (playable bubble), not file attachment.
