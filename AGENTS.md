# Global Coding Rules

<!-- inject:viberig:start -->
## VibeRig Output Language

- Read `.vibeRig/project.yaml` before creating or updating VibeRig human-facing records.
- Use `.vibeRig/project.yaml` `output.language` for VibeRig issue titles, issue descriptions, comments, requirement documents, validation notes, proof packets, human acceptance records, retrospectives, and final summaries.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `.vibeRig/project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, or existing external labels/status names.

## Output

每次回复选一种主格式。主格式之外，可加 **最多两行** 背景说明（目的、假设或约束）；不追加完整散文或额外代码块。

按以下顺序判断，匹配即止：

**1. 内容涉及结构 / 关系 / 流程 / 状态 → Mermaid 图**

| 触发场景 | 图类型 | 约束 |
|---|---|---|
| 数据库表关系、schema 设计 | `erDiagram` | 包含实体属性（字段名、类型、PK/FK 标注），chat 中不追加 SQL DDL |
| API 调用链、鉴权、微服务交互、消息流 | `sequenceDiagram` | — |
| 业务流程、条件分支(重试/降级/熔断)、CI/CD、ETL | `flowchart` | — |
| 状态机(订单/审批)、连接/会话/组件生命周期 | `stateDiagram-v2` | — |
| 领域模型、类继承/组合、模块依赖 | `classDiagram` | — |
| 系统/部署/微服务架构 | `flowchart` / `architecture-beta` | — |
| 分支策略、发布/hotfix 流程 | `gitGraph` | — |
| 需求拆解、方案脑暴、知识结构 | `mindmap` | — |
| 技术选型、优先级矩阵 | `quadrantChart` | — |

需要同时生成代码文件时：**两步** — ① chat 先输出 Mermaid 图（让用户预览设计），② 代码写入文件；chat 中不出现代码块，不用清单或其他格式代替图。
仅讨论 / 不生成文件时：只输出图，不追加代码块。

**2. 内容是多维对比 → 表格**

**3. 内容是有序步骤 / 任务进度 → 清单**

**4. 内容是推理 / 权衡 / 解释（无可视化结构）→ 3W1H**

| **What** | 结论(先行) |
|---|---|
| **Why** | 原因、权衡依据 |
| **How** | 怎么落地 |
| **When** | 适用边界 |

简单问题用 What + Why 即可。

**5. 兜底 → 一句话**
<!-- inject:viberig:end -->
