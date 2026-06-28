# AI 灵境塔罗 — Code Wiki

## 项目概述

**AI灵境塔罗** 是一款基于 AI 驱动的塔罗占卜全栈应用。用户输入问题后抽取塔罗牌，通过 DeepSeek AI（或备用的 Google Gemini）获取占卜解读，支持保存历史记录、查看连续打卡天数、用户等级与额度管理，以及管理员后台数据分析。

| 属性 | 值 |
|------|-----|
| 项目名称 | AI灵境塔罗 (Tarot AI) |
| 技术架构 | 全栈 SPA (React + Express + MySQL) |
| 前端框架 | React 19 + TypeScript + Tailwind CSS v4 |
| 构建工具 | Vite 6 |
| 后端框架 | Express 4 + Node.js |
| 数据库 | MySQL (通过 mysql2) |
| AI 服务 | DeepSeek API (主要) / Google Gemini API (备选) |
| 其他客户端 | 微信小程序 (原生框架) + 独立管理后台 (原生 HTML/JS) |
| 部署方式 | 单服务器部署 (Express 同时服务 API 和静态资源) |

---

## 项目目录结构

```
wechat/
├── src/                          # 主应用前端源码 (React SPA)
│   ├── components/
│   │   ├── LoginModal.tsx        # 登录弹窗（微信/账号两种方式）
│   │   └── UserManagement.tsx    # 管理员用户管理面板
│   ├── data/
│   │   └── tarotCards.ts         # 22张大阿卡纳塔罗牌数据
│   ├── lib/
│   │   └── utils.ts              # 工具函数 (cn: clsx + tailwind-merge)
│   ├── services/
│   │   ├── deepseekService.ts    # DeepSeek AI 塔罗解读服务（主要）
│   │   └── geminiService.ts      # Google Gemini AI 塔罗解读服务（备选）
│   ├── App.tsx                   # 主应用组件（单页应用，5种视图）
│   ├── index.css                 # 全局样式（Tailwind + 自定义主题）
│   └── main.tsx                  # React 入口
│
├── server.ts                     # Express 后端服务器（含所有 API 路由）
├── index.html                    # HTML 入口
├── admin.html                    # 独立管理后台页面（原生 HTML/JS）
├── package.json                  # 依赖管理与脚本
├── vite.config.ts                # Vite 构建配置
├── tsconfig.json                 # TypeScript 配置
├── .env                          # 环境变量（实际使用）
├── .env.example                  # 环境变量模板
│
├── wechat-mini-program/          # 微信小程序源码
│   ├── app.js / app.json / app.wxss
│   ├── pages/                    # 多个功能页面
│   └── utils/
│       ├── api.js                # API 请求封装
│       └── tarotCards.js         # 小程序端塔罗牌数据
│
├── cards/                        # 塔罗牌图片资源（按花色分类）
├── tarot-images/                 # 备用塔罗牌静态展示站点
├── images_backup/                # 图片备份
├── uploads/                      # 用户头像上传目录（运行时生成）
├── dist/                         # Vite 生产构建输出
│
└── 部署文档
    ├── README.md
    ├── DEPLOY.md / DEPLOY_CHECKLIST.md
    └── metadata.json
```

---

## 技术栈详解

### 前端依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| react / react-dom | ^19.2.6 | UI 框架 |
| motion | ^12.38.0 | 页面过渡动画（Framer Motion v12） |
| tailwindcss | ^4.1.14 | CSS 工具类框架 |
| @tailwindcss/vite | ^4.3.0 | Tailwind v4 Vite 插件 |
| lucide-react | ^0.546.0 | SVG 图标库 |
| react-markdown | ^10.1.0 | Markdown 渲染（展示 AI 解读结果） |
| clsx | ^2.1.1 | 条件类名拼接 |
| tailwind-merge | ^3.5.0 | Tailwind 类名智能合并 |

### 后端依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| express | ^4.22.1 | HTTP 服务器框架 |
| mysql2 | ^3.11.4 | MySQL 数据库驱动（连接池） |
| multer | ^2.1.1 | 文件上传处理 |
| dotenv | ^17.4.2 | 环境变量加载 |
| node-fetch | ^3.3.2 | HTTP 请求（调用微信 API、DeepSeek API） |
| tsx | ^4.21.0 | TypeScript 运行时执行 |
| @google/genai | ^1.29.0 | Google Gemini AI SDK |

