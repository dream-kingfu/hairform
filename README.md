# 型格 HAIRFORM

面向普通用户的男生 AI 发型分析 H5。当前默认采用文字优先模式：上传一张正面肖像后，只调用一次视觉模型即可获得完整建议；真人预览由后台开关控制，默认关闭。

新开发任务请先阅读 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)，其中包含当前线上状态、架构、接口、模型策略、管理方法、小程序说明和完整更新历史。

应用会提供：

- 最佳短发、最佳中发、最佳长发和一款谨慎选择建议
- 默认不调用 Image2；后台开启真人预览后，用户可从三款推荐中选择一款，整单最多调用 Image2 两次
- 两款辅助发色色卡
- 2160×3840 双语 PNG 报告和 1080×1920 WebP 页面预览
- 24 小时任务保留、匿名反馈、分享与立即删除

## 本地运行

```bash
npm install
npm run dev
```

未配置 Kie API Key 时可通过 `DEMO_MODE=true` 进入演示模式，完整任务流和报告仍可操作，单张预览使用原图作为诚实占位。

Kie 使用文件流上传、异步生成任务和统一任务查询接口。复制 `.env.example` 为 `.env.local` 并填入密钥后启用真实生成：

```text
AI_PROVIDER=kie
KIE_API_KEY=...
KIE_ANALYSIS_MODEL=gpt-5-6-terra
KIE_QC_MODEL=gpt-5-6-luna
KIE_IMAGE_MODEL=gpt-image-2-image-to-image
DEMO_MODE=false
```

文字分析固定支持 Kie Terra、阿里云 Qwen3.6-Flash 和智谱 GLM-4.6V-Flash；真人预览固定使用 Kie Image2，质检使用 Luna/Terra。任何白名单外模型都会失败关闭。API Key 只允许保存在本地未提交的环境文件或 Sites 加密环境变量中。

## 数据边界

- D1 保存任务状态和结构化分析，R2 保存原图、可选头发蒙版、预览和报告。
- 所有任务都有 24 小时到期时间；读取任务时会清理过期内容，生产环境还应为 R2 配置同等生命周期规则。
- 使用 Kie 时原始肖像会先上传到其临时文件服务。Kie 文档对临时文件删除时间存在 24 小时与 3 天两种描述，正式上线前必须向 Kie 确认实际保留期限，并让隐私指引与真实期限一致。
- 图片、访问令牌和完整模型提示词不会写入业务日志。
- 任务使用高熵访问令牌和 HttpOnly、SameSite Cookie；令牌不进入公开页面 URL。

## 公开部署保护

- 访客 IP 仅以加盐 SHA-256 哈希进入 D1 限流桶，不保存原始地址。
- 默认每位访客每小时最多创建 2 份报告、每天最多 5 份报告。
- 默认全站每天最多 100 个新任务和 200 次 Image2 调用；每份任务最多 1 次 Terra 分析、2 次 Luna 质检、1 次 Terra 疑难复核和 2 次 Image2。
- Kie 积分安全线只在可选真人预览前检查；测试环境可设为 0，正式公开流量应恢复合理阈值。连续服务故障会短时熔断。
- 同一任务使用数据库原子锁防止并发重复处理；达到限额时接口返回 `429` 与标准 `Retry-After`。
- 生产环境必须设置随机 `RATE_LIMIT_SALT`，并可通过环境变量调整全部额度。

## V0.4 文字优先与管理后台

- 新任务默认采用 `text-first-v1`，一次视觉分析后立即获得文字建议、发色色卡、三款理发师沟通卡和双语报告，不调用 Image2。
- `/admin` 为独立密码管理后台，可在 Kie Terra、Qwen3.6-Flash、GLM-4.6V-Flash 之间切换，并控制真人预览是否开放。
- 供应商 API Key、`ADMIN_PASSWORD_HASH` 和 `ADMIN_SESSION_SECRET` 必须只保存在 Sites 加密环境变量中；后台不会读取或返回密钥内容。
- 生成管理员密码哈希可在本机运行 `npm run admin:hash-password`，然后把输出值填入 Sites 的 `ADMIN_PASSWORD_HASH`。同时设置至少32字符的随机 `ADMIN_SESSION_SECRET` 和递增的 `ADMIN_PASSWORD_VERSION`。
- 切换供应商前必须先配置对应 Key，并在后台完成一次连接测试；健康结果30分钟内有效。

## 验证

```bash
npm run db:generate
npm run build
npm test
```

真实视觉验收仍需使用不少于 30 张获得授权的男性正面肖像完成，重点检查身份一致性、发型目标匹配和非头发区域保护。

## License / 许可证

本项目采用 [GNU Affero General Public License v3.0](LICENSE)（`AGPL-3.0-only`）。你可以使用、研究、修改和分发本项目，包括商业使用；如果你分发修改版本，或通过网络向用户提供修改版本的服务，必须按 AGPL-3.0 提供相应源代码并保留许可证声明。

Copyright © 2026 dream-kingfu.

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). Modified versions distributed or made available to users over a network must provide the corresponding source code under the AGPL-3.0 terms.
