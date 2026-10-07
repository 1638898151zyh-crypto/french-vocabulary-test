# 安装 Franmotest 1.1.5 · 法语词汇学习

安装入口：[https://franmotest.pages.dev/](https://franmotest.pages.dev/)

这是可安装到桌面的 PWA 应用。无需下载 ZIP：先联网打开网站，从首页或设置选择“安装到桌面”。

## iPhone / iPad

1. 用 Safari 打开上面的网址。
2. 点“分享”，选择“添加到主屏幕”。
3. 点“添加”，之后从桌面的 Franmotest 图标打开。

## 安卓手机

1. 用 Chrome 打开上面的网址。
2. 在网站首页或设置点击“安装应用”；若没有弹出安装窗口，在浏览器菜单中选择“安装应用”或“添加到主屏幕”。
3. 安装后从桌面打开 Franmotest。

## Windows / macOS 电脑

用 Chrome 或 Edge 打开网址，点击网站的“安装应用”或地址栏的安装图标。在 Windows 上，也可以打开发布附件 `Franmotest-Install.url`，进入网站后再完成安装；这个文件是网站快捷入口。

## 离线使用与记录

首次请保持联网，等首页或设置显示“离线词库已准备好”。之后可断网打开课本、翻词自评并查看统计。账号登录、注册、头像修改和云同步需要联网；联网并打开应用后再核对、同步记录。

离线重启可继续上次账号在这台设备上的记录，并显示“需联网验证”。登录失效时重新登录原账号；云端冲突时先导出本机备份，再决定恢复范围。安装后如没有看到原浏览器的游客记录，可先从浏览器导出完整备份，再在应用中导入。

## 找回密码

登录窗口选择“忘记密码”，输入注册邮箱，填写邮件中的 6 位验证码，再设置新密码。验证码 10 分钟有效，60 秒后可重发；新密码至少 8 位，可以与旧密码相同，学习记录保留。

## 发布附件用途

- `Franmotest-Install.url`：Windows 网站快捷入口，打开后在浏览器中安装。
- `Franmotest-Installation.md`：手机与电脑的安装说明。
- `Franmotest-PWA-1.1.5.zip`：已构建的 Cloudflare Pages 部署包，包含应用、词库、图标、离线文件和 API Worker；自行部署仍需配置 Supabase 及允许来源，不包含数据库、私有密钥或用户记录，不是手机安装程序。
- GitHub 自动提供的 Source code：对应版本源码。

自行托管时，把 ZIP 中的网站文件发布到 HTTPS 网站根目录（本机验收可使用 localhost），再从浏览器安装。不要直接双击本地 `index.html`。静态部署包可以使用游客模式，但不包含 Netlify 账号云函数；完整账号服务的部署方法见源码 `website/README.md`。

安装支持参考：[MDN PWA 安装说明](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)。
