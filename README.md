# 法语词汇检测 / French Vocabulary Test

交互式法语→中文词汇自测插件，源码基于现用 **1.0.8**。包含三个 ChatGPT skill、自包含 HTML 卡片、MCP 服务和行为测试。

## 在线学习网站

[打开 Édito Atelier](https://editob1test.netlify.app/)：三个检测入口、完整词库、独立 Part 卡片、历史记录和进度导入导出。游客进度保存在本机；已启用邮箱注册与账号进度云同步，注册需确认邮箱。网站与 ChatGPT 插件通过主进度文件迁移。

网站源码位于 [`website/`](website/README.md)，根目录 `netlify.toml` 提供 Netlify 构建配置。

## 功能

| 入口 | 规则 | 保存位置 |
| --- | --- | --- |
| 法语词汇检测 | 云端卡片覆盖 U1 P1＋P2，五组各10词 | 云端 SQLite/D1，按用户隔离 |
| 课本单词检测 | 24个 Part；每组一个完整主题，组数和词数随主题变化 | 客户端主进度，可导入导出 |
| 每日单词检测 | 最近已过关 Part 两组，倒数第二、第三各一组，其余随机一个 Part 一组；每组一个主题、10词 | 客户端独立副进度 |

点击词条翻看中文和音标，再自评 ✔／✘；改选替换本轮原判定，重复点击不会重复累计。Part 与主题显示双语标题。每日检测至少需要4个已过关 Part；主题不足时提示，不跨主题或超出主进度补词。每次打开每日卡片重新抽词，同一轮翻词和切组不刷新题目。

**课本和每日进度不支持自动跨设备云同步**，跨设备使用导出、导入。源码开源不代表已上架 ChatGPT 公共插件目录，也不会自动注册 MCP 工具。

## 仓库结构

- `plugin-package/`：三个 skill、词库与内置 HTML 后备卡片。
- `assets/`：界面模板、抽词/评分核心、词库和双语标题。
- `*-bridge.js`：MCP Apps 宿主桥接代码。
- `worker-source.mjs`：MCP 路由、用户隔离和云端记录逻辑。
- `db/`、`drizzle/`：数据库结构和迁移，不含用户数据。
- `scripts/`：构建、插件打包和行为测试。

## 构建与测试

需要 Node.js 22+ 和 npm；插件打包另需 Python 3。

```bash
npm ci
npm run build
npm test
npm run package:plugin
```

构建输出 `dist/server/index.js` 与 `dist/.openai/hosting.json`。生成产物、依赖、数据库和个人连接不提交到仓库。测试使用独立样例，不访问真实学习记录。

## 使用 skill 与离线卡片

按宿主说明安装 `plugin-package/skills/` 中所需 skill。支持 HTML/Visualize 的宿主可按 SKILL.md 呈现 `assets/interactive-card.html`；普通浏览器可打开对应 `assets/preview.html`。复制 skill 不会自动注册 MCP 工具。

## 部署 MCP 服务

源码采用 Sites/Workers 风格运行时，不能直接当作普通 Node HTTP 服务执行。需要支持 `fetch(request, env)` 的运行时、名为 `DB` 的 D1/SQLite 绑定，以及 `drizzle/0000_vocabulary_state.sql` 初始迁移。

服务依赖可信托管边界完成 OAuth，并注入 `oai-authenticated-user-id`；代码不实现独立 OAuth 服务。迁移到其他平台时须实现等效身份认证，并过滤外部伪造的身份头。

`.openai/hosting.json` 仅含通用能力配置，没有作者项目 ID。部署到自己的 Sites 项目时，由托管流程填写新的项目身份。成功部署后，使用你的真实 HTTPS MCP 地址打包：

```bash
python3 scripts/package-plugin.py --mcp-url https://your-service.example/mcp
```

地址仅为格式示例。打包不自动部署，也不含作者的私人应用绑定。不传 `--mcp-url` 时生成 skills-only 包，通过内置 HTML 使用。

## 数据与许可

原创代码和工作流指引采用 [MIT](LICENSE) 许可。教材衍生词库不属于 MIT 授权范围，来源及翻译、音标质量限制见 [DATA_NOTICE.md](DATA_NOTICE.md)。

## 贡献

欢迎提交 Issue 或 Pull Request。校对词条时保留稳定 ID，并同步嵌入模板的词库副本。修改界面后重新构建、测试。主进度和副进度使用不同存储键，不应混写。
