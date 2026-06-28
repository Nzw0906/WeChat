# 塔罗应用部署指南

## 部署前准备

1. 确保服务器已安装 Node.js (推荐 v18 或更高版本)
2. 确保服务器已安装 MySQL 数据库
3. 确保有微信小程序的 AppID 和 AppSecret

## 部署步骤

### 1. 上传部署包

将以下文件/文件夹上传到服务器：
- `server.ts` - 服务器主代码
- `dist/` - 前端构建文件
- `package.json` - 项目依赖
- `package-lock.json` - 依赖版本锁定
- `tsconfig.json` - TypeScript 配置
- `.env.example` - 环境变量示例

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，并根据实际情况修改：

```env
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=tarot
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
```

### 4. 初始化数据库

确保 MySQL 中有 `tarot` 数据库，或者修改 `.env` 中的 `DB_NAME` 为你自己的数据库名。

### 5. 启动服务

```bash
npm run dev
```

或者使用 PM2 来管理进程：
```bash
npm install -g pm2
pm2 start npm --name "tarot-server" -- run dev
```

### 6. 配置反向代理 (可选但推荐)

使用 Nginx 或其他反向代理服务器将请求转发到 3000 端口。

## 文件清单

### 必需文件
- [ ] server.ts
- [ ] dist/ (整个目录)
- [ ] package.json
- [ ] package-lock.json
- [ ] tsconfig.json
- [ ] .env.example

### 可选文件
- [ ] README.md
- [ ] src/ (源代码，用于开发调试)
