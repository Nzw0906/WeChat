# 用户管理页面部署清单

## 构建文件（已完成）

✓ 已构建生产版本
✓ dist/ 目录已更新，包含最新的用户管理页面

## 部署到服务器

### 方式一：手动部署

1. **上传文件到服务器**
   将以下文件上传到您的服务器 `/path/to/your/app/` 目录：
   
   ```
   dist/
   server.ts
   package.json
   package-lock.json
   tsconfig.json
   ```

2. **SSH 连接到服务器**
   ```bash
   ssh your-server
   cd /path/to/your/app/
   ```

3. **安装依赖**
   ```bash
   npm install
   ```

4. **重启服务**
   ```bash
   pm2 restart tarot-app
   ```
   
   或者如果没有使用 PM2：
   ```bash
   npm run dev
   ```

### 方式二：使用 Git 部署

1. 提交代码到 Git 仓库
2. 在服务器上 pull 最新代码
3. 执行 `npm install` 和 `npm run build`
4. 重启服务

## 访问页面

部署完成后，通过以下地址访问：

- 管理页面：`https://api.niouw.xyz/`（首页右上角用户图标）
- 健康检查：`https://api.niouw.xyz/api/health`

## 验证部署成功

在浏览器中打开开发者工具（F12），查看网络请求：

1. 访问首页，应该能看到用户管理图标
2. 点击用户图标，应该能看到用户列表或加载状态
3. 打开 Network 面板，确认 `/api/admin/users` 请求成功

## 注意事项

⚠️ **重要**：如果您没有在服务器上运行数据库，请先确保 MySQL 服务已启动并配置正确。

## 联系支持

如果部署过程中遇到问题，请检查：

1. 服务日志：`pm2 logs tarot-app`
2. 数据库连接状态
3. 防火墙设置