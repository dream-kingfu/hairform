# HAIRFORM 项目全景与交接文档

> 最后更新：2026-07-30  
> 用途：让新的开发任务、开发者或 AI 助手不依赖历史聊天，也能快速理解、运行、维护和继续迭代 HAIRFORM。  
> 安全要求：本文只记录环境变量名称与配置状态，绝不记录 API Key、管理员密码、访问令牌或用户照片。

## 1. 当前结论

HAIRFORM 是一个面向普通用户的响应式 H5 与微信原生小程序发型分析服务。用户上传一张获得授权的正面肖像后，服务默认只调用一次视觉模型，生成结构化文字分析、四款发型建议、两款发色色卡、三款理发师沟通卡以及可下载报告。

当前生产策略是 `text-first-v1`：

- 默认不调用 Image2，先以低成本提供完整文字报告。
- 真人换发型预览是后台控制的可选功能，当前全站关闭。
- 开启真人预览后，用户从最佳短发、中发、长发中选择一款；Image2 每任务最多调用两次，第二次只用于质检失败后的重试。
- 谨慎选择和发色色卡不会触发 Image2。
- 真人预览失败不会影响已经完成的文字报告。

## 2. 重要位置

### 线上与源码

- 公开网站：https://hairform-ai.king1018.chatgpt.site
- 管理后台：https://hairform-ai.king1018.chatgpt.site/admin
- GitHub：https://github.com/dream-kingfu/hairform
- GitHub 默认分支：`main`
- 当前源码基线提交：`474e202`
- Sites 项目：`型格 HAIRFORM`
- Sites 项目 ID：`appgprj_6a60f9628f88819183313e7f4f41a60c`

### 本机目录

- H5 与后端：`C:\Users\Administrator\Desktop\XM\hair-style-ai`
- 微信小程序：`C:\Users\Administrator\Desktop\XM\ku\Photography-KB-miniprogram`
- 小程序 HAIRFORM API 地址：`https://hairform-ai.king1018.chatgpt.site`

管理员密码和 API Key 不属于源码。管理员初始密码只在本机交接文件或密码管理器中保存，不能复制到本文、GitHub、业务日志或聊天记录。

## 3. 当前生产配置快照

| 项目 | 当前状态 |
|---|---|
| 当前视觉供应商 | Kie |
| Kie Terra | 密钥已配置，真实分析已验证 |
| 阿里云千问 Qwen3.6-Flash | 密钥已配置，后台连接测试通过，实测延迟约 1.54 秒；尚未切换为当前供应商 |
| 智谱 GLM-4.6V-Flash | 适配器已实现，密钥未配置 |
| 真人发型预览 | 全站关闭 |
| Image2 | 仅在后台开启真人预览后使用 |
| Kie 积分安全线 | 测试阶段暂设为 `0`；正式扩大公开流量前应恢复安全阈值 |
| 任务保留 | 最长 24 小时，可立即删除 |
| 公开访问 | 已上线 |

配置变更只影响新任务。每个任务创建时会保存供应商与模型快照，后台切换不会改变已经创建的任务。

## 4. 产品输出

一次文字优先分析会返回：

- 脸型、发质、发量、发际线、额头比例、肤色倾向和整体风格标签。
- 最佳短发、最佳中发、最佳长发和谨慎选择。
- 每款发型的固定中英文名称、发长、刘海、分缝和推荐等级。
- 两款推荐发色色卡。
- 三款推荐发型对应的理发师沟通卡。
- `2160×3840 PNG` 高清报告。
- `1080×1920 WebP/PNG` 页面或小程序预览。

沟通卡由固定目录与双语字典生成，不增加 AI 调用。它包含顶部长度、两侧后区、刘海、分缝、层次、打薄、造型产品、避坑提醒和现场确认事项。

## 5. 用户流程与状态

新任务主流程：

```text
上传照片
  → validating
  → analyzing
  → analysis_ready
  → 文字报告、发色色卡、沟通卡可用
```

如果后台开启真人预览：

```text
analysis_ready
  → 用户选择 best_short / best_medium / best_long
  → generating
  → Luna 质检，必要时 Terra 复核
  → compositing
  → completed / partial
```