### 构建与开发工具

| 工具 | 版本 | 用途 |
|------|------|------|
| vite | ^6.4.2 | 构建与开发服务器 |
| @vitejs/plugin-react | ^5.2.0 | React HMR 支持 |
| typescript | ~5.8.2 | 类型检查 |

---

## 架构设计

### 整体架构

采用 **SPA + API** 架构，Express 后端同时扮演以下角色：

1. **API 服务器** — 处理认证、占卜、数据管理等所有业务逻辑
2. **静态文件服务器** — 开发模式下使用 Vite middleware，生产模式下提供 `dist/` 目录的编译产物
3. **文件上传服务器** — 管理用户头像的存储与访问

```
┌────────────────────────────────────────────────────┐
│                   浏览器客户端                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ React SPA   │  │ 管理后台     │  │ 微信小程序 │ │
│  │ (src/)      │  │ (admin.html) │  │ (原生)     │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘ │
└─────────┼─────────────────┼────────────────┼───────┘
          │                 │                │
          ▼                 ▼                ▼
┌────────────────────────────────────────────────────┐
│                 Express 服务器 (server.ts)           │
│  ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌───────┐ │
│  │ 认证路由 │ │占卜路由 │ │管理路由   │ │静态文件│ │
│  │ (JWT)    │ │(AI解读) │ │(CRUD/统计)│ │服务    │ │
│  └────┬─────┘ └────┬────┘ └─────┬─────┘ └───┬───┘ │
└───────┼────────────┼────────────┼────────────┼─────┘
        │            │            │            │
        ▼            ▼            │            │
┌──────────────┐ ┌─────────┐      │            │
│ MySQL 数据库  │ │ AI API  │◄─────┘            │
│ (users/       │ │ DeepSeek│                   │
│  readings/    │ │ Gemini  │                   │
│  login_sessions)│ └─────────┘                  │
└──────────────┘                                │
        │  ┌──────────────────────────────────────┘
        │  │
        ▼  ▼
┌────────────────┐
│ 上传文件目录    │
│ (uploads/)     │
└────────────────┘
```

### 核心业务流程

```
用户输入问题
    │
    ▼
点击"开始占卜"
    │
    ├── 未登录 → 弹出 LoginModal → 登录成功 → 继续
    │
    ▼
切换到 Drawing 视图
    │
    ▼
用户点击抽牌（最多3张）
    │  - 随机选取不重复的牌
    │  - 每张牌 30% 概率为逆位
    │
    ▼
选满3张 → 自动触发 performInterpretation()
    │
    ▼
调用 DeepSeek AI API (interpretTarot)
    │  - 构建结构化 prompt
    │  - 要求 Markdown 格式输出
    │
    ▼
切换到 Result 视图显示解读结果
    │
    ▼
同时异步保存到数据库 (/api/save-reading)
    │
    ▼
返回 Home 视图
```

---

## 数据库设计

### 表结构

#### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(100) PK | 唯一标识（openid 或自动生成） |
| openid | VARCHAR(100) UNIQUE NOT NULL | 微信 OpenID（或自生成 ID） |
| unionid | VARCHAR(100) | 微信 UnionID（可选） |
| nickname | VARCHAR(100) | 用户昵称 |
| avatar | TEXT | 头像 URL |
| password | VARCHAR(200) | 哈希后的密码（账号登录用） |
| level | VARCHAR(50) DEFAULT '入门' | 用户等级 |
| readings | INT DEFAULT 0 | 占卜次数（冗余计数） |
| draw_quota | INT DEFAULT 10 | 剩余抽牌额度 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### readings（占卜记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PK | 自增主键 |
| user_id | VARCHAR(100) FK | 关联用户 ID |
| question | TEXT | 用户提问内容 |
| cards | JSON | 抽到的牌面数组（含正/逆位） |
| interpretation | TEXT | AI 解读结果（Markdown） |
| spread | JSON | 牌阵信息 |
| created_at | TIMESTAMP | 创建时间 |

