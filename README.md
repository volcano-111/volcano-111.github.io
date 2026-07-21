# 个人 Portfolio

一个中文个人作品集网站，采用 Astro / shadcn 风格的深色极简视觉，纯 HTML、CSS 和 JavaScript 实现，可直接部署到 GitHub Pages。

## 修改个人信息

编辑 `index.html`，替换以下内容：

- `你的名字`
- `hello@example.com`
- 个人介绍、项目、工作经历
- GitHub 与 LinkedIn 链接

## 本地预览

```bash
python3 -m http.server 8000
```

然后打开 `http://localhost:8000`。

## 部署到 GitHub Pages

建议创建名为 `你的用户名.github.io` 的 GitHub 仓库，把本目录中的文件推送到 `main` 分支，然后在仓库的 **Settings → Pages** 中选择 **Deploy from a branch → main → /(root)**。
