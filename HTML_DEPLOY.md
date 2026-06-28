# HTML 版本用户管理页面部署指南

## 概述

已经创建了带登录验证的用户管理页面，需要管理员账号才能访问。

## 新增功能

### 🔐 管理员登录

- 必须输入用户名和密码才能访问管理页面
- Token 认证机制，24小时自动过期
- 登录状态保存在浏览器本地存储中
- 支持退出登录功能

### 安全特性

- 所有 API 接口都需要认证 Token
- Token 存储在 localStorage 中
- 支持 Token 验证和自动过期
- 登录过期后自动跳转到登录页面

## 文件说明

- `admin.html` - 带登录功能的用户管理页面
- `server.ts` - 已更新，添加了认证 API 和中间件
- `.env.example` - 已更新，添加了管理员配置

## 部署步骤

### 1. 上传文件到服务器

将以下文件上传到您的服务器：

```
admin.html
server.ts
package.json
package-lock.json
tsconfig.json
.env
```

### 2. 配置管理员账号

在服务器的 `.env` 文件中配置管理员凭证：

```env
# 管理员登录凭证
ADMIN_USERNAME="your_admin_username"
ADMIN_PASSWORD="your_secure_password"
# 可选：用于签名的密钥
ADMIN_TOKEN_SECRET="your_random_secret_key"
```

**重要提示**：
- ⚠️ 请务必修改默认的管理员密码！
- 建议使用强密码（包含大小写字母、数字和特殊字符）
- 生产环境一定要修改 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`

### 3. 在服务器上安装依赖

```bash
cd /path/to/your/app
npm install
```

### 4. 重启服务

```bash
pm2 restart tarot-app
```

## 访问管理页面

部署完成后，通过以下地址访问：

```
https://api.niouw.xyz/admin
```

首次访问会显示登录页面，输入配置的管理员账号密码即可登录。

## 默认登录凭证

**测试环境**（未修改配置时）：
- 用户名：`admin`
- 密码：`admin123`

**生产环境**：请务必修改！

## 登录页面功能

### 登录表单

- 用户名输入框
- 密码输入框
- 登录按钮
- 错误提示显示

### 登录流程

1. 输入用户名和密码
2. 点击"登录"按钮
3. 系统验证凭证
4. 验证成功 → 进入管理页面
5. 验证失败 → 显示错误提示

### Token 管理

- 登录成功后，Token 保存到浏览器 localStorage
- Token 有效期：24小时
- 刷新页面会自动验证 Token
- Token 过期后需要重新登录

## 管理页面功能

### 用户管理

✅ **查看用户列表** - 分页显示所有用户
✅ **搜索用户** - 按昵称或 OpenID 实时搜索
✅ **编辑用户** - 修改用户等级
✅ **删除用户** - 带确认弹窗的删除操作
✅ **退出登录** - 安全退出管理页面

### 安全退出

点击右上角"退出登录"按钮：
- 清除本地存储的 Token
- 通知服务器使 Token 失效
- 自动跳转到登录页面

## API 接口

### 认证相关接口

| 方法 | 接口 | 功能 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| GET | `/api/admin/verify` | 验证 Token 有效性 |
| POST | `/api/admin/logout` | 退出登录 |

### 管理相关接口（需认证）

| 方法 | 接口 | 功能 |
|------|------|------|
| GET | `/api/admin/users` | 获取用户列表 |
| GET | `/api/admin/users/:id` | 获取单个用户 |
| PUT | `/api/admin/users/:id` | 更新用户信息 |
| DELETE | `/api/admin/users/:id` | 删除用户 |

### 登录接口详情

```
POST /api/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

响应成功：
{
  "success": true,
  "token": "abc123...",
  "message": "登录成功"
}

响应失败：
{
  "success": false,
  "error": "用户名或密码错误"
}
```

## 文件部署清单

### 必需上传的文件

✅ `admin.html` - 用户管理页面（带登录）
✅ `server.ts` - 后端服务器代码（带认证）
✅ `package.json` - 项目依赖
✅ `package-lock.json` - 依赖锁定文件
✅ `tsconfig.json` - TypeScript 配置
✅ `.env` - 环境变量配置（包含管理员凭证）

## 安全建议

### 1. 修改默认密码

部署后第一时间修改管理员密码：

```env
ADMIN_PASSWORD="your_new_secure_password"
```

### 2. 使用强密码

建议密码：
- 长度至少 12 位
- 包含大小写字母
- 包含数字
- 包含特殊字符

### 3. 生成安全的 Token Secret

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[BitConverter]::ToString($bytes) -replace '-',''
```

### 4. 定期更新密码

建议每 3-6 个月更换一次管理员密码

## 故障排查

### 登录页面一直显示

- 确认 `.env` 文件中 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 配置正确
- 检查服务器日志是否有错误
- 确认数据库连接正常

### Token 验证失败

- 检查浏览器控制台错误信息
- 尝试清除浏览器缓存和 localStorage
- 确认服务器时间正确（Token 有时间戳验证）

### API 请求失败 (401)

- Token 已过期，需要重新登录
- Token 未正确发送
- 检查浏览器网络请求中的 Authorization header

### 页面无法访问

- 检查 `server.ts` 是否正确部署
- 确认 PM2 服务正在运行：`pm2 status`
- 查看服务日志：`pm2 logs tarot-app`

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 技术栈

- **前端**：纯 HTML5 + CSS3 + JavaScript ES6+
- **后端**：Node.js + Express.js
- **认证**：JWT Token (简化版)
- **存储**：内存存储 Token（生产环境建议使用 Redis）