#### login_sessions（登录会话表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PK | 自增主键 |
| user_id | VARCHAR(100) FK | 关联用户 ID |
| token | VARCHAR(100) UNIQUE | 会话 Token |
| expires_at | TIMESTAMP | 过期时间 |
| created_at | TIMESTAMP | 创建时间 |

### ER 关系

```
users (1) ──── (N) readings
users (1) ──── (N) login_sessions
```

- `readings.user_id` → `users.id`（CASCADE 删除）
- `login_sessions.user_id` → `users.id`（CASCADE 删除）

---

## 前端模块详解

### [main.tsx](file:///c:/Users/Admin/Documents/trae/WeChat/src/main.tsx) — React 入口

标准 React 入口，将 `<App />` 挂载到 `#root` DOM 节点。使用 React 19 的 `createRoot` API。

### [App.tsx](file:///c:/Users/Admin/Documents/trae/WeChat/src/App.tsx) — 主应用组件

**核心功能**：单页应用的主控制器，采用**视图状态机模式**。

**视图状态**：
```typescript
type View = "home" | "drawing" | "result" | "history" | "admin";
```

**关键状态变量**：
- `question: string` — 用户输入的占卜问题
- `selectedCards: { card: TarotCard; isReversed: boolean }[]` — 已选的牌面
- `interpretation: string` — AI 解读结果（Markdown 格式）
- `user: any` — 当前登录用户信息
- `authToken: string | null` — 认证 Token
- `pendingAction: (() => void) | null` — 延迟执行动作（先登录再操作）

**关键方法**：
- `startReading()` — 开始占卜，检查登录状态，切换到 Drawing 视图
- `drawCard()` — 随机抽牌（不重复），30% 概率逆位，满3张自动解读
- `performInterpretation(cards)` — 调用 AI 解读并保存记录
- `handleLoginSuccess(data)` — 登录成功后执行 pendingAction
- `fetchHistory()` — 获取历史占卜记录

**UI 结构**：
- 深色主题 (`#08080a` 背景)
- 金色 (`#b49157`) 主题色
- `AnimatePresence` + `mode="wait"` 实现视图间平滑过渡动画
- Header 包含：返回按钮、标题、用户信息、历史/管理入口
- Home 视图：问题输入框 + 开始占卜按钮 + 牌数统计卡片
- Drawing 视图：3个牌位，逐张抽取动画
- Result 视图：使用 `react-markdown` 渲染 AI 解读

### [components/LoginModal.tsx](file:///c:/Users/Admin/Documents/trae/WeChat/src/components/LoginModal.tsx) — 登录弹窗

**功能**：支持微信登录和账号密码登录两种方式。

**关键接口**：
```typescript
interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}
```

**微信登录流程**：
1. 跳转到 `/api/auth/wechat?returnUrl=...` → 微信 OAuth 授权
2. 回调 URL 携带 `code` 参数
3. 前端提取 `code` 调用 `/api/auth/wechat/callback?code=...`

**账号密码登录**：
- 调用 `POST /api/auth/login` 接口
- 成功时调用 `onLoginSuccess(data)` 并关闭弹窗

### [components/UserManagement.tsx](file:///c:/Users/Admin/Documents/trae/WeChat/src/components/UserManagement.tsx) — 管理后台用户管理

**功能**：管理员用户 CRUD 面板。

**特性**：
- 分页获取用户列表（每页10条）
- 搜索过滤（按昵称或 OpenID）
- 内联编辑（昵称、等级、头像）
- 头像上传/预览/删除
- 用户删除确认弹窗

**等级系统**：入门、学徒、进阶、资深、大师（5级）

### [data/tarotCards.ts](file:///c:/Users/Admin/Documents/trae/WeChat/src/data/tarotCards.ts) — 塔罗牌数据

**接口**：
```typescript
export interface TarotCard {
  name: string;          // 牌名（中文）
  nameEn: string;        // 牌名（英文）
  id: string;            // 编号（0-21）
  meaning: string;       // 正位释义
  reversedMeaning: string; // 逆位释义
  image: string;         // 图片 URL
}
```

