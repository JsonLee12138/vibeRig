# Python 脚本用法示例

三个模型分别对应三个脚本：

| 脚本 | 模型 | 用途 |
|---|---|---|
| `mimo_tts.py` | `mimo-v2.5-tts` | 预置音色语音合成 |
| `mimo_tts_voicedesign.py` | `mimo-v2.5-tts-voicedesign` | 文本描述定制音色 |
| `mimo_tts_voiceclone.py` | `mimo-v2.5-tts-voiceclone` | 音频样本复刻音色 |

定位脚本目录：
```bash
SKILL_DIR="$(dirname "$(find . -path "*/mimo-v2-5-tts/SKILL.md" -print -quit 2>/dev/null)")"
```

## 预置音色合成

```bash
python3 "$SKILL_DIR/scripts/mimo_tts.py" \
  --text "你好，今天天气真不错。" \
  --voice "冰糖"
```

## 预置音色 + 自然语言风格控制

```bash
python3 "$SKILL_DIR/scripts/mimo_tts.py" \
  --context "用温柔的语气，语速稍慢" \
  --text "没关系，慢慢来，我等你。" \
  --voice "冰糖" \
  --output tmp/mimo-v2.5-tts/comfort.wav
```

## 预置音色 + 音频标签

```bash
python3 "$SKILL_DIR/scripts/mimo_tts.py" \
  --text "（紧张，深呼吸）呼……冷静，冷静。（小声）哎呀，领带歪没歪？" \
  --voice "冰糖" \
  --output tmp/mimo-v2.5-tts/interview.wav
```

## 唱歌

```bash
python3 "$SKILL_DIR/scripts/mimo_tts.py" \
  --text "(唱歌)原谅我这一生不羁放纵爱自由，也会怕有一天会跌倒。" \
  --voice "冰糖" \
  --output tmp/mimo-v2.5-tts/singing.wav
```

## 音色设计

```bash
python3 "$SKILL_DIR/scripts/mimo_tts_voicedesign.py" \
  --context "Give me a young male tone." \
  --text "Yes, I had a sandwich." \
  --output tmp/mimo-v2.5-tts/voicedesign.wav
```

## 音色克隆

> 音频样本 Base64 编码不超过 10 MB，仅支持 mp3 和 wav。

```bash
python3 "$SKILL_DIR/scripts/mimo_tts_voiceclone.py" \
  --voice-file voice.mp3 \
  --text "Yes, I had a sandwich." \
  --output tmp/mimo-v2.5-tts/voiceclone.wav
```

## 音色克隆 + 导演模式

```bash
python3 "$SKILL_DIR/scripts/mimo_tts_voiceclone.py" \
  --voice-file voice.mp3 \
  --context "用温柔的语气，语速稍慢" \
  --text "没关系，慢慢来，我等你。" \
  --output tmp/mimo-v2.5-tts/voiceclone_director.wav
```

## 英文 + 音频标签

```bash
python3 "$SKILL_DIR/scripts/mimo_tts.py" \
  --text "I just... (sighs deeply) I don't know anymore. (suddenly firm) But I won't give up!" \
  --voice "Mia" \
  --output tmp/mimo-v2.5-tts/english.wav
```

## 长文本分段合并

V2.5 建议几乎所有场景都一次性生成。仅当文本超过 **2500 字**时才需要分段：

```bash
# 创建文件列表
echo "file '/tmp/mimo-v2.5-tts/part1.wav'" > /tmp/mimo-v2.5-tts/list.txt
echo "file '/tmp/mimo-v2.5-tts/part2.wav'" >> /tmp/mimo-v2.5-tts/list.txt

# 拼接
ffmpeg -y -f concat -safe 0 -i /tmp/mimo-v2.5-tts/list.txt -c copy /tmp/mimo-v2.5-tts/combined.wav
```
