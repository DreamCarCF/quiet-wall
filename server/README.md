# 栖景后台

这个目录上传到服务器后运行。Unsplash Access Key 只放在服务器的 `.env` 里，不放进桌面应用。

应用正式版会请求 `https://www.ilovedsy.com/quiet`。本机开发时请求 `http://127.0.0.1:8787`。

## 启动

服务器需要 Node.js 18 或更高版本。不需要再安装依赖。

```bash
cp .env.example .env
node server.js
```

后台地址是 `http://127.0.0.1:8787/admin`，密码是 `.env` 里的 `ADMIN_PASSWORD`。

后台可以看到：

- 每台设备的大致位置（根据 IP 判断到城市，不是精确住址）
- 系统、处理器和内存
- 累计使用时长、打开次数、最近使用时间
- 用户在偏好设置里提交的意见

应用没有登录，所以这里区分的是设备编号，不包含姓名。统计里也不上传照片。

## 接到网站

在 nginx 里把 `/quiet/` 转到本服务：

```nginx
location /quiet/ {
  proxy_pass http://127.0.0.1:8787/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

配好后，作者后台是 https://www.ilovedsy.com/quiet/admin 。