包含 22 张大阿卡纳牌（0 愚者 → 21 世界）。小阿卡纳数据未在前端定义。

### [services/deepseekService.ts](file:///c:/Users/Admin/Documents/trae/WeChat/src/services/deepseekService.ts) — DeepSeek AI 解读服务

**主要 AI 服务**，被 `App.tsx` 实际引用。

**API 调用**：
- 端点：`https://api.deepseek.com/v1/chat/completions`
- 模型：`deepseek-chat`
- 温度：`0.7`
- 最大 Token：`2048`
- 系统提示：`"你是一位专业的塔罗占卜师，擅长解读塔罗牌的神秘智慧。"`

**Prompt 结构**：
```
# 塔罗牌阵解读
## 一、牌面的综合意象
## 二、问题具体分析
## 三、建议与启示
```

要求 AI 使用 Markdown 标题层级、**粗体**关键词、温暖神秘且具有洞察力的语言。

### [services/geminiService.ts](file:///c:/Users/Admin/Documents/trae/WeChat/src/services/geminiService.ts) — Gemini AI 解读服务（备选）

备选 AI 服务，使用 `@google/genai` SDK。

- 模型：`gemini-3-flash-preview`
- Prompt 相对简洁，未设定严格格式要求

### [lib/utils.ts](file:///c:/Users/Admin/Documents/trae/WeChat/src/lib/utils.ts) — 工具函数

```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

合并 Tailwind 类名，自动处理冲突。

### [index.css](file:///c:/Users/Admin/Documents/trae/WeChat/src/index.css) — 全局样式

- Tailwind CSS v4 入口：`@import "tailwindcss"`
- 自定义 CSS 变量：`--color-gold: #b49157`
- 字体：`Cinzel`（英文衬线标题）、`Noto Serif SC`（中文衬线正文）
- Markdown 渲染样式（`.markdown-body` 类）

---

## 后端模块详解

### [server.ts](file:///c:/Users/Admin/Documents/trae/WeChat/server.ts) — Express 服务器

约 2206 行代码，包含所有后端逻辑。

**启动流程**：

```
startServer()
  ├── 创建 Express 应用
  ├── 注册 API 路由（约 30+ 个端点）
  ├── 配置静态文件服务
  ├── 初始化 Vite middleware（开发模式）或 静态 dist（生产模式）
  ├── 初始化数据库连接池与表
  └── 监听 3000 端口
```

---

## API 路由文档

### 认证与用户

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/wechat/login` | 无 | 微信小程序登录（jscode2session） |
| POST | `/api/auth/login` | 无 | 账号密码登录 |
| POST | `/api/auth/register` | 无 | 用户注册（受注册开关控制） |
| POST | `/api/auth/logout` | Token | 退出登录，清除 session |
| GET | `/api/auth/check` | Token | Token 校验与用户信息查询 |
| POST | `/api/wechat/update-user` | Token | 更新用户昵称/头像 |
| GET | `/api/wechat/user/:openid` | Token | 获取用户信息 |
| POST | `/api/wechat/upload-avatar` | Token | 上传头像文件 |

### 占卜相关

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/interpret` | 无 | AI 塔罗解读 |
| POST | `/api/save-reading` | 无 | 保存占卜记录 |
| POST | `/api/update-reading` | 无 | 更新解读内容 |
| POST | `/api/reading/delete` | 无 | 删除记录 |
| POST | `/api/sync-readings` | 无 | 批量同步历史记录 |
| GET | `/api/history` | 无 | 获取历史记录（分页） |
| GET | `/api/user/stats` | 无 | 获取用户统计（连续天数等） |

