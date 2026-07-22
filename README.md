# 型格 HAIRFORM

面向普通用户的男生 AI 发型分析 H5。上传一张正面肖像后，应用会生成：

- 最佳短发、最佳中发、最佳长发和一款谨慎选择对照
- 两款辅助发色真人预览
- 2160×3840 双语 PNG 报告和 1080×1920 WebP 页面预览
- 24 小时任务保留、匿名反馈、单张重试、分享与立即删除

## 本地运行

```bash
npm install
npm run dev
```

未配置 `OPENAI_API_KEY` 时自动进入演示模式，完整任务流和报告仍可操作，六张预览使用原图作为诚实占位。

复制 `.env.example` 为 `.env.local` 并填入密钥后启用真实生成：

```text
OPENAI_API_KEY=...
ANALYSIS_MODEL=gpt-5.6-terra
IMAGE_MODEL=gpt-image-2-2026-04-21
DEMO_MODE=false
```

## 数据边界

- D1 保存任务状态和结构化分析，R2 保存原图、可选头发蒙版、预览和报告。
- 所有任务都有 24 小时到期时间；读取任务时会清理过期内容，生产环境还应为 R2 配置同等生命周期规则。
- 图片、访问令牌和完整模型提示词不会写入业务日志。
- 任务使用高熵访问令牌和 HttpOnly、SameSite Cookie；令牌不进入公开页面 URL。

## 验证

```bash
npm run db:generate
npm run build
npm test
```

真实视觉验收仍需使用不少于 30 张获得授权的男性正面肖像完成，重点检查身份一致性、发型目标匹配和非头发区域保护。
