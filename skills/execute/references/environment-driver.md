# Environment Driver

Environment Driver 把测试环境选择落实为可执行项目命令。先读取 `.vibeRig/project.yaml` 的 environment manifest，再解析 `.vibeRig/environments.yaml` 中的目标 profile。

## 执行顺序

1. 选择 TC 要求的最低充分保真度与环境 profile。
2. 依次运行已声明的 bootstrap、start 和 health；缺失命令时再使用 Test Environment Broker 生成临时依赖。
3. 执行 migration、seed、API/浏览器操作及日志、trace、数据库检查。
4. 将环境 profile、命令、结果和实际保真度写入 Evidence。
5. 需要清理时运行 reset；失败时保留诊断信息，不虚报清理成功。

## 凭据等级

| 等级 | 行为 |
|---|---|
| `disposable_local` | 可生成、读取和使用；不得输出或提交具体值 |
| `provider_sandbox` | 已存在且 profile 允许时可自主使用 |
| `shared_dev` | 只使用已提供的受限凭据，不扩大权限 |
| `production` | 默认禁止；任何写入仍需独立明确授权 |

本地高自治不等于忽略安全。`production_network: denied` 必须由网络、配置或脚本保护，而不能只依赖提示词。Evidence 记录凭据类别和 provider，不记录 secret、token、cookie 或密码。

要求 sandbox、real 或 real browser 的 TC 不能由低保真 Evidence 满足。