### 额度管理

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/user/quota` | Token | 查询剩余抽牌额度 |
| POST | `/api/user/deduct-quota` | Token | 扣除抽牌额度 |
| POST | `/api/user/refill-quota` | Token | 补充抽牌额度 |

### 管理后台

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/admin/login` | 无 | 管理员登录 |
| GET | `/api/admin/verify` | Token | 验证管理员 Token |
| GET | `/api/admin/users` | Admin Token | 用户列表（分页） |
| GET | `/api/admin/users/:id` | Admin Token | 获取单个用户详情 |
| POST | `/api/admin/users` | Admin Token | 创建用户 |
| PUT | `/api/admin/users/:id` | Admin Token | 更新用户信息 |
| DELETE | `/api/admin/users/:id` | Admin Token | 删除用户 |
| POST | `/api/admin/users/batch-update-quota` | Admin Token | 批量更新额度 |
| POST | `/api/admin/upload-avatar` | Admin Token | 管理员上传头像 |
| GET | `/api/admin/stats` | Admin Token | 统计数据（用户/解读数/活跃度/等级分布/热门牌阵） |
| GET | `/api/admin/readings` | Admin Token | 解读记录列表（可筛选） |
| GET | `/api/admin/all-users` | Admin Token | 获取所有用户列表（供筛选使用） |
| GET | `/api/admin/config` | Admin Token | 获取系统配置 |
| PUT | `/api/admin/config` | Admin Token | 更新系统配置 |
| GET | `/api/admin/wordcloud` | Admin Token | 用户提问词云数据 |

### 公共

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 无 | 健康检查 |
| GET | `/api/spreads/popular` | 无 | 热门牌阵排行 |

---

## 关键后端实现细节

### Token 认证机制

**管理员 Token**：
- 存储在内存 `Map<string, { username: string; expiresAt: number }>`
- 24 小时过期
- 中间件 `adminAuth` 校验 `Authorization: Bearer <token>` 头

**用户 Token**：
- 存储在内存 `Map` + 数据库 `login_sessions` 表
- 7 天过期
- 双重验证：先查内存，再查数据库恢复

### 用户等级与额度系统

| 等级 | 初始额度 |
|------|---------|
| 入门 | 10 次 |
| 学徒 | 20 次 |
| 进阶 | 35 次 |
| 资深 | 50 次 |
| 大师 | 100 次 |

每次占卜消耗额度，额度不足时返回 400 错误。管理员可通过后台调整额度。

### 连续天数计算

- 以北京时间（UTC+8）为基准计算日期
- 从数据库获取所有占卜记录的 `created_at`
- 统一转换为北京时间日期字符串
- 去重后排序，从最新日期向过去检查连续天数
- 只有当最新记录是今天或昨天时才开始计算

### 文件上传

- 使用 Multer 中间件
- 头像存储在 `uploads/avatars/` 目录
- 5MB 大小限制
- 仅允许图片格式（jpeg/jpg/png/gif/webp）
- 微信小程序临时文件无扩展名时默认使用 `.jpg`
- 使用 `crypto.randomBytes` 生成唯一文件名

### 词云功能

- 从数据库获取所有用户提问文本
- 使用简单分词方法：提取双字词和三字词
- 结合预定义的塔罗相关词汇表（感情、事业、财运等）给予更高权重
- 过滤停用词
- 返回出现频率前 50 的词

---

## 微信小程序模块

位于 `wechat-mini-program/` 目录，使用微信原生框架。

