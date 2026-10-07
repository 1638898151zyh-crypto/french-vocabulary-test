# Franmotest 完整后台迁移

状态：[正式网站](https://franmotest.pages.dev/) 与 [测试预览](https://migration-preview.franmotest.pages.dev/) 已部署；账号、记录和头像已导入核对，并补齐切换前新增记录。真实登录、同步、隔离、冲突与头像检查通过。自定义 SMTP 已在线核验，账号本人已确认收到恢复邮件、登录成功且原学习记录正常。原站和原账号数据保留。

网页由 Cloudflare Pages 托管；`cloudflare/worker.js` 处理学习记录和头像接口。登录、密码恢复、资料、数据库和头像存储由独立 Supabase 项目提供。新运行环境不调用 Netlify Identity、Functions 或 Blobs。原函数文件仅用于兼容旧构建及历史验证。

## 数据与账号

先运行 `node scripts/export-netlify.mjs`，把原账号、两种记录和头像完整导出到仓库根目录 `.netlify/migration/exports/<时间>/`，附校验和。文件含个人资料，禁止上传 GitHub 或放进部署目录。导出脚本只读取原服务。

在新项目执行 `supabase/migrations/202610070001_learning.sql`，然后通过私有配置运行 `node scripts/import-supabase.mjs <私有配置路径>`。配置格式：

```json
{
  "url": "https://<project>.supabase.co",
  "serviceRoleKey": "<仅用于本机迁移的管理员密钥>",
  "exportDir": "<完整备份的绝对目录>",
  "usersFile": "<同一备份目录下的 users.json>"
}
```

保留原账号 UUID、昵称、头像地址、学习内容和 ETag。已有新后台记录不会被导入脚本覆盖；缺少账号所有者时停止。重复导入可安全重试。迁移后需要再次核对账号、学习记录和头像数量及内容。

2026-10-07 原服务清点：1 个已验证账号、1 份多课本记录、1 份旧版记录、1 张头像。账号导出不含密码哈希，原账号第一次使用新服务需通过原邮箱重设密码。不要为了迁移重新注册同一个邮箱。

Supabase Site URL 和允许的邮件回调地址需要设为实际新网站地址。必须验证确认邮件和恢复邮件能送达；公开服务需要配置自定义 SMTP，默认邮件服务只向项目团队成员发送邮件。保持邮箱验证，不关闭验证绕过邮件配置。[官方邮件配置说明](https://supabase.com/docs/guides/auth/auth-smtp)。

浏览器存储按网站地址隔离：原站游客及尚未同步的数据需先导出完整备份，再在新站导入。账号已经同步的记录直接从新后台恢复。迁移时再次读取原数据，避免遗漏准备期间的新增记录。

## 构建和部署

通过私有环境配置提供：

```text
FRANMOTEST_BACKEND=supabase
VITE_SITE_URL=https://<实际项目名>.pages.dev/
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<公开 anon 或 publishable key>
VITE_ACCOUNT_MIGRATED=true
```

执行 `npm run build:cloudflare`，发布目录为 `dist-cloudflare`。构建会拒绝缺失配置或浏览器管理员密钥。仅本地未配置演示可设置 `FRANMOTEST_ALLOW_UNCONFIGURED=true`；该演示不能用于正式发布。

Pages Worker 环境绑定：`SUPABASE_URL`、`SUPABASE_ANON_KEY`（与上述公开配置一致），`ALLOWED_ORIGINS` 包含实际正式站地址及 `https://franmotest.netlify.app`。后者仅用于已安装 App 的本地虚拟来源，并非旧服务代理。不要向浏览器、Pages Worker 或构建产物提供管理员密钥。

`_routes.json` 只让 `/api/*` 进入 Worker。学习记录不缓存；头像公开读取、不可覆盖；写入使用用户令牌。数据库再次按 `auth.uid()` 隔离读取，保存使用原子 ETag 比较，另一个设备有新数据时返回 409。

测试：`npm run test:cloudflare` 验证接口和真实 PostgreSQL 权限、并发保护，以及真实 Supabase 客户端的登录记忆、账号切换、资料修改、找回密码与回调。另跑已有账号、资料、生产、多课本、PWA 和安卓检查。

## 安卓兼容和发布顺序

迁移构建复用上述环境变量，保留包名与发布签名，以新版版本号覆盖安装。现有 `https://franmotest.netlify.app` 仍由 App 内置资源加载器作为本地虚拟来源，保留已有 WebView 本机数据；新服务请求直接发送到配置的新地址。旧线上接口在迁移构建中被阻断，只放行配置的 Cloudflare 和 Supabase 主机。

App 更新清单读取仓库内的公开 GitHub 原文地址，安装包仍从该仓库 Release 下载并验证大小、SHA-256、包名、版本与发布签名。旧 App 的更新地址已内置，首次迁移需手动覆盖安装新 APK，不能先卸载或清除数据。

正式顺序：授权两项新服务 → 新项目与邮件配置 → 数据导入及核对 → 新站预览与真人登录验证 → 签名新版 APK 并发布 Release → 更新下载链接和更新清单 → 正式网页部署 → 检查 App 与网页双向同步。正式新地址确认后再修改 GitHub README、教程、发布说明等公开入口。个人网站的托管迁移不在本次范围。
