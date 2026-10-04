# Édito Atelier

Édito B1 2023 法语词汇学习网站。使用仓库现有的 1110 条词库和检测引擎，与 ChatGPT 插件独立运行。

## 本地开发

```sh
cd website
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

游客记录保存在浏览器。登录同步需要在 Netlify 项目中启用 Identity；本地 Vite 开发时仍可完整使用游客模式。请勿把测试进度或用户备份提交到公开仓库。

## 发布到 Netlify

仓库根目录的 `netlify.toml` 设置 `website` 为构建目录，并发布 `website/dist`。从仓库根目录运行 Netlify CLI，或在 Netlify 连接此 GitHub 仓库。

账号使用 `@netlify/identity`。云端 `/api/progress` 要求登录并根据认证用户 ID 保存到 Netlify Blobs。写入校验请求来源和进度格式，使用 ETag 条件更新；冲突时保留本机数据，用户先导出备份，再读取云端记录。正式部署使用站点存储，预览部署使用隔离的部署存储。

## 检测规则

- 课本：每个 Part 全部词条按主题分组。手动过关或全部正确后推进主进度；下一 Part 新建独立卡片，旧卡片保留。更正自动过关卡片会恢复相应主进度。
- 每日：至少四个 Part 过关后启用。最新 Part 两组，前两个 Part 各一组，较早 Part 随机一组；每组同一主题十词，不推进主进度。每次进入与北京时间跨日更新。副进度独立累计，保留最近二十轮。
- 普通：沿用 U1 P1＋P2 混合五组十词，独立累计。
- 导入：网站完整 JSON 备份，或插件的 `edito-b1-main-progress.json`。导入课本进度时每日记录重新初始化。

代码遵循仓库 MIT 许可。词库的来源、译文与音标校核状态遵循根目录 `DATA_NOTICE.md`，不包含在 MIT 代码授权中。
