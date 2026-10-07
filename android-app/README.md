# Franmotest 1.1.5 · 独立 Android App

Android APK 自带 React 学习界面与三本完整词库，通过原生 Activity 和 Android WebView 在应用内运行。移除了 TWA、Custom Tabs 和 Android Browser Helper，学习不依赖外部浏览器，首次启动即可离线检测。

包名 `app.netlify.franmotest`，版本名 `1.1.5`，内部版本号 `8`，最低 Android 6.0（API 23）。同一发布签名允许覆盖升级此前版本。

[下载安装说明](INSTALL.md) · [下载 APK](https://github.com/Alain-0721/french-vocabulary-test/releases/download/v1.1.5/Franmotest-1.1.5-Android.apk)

## 界面、文件与账号

`MainActivity` 使用官方 `WebViewAssetLoader` 加载 APK 内置页面与脚本。迁移构建通过 Cloudflare Pages 接口同步记录和头像，通过 Supabase 登录并保存会话，不访问旧 Netlify 账号服务。原虚拟来源保留以继续读取已安装 App 的本机记录；缺失静态资源返回 404。新网站的邮件回调会映射回内置页面，保留同一本机存储。

原生文件选择器支持词库和备份导入、头像选择；文件导出通过系统保存窗口写入用户指定位置。返回键先关闭弹窗或菜单，再返回上一页，首页连续返回退出。系统栏、刘海、键盘与深色外观由原生窗口处理。学习卡片保持现有无蓝色点击高亮设置。

WebView 禁用文件 URL 访问、明文与混合内容、第三方 Cookie、自动弹窗与发布版调试；不加载外站学习页面。不申请存储、相机、定位等广泛权限。外部 HTTPS 或邮件链接仅由用户主动点击打开。Android App Links 使用正式网站已有证书关联，邮箱确认与找回密码链接可回到 App 中处理。

App 数据与原浏览器数据分开。账号用户登录同步；游客通过完整备份迁移。不要假定覆盖旧版 TWA APK 能自动取得 Chrome 私有存储。

## 构建

需要 Node.js 22+、JDK 17、Android SDK Platform 36、Build Tools 36.1.0。Gradle wrapper 为 8.11.1，Android Gradle Plugin 为 8.9.1。先在 `../website` 安装 npm 依赖。

```powershell
# 在 android-app 目录
npm ci
npm run build
```

`generate.mjs` 先以 Vite `android` 模式构建共享界面，复制到 `app/src/main/assets/public/`，确认内置三本词库且不包含网站 Service Worker。生成目录不提交到 Git。网页版正常构建仍提供 PWA。

`build.mjs` 读取项目根目录 `.netlify/android-tools/config.json` 中的 `jdkPath` 与 `androidSdkPath`，生成 Release/Debug、运行 Android Lint，再对发布 APK 对齐、签名与校验。签名配置为 `app-config.json`，密码只从本机 `.netlify/android-signing/password.json` 读取。私有密钥与密码不进入仓库或 Release。请私下备份，未来升级需继续使用相同签名并增加内部版本号。

迁移构建需提供 [网站迁移说明](../website/CLOUDFLARE-MIGRATION.md) 中的公开环境变量。产物位于 `.netlify/releases/android-1.1.5/`。也可用 Android Studio 打开本目录构建。应用发布为 APK；Google Play 上架需另行准备 AAB 和商店资料。

```powershell
# 在 website 目录，先构建 native assets
node node_modules/vite/bin/vite.js build --mode android
npm run test:android
```

AndroidX 和保留的 Gradle/icon 模板采用 Apache-2.0，原创代码许可见根目录 LICENSE；词库的教材数据许可与质量说明见 DATA_NOTICE.md。
