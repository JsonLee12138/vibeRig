# Runbook Contract

Runbook 是运行、诊断、恢复和回滚的可执行契约，不是所有需求的固定文档。

## 触发条件

出现以下任一变化时检查 `.vibeRig/runbooks.yaml`：

- 新服务、进程、定时任务或外部依赖；
- 启动、配置、部署、迁移、回填或恢复方式变化；
- 新告警、SLO、容量或观察窗口；
- Smoke、回滚或事故处置步骤变化。

不命中时记录 `not_applicable`，不要创建空 Runbook。

## 最低契约

每个命中的 Runbook 声明 owner、触发条件、权威文档路径和 diagnose/execute/verify/rollback 命令。文档说明前置条件、停止线、失败处理和升级路径；确定性动作优先放在可测试脚本中。

Runbook 更新的完成判据是：在允许的 local、ephemeral 或 staging 环境按契约实际演练，Evidence 记录 commit、环境、结果和残余未覆盖差异。只有 Markdown 存在不能判定完成。

生产命令、真实通知、付费操作和破坏性恢复始终受 authority Gate 约束。