主要任务状态：

`validating | analyzing | analysis_ready | awaiting_selection | generating | compositing | completed | partial | failed | expired | deleted`

旧任务策略 `legacy-six-v1` 和 `single-preview-v1` 只用于 24 小时兼容读取、下载与删除；新任务全部使用 `text-first-v1`。

## 6. 模型白名单与路由

前端、用户请求和管理后台都不能输入任意模型名。服务端固定白名单如下：

| 用途 | 供应商 | 固定模型 |
|---|---|---|
| 文字优先视觉分析 | Kie | `gpt-5-6-terra` |
| 文字优先视觉分析 | 阿里云 | `qwen3.6-flash` |
| 文字优先视觉分析 | 智谱 | `glm-4.6v-flash` |
| 真人预览 | Kie | `gpt-image-2-image-to-image` |
| 常规图片质检 | Kie | `gpt-5-6-luna` |
| 疑难质检复核 | Kie | `gpt-5-6-terra` |

规则：

- 不做静默跨供应商回退。
- 未知模型配置直接返回 `model_policy_error`。
- 视觉模型只能返回固定发型与发色目录 ID，不能生成最终展示文案。
- 无法从单张照片可靠判断的字段必须返回 `unknown`。
- 视觉响应必须通过 `HairAnalysis` Schema 和目录 ID 二次校验。

## 7. API 概览

### 用户任务接口

- `POST /api/v1/hair-jobs`：上传照片并创建任务。
- `POST /api/v1/hair-jobs/{jobId}/process`：执行文字分析。
- `GET /api/v1/hair-jobs/{jobId}`：读取状态、分析、展示数据和报告地址。
- `POST /api/v1/hair-jobs/{jobId}/generate`：真人预览开启后生成选定发型。
- `POST /api/v1/hair-jobs/{jobId}/retry`：按策略重试允许的资源。
- `POST /api/v1/hair-jobs/{jobId}/feedback`：提交是否有帮助和选中发型。
- `POST /api/v1/hair-jobs/{jobId}/report`：上传兼容报告。
- `POST /api/v1/hair-jobs/{jobId}/report-assets`：分别上传高清报告和页面预览。
- `GET /api/v1/hair-jobs/{jobId}/assets/{assetId}`：受保护地读取任务图片。
- `DELETE /api/v1/hair-jobs/{jobId}`：立即删除任务、图片和报告。

任务访问令牌只允许放在 `Authorization: Bearer ...` 请求头或 HttpOnly Cookie 中，不能放进公开 URL。