**页面结构**：

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/home/` | 主入口 |
| 登录 | `pages/login/` | 微信授权登录 |
| 抽牌 | `pages/drawing/` | 塔罗抽牌界面 |
| 提问 | `pages/question/` | 输入占卜问题 |
| 牌阵选择 | `pages/spread-select/` | 选择牌阵 |
| 解读结果 | `pages/result/` | AI 解读展示 |
| 历史记录 | `pages/history/` | 历史占卜记录 |
| 塔罗百科 | `pages/tarot/` | 牌面详解（大阿卡纳/小阿卡纳） |
| 个人中心 | `pages/profile/` | 用户信息 |
| 设置 | `pages/settings/` | 应用设置 |
| 使用指南 | `pages/guide/` | 使用说明 |
| 关于 | `pages/about/` | 关于页面 |
| 预览 | `pages/preview/` | 牌面预览 |
| 完善资料 | `pages/complete-profile/` | 资料补充 |

**工具文件**：
- `utils/api.js` — API 请求封装，与后端 Express 服务器通信
- `utils/tarotCards.js` — 小程序端塔罗牌数据

---

## 管理后台（admin.html）

独立于 React SPA 的原生 HTML/JavaScript 管理页面。

**功能模块**：
- 管理员登录（账号密码）
- 用户管理（CRUD、分页、搜索）
- 解读记录查看（筛选、分页）
- 统计数据仪表盘：
  - 总用户数 / 今日新增用户
  - 总解读数 / 今日解读数
  - 今日活跃用户
  - 用户等级分布
  - 活跃用户排行
  - 热门牌阵排行
- 词云分析
- 系统配置（注册开关）

---

## 环境变量与配置

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek AI API 密钥 |
| `APP_URL` | 是 | 应用部署域名 |
| `WECHAT_APP_ID` | 是 | 微信小程序 AppID |
| `WECHAT_APP_SECRET` | 是 | 微信小程序 AppSecret |
| `DB_HOST` | 是 | MySQL 主机地址 |
| `DB_PORT` | 是 | MySQL 端口（默认 3306） |
| `DB_USER` | 是 | MySQL 用户名 |
| `DB_PASSWORD` | 是 | MySQL 密码 |
| `DB_NAME` | 是 | MySQL 数据库名 |
| `ADMIN_USERNAME` | 是 | 管理后台用户名 |
| `ADMIN_PASSWORD` | 是 | 管理后台密码 |
| `ADMIN_TOKEN_SECRET` | 否 | Token 签名密钥 |
| `GEMINI_API_KEY` | 否 | Google Gemini API 密钥（备选） |

---

## 项目运行方式

### 开发模式

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
# 复制 .env.example 为 .env 并填写配置
cp .env.example .env

# 3. 启动开发服务器（同时启动 Express + Vite HMR）
npm run dev
```

服务器启动在 `http://localhost:3000`。

**开发模式特点**：
- Express 服务器通过 Vite middleware 提供前端资源
- Vite HMR 实时热更新
- 数据库可选：无 MySQL 时服务器仍可启动，但数据相关功能不可用

### 生产构建

```bash
# 1. 构建前端
npm run build
# 生成 dist/ 目录

# 2. 启动生产服务器
NODE_ENV=production npx tsx server.ts
```

**生产模式特点**：
- Express 直接提供 `dist/` 目录的静态文件
- 所有 `*` 路由返回 `dist/index.html`（SPA 支持）
- `GET /admin` 路由返回 `admin.html` 管理后台

### 脚本说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（`tsx server.ts`） |
| `npm run build` | Vite 构建（`vite build`） |
| `npm run preview` | Vite 预览模式 |
| `npm run clean` | 清理 dist 目录 |
| `npm run lint` | TypeScript 类型检查 |

---

## 依赖关系图

```
App.tsx
  ├── tarotCards.ts          (数据: 塔罗牌定义)
  ├── deepseekService.ts     (服务: AI 解读)
  │     └── tarotCards.ts    (数据: TarotCard 类型)
  ├── LoginModal.tsx         (组件: 登录弹窗)
  │     └── utils.ts         (工具: cn 函数)
  ├── UserManagement.tsx     (组件: 用户管理面板)
  │     └── utils.ts         (工具: cn 函数)
  ├── utils.ts               (工具: cn 函数)
  └── react-markdown         (库: Markdown 渲染)

server.ts
  ├── deepseekService.ts     (服务: AI 解读)
  ├── express                (框架: HTTP 服务器)
  ├── mysql2                 (库: MySQL 连接池)
  ├── multer                 (库: 文件上传)
  ├── dotenv                 (库: 环境变量)
  └── node-fetch             (库: HTTP 请求)
```

---

## 关键设计决策

1. **单服务器架构**：Express 同时服务 API 和前端静态资源，简化部署
2. **视图状态机**：前端使用单一 `view` 状态控制页面切换，而非路由系统
3. **延迟执行模式**：`pendingAction` 实现"先登录再继续操作"的无缝体验
4. **双重 Session 存储**：用户 Token 同时存储在内存和数据库，兼顾性能与持久化
5. **AI 服务抽象**：`deepseekService.ts` 和 `geminiService.ts` 提供相同接口，可轻松切换
6. **数据库自动迁移**：启动时自动 CREATE TABLE 和 ALTER TABLE ADD COLUMN，兼容存量数据库
7. **北京时间计算**：连续天数等时间相关计算统一以 UTC+8 为基准
