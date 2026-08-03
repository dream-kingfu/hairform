# <TASK-ID>：<用户结果>

## 元数据

- owner: `gpt-controller`
- implementation_owner: `deepseek`
- reviewer: `gpt-release-reviewer`
- repair_round: `0`
- max_repair_rounds: `2`
- release_boundary: `source-only | github-pr | production`

## 用户结果

描述完成后用户会看到或得到什么。

## 商业目标

说明为什么值得做，以及成功意味着什么。

## 当前问题与证据

记录可复现现象、相关页面或 API、错误信息、截图引用和已知事实。不要写入密钥、真实照片路径或生产私有配置。

## 验收标准

- [ ] 使用可观察行为描述第一项标准。
- [ ] 列出失败、空状态、窄屏或兼容性要求。
- [ ] 明确必须保持不变的行为。

## 允许修改

```yaml
allowed_paths:
  - path/to/file-or-directory
```

## 禁止修改

```yaml
forbidden_paths:
  - PROJECT_CONTEXT_PRIVATE.md
  - .env*
  - separate-wechat-project
```

## 实现约束

- 需要遵守的产品不变量：
- 数据库或迁移要求：
- 模型和供应商边界：
- 隐私与删除要求：
- 性能或成本限制：

## 必跑验证

```text
npm run lint
npm test
```

按任务增加浏览器、API、迁移或图片语义验收。没有运行的检查必须写成 `not_run` 并说明原因。

## 不在范围内

- 列出本任务不会改动或发布的产品面。

## 交付物

- 代码与测试差异；
- 基于 `developer-report.json` 的开发报告；
- 必要的截图或测试产物引用；
- 未解决问题和返修建议。