### 管理接口

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/config`
- `PUT /api/admin/config`
- `POST /api/admin/providers/{providerId}/test`
- `GET /api/admin/audit`

管理写接口必须同时具备有效会话、同源请求和 `X-Admin-CSRF`。

## 8. 管理后台

后台地址不出现在公开导航中，采用单管理员密码。

可执行操作：

- 查看当前视觉供应商与固定模型。
- 查看 Kie、Qwen、GLM 的“密钥已配置/未配置”状态。
- 执行真实连接测试并查看健康状态与延迟。
- 切换新任务使用的视觉供应商。
- 开启或关闭真人预览。
- 查看当天分析次数、成功数、失败数和 Image2 调用数。
- 查看配置测试、切换和登录审计记录。

供应商只有在密钥已配置且 30 分钟内连接测试成功时才能切换。配置更新使用版本号防止旧页面覆盖新配置。

### 管理安全

- 密码使用 PBKDF2-HMAC-SHA256、随机盐和十六进制存储。
- Sites Worker 当前最多支持 PBKDF2 100,000 次，因此生产值固定为 100,000 次；同时使用长随机密码、登录限速和高熵会话密钥。
- 会话 Cookie：`HttpOnly + Secure + SameSite=Strict`。
- 2 小时无操作失效，最长 12 小时自动退出。
- 同一公网 IP 15 分钟最多 5 次失败，超限锁定 30 分钟。
- D1 只保存会话令牌哈希与匿名 IP 指纹。
- 修改密码时更新 `ADMIN_PASSWORD_HASH` 并递增 `ADMIN_PASSWORD_VERSION`，旧会话立即失效。

## 9. API Key 配置方法

API Key 只能存放在 Sites 加密环境变量或本机未提交的 `.env.local`，管理后台不会读取、显示或修改密钥。

| 供应商 | Sites Secret 名称 |
|---|---|
| Kie | `KIE_API_KEY` |
| 阿里云千问 | `QWEN_API_KEY` |
| 智谱 | `GLM_API_KEY` |

标准操作顺序：

1. 将密钥写入 Sites Secret。
2. 重新部署当前已保存版本，使新环境变量生效。
3. 登录 `/admin`，执行对应供应商连接测试。
4. 测试为 `ok` 后再切换供应商。
5. 删除本机临时明文密钥文件。

密钥不能写入 `.env.example`、README、本文、D1、GitHub、业务日志或聊天。

## 10. 数据与存储

- D1：任务、结构化分析、模型调用计数、运行配置、供应商健康、管理员会话与审计。
- R2：原图、可选蒙版、生成预览和报告。
- 主要 V0.4 表：`ai_runtime_config`、`provider_health`、`admin_sessions`、`admin_audit_log`。
- `hair_jobs` 保存 `analysis_provider`、`analysis_model`、策略版本、选中槽位和各阶段调用次数。
- 原图、预览和报告最长保留 24 小时，并提供立即删除。
- 业务日志不能记录图片、访问令牌、API Key 或完整提示词。

用户页面必须说明：结果基于单张照片的视觉建议，不是医学、植发或专业理发结论；用户只能上传本人或已获授权的肖像。

## 11. 限流与成本保护

默认限制：

- 每位访客每小时最多 2 个新任务。
- 每位访客每天最多 5 个新任务。
- 全站每天最多 100 个新任务。
- 全站每天最多 100 次分析。
- 全站每天最多 200 次 Image2。
- 单任务最多 1 次主分析、2 次 Image2、2 次 Luna 质检和 1 次 Terra 疑难复核。
- Image2 网络结果不确定时按已使用计费，防止重复提交隐藏扣费。

精确公网 IP 白名单只绕过个人每小时和每天任务限制，不绕过全站额度、模型次数、单任务次数和熔断。白名单不接受通配符或 CIDR。

当前生产 `KIE_MIN_CREDITS=0` 是测试阶段临时配置；扩大公开流量前应恢复安全阈值并结合 Kie 实际计费校准。

## 12. H5 报告与前端

- React 19、Next 16、TypeScript、vinext/Vite。
- 照片上传前压缩到最长边约 1280px、JPEG 质量约 85%。
- 在 `analysis_ready` 即可查看建议、沟通卡、反馈、删除并生成无真人预览报告。
- 真人预览按钮仅在后台开启且当前槽位允许时显示。
- 报告文字全部由程序字典渲染，AI 图片不生成文字。
- 中文为主，英文为固定辅助标签。

## 13. 微信小程序

小程序项目同时包含摄影知识库和发型分析：

- 底部仅两个标签：`摄影 / 发型`。
- 摄影模块保留原白名单、资料库、小红书导入、新建录入和我的权限。
- 发型模块为微信原生页面，不使用 WebView，也不受摄影白名单限制。
- 使用 `wx.chooseMedia`、`wx.request`、`wx.uploadFile`、Canvas 和系统分享/保存相册。
- 支持 `analysis_ready`、任务恢复、文字报告、沟通卡、反馈和立即删除。
- 真人预览按钮由服务器开关控制。
- API 基地址位于 `miniprogram/utils/config.js`。
- 已在微信开发者工具重新编译通过，但没有自动上传或提交微信审核。

正式上线微信前仍需：

- 在微信公众平台配置 HAIRFORM 域名为 `request`、`uploadFile` 和 `downloadFile` 合法域名。
- 完成隐私保护指引、用户协议、服务类目和图片处理说明。
- 使用真机测试 iOS 与 Android 的上传、报告保存和分享。

摄影页已有云端授权查询偶尔超时，这是摄影模块原有问题，不是发型页面编译错误。

## 14. 本地开发与验证

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
npm run lint
npm run build
npm test
```

