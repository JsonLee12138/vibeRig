# 飞书语音消息发送

> 仅当用户需要将 TTS 生成的语音发送到飞书时使用此功能。

将 TTS 生成的 WAV 发送到飞书，一条命令完成：生成 → 转码 → 上传 → 发送。

**为什么不用 message tool：** 飞书语音消息需要调用 `/im/v1/messages` 接口（`msg_type: audio`），且需先上传音频获取 `file_key`。很多工具的 message tool 在飞书 channel 上会将音频当作普通附件发送（用户看到文件而非语音条）。`feishu_send_audio.sh` 完成了完整的上传 + 发送流程，不可替换为 message tool。

## 环境依赖

| 环境变量 | 来源 | 说明 |
|---|---|---|
| `FEISHU_APP_ID` | 飞书开放平台 | 应用 App ID |
| `FEISHU_APP_SECRET` | 飞书开放平台 | 应用 App Secret |

依赖：`ffmpeg`（WAV 转 Opus、获取音频时长）、`curl`（调用飞书 API）

## 私聊发送（open_id）

```bash
# 1. 生成语音
python3 "$SKILL_DIR/scripts/mimo_tts.py" \
  --text "好的，马上就好！" \
  --voice "冰糖" \
  --output /tmp/mimo-v2.5-tts/voice.wav

# 2. 发送到飞书私聊
bash "$SKILL_DIR/scripts/feishu_send_audio.sh" /tmp/mimo-v2.5-tts/voice.wav open_id ou_xxxxxx
```

## 群聊发送（chat_id）

```bash
# 1. 生成语音
python3 "$SKILL_DIR/scripts/mimo_tts.py" \
  --text "大家好，今天天气真不错！" \
  --voice "冰糖" \
  --output /tmp/mimo-v2.5-tts/voice.wav

# 2. 发送到飞书群聊
bash "$SKILL_DIR/scripts/feishu_send_audio.sh" /tmp/mimo-v2.5-tts/voice.wav chat_id oc_xxxxxx
```

内部流程：`wav → opus (ffmpeg)` → `获取 tenant_access_token` → `上传音频文件` → `发送 audio 消息`
