# 用户管理页面部署指南

## 概述

用户管理页面已经集成到塔罗应用的主应用中了。部署流程与普通应用完全相同。

## 部署步骤

### 1. 构建生产版本

在本地执行：

```bash
npm run build
```

这会在 `dist/` 目录生成静态文件。

### 2. 上传到服务器

将以下文件上传到您的服务器：

```
dist/
server.ts
package.json
package-lock.json
tsconfig.json
.env
```

### 3. 在服务器上安装依赖

```bash
npm install
```

### 4. 重启服务

如果您使用 PM2：

```bash
pm2 restart tarot-app
```

或者手动启动：

```bash
npm run dev
```

### 5. 访问管理页面

在浏览器中访问：`https://api.niouw.xyz/admin`

## 功能说明

### 用户管理页面功能

1. **查看用户列表**：显示所有注册用户的头像、昵称、等级、占卜次数、注册时间
2. **搜索用户**：支持按昵称或 OpenID 搜索
3. **编辑用户**：
   - 修改用户昵称
   - 调整用户等级（入门/学徒/进阶/资深/大师）
4. **删除用户**：删除用户及其所有占卜记录
5. **分页浏览**：支持分页查看用户列表

### 入口位置

在应用首页右上角，点击用户图标（Users）即可进入管理页面。

## API 接口

### 用户管理相关接口

| 方法 | 接口 | 功能 |
|------|------|------|
| GET | `/api/admin/users` | 获取用户列表（支持分页） |
| GET | `/api/admin/users/:id` | 获取单个用户详情 |
| PUT | `/api/admin/users/:id` | 更新用户信息 |
| DELETE | `/api/admin/users/:id` | 删除用户 |

### 参数说明

#### 获取用户列表

```
GET /api/admin/users?page=1&limit=10
```

响应示例：

```json
{
  "success": true,
  "users": [
    {
      "id": "user_openid",
      "openid": "user_openid",
      "unionid": "wechat_unionid",
      "nickname": "用户昵称",
      "avatar": "头像URL",
      "level": "入门",
      "readings": 5,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

#### 更新用户

```
PUT /api/admin/users/:id
Content-Type: application/json

{
  "nickname": "新昵称",
  "level": "学徒"
}
```

#### 删除用户

```
DELETE /api/admin/users/:id
```

## 注意事项

1. **安全性**：建议在生产环境中添加管理员认证机制
2. **数据库连接**：确保 `.env` 中的数据库配置正确
3. **反向代理**：如果使用 Nginx，确保正确配置路由

## 故障排查

### 页面无法加载

检查服务是否正常运行：

```bash
pm2 status
curl http://localhost:3000/api/health
```

### API 请求失败

1. 检查浏览器控制台错误信息
2. 确认服务器防火墙开放了 3000 端口
3. 检查 Nginx 配置是否正确转发请求