本机真实供应商密钥放在未提交的 `.env.local`。未配置真实密钥时可使用 `DEMO_MODE=true`，但演示结果不能冒充真实 AI 生成。

最近一次完整验证：

- 生产构建通过。
- Lint 通过。
- 21 项自动化测试通过。
- 使用授权肖像完成真实 Kie Terra 文字分析。
- 结果进入 `analysis_ready`，四款发型与两款发色返回。
- Image2 调用数为 0。
- 测试任务和照片已立即删除。
- 管理员登录、CSRF、Kie 健康检查与审计写入通过。
- Qwen 密钥已配置，后台连接测试为 `ok`，延迟约 1.54 秒。

## 15. 已知边界与下一步

### V1 不包含

- 账号体系和长期历史。
- 理发店 CRM、发型社区或身份识别。
- 360° 头型分析。
- 医学、植发或人工精修结论。
- 染发配方、漂发次数或药水比例。

### 建议后续顺序

1. 从后台把 Qwen 切换为当前供应商，用不少于 30 张获得授权的肖像做 A/B 视觉验收。
2. 配置并测试 GLM，再比较准确率、延迟、稳定性和单次成本。
3. 恢复 Kie 积分安全线，确认正式公开流量预算。
4. 完成微信合法域名、隐私指引与真机验收后上传审核。
5. 为报告 Canvas 增加更多真机字体与最长标签回归测试。
6. 定期检查 24 小时清理、供应商临时文件保留政策和审计日志。

## 16. 完整更新日志：HAIRFORM H5 与后端

以下内容同步自 `CHANGELOG.md`。

### [Unreleased]

#### Documentation

- 新增 `PROJECT_CONTEXT.md` 项目全景与交接文档，集中记录当前线上状态、架构、模型路由、后台、API、数据安全、小程序、验证结果、完整版本日志与 Git 历史。
- 校正 README 中已经过时的“默认生成真人预览”和“生产只支持 Kie”描述。

#### Fixed

- 增加管理员登录的安全错误分类日志，区分未配置、临时锁定与密码不匹配；不记录密码、会话令牌或原始 IP。
- 管理员密码哈希改用仅含安全字符的十六进制格式，并保留旧 Base64 格式读取兼容；PBKDF2 参数不变。
- Sites 运行环境将 PBKDF2 单次迭代上限限制为 100,000；管理密码哈希调整为平台支持的 100,000 次，并继续配合长随机密码、随机盐、登录限速与会话密钥保护。
- 完成根因定位后移除临时密码与哈希指纹诊断日志。

### [0.4.0] - 2026-07-30

#### Added

- 新增文字优先任务策略 `text-first-v1`：一次视觉分析即可输出完整双语发型建议、发色色卡、理发师沟通卡和可下载报告，默认不调用 Image2。
- 新增 Kie Terra、Qwen3.6-Flash、GLM-4.6V-Flash 三家固定视觉识别供应商适配器；任务创建时保存供应商与模型快照。
- 新增独立密码管理后台 `/admin`，提供供应商连接测试、切换、真人预览开关、当日用量和审计记录。
- 新增管理员 PBKDF2-HMAC-SHA256 密码校验、HttpOnly 会话、CSRF、登录限速、密码版本失效和审计保护。
- 网页与微信小程序新增无真人预览报告与原图版理发师沟通卡；上传前压缩至约 1280px、JPEG 质量 85%。

#### Changed

- Kie 积分检查移动到可选真人预览请求前，纯文字分析不再被 Image2 积分安全线阻塞。
- 真人发型预览改为后台全站开关控制，默认关闭；开启后仍保持每任务最多两次 Image2 调用与 Luna/Terra 质检。
- Image2 失败只影响可选预览，不再使已完成的文字报告失效。
- 报告上传接口支持 `analysis_ready`，并允许真人预览完成后覆盖为含预览版本。

#### Security

- API Key 仍只存放在 Sites 加密环境变量，管理接口不会返回密钥、密码哈希或会话令牌。
- 管理配置采用版本号原子更新，供应商切换要求密钥已配置且 30 分钟内健康检查通过。

