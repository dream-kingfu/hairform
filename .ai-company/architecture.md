# HAIRFORM 公共架构与交接地图

## 运行架构

```text
H5 / 管理后台
      ↓
Next.js App Router
      ↓
vinext + Vite
      ↓
Cloudflare Workers
      ├─ D1：任务、结构化分析、配置与审计
      └─ R2：原图、蒙版、预览与报告
```

核心目录：

- `app/`：H5、管理后台和 API Route。
- `lib/hair/`：目录、类型、结构化结果和确定性展示。
- `lib/client/`：浏览器照片检查与报告生成。
- `lib/server/`：供应商适配、模型策略、任务状态、限流和处理流水线。
- `db/`、`drizzle/`：D1 schema 与迁移。
- `tests/`：Node 自动化测试。

微信原生小程序使用同一套 HAIRFORM API，但属于独立工程和发布面，不在本仓库默认修改范围内。

## AI 开发架构

```text
用户需求 / GitHub Issue
          ↓
GPT 主控：判断、澄清、架构、任务单
          ↓
DeepSeek：按允许路径实现并提交开发报告
          ↓
Lint / Build / Tests / Browser / GitHub Actions
          ↓
GPT 主控：功能、视觉、隐私和发布验收
          ↓
Draft PR / 人工合并 / 单独授权的生产发布
```

公共协作文件：

- `AGENTS.md`：所有 Agent 的最高公共约束。
- `.agents/skills/`：按职责加载的项目 Skill。
- `.ai-company/templates/`：任务、开发报告和验收报告格式。
- `.github/workflows/quality-gate.yml`：确定性 PR 门禁。

主控电脑可拥有被 Git 忽略的私有补充，但公共流程不得依赖只有某一台电脑才知道的必要步骤。
