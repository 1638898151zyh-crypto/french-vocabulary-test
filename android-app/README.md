# Franmotest 1.0 · Android

Franmotest 的 Android APK 使用 Google Bubblewrap 生成的 Trusted Web Activity，访问 https://franmotest.netlify.app/。应用包名为 `app.netlify.franmotest`，版本名 `1.0`、版本号 `1`，最低 Android API 23（Android 6.0）。

[安装与使用说明](INSTALL.md) · [下载 APK](https://github.com/Alain-0721/french-vocabulary-test/releases/download/v1.0/Franmotest-1.0-Android.apk)

网页功能与学习数据仍在浏览器的同源空间中。支持的浏览器验证网站与应用发布证书后，以独立窗口显示页面；缺少支持的浏览器时退回 Custom Tabs。应用不额外加入通知、定位、支付或分析 SDK。

## 文件与构建

- `twa-manifest.json`：应用名称、网站、图标、版本及发布证书指纹。
- `app/`、`gradle/`、`gradlew*`：生成的标准 Android 工程。
- `scripts/generate.mjs`：从应用配置生成工程和图标；使用 Maven Central 替换模板中已停用的 JCenter。
- `scripts/build.mjs`：Windows 本地构建、签名，并校验 APK 证书、包名、版本和 ZIP 对齐。
- `../website/public/.well-known/assetlinks.json`：网站与 APK 的证书关联，必须部署在正式网站，并以 JSON 返回。

构建工具为 JDK 17、Android SDK Platform 36、Build Tools 36.1.0 和 Gradle 8.11.1。先安装依赖：

```powershell
npm ci
npm run generate
npm run build
```

本地构建脚本读取项目根目录 `.netlify/android-tools/config.json` 中的 `jdkPath` 和 `androidSdkPath`。签名文件保存在 `.netlify/android-signing/franmotest-release.jks`，密码文件为同目录 `password.json`（字段 `password`）。这些文件全部被 Git 忽略，签名目录的 Windows 权限限制为当前用户与 SYSTEM。请在私人位置备份密钥和密码，后续覆盖升级需沿用同一签名；不要上传它们到 GitHub 或 Release。

产物保存到 `.netlify/releases/android-1.0/`，包含发布 APK、安装说明、SHA-256 和证书/版本校验结果。新发布版本需增加 `appVersionCode`；更换签名密钥时须同步更新网站的证书关联文件。

也可在 Android Studio 打开本目录，使用自己的 SDK 和签名配置构建。Google Play 的 AAB 构建与上架需单独准备，不在此 APK 下载发布流程中。

生成的 Android 模板和 Bubblewrap 依赖采用 Apache-2.0，模板保留原版权声明；网站与本项目原创代码许可见根目录 [LICENSE](../LICENSE)。