#### Verified

- TypeScript、Lint、生产构建与 21 项自动化测试通过。
- 微信开发者工具完成重新编译，“摄影 / 发型”双导航和发型原生页面可正常打开；摄影页原有云端授权查询仍可能出现超时。

### [0.3.1] - 2026-07-30

#### Added

- 新增精确公网 IP 白名单；白名单访客不受每小时、每天的个人任务次数限制。
- 新增白名单解析测试，明确拒绝通配符和 CIDR 网段配置。

#### Changed

- 白名单只绕过个人限流，继续保留全站任务、模型调用、单任务 Image2 次数和服务熔断保护。
- 生产环境已将当前测试电脑的公网 IP 作为保密配置加入白名单。

#### Fixed

- Image2 改为异步任务提交与轮询，避免长时间同步等待被托管平台中断。
- 生成完成后继续执行 Luna 质检，并在必要时按单任务上限进行一次 Image2 重试。

#### Verified

- 生产环境真实完成照片上传、Terra 分析、发型选择、Image2 单图生成和 Luna 质检。
- 实测单次 Image2 调用生成预览成功；测试任务、服务端照片和本地测试副本已删除。

## 17. 完整更新日志：微信小程序

以下内容同步自小程序 `CHANGELOG.md`。

### v1.4.0 - HAIRFORM 文字优先模式

- 发型分析完成后立即显示文字建议、发色色卡与三款理发师沟通卡，默认不请求 Image2。
- 沟通卡在没有真人预览时使用原始肖像，有预览后自动替换。
- 支持 `analysis_ready` 状态直接生成、上传、保存和分享 2160×3840 报告与 1080×1920 预览。
- 真人预览按钮由 HAIRFORM 后台全站开关控制，关闭时不显示；开启后沿用单图最多两次生成策略。
- 上传前自动压缩到最长边约 1280px、JPEG 质量 85%，降低上传与视觉识别成本。
- 已在微信开发者工具重新编译并确认“摄影 / 发型”双导航和发型原生页面可打开；摄影页仍存在原有云端授权查询超时，不属于本次发型源码编译错误。

### v1.3.0 - AI 发型分析入口

- 底部导航改为“摄影 / 发型”，摄影资料白名单逻辑保持不变。
- 摄影首页新增资料、导入、录入、我的四个快捷入口。
- 发型分析改为微信原生页面，不再依赖 WebView。
- 原生支持发型/发色预览、双语报告、理发师沟通卡、反馈、重试和立即删除。
- 增加服务器域名与隐私合规发布说明。

### v1.2.0 - 小红书链接图片识别

- 新增云函数 `analyzeXhsLink`。
- 支持粘贴小红书链接后解析页面标题、描述和可访问图片地址。
- 支持把解析到的图片转存到微信云存储，作为素材卡片图片保存。
- 支持根据笔记文字生成标签建议和图片识别记录草稿。
- 同步到 Obsidian 时保留来源链接和原始图片链接。
- 当前识别为“链接解析 + 文字标签推断 + 图片转存”，不绕过小红书访问限制；无法访问的图片会提示手动上传。

### v1.1.0 - 小红书素材导入

- 新增“小红书导入”页，支持粘贴小红书分享文案或链接。
- 自动提取 `xiaohongshu.com` / `xhslink.com` 链接。
- 自动从分享文案中生成标题草稿。
- 支持上传多张保存过的图片，并保存为素材卡片。
- 新增来源字段：来源平台、来源链接、原始分享文案、导入方式。
- 新增图片识别记录区：先记录团队人工识别/标签建议，后续可接入合规 AI 图片识别服务。

### v1.0.0 - 可用首版

- 原生微信小程序项目可运行。
- 微信云开发环境：`cloudbase-d6g4tamfqd9f73c48`。
- 已支持白名单登录和首个管理员自动初始化。
- 支持姿势卡片、风格卡片、项目复盘、素材入库 4 类资料。
- 支持手机多图上传、标签、状态、说明和备注。
- 支持资料列表、详情页、搜索和筛选。
- 5 个云函数已部署并验证为 Active：`login`、`saveCard`、`listCards`、`getPendingSync`、`markSynced`。
- 支持电脑同步助手把云端资料写回 Obsidian。

