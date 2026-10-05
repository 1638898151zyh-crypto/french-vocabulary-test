# Franmotest · 法语词汇检测

**Franmotest = Français（法语）＋ mots（单词）＋ test（检测）**。按课本主题学习、自测和复习法语词汇。仓库包含多课本学习网站，以及 **1.0.8** 版 ChatGPT 插件源码、三个 skill、自包含 HTML 卡片和 MCP 服务。

## 在线学习网站

**[打开学习网站](https://franmotest.netlify.app/)**：https://franmotest.netlify.app/

[网站介绍与使用教程](https://franmotest.netlify.app/#/about) · [词库生成与导入教程](website/AI词库生成与导入教程.md) · [下载与安装](https://github.com/Alain-0721/french-vocabulary-test/releases)

网站主导航为 **首页、课本过关、每日检测、词库统计、设置**。首页展示当前课本进度、已自评词汇与累计判定，并提供“我的课本”入口；教程可从首页和设置打开。

- **多课本学习**：每本课本独立保存进度，可随时从检测页底部目录选择 Part；已过关部分可再次测试并累计每个词的对错次数。
- **点击翻词**：整行可翻看中文，翻开前后法语位置固定；长词优先完整展示，音标自动换行。支持两种卡片布局，组内打乱可在设置中开启，默认按原书顺序。
- **每日复习**：只从本书已过关部分抽取五组各十词，不推进课本主进度。普通词汇检测作为首页的补充练习入口。
- **词库与统计**：搜索法语或中文，按 Part 和主题筛选，查看来源、音标校核状态及逐词对错次数。
- **一键导入词库**：支持 XLSX、UTF-8 CSV、JSON；提供 14 列空白模板和“课本 PDF → AI 整理 → 校核 → 导入”的教程。PDF 需先整理成词库文件。
- **账号与备份**：游客记录保存在本机；邮箱注册确认后，登录账号同步课本、词库和学习记录。支持保持登录、切换账号、修改昵称和圆形头像，以及完整备份导入导出。
- **可安装应用（PWA）**：从首页或设置安装到手机、电脑桌面。首次联网准备词库后支持离线检测，本机记录保留；联网并打开应用后验证账号、核对云端记录并同步。

已接入的教材词库：

| 课本 | 版本 | 词条 | Part |
| --- | --- | ---: | ---: |
| Édito B1 | 2023 | 1110 | 24 |
| Inspire A1 | 导入文件未标注版本 | 937 | 32 |
| Édito A2 | 2022 · 第 2 版 | 850 | 24 |

Part 和主题提供法中双语标题。Édito B2 是待导入的课本选项，“我的法语笔记”是 6 词演示，均不代表已接入完整教材。翻译、音标和来源的校核情况见 [词库说明](DATA_NOTICE.md)。

旧网址的游客记录需先导出再到新网址导入；网站与 ChatGPT 插件通过主进度文件迁移，不自动互相同步。设计预览 `textbooks-preview.html` 使用独立演示数据，检测进度刷新后重置。

网站源码位于 [`website/`](website/README.md)，根目录 `netlify.toml` 提供 Netlify 构建配置。

## ChatGPT 插件功能

| 入口 | 规则 | 保存位置 |
| --- | --- | --- |
| 法语词汇检测 | 云端卡片覆盖 U1 P1＋P2，五组各10词 | 云端 SQLite/D1，按用户隔离 |
| 课本单词检测 | 24个 Part；每组一个完整主题，组数和词数随主题变化 | 客户端主进度，可导入导出 |
| 每日单词检测 | 最近已过关 Part 两组，倒数第二、第三各一组，其余随机一个 Part 一组；每组一个主题、10词 | 客户端独立副进度 |

点击词条翻看中文和音标，再自评 ✔／✘；改选替换本轮原判定，重复点击不会重复累计。Part 与主题显示双语标题。每日检测至少需要4个已过关 Part；主题不足时提示，不跨主题或超出主进度补词。每次打开每日卡片重新抽词，同一轮翻词和切组不刷新题目。

**ChatGPT 插件的课本和每日进度不支持自动跨设备云同步**，跨设备使用导出、导入；上面的网站账号采用独立的云端同步。源码开源不代表已上架 ChatGPT 公共插件目录，也不会自动注册 MCP 工具。

## 仓库结构

- `plugin-package/`：三个 skill、词库与内置 HTML 后备卡片。
- `assets/`：界面模板、抽词/评分核心、词库和双语标题。
- `website/`：React/Vite 多课本网站、词库导入教程、账号界面与 Netlify 云端接口。
- `netlify.toml`：网站构建、函数和路由配置。
- `*-bridge.js`：MCP Apps 宿主桥接代码。
- `worker-source.mjs`：MCP 路由、用户隔离和云端记录逻辑。
- `db/`、`drizzle/`：数据库结构和迁移，不含用户数据。
- `scripts/`：构建、插件打包和行为测试。

## 构建与测试

需要 Node.js 22+ 和 npm；插件打包另需 Python 3。网站的独立开发、测试和部署步骤见 [website/README.md](website/README.md)。以下命令用于仓库根目录的插件：

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
