---
name: script-to-video
description: 用户提供文章脚本、播客文稿、讲解稿，要求"做成视频""配图做视频""脚本视频""播客视频"时激活。不适用：无脚本的选题视频（→ faceless-explainer）、产品推广（→ product-launch-video）、纯图配乐（→ slideshow）。
---

# script-to-video

一个 prompt 完整跑完「脚本 → 配图 → 语音 → 视频」，Step 0 收集输入后全程自动执行。

## 输入 Contract

**必填（缺任一项在 Step 0 问清楚，其余用默认值）：**

| 参数 | 说明 | 默认值 |
|---|---|---|
| **脚本** | 文本直接粘贴 或 文件路径（.md / .txt） | — 必填 — |
| **输出目录** | 绝对路径或相对路径，不存在则自动创建 | — 必填 — |
| **语音风格（音色）** | 描述风格（如"亲切女声""磁性男声"）或 mimo 音色 ID | 亲切女声播客风 |
| **视频尺寸** | `16:9`（电脑横版）或 `9:16`（手机竖版） | `16:9` |
| **配图尺寸** | 不填时按视频尺寸自动推导：16:9 → `16:9`；9:16 → `3:4` | 自动推导 |

## 输出 Contract

所有产物写入用户指定的 `OUTPUT_DIR`：

```
OUTPUT_DIR/
├── script.md          # 标准化脚本（加段落标记）
├── shot_list.md       # ian-xiaohei-illustrations 输出的配图策略
├── assets/
│   ├── img_01.png     # 配图，按 shot list 编号
│   ├── img_02.png
│   └── narration.wav  # mimo-v2-5-tts 生成的语音
└── renders/
    └── video.mp4      # hyperframes 最终输出
```

## 工作流

### Step 0 — 收集输入（唯一停顿点）

一次性确认以下字段，预填用户已给出的内容，缺失字段给出默认值供用户直接回复"用默认"：

1. 脚本：文本 or 文件路径？
2. 输出目录：`./output/<项目名>` 还是用户指定路径？
3. 语音风格（音色）：（默认：亲切女声播客风）
4. 视频尺寸：`16:9` 横版 or `9:16` 竖版？（默认 `16:9`）
5. 配图尺寸：按视频尺寸自动推导（`16:9` → `16:9`；`9:16` → `3:4`），或手动指定？

等用户回复后立刻执行 Step 1–5，不再停顿。

---

### Step 1 — 初始化目录 & 标准化脚本

```bash
mkdir -p "$OUTPUT_DIR/assets" "$OUTPUT_DIR/renders"
```

将脚本内容写入 `$OUTPUT_DIR/script.md`，处理规则：
- 每个自然段加 `## P1`、`## P2` … 段落标记（供 shot list 和字幕定位）
- 剔除对 TTS 有干扰的 markdown 符号（`**`、`#` 标题、`---`）
- 不改写任何口播文字内容

验证：`wc -c "$OUTPUT_DIR/script.md"` 字节数 > 0。

---

### Step 2 — 调用 ian-xiaohei-illustrations 分析 Shot List

用 Skill 工具调用 `ian-xiaohei-illustrations`，传入 `$OUTPUT_DIR/script.md` 全文，指令：

> 请分析这篇脚本的配图策略，给出 shot list。每张图写清楚：放在哪段后、主题、核心意思、结构类型、小黑在做什么、建议中文标注词。配图尺寸为 {IMAGE_RATIO}。

将输出原样保存为 `$OUTPUT_DIR/shot_list.md`。

每条条目必须包含以下字段，缺字段时按内容推断补全：

```
## Shot N
- 位置：放在第 P? 段后
- 主题：
- 核心意思：
- 结构类型：（流程图 / 对比 / 单场景 / 状态变化 / 隐喻）
- 小黑在做什么：
- 建议中文标注词：
```

数量：默认 4–8 张；脚本 < 500 字最多 3 张。

---

### Step 3 — 逐张配图

读取 `$OUTPUT_DIR/shot_list.md`，按 Shot 编号顺序逐张调用 `ian-xiaohei-illustrations`，**每张独立生成，不合并**。

提示词模板（从 shot list 对应字段填入，`{IMAGE_RATIO}` 使用 Step 0 确定的配图尺寸）：

```
{IMAGE_RATIO} 中文正文配图，纯白背景，黑色手绘线稿，无渐变填充、少量红橙蓝中文手写批注。。
```

输出路径：`$OUTPUT_DIR/assets/img_01.png`、`img_02.png` … 与 Shot 编号对应。

---

### Step 4 — 调用 mimo-v2-5-tts 生成语音

用 Skill 工具调用 `mimo-v2-5-tts`，参数：

- **文本**：读取 `$OUTPUT_DIR/script.md`，去掉 `## P?` 标题行，保留全部口播正文
- **音色**：Step 0 确认的语音风格 / 音色
- **风格控制**：`--context "播客主播，语速适中，亲切自然"`
- **输出路径**：`$OUTPUT_DIR/assets/narration.wav`

语速偏慢时加 `--speed 1.1` 重新合成（无需询问用户）。

---

### Step 5 — 调用 hyperframes 编排视频

用 Skill 工具调用 `hyperframes`，传入以下上下文：

**素材**：
- 脚本：`$OUTPUT_DIR/script.md`（含 P1/P2 段落标记）
- Shot list：`$OUTPUT_DIR/shot_list.md`（图片 → 段落映射）
- 图片：`$OUTPUT_DIR/assets/img_01.png` …
- 语音：`$OUTPUT_DIR/assets/narration.wav`

**视频结构指令**：
- 视频尺寸：`{VIDEO_RATIO}`（Step 0 确认值）
- 语音轨：`narration.wav` 从头到尾
- 字幕：从脚本逐段同步，简洁单行，白字深底
- 图片出现时机：按 shot list"放在第 P? 段后"对应的语音时间点淡入（0.5s fade）
- 图片持续：从淡入到下一张图出现（或视频结束）
- 背景：纯黑或深灰
- 无背景音乐（除非用户在 Step 0 要求）

输出：`$OUTPUT_DIR/renders/video.mp4`

---

### Step 6 — 完成报告

```bash
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT_DIR/renders/video.mp4"
ls "$OUTPUT_DIR/assets/"*.png | wc -l
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT_DIR/assets/narration.wav"
```

向用户报告（表格形式）：

| 产物 | 路径 | 时长 / 数量 |
|---|---|---|
| 最终视频 | `renders/video.mp4` | ? 秒 |
| 语音 | `assets/narration.wav` | ? 秒 |
| 配图 | `assets/img_0N.png` | ? 张 |

---

## 错误处理

| 错误 | 处理（不停顿，自行解决后继续） |
|---|---|
| shot list 字段缺失 | 按格式规范推断补全后继续 |
| 某张图生成失败 | 换提示词重试一次；仍失败则跳过，在报告中注明 |
| 语音语速明显偏慢 | 加 `--speed 1.1` 自动重新合成 |
| hyperframes 图片时间点错位 | 补充段落估算秒数（字数 ÷ 130 × 60）重新传递 shot_list.md |