## 18. Git 历史里程碑

`CHANGELOG.md` 创建前的历史也保留如下，方便追溯：

| 日期 | 提交 | 内容 |
|---|---|---|
| 2026-07-23 | `a762db5` | Build AI men's hairstyle analysis V1 |
| 2026-07-23 | `2d23198` | Add AGPL-3.0 license |
| 2026-07-23 | `6e150d2` | Merge AGPL license PR |
| 2026-07-23 | `e716e06` | Add public generation rate limits |
| 2026-07-24 | `10c67e0` | Add barber communication cards |
| 2026-07-26 | `3b7ebce` | Add native mini program hair API support |
| 2026-07-26 | `e66b410` | Add Kie GPT Image 2 provider support |
| 2026-07-26 | `fc6eaac` | Run Kie previews sequentially |
| 2026-07-26 | `5547282` | Fix Kie Terra analysis requests |
| 2026-07-26 | `aa2bc02` | Stabilize Kie JSON analysis output |
| 2026-07-26 | `1fb4736` | Use Kie base64 upload for mobile photos |
| 2026-07-27 | `c1d2086` | Release V0.2 Kie response compatibility |
| 2026-07-27 | `82834aa` | Handle Kie data string responses |
| 2026-07-27 | `d634a35` | Add single-preview model routing |
| 2026-07-27 | `2e2293e` | Merge AGPL-3.0 license |
| 2026-07-29 | `e285e80` | Poll Kie image tasks asynchronously |
| 2026-07-30 | `54f1d3e` | Allow trusted IPs to bypass visitor rate limits |
| 2026-07-30 | `f20c5f1` | Add HAIRFORM changelog |
| 2026-07-30 | `9c31807` | Add text-first analysis and admin control |
| 2026-07-30 | `80a43f3` | Log safe admin login failures |
| 2026-07-30 | `0375fda` | Classify admin login failures |
| 2026-07-30 | `b9f3227` | Use Sites-safe password hash format |
| 2026-07-30 | `c18ed1e` | Encode admin password hash as hex |
| 2026-07-30 | `568c27e` | Add temporary safe password diagnostic fingerprints |
| 2026-07-30 | `e228e9b` | Diagnose PBKDF2 runtime failure |
| 2026-07-30 | `474e202` | Respect Sites PBKDF2 runtime limit and remove temporary diagnostics |

### 生产运行配置记录

运行配置不一定产生 Git 提交，因此单独记录：

| 日期 | 配置变更 | 验证结果 |
|---|---|---|
| 2026-07-30 | Kie Terra 设置为当前视觉分析供应商 | 真实肖像文字分析成功，Image2 调用为 0 |
| 2026-07-30 | 真人预览全站开关保持关闭 | H5 与小程序只显示文字报告，不触发 Image2 |
| 2026-07-30 | Kie 积分安全线在测试阶段临时设为 0 | 纯文字分析与 API 效果测试不再被积分阈值阻塞 |
| 2026-07-30 | 阿里云 `QWEN_API_KEY` 写入 Sites Secret | Qwen3.6-Flash 后台连接测试 `ok`，延迟约 1.54 秒；当前供应商仍为 Kie |
| 2026-07-30 | GLM 适配器保留但未配置密钥 | 后台显示未配置，不能切换 |

## 19. 交接检查清单

新任务开始前先确认：

- 阅读本文和 `CHANGELOG.md`。
- 不从聊天、截图或日志复制任何旧密钥。
- 检查 `git status`，保护用户未提交的改动。
- 确认当前 Sites 供应商、健康状态和真人预览开关。
- 如果修改模型、接口、数据库、限流、后台或报告，补充自动化测试。
- 每次源码发布都更新 `CHANGELOG.md`，并同步更新本文中受影响的当前状态和完整更新日志。
- 环境变量变更写入后台审计；密钥只使用 Sites Secret。
- 发布后用非敏感或获得授权的照片做最小真实验证，并立即删除测试任务。
