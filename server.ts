import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import { interpretTarot } from "./src/services/deepseekService";
import fetch from "node-fetch";
import mysql from "mysql2/promise";
import multer from "multer";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 管理员认证配置
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// 文件上传配置
const UPLOAD_DIR = path.join(__dirname, "uploads");
const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");

// 系统配置存储
const CONFIG_FILE = path.join(__dirname, "system_config.json");

// 微信订阅消息配置
// 在服务器 .env 文件中配置：
//   SUBSCRIBE_LOGIN_TMPL_ID=您的登录通知模板ID
//   SUBSCRIBE_QUOTA_TMPL_ID=您的额度提醒模板ID
//   SUBSCRIBE_CHECKIN_TMPL_ID=frghlROCjSAEF9JQLgShhlqr6_ZdfPzVd7aQWj54gac
//   LOGIN_FIELD_TIME=time2
//   LOGIN_FIELD_NAME=thing4
//   QUOTA_FIELD_REMAINING=number1
//   QUOTA_FIELD_USED=number2
//   CHECKIN_FIELD_REWARD=thing10
//   CHECKIN_FIELD_TIP=thing9
//   CHECKIN_FIELD_DAYS=number3
const SUBSCRIBE_LOGIN_TMPL_ID = process.env.SUBSCRIBE_LOGIN_TMPL_ID || "";
const SUBSCRIBE_QUOTA_TMPL_ID = process.env.SUBSCRIBE_QUOTA_TMPL_ID || "";
const SUBSCRIBE_CHECKIN_TMPL_ID = process.env.SUBSCRIBE_CHECKIN_TMPL_ID || "";
const LOGIN_FIELD_TIME = process.env.LOGIN_FIELD_TIME || "time2";
const LOGIN_FIELD_NAME = process.env.LOGIN_FIELD_NAME || "thing4";
const QUOTA_FIELD_REMAINING = process.env.QUOTA_FIELD_REMAINING || "number1";
const QUOTA_FIELD_USED = process.env.QUOTA_FIELD_USED || "number2";
const CHECKIN_FIELD_REWARD = process.env.CHECKIN_FIELD_REWARD || "thing10";
const CHECKIN_FIELD_TIP = process.env.CHECKIN_FIELD_TIP || "thing9";
const CHECKIN_FIELD_DAYS = process.env.CHECKIN_FIELD_DAYS || "number3";
// 签到成功通知模板（解读完成后立即发送）
const SUBSCRIBE_SIGNIN_TMPL_ID = process.env.SUBSCRIBE_SIGNIN_TMPL_ID || "fRghIROCjSAEF9JQLgShhGxOuDpoC9_4oSNVrtNXRGo";
const SIGNIN_FIELD_STATUS = process.env.SIGNIN_FIELD_STATUS || "thing7";
const SIGNIN_FIELD_DAYS = process.env.SIGNIN_FIELD_DAYS || "number3";
const SIGNIN_FIELD_REWARD = process.env.SIGNIN_FIELD_REWARD || "thing10";
console.log("[订阅消息] 登录通知模板ID:", SUBSCRIBE_LOGIN_TMPL_ID ? "已配置" : "(未配置)");
console.log("[订阅消息] 额度提醒模板ID:", SUBSCRIBE_QUOTA_TMPL_ID ? "已配置" : "(未配置)");
console.log("[订阅消息] 签到提醒模板ID:", SUBSCRIBE_CHECKIN_TMPL_ID ? "已配置" : "(未配置)");
console.log("[订阅消息] 签到成功模板ID:", SUBSCRIBE_SIGNIN_TMPL_ID ? "已配置" : "(未配置)", SUBSCRIBE_SIGNIN_TMPL_ID ? SUBSCRIBE_SIGNIN_TMPL_ID : "");

// 微信 access_token 缓存
let cachedAccessToken: string | null = null;
let accessTokenExpiresAt: number = 0;

async function getWechatAccessToken(): Promise<string | null> {
  if (cachedAccessToken && Date.now() < accessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) return null;

  try {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.access_token) {
      cachedAccessToken = data.access_token;
      accessTokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
      return cachedAccessToken;
    }
    console.error("[订阅消息] 获取 access_token 失败:", data);
    return null;
  } catch (err) {
    console.error("[订阅消息] 获取 access_token 异常:", err);
    return null;
  }
}

async function sendSubscribeMessage(openid: string, templateId: string, data: Record<string, { value: string }>): Promise<{ success: boolean; errcode?: number; errmsg?: string }> {
  const accessToken = await getWechatAccessToken();
  if (!accessToken) return { success: false, errcode: -1, errmsg: "access_token获取失败" };

  try {
    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
    const payload = {
      touser: openid,
      template_id: templateId,
      page: "pages/main/main",
      miniprogram_state: "formal",
      data: data
    };
    console.log(`[订阅消息] 发送请求: openid=${openid} template=${templateId} data=${JSON.stringify(data)}`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json() as any;
    console.log(`[订阅消息] 发送结果 errcode=${result.errcode} errmsg=${result.errmsg}`);
    if (result.errcode === 0) {
      return { success: true };
    } else {
      return { success: false, errcode: result.errcode, errmsg: result.errmsg };
    }
  } catch (err: any) {
    console.error("[订阅消息] 发送异常:", err);
    return { success: false, errcode: -2, errmsg: err?.message || "network error" };
  }
}

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

// 配置文件存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    // 生成唯一的文件名，处理微信小程序临时文件没有扩展名的情况
    let ext = path.extname(file.originalname || '');
    if (!ext) {
      // 微信小程序临时文件默认为 .jpg
      ext = '.jpg';
    }
    const uniqueName = crypto.randomBytes(16).toString("hex") + ext;
    console.log('[上传] 原始文件名:', file.originalname, '-> 生成文件名:', uniqueName);
    cb(null, uniqueName);
  }
});

// 文件过滤器 - 只允许图片
const fileFilter = (req: express.Request, file: any, cb: any) => {
  // 微信小程序临时文件可能没有原始文件名，默认允许通过
  if (!file.originalname) {
    console.log('[上传] 文件没有原始文件名，允许上传');
    return cb(null, true);
  }
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname || file.mimetype.startsWith('image/')) {
    return cb(null, true);
  } else {
    cb(new Error("只允许上传图片文件"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 限制
  fileFilter: fileFilter
});

// 简单的 token 存储（生产环境建议使用 Redis）
const activeTokens = new Map<string, { username: string; expiresAt: number }>();

const userSessions = new Map<string, { token: string; userId: string; expiresAt: number }>();

// 用户等级额度配置
const LEVEL_QUOTA_CONFIG: Record<string, number> = {
  '入门': 10,
  '学徒': 20,
  '进阶': 35,
  '资深': 50,
  '大师': 100
};

function getQuotaByLevel(level: string): number {
  return LEVEL_QUOTA_CONFIG[level] || 10;
}

function generateUserToken(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  userSessions.set(token, { token, userId, expiresAt });
  return token;
}

async function verifyUserToken(token: string): Promise<string | null> {
  if (!token) return null;
  
  // 先尝试从内存中查找
  let session = userSessions.get(token);
  if (session && Date.now() <= session.expiresAt) {
    return session.userId;
  }
  
  // 如果内存中没有或已过期，尝试从数据库恢复
  if (dbPool) {
    try {
      const [rows] = await dbPool.execute(
        'SELECT * FROM login_sessions WHERE token = ? AND expires_at > NOW()',
        [token]
      ) as any[];
      
      if (rows.length > 0) {
        const dbSession = rows[0];
        session = { token, userId: dbSession.user_id, expiresAt: new Date(dbSession.expires_at).getTime() };
        userSessions.set(token, session);
        return session.userId;
      }
    } catch (err) {
      console.error("从数据库恢复session失败:", err);
    }
  }
  
  return null;
}

function deleteUserSession(token: string) {
  if (token) {
    userSessions.delete(token);
  }
}

// 生成 token
function generateToken(username: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24小时过期
  activeTokens.set(token, { username, expiresAt });
  return token;
}

// 验证 token
function verifyToken(token: string): boolean {
  const data = activeTokens.get(token);
  if (!data) return false;
  if (Date.now() > data.expiresAt) {
    activeTokens.delete(token);
    return false;
  }
  return true;
}

// 管理员认证中间件
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ success: false, error: "未授权，请先登录" });
  }
  
  next();
}

interface Reading {
  id: number;
  userId: string;
  question: string;
  cards: any[];
  interpretation: string;
  createdAt: string;
}

interface User {
  id: string;
  openid: string;
  unionid?: string;
  nickname?: string;
  avatar?: string;
  level: string;
  readings: number;
  createdAt: string;
}

let dbPool: mysql.Pool | null = null;

async function initDatabase() {
  try {
    console.log("正在创建数据库连接池...");
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "tarot",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    console.log("数据库连接池创建成功！");

    // 测试连接并初始化表
    const connection = await dbPool.getConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(100) PRIMARY KEY,
          openid VARCHAR(100) UNIQUE NOT NULL,
          unionid VARCHAR(100),
          nickname VARCHAR(100),
          avatar TEXT,
          password VARCHAR(200),
          level VARCHAR(50) DEFAULT '入门',
          readings INT DEFAULT 0,
          draw_quota INT DEFAULT 10,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_openid (openid)
        )
      `);

      // 兼容已有数据库：补充可能缺失的列
      try {
        await connection.execute(`ALTER TABLE users ADD COLUMN password VARCHAR(200) DEFAULT NULL AFTER avatar`);
      } catch (e) {
        // 列已存在则忽略
      }
      try {
        await connection.execute(`ALTER TABLE users ADD COLUMN unionid VARCHAR(100) DEFAULT NULL AFTER openid`);
      } catch (e) {
        // 列已存在则忽略
      }
      try {
        await connection.execute(`ALTER TABLE users ADD COLUMN draw_quota INT DEFAULT 10 AFTER readings`);
      } catch (e) {
        // 列已存在则忽略
      }
      try {
        await connection.execute(`ALTER TABLE users ADD COLUMN last_checkin_notified_at DATETIME DEFAULT NULL AFTER draw_quota`);
      } catch (e) {
        // 列已存在则忽略
      }

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS readings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          question TEXT,
          cards JSON,
          interpretation TEXT,
          spread JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // 兼容已有数据库：补充可能缺失的 spread 列
      try {
        await connection.execute(`ALTER TABLE readings ADD COLUMN spread JSON DEFAULT NULL AFTER interpretation`);
      } catch (e) {
        // 列已存在则忽略
      }

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS login_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          token VARCHAR(100) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_token (token),
          INDEX idx_user_id (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // 兼容已有数据库：补充 login_sessions 表可能缺失的列
      try {
        await connection.execute(`ALTER TABLE login_sessions ADD COLUMN user_id VARCHAR(100) NOT NULL AFTER id`);
      } catch (e) {
        // 列已存在则忽略
      }
      try {
        await connection.execute(`ALTER TABLE login_sessions ADD COLUMN token VARCHAR(100) NOT NULL UNIQUE AFTER user_id`);
      } catch (e) {
        // 列已存在则忽略
      }
      try {
        await connection.execute(`ALTER TABLE login_sessions ADD COLUMN expires_at TIMESTAMP NOT NULL AFTER token`);
      } catch (e) {
        // 列已存在则忽略
      }

      console.log("数据库表初始化完成！");
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("数据库初始化失败:", error);
    console.log("⚠️  注意：请确保数据库已创建，或者使用内存模式运行");
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/wechat/login", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "缺少 code 参数" });
      }

      const appId = process.env.WECHAT_APP_ID;
      const appSecret = process.env.WECHAT_APP_SECRET;

      if (!appId || !appSecret) {
        return res.status(500).json({ error: "服务器配置错误" });
      }

      const wxLoginUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

      const wxResponse = await fetch(wxLoginUrl);
      const wxData = await wxResponse.json() as any;

      if (wxData.errcode) {
        return res.status(400).json({ error: wxData.errmsg || "微信登录失败" });
      }

      const { openid, session_key, unionid } = wxData;

      let user: any = null;
      if (dbPool) {
        const [rows] = await dbPool.execute('SELECT * FROM users WHERE openid = ?', [openid]) as any[];
        if (rows.length > 0) {
          user = rows[0];
          // 检查用户是否有额度，如果没有则根据等级初始化
          if (user.draw_quota === null || user.draw_quota === undefined) {
            const defaultQuota = getQuotaByLevel(user.level || '入门');
            await dbPool.execute('UPDATE users SET draw_quota = ? WHERE id = ?', [defaultQuota, user.id]);
            user.draw_quota = defaultQuota;
          }
        } else {
          const defaultLevel = '入门';
          const defaultQuota = getQuotaByLevel(defaultLevel);
          await dbPool.execute(
            'INSERT INTO users (id, openid, unionid, nickname, level, readings, draw_quota) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [openid, openid, unionid || null, '探索者', defaultLevel, 0, defaultQuota]
          );
          const [newRows] = await dbPool.execute('SELECT * FROM users WHERE openid = ?', [openid]) as any[];
          user = newRows[0];
        }
      }

      let readings: any[] = [];
      let totalReadingsCount = 0;
      let interpretedCount = 0;
      let consecutiveDays = 0;
      
      if (dbPool && user) {
        // 获取最新的10条记录用于展示
        const [readingRows] = await dbPool.execute(
          'SELECT * FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
          [user.id]
        ) as any[];
        readings = readingRows.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          question: row.question,
          cards: row.cards,
          interpretation: row.interpretation,
          spread: row.spread,
          createdAt: row.created_at
        }));
        
        // 获取总的解读数量
        const [countResult] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM readings WHERE user_id = ?',
          [user.id]
        ) as any[];
        totalReadingsCount = countResult[0]?.count || 0;
        
        // 获取已完成解读的数量
        const [interpretedResult] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM readings WHERE user_id = ? AND interpretation IS NOT NULL AND interpretation != ""',
          [user.id]
        ) as any[];
        interpretedCount = interpretedResult[0]?.count || 0;
        
        // 获取所有记录的创建时间，在 JavaScript 中统一处理日期
        const [allReadingDates] = await dbPool.execute(
          'SELECT created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC',
          [user.id]
        ) as any[];
        
        // 计算连续天数（使用 Asia/Shanghai 时区 UTC+8）
        if (allReadingDates.length > 0) {
          // 所有日期统一转为北京时间（UTC+8）的日期字符串
          const dateSet = new Set<string>();
          for (const row of allReadingDates) {
            const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
            // 转换为北京时间（UTC+8）
            const beijingMs = d.getTime() + 8 * 60 * 60 * 1000;
            const beijingDate = new Date(beijingMs);
            const dateStr = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;
            dateSet.add(dateStr);
          }
          
          const dates = Array.from(dateSet).sort().reverse();
          
          // 获取今天的北京时间日期
          const now = new Date();
          const nowBeijingMs = now.getTime() + 8 * 60 * 60 * 1000;
          const nowBeijing = new Date(nowBeijingMs);
          const todayStr = `${nowBeijing.getUTCFullYear()}-${String(nowBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(nowBeijing.getUTCDate()).padStart(2, '0')}`;
          
          // 获取昨天的北京时间日期
          const yesterdayBeijing = new Date(nowBeijingMs - 24 * 60 * 60 * 1000);
          const yesterdayStr = `${yesterdayBeijing.getUTCFullYear()}-${String(yesterdayBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBeijing.getUTCDate()).padStart(2, '0')}`;
          
          console.log('[DEBUG] 今天:', todayStr, '昨天:', yesterdayStr, '最新记录:', dates[0], '所有日期:', dates.join(','));
          
          if (dates[0] === todayStr || dates[0] === yesterdayStr) {
            let consecutive = 1;
            for (let i = 0; i < dates.length - 1; i++) {
              const currentParts = dates[i].split('-').map(Number);
              const nextParts = dates[i + 1].split('-').map(Number);
              const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
              const nextDate = new Date(nextParts[0], nextParts[1] - 1, nextParts[2]);
              const diffDays = Math.round((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
              
              console.log('[DEBUG] 对比:', dates[i], dates[i + 1], '相差', diffDays, '天');
              
              if (diffDays === 1) {
                consecutive++;
              } else {
                break;
              }
            }
            consecutiveDays = consecutive;
            console.log('[DEBUG] 连续天数:', consecutiveDays);
          } else {
            console.log('[DEBUG] 最新记录不是今天或昨天，连续天数为0');
          }
        }
      }

      const token = generateUserToken(user ? user.id : openid);

      if (dbPool) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await dbPool.execute(
          'INSERT INTO login_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
          [user ? user.id : openid, token, expiresAt]
        );
      }

      const completionRate = totalReadingsCount > 0 ? Math.round((interpretedCount / totalReadingsCount) * 100) : 0;

      const userOpenid = user ? user.id : openid;

      res.json({
        success: true,
        token,
        user: {
          id: userOpenid,
          nickname: user ? user.nickname : '探索者',
          avatar: user ? user.avatar : null,
          level: user ? user.level : '入门',
          readings: totalReadingsCount,
          draw_quota: user ? (user.draw_quota !== undefined ? user.draw_quota : 10) : 10
        },
        stats: {
          totalReadings: totalReadingsCount,
          interpretedCount: interpretedCount,
          completionRate: completionRate,
          consecutiveDays: consecutiveDays
        },
        sessionKey: session_key,
        history: readings,
        subscribeConfig: SUBSCRIBE_LOGIN_TMPL_ID || SUBSCRIBE_QUOTA_TMPL_ID || SUBSCRIBE_CHECKIN_TMPL_ID ? {
          loginTmplId: SUBSCRIBE_LOGIN_TMPL_ID,
          quotaTmplId: SUBSCRIBE_QUOTA_TMPL_ID,
          checkinTmplId: SUBSCRIBE_CHECKIN_TMPL_ID
        } : null
      });
    } catch (error) {
      console.error("微信登录错误:", error);
      res.status(500).json({ error: "登录失败，请稍后重试" });
    }
  });

  app.post("/api/wechat/send-login-notify", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || req.body.token;
      if (!token) {
        return res.status(401).json({ success: false, error: "未授权" });
      }

      const userId = await verifyUserToken(token);
      if (!userId) {
        return res.status(401).json({ success: false, error: "无效的token" });
      }

      if (!SUBSCRIBE_LOGIN_TMPL_ID) {
        return res.status(400).json({ success: false, error: "未配置登录通知模板ID" });
      }

      let nickname = "探索者";
      let openid = userId;
      if (dbPool) {
        const [rows] = await dbPool.execute('SELECT nickname, openid FROM users WHERE id = ?', [userId]) as any[];
        if (rows.length > 0) {
          nickname = rows[0].nickname || "探索者";
          openid = rows[0].openid || userId;
        }
      }

      if (!openid) {
        return res.json({ success: false, message: "用户未绑定微信openid" });
      }

      const loginData: Record<string, { value: string }> = {};
      // time 类型字段格式: YYYY-MM-DD HH:mm
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const formattedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      loginData[LOGIN_FIELD_TIME] = { value: formattedTime };
      loginData[LOGIN_FIELD_NAME] = { value: nickname || "用户" };

      const sendResult = await sendSubscribeMessage(openid, SUBSCRIBE_LOGIN_TMPL_ID, loginData);

      if (sendResult.success) {
        res.json({ success: true, message: "登录通知已发送" });
      } else {
        res.json({ success: false, message: `登录通知发送失败: ${sendResult.errmsg || '未知错误'} (errcode: ${sendResult.errcode})` });
      }
    } catch (error) {
      console.error("发送登录通知错误:", error);
      res.status(500).json({ success: false, error: "发送登录通知失败" });
    }
  });

  app.post("/api/wechat/send-quota-notify", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || req.body.token;
      if (!token) {
        return res.status(401).json({ success: false, error: "未授权" });
      }

      const userId = await verifyUserToken(token);
      if (!userId) {
        return res.status(401).json({ success: false, error: "无效的token" });
      }

      if (!SUBSCRIBE_QUOTA_TMPL_ID) {
        return res.status(400).json({ success: false, error: "未配置额度通知模板ID" });
      }

      let currentQuota = 0;
      let openid = userId;
      if (dbPool) {
        const [rows] = await dbPool.execute('SELECT draw_quota, openid FROM users WHERE id = ?', [userId]) as any[];
        if (rows.length > 0) {
          currentQuota = rows[0].draw_quota !== undefined ? rows[0].draw_quota : 0;
          openid = rows[0].openid || userId;
        }
      }

      if (!openid) {
        return res.json({ success: false, message: "用户未绑定微信openid" });
      }

      const usedQuota = req.body.usedQuota || 0;
      const remainingQuota = req.body.remaining !== undefined ? req.body.remaining : currentQuota;

      const quotaData: Record<string, { value: string }> = {};
      quotaData[QUOTA_FIELD_REMAINING] = { value: String(remainingQuota) };
      quotaData[QUOTA_FIELD_USED] = { value: String(usedQuota) };

      const sendResult = await sendSubscribeMessage(openid, SUBSCRIBE_QUOTA_TMPL_ID, quotaData);

      if (sendResult.success) {
        res.json({ success: true, message: "额度通知已发送", currentQuota: remainingQuota, usedQuota: usedQuota });
      } else {
        res.json({ success: false, message: `额度通知发送失败: ${sendResult.errmsg || '未知错误'} (errcode: ${sendResult.errcode})`, usedQuota: usedQuota });
      }
    } catch (error) {
      console.error("发送额度通知错误:", error);
      res.status(500).json({ success: false, error: "发送额度通知失败" });
    }
  });

  app.post("/api/wechat/send-checkin-notify", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || req.body.token;
      if (!token) {
        return res.status(401).json({ success: false, error: "未授权" });
      }

      const tokenUserId = await verifyUserToken(token);
      if (!tokenUserId) {
        return res.status(401).json({ success: false, error: "无效的token" });
      }

      const userId = req.body.userId || tokenUserId;
      if (!userId) {
        return res.status(400).json({ success: false, error: "缺少 userId" });
      }

      if (!SUBSCRIBE_CHECKIN_TMPL_ID) {
        return res.status(400).json({ success: false, error: "未配置签到提醒模板ID" });
      }

      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      const [rows] = await dbPool.execute('SELECT openid FROM users WHERE id = ?', [userId]) as any[];
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "用户不存在" });
      }
      const openid = rows[0].openid || userId;
      if (!openid) {
        return res.json({ success: false, message: "用户未绑定微信openid" });
      }

      // 计算用户的连续签到天数（按北京时间）
      const [allReadingDates] = await dbPool.execute(
        'SELECT created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      ) as any[];

      let consecutiveDays = 0;
      if (allReadingDates.length > 0) {
        const dateSet = new Set();
        for (const row of allReadingDates) {
          const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
          const beijingMs = d.getTime() + 8 * 60 * 60 * 1000;
          const beijingDate = new Date(beijingMs);
          const dateStr = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;
          dateSet.add(dateStr);
        }
        const dates = Array.from(dateSet).sort().reverse();
        const now = new Date();
        const nowBeijingMs = now.getTime() + 8 * 60 * 60 * 1000;
        const nowBeijing = new Date(nowBeijingMs);
        const todayStr = `${nowBeijing.getUTCFullYear()}-${String(nowBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(nowBeijing.getUTCDate()).padStart(2, '0')}`;
        const yesterdayBeijing = new Date(nowBeijingMs - 24 * 60 * 60 * 1000);
        const yesterdayStr = `${yesterdayBeijing.getUTCFullYear()}-${String(yesterdayBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBeijing.getUTCDate()).padStart(2, '0')}`;

        if (dates[0] === todayStr || dates[0] === yesterdayStr) {
          let consecutive = 1;
          for (let i = 0; i < dates.length - 1; i++) {
            const currentParts = dates[i].split('-').map(Number);
            const nextParts = dates[i + 1].split('-').map(Number);
            const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
            const nextDate = new Date(nextParts[0], nextParts[1] - 1, nextParts[2]);
            const diffDays = Math.round((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
              consecutive++;
            } else {
              break;
            }
          }
          consecutiveDays = consecutive;
        }
      }

      const reward = req.body.reward || "连续签到奖励解读额度";
      const tip = req.body.tip || "今日还未进行塔罗解读，快来探索吧～";

      const checkinData = {};
      checkinData[CHECKIN_FIELD_REWARD] = { value: String(reward) };
      checkinData[CHECKIN_FIELD_TIP] = { value: String(tip) };
      checkinData[CHECKIN_FIELD_DAYS] = { value: String(consecutiveDays) };

      const sendResult = await sendSubscribeMessage(openid, SUBSCRIBE_CHECKIN_TMPL_ID, checkinData);

      if (sendResult.success) {
        res.json({ success: true, message: "签到提醒已发送", consecutiveDays: consecutiveDays });
      } else {
        res.json({ success: false, message: `签到提醒发送失败: ${sendResult.errmsg || '未知错误'} (errcode: ${sendResult.errcode})`, consecutiveDays: consecutiveDays });
      }
    } catch (error) {
      console.error("发送签到提醒错误:", error);
      res.status(500).json({ success: false, error: "发送签到提醒失败" });
    }
  });

  // 解读完成后发送签到成功通知
  app.post("/api/send-signin-success", async (req, res) => {
    try {
      const { userId, status, days, reward } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: "缺少userId" });
      }

      if (!SUBSCRIBE_SIGNIN_TMPL_ID) {
        return res.json({ success: false, message: "签到成功模板未配置" });
      }

      // 获取用户openid
      let openid = "";
      if (dbPool) {
        const [rows] = await dbPool.execute(
          'SELECT openid FROM users WHERE id = ?',
          [userId]
        ) as any[];
        if (rows.length > 0) {
          openid = rows[0].openid || "";
        }
      }
      if (!openid) {
        return res.json({ success: false, message: "用户未绑定openid" });
      }

      // 构建签到成功消息数据
      const signinData: Record<string, { value: string }> = {};
      signinData[SIGNIN_FIELD_STATUS] = { value: String(status || "签到成功") };
      signinData[SIGNIN_FIELD_DAYS] = { value: String(days || 0) };
      signinData[SIGNIN_FIELD_REWARD] = { value: String(reward || "+2") };

      const sendResult = await sendSubscribeMessage(openid, SUBSCRIBE_SIGNIN_TMPL_ID, signinData);

      if (sendResult.success) {
        res.json({ success: true, message: "签到成功通知已发送" });
      } else {
        res.json({ success: false, message: `签到成功通知发送失败: ${sendResult.errmsg || '未知错误'} (errcode: ${sendResult.errcode})` });
      }
    } catch (error) {
      console.error("发送签到成功通知错误:", error);
      res.status(500).json({ success: false, error: "发送签到成功通知失败" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, error: "用户名和密码不能为空" });
      }

      let user: any = null;

      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        user = { id: "admin", nickname: "管理员", level: "大师" };
      } else if (dbPool) {
        const [rows] = await dbPool.execute(
          'SELECT * FROM users WHERE nickname = ?',
          [username]
        ) as any[];

        if (rows.length > 0) {
          const row = rows[0];
          const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
          console.log(`[登录调试] 找到用户: ${row.nickname}, 数据库密码哈希: ${row.password ? row.password.substring(0, 16) + '...' : 'NULL'}, 计算哈希: ${hashedPassword.substring(0, 16)}...`);
          if (row.password === hashedPassword) {
            user = {
              id: row.id,
              nickname: row.nickname,
              avatar: row.avatar,
              level: row.level,
              readings: row.readings,
              draw_quota: row.draw_quota !== undefined ? row.draw_quota : 10
            };
          }
        } else {
          console.log(`[登录调试] 未找到用户: ${username}`);
        }
      }

      if (!user) {
        return res.status(401).json({ success: false, error: "用户名或密码错误" });
      }

      const token = generateUserToken(user.id);

      if (dbPool) {
        try {
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await dbPool.execute(
            'INSERT INTO login_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, token, expiresAt]
          );
        } catch (sessionErr) {
          console.error("保存登录会话失败:", sessionErr);
        }
      }

      res.json({
        success: true,
        token,
        user,
        subscribeConfig: SUBSCRIBE_LOGIN_TMPL_ID || SUBSCRIBE_QUOTA_TMPL_ID || SUBSCRIBE_CHECKIN_TMPL_ID ? {
          loginTmplId: SUBSCRIBE_LOGIN_TMPL_ID,
          quotaTmplId: SUBSCRIBE_QUOTA_TMPL_ID,
          checkinTmplId: SUBSCRIBE_CHECKIN_TMPL_ID
        } : null
      });
    } catch (error) {
      console.error("账号登录错误:", error);
      res.status(500).json({ success: false, error: "登录失败，请稍后重试" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      // 检查注册开关
      if (fs.existsSync(CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        if (config.registrationEnabled === false) {
          return res.status(403).json({ success: false, message: "注册通道暂未开放" });
        }
      }
      
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ success: false, message: "用户名和密码不能为空" });
      }
      
      if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ success: false, message: "用户名长度需在2-20个字符之间" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "密码长度不能少于6位" });
      }
      
      if (!dbPool) {
        return res.status(500).json({ success: false, message: "数据库未连接" });
      }
      
      // 检查用户名是否已存在
      const [existing] = await dbPool.execute(
        'SELECT * FROM users WHERE nickname = ?',
        [username]
      ) as any[];
      
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "用户名已存在" });
      }
      
      // 创建新用户
      const id = 'user_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      const defaultLevel = '入门';
      const defaultQuota = getQuotaByLevel(defaultLevel);
      
      await dbPool.execute(
        'INSERT INTO users (id, openid, nickname, password, level, readings, draw_quota) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, id, username, hashedPassword, defaultLevel, 0, defaultQuota]
      );
      
      const token = generateUserToken(id);
      try {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await dbPool.execute(
          'INSERT INTO login_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
          [id, token, expiresAt]
        );
      } catch (sessionErr) {
        console.error("注册-保存登录会话失败:", sessionErr);
      }

      res.json({
        success: true,
        token,
        user: { id, nickname: username, avatar: null, level: defaultLevel, readings: 0, draw_quota: defaultQuota },
        subscribeConfig: SUBSCRIBE_LOGIN_TMPL_ID || SUBSCRIBE_QUOTA_TMPL_ID || SUBSCRIBE_CHECKIN_TMPL_ID ? {
          loginTmplId: SUBSCRIBE_LOGIN_TMPL_ID,
          quotaTmplId: SUBSCRIBE_QUOTA_TMPL_ID,
          checkinTmplId: SUBSCRIBE_CHECKIN_TMPL_ID
        } : null
      });
    } catch (error) {
      console.error("注册错误:", error);
      res.status(500).json({ success: false, error: "注册失败，请稍后重试" });
    }
  });

  app.post("/api/reading/delete", async (req, res) => {
    try {
      const { readingId, userId, token } = req.body;
      
      if (!readingId || !userId) {
        return res.status(400).json({ success: false, error: "缺少参数" });
      }
      
      if (dbPool) {
        await dbPool.execute(
          'DELETE FROM readings WHERE id = ? AND user_id = ?',
          [readingId, userId]
        );
        console.log('[删除] 已删除记录:', readingId, '用户:', userId);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("删除记录错误:", error);
      res.status(500).json({ success: false, error: "删除失败" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "") || req.body?.token;
    
    if (token) {
      deleteUserSession(token);
      
      if (dbPool) {
        try {
          await dbPool.execute('DELETE FROM login_sessions WHERE token = ?', [token]);
        } catch (err) {
          console.error("清除数据库session失败:", err);
        }
      }
    }
    
    res.json({ success: true, message: "已退出登录" });
  });

  app.get("/api/auth/check", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "") || (req.query.token as string);
    
    if (!token) {
      return res.json({ success: true, loggedIn: false });
    }

    const userId = await verifyUserToken(token);
    if (!userId) {
      return res.json({ success: true, loggedIn: false });
    }

    if (dbPool) {
      try {
        const [userRows] = await dbPool.execute('SELECT * FROM users WHERE id = ?', [userId]) as any[];
        if (userRows.length > 0) {
          const u = userRows[0];
          return res.json({
            success: true,
            loggedIn: true,
            user: {
              id: u.id,
              nickname: u.nickname,
              avatar: u.avatar,
              level: u.level,
              readings: u.readings,
              draw_quota: u.draw_quota !== undefined ? u.draw_quota : getQuotaByLevel(u.level || '入门')
            }
          });
        }
      } catch (err) {
        console.error("查询用户失败:", err);
      }
    }

    res.json({ success: true, loggedIn: true, userId });
  });

  app.post("/api/wechat/update-user", async (req, res) => {
    try {
      const { id, nickname, avatar } = req.body;

      if (!id) {
        return res.status(400).json({ error: "缺少 id 参数" });
      }

      if (dbPool) {
        const updates: string[] = [];
        const params: any[] = [];
        if (nickname) {
          updates.push('nickname = ?');
          params.push(nickname);
        }
        if (avatar) {
          updates.push('avatar = ?');
          params.push(avatar);
        }
        params.push(id);
        
        if (updates.length > 0) {
          await dbPool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        const [rows] = await dbPool.execute('SELECT * FROM users WHERE id = ?', [id]) as any[];
        if (rows.length === 0) {
          return res.status(404).json({ error: "用户不存在" });
        }
        
        const user = rows[0];
        res.json({
          success: true,
          user: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            level: user.level,
            readings: user.readings,
            draw_quota: user.draw_quota !== undefined ? user.draw_quota : 10
          }
        });
      } else {
        res.status(500).json({ error: "数据库未连接" });
      }
    } catch (error) {
      console.error("更新用户信息错误:", error);
      res.status(500).json({ error: "更新用户信息失败" });
    }
  });

  app.get("/api/wechat/user/:openid", async (req, res) => {
    try {
      const { openid } = req.params;
      if (dbPool) {
        const [rows] = await dbPool.execute('SELECT * FROM users WHERE openid = ?', [openid]) as any[];
        if (rows.length === 0) {
          return res.status(404).json({ error: "用户不存在" });
        }
        
        const user = rows[0];
        res.json({
          success: true,
          user: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            level: user.level,
            readings: user.readings,
            draw_quota: user.draw_quota !== undefined ? user.draw_quota : 10
          }
        });
      } else {
        res.status(500).json({ error: "数据库未连接" });
      }
    } catch (error) {
      console.error("获取用户信息错误:", error);
      res.status(500).json({ error: "获取用户信息失败" });
    }
  });

  app.get("/api/user/stats", async (req, res) => {
    const userId = req.query.userId || "default_user";
    if (!dbPool) {
      return res.json({ totalReadings: 0, interpretedCount: 0, completionRate: 0, consecutiveDays: 0 });
    }
    
    try {
      const [countResult] = await dbPool.execute(
        'SELECT COUNT(*) as count FROM readings WHERE user_id = ?',
        [userId]
      ) as any[];
      const totalReadingsCount = countResult[0]?.count || 0;
      
      const [interpretedResult] = await dbPool.execute(
        'SELECT COUNT(*) as count FROM readings WHERE user_id = ? AND interpretation IS NOT NULL AND interpretation != ""',
        [userId]
      ) as any[];
      const interpretedCount = interpretedResult[0]?.count || 0;
      
      const completionRate = totalReadingsCount > 0 ? Math.round((interpretedCount / totalReadingsCount) * 100) : 0;
      
      const [allReadingDates] = await dbPool.execute(
        'SELECT created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      ) as any[];
      
      let consecutiveDays = 0;
      if (allReadingDates.length > 0) {
        const dateSet = new Set<string>();
        for (const row of allReadingDates) {
          const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
          const beijingMs = d.getTime() + 8 * 60 * 60 * 1000;
          const beijingDate = new Date(beijingMs);
          const dateStr = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;
          dateSet.add(dateStr);
        }
        
        const dates = Array.from(dateSet).sort().reverse();
        
        const now = new Date();
        const nowBeijingMs = now.getTime() + 8 * 60 * 60 * 1000;
        const nowBeijing = new Date(nowBeijingMs);
        const todayStr = `${nowBeijing.getUTCFullYear()}-${String(nowBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(nowBeijing.getUTCDate()).padStart(2, '0')}`;
        
        const yesterdayBeijing = new Date(nowBeijingMs - 24 * 60 * 60 * 1000);
        const yesterdayStr = `${yesterdayBeijing.getUTCFullYear()}-${String(yesterdayBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBeijing.getUTCDate()).padStart(2, '0')}`;
        
        if (dates[0] === todayStr || dates[0] === yesterdayStr) {
          let consecutive = 1;
          for (let i = 0; i < dates.length - 1; i++) {
            const currentParts = dates[i].split('-').map(Number);
            const nextParts = dates[i + 1].split('-').map(Number);
            const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
            const nextDate = new Date(nextParts[0], nextParts[1] - 1, nextParts[2]);
            const diffDays = Math.round((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
              consecutive++;
            } else {
              break;
            }
          }
          consecutiveDays = consecutive;
        }
      }
      
      res.json({
        totalReadings: totalReadingsCount,
        interpretedCount: interpretedCount,
        completionRate: completionRate,
        consecutiveDays: consecutiveDays
      });
    } catch (error) {
      console.error("获取统计数据失败:", error);
      res.status(500).json({ error: "获取统计数据失败" });
    }
  });

  app.get("/api/history", async (req, res) => {
    const userId = req.query.userId || "default_user";
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = page * limit;
    
    if (dbPool) {
      const [rows] = await dbPool.execute(
        'SELECT * FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, String(limit), String(offset)]
      ) as any[];
      
      const [countResult] = await dbPool.execute(
        'SELECT COUNT(*) as total FROM readings WHERE user_id = ?',
        [userId]
      ) as any[];
      const total = countResult[0]?.total || 0;
      
      res.json({
        data: rows.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          question: row.question,
          cards: row.cards,
          interpretation: row.interpretation,
          spread: row.spread,
          createdAt: row.created_at
        })),
        total: total,
        page: page,
        limit: limit,
        hasMore: offset + rows.length < total
      });
    } else {
      res.json({ data: [], total: 0, page: 0, limit: 10, hasMore: false });
    }
  });

  app.post("/api/save-reading", async (req, res) => {
    try {
      const { userId, question, cards, interpretation, spread } = req.body;
      const actualUserId = userId || "default_user";

      if (dbPool) {
        // ---- 写入解读记录前，查询昨日/今日是否有记录：
        //   只有"昨天有 & 今天还没有"才给 +2 奖励（一天最多一次）
        let yesterdayHadReading = false;
        let todayHadReading = false;
        try {
          const [allDates] = await dbPool.execute(
            'SELECT created_at FROM readings WHERE user_id = ?',
            [actualUserId]
          ) as any[];
          const now = new Date();
          const nowBeijingMs = now.getTime() + 8 * 60 * 60 * 1000;
          const nowBeijing = new Date(nowBeijingMs);
          const todayStr = `${nowBeijing.getUTCFullYear()}-${String(nowBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(nowBeijing.getUTCDate()).padStart(2, '0')}`;
          const yesterdayBeijing = new Date(nowBeijingMs - 24 * 60 * 60 * 1000);
          const yesterdayStr = `${yesterdayBeijing.getUTCFullYear()}-${String(yesterdayBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBeijing.getUTCDate()).padStart(2, '0')}`;
          const dateSet = new Set<string>();
          for (const row of allDates) {
            const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
            const beijingMs = d.getTime() + 8 * 60 * 60 * 1000;
            const beijingDate = new Date(beijingMs);
            const dateStr = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;
            dateSet.add(dateStr);
          }
          yesterdayHadReading = dateSet.has(yesterdayStr);
          todayHadReading = dateSet.has(todayStr);
        } catch (e) {
          console.warn('[签到奖励] 查询昨日/今日记录异常:', e);
        }

        // ---- 写入新的解读记录 ----
        const [result] = await dbPool.execute(
          'INSERT INTO readings (user_id, question, cards, interpretation, spread) VALUES (?, ?, ?, ?, ?)',
          [actualUserId, question || '', JSON.stringify(cards), interpretation, spread ? JSON.stringify(spread) : null]
        ) as any;

        // 同步更新用户表中的 readings 字段
        await dbPool.execute(
          'UPDATE users SET readings = (SELECT COUNT(*) FROM readings WHERE user_id = ?) WHERE id = ?',
          [actualUserId, actualUserId]
        );

        // ---- 连续签到奖励：+2 基础 + 连续天数（封顶5），一天只给一次 ----
        let quotaBonus = 0;
        let signinDays = 0;
        if (yesterdayHadReading && !todayHadReading) {
          // 计算连续签到天数（从昨天开始往前数）
          const dates = Array.from(dateSet).sort(); // 升序排列
          const yesterdayIndex = dates.indexOf(yesterdayStr);
          if (yesterdayIndex > 0) {
            let consecutive = 1; // 从昨天开始算1天
            for (let i = yesterdayIndex; i > 0; i--) {
              const currentParts = dates[i].split('-').map(Number);
              const prevParts = dates[i - 1].split('-').map(Number);
              const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
              const prevDate = new Date(prevParts[0], prevParts[1] - 1, prevParts[2]);
              const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays === 1) {
                consecutive++;
              } else {
                break;
              }
            }
            signinDays = consecutive;
          } else {
            signinDays = 1; // 只有昨天一天
          }
          // 奖励 = 2 + 连续天数，封顶5
          quotaBonus = Math.min(2 + signinDays, 5);
          await dbPool.execute(
            'UPDATE users SET draw_quota = draw_quota + ? WHERE id = ?',
            [quotaBonus, actualUserId]
          );
          console.log(`[签到奖励] 用户 ${actualUserId} 连续签到 - 昨日:有 今日:首次 - 连续${signinDays}天 - 额度 +${quotaBonus}`);
        } else {
          console.log(`[签到奖励] 用户 ${actualUserId} - 昨日:${yesterdayHadReading ? '有' : '无'} 今日已有:${todayHadReading ? '是' : '否'} - 跳过奖励`);
        }

        // 返回最新额度
        let currentQuota = 10;
        try {
          const [quotaRows] = await dbPool.execute(
            'SELECT draw_quota FROM users WHERE id = ?',
            [actualUserId]
          ) as any[];
          if (quotaRows.length > 0 && quotaRows[0].draw_quota !== undefined) {
            currentQuota = quotaRows[0].draw_quota;
          }
        } catch (e) { /* ignore */ }

        res.json({ id: result.insertId, quotaBonus: quotaBonus, signinDays: signinDays, draw_quota: currentQuota });
      } else {
        res.status(500).json({ error: "数据库未连接" });
      }
    } catch (error) {
      console.error("保存解读失败:", error);
      res.status(500).json({ error: "保存失败" });
    }
  });

  app.post("/api/update-reading", async (req, res) => {
    try {
      const { userId, readingId, interpretation } = req.body;
      
      if (!userId || !readingId) {
        return res.status(400).json({ success: false, error: "缺少必要参数" });
      }
      
      if (dbPool) {
        const [result] = await dbPool.execute(
          'UPDATE readings SET interpretation = ? WHERE id = ? AND user_id = ?',
          [interpretation, readingId, userId]
        ) as any;
        
        if (result.affectedRows > 0) {
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: "记录不存在或无权限" });
        }
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("更新解读失败:", error);
      res.status(500).json({ success: false, error: "更新解读失败" });
    }
  });

  app.post("/api/sync-readings", async (req, res) => {
    try {
      const { userId, readings } = req.body;
      console.log("收到同步请求，userId:", userId, "readings数量:", readings && readings.length);
      
      if (!userId || !Array.isArray(readings)) {
        console.log("参数错误: userId =", userId, "readings =", readings);
        return res.status(400).json({ error: "缺少必要参数" });
      }
      
      if (dbPool) {
        let addedCount = 0;
        
        for (const reading of readings) {
          try {
            console.log("处理记录:", reading.question, "时间:", reading.createdAt);
            
            const existsResult = await dbPool.execute(
              'SELECT id FROM readings WHERE user_id = ? AND question = ? AND created_at = ?',
              [userId, reading.question, reading.createdAt]
            ) as any[];
            
            if (existsResult[0].length === 0) {
              console.log("插入新记录:", reading.question);
              await dbPool.execute(
                'INSERT INTO readings (user_id, question, cards, interpretation, spread, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, reading.question || '', JSON.stringify(reading.cards), reading.interpretation, reading.spread ? JSON.stringify(reading.spread) : null, reading.createdAt]
              );
              addedCount++;
            } else {
              console.log("记录已存在，跳过:", reading.question);
            }
          } catch (err) {
            console.error("处理单条记录失败:", err);
          }
        }
        
        console.log("本次同步新增记录:", addedCount, "条");
        
        const [result] = await dbPool.execute('UPDATE users SET readings = (SELECT COUNT(*) FROM readings WHERE user_id = ?) WHERE id = ?', [userId, userId]) as any;
        
        const [updatedUser] = await dbPool.execute('SELECT * FROM users WHERE id = ?', [userId]) as any[];
        // 只获取最新的10条记录返回给前端
        const [readingRows] = await dbPool.execute(
          'SELECT * FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
          [userId]
        ) as any[];
        
        // 计算统计数据
        const [interpretedResult] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM readings WHERE user_id = ? AND interpretation IS NOT NULL AND interpretation != ""',
          [userId]
        ) as any[];
        const interpretedCount = interpretedResult[0]?.count || 0;
        
        const [countResult] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM readings WHERE user_id = ?',
          [userId]
        ) as any[];
        const totalReadingsCount = countResult[0]?.count || 0;
        
        const [allReadingDates] = await dbPool.execute(
          'SELECT created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC',
          [userId]
        ) as any[];
        
        let consecutiveDays = 0;
        
        // 计算连续天数（使用 Asia/Shanghai 时区 UTC+8）
        if (allReadingDates.length > 0) {
          // 所有日期统一转为北京时间（UTC+8）的日期字符串
          const dateSet = new Set<string>();
          for (const row of allReadingDates) {
            const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
            const beijingMs = d.getTime() + 8 * 60 * 60 * 1000;
            const beijingDate = new Date(beijingMs);
            const dateStr = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;
            dateSet.add(dateStr);
          }
          
          const dates = Array.from(dateSet).sort().reverse();
          
          // 获取今天的北京时间日期
          const now = new Date();
          const nowBeijingMs = now.getTime() + 8 * 60 * 60 * 1000;
          const nowBeijing = new Date(nowBeijingMs);
          const todayStr = `${nowBeijing.getUTCFullYear()}-${String(nowBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(nowBeijing.getUTCDate()).padStart(2, '0')}`;
          
          // 获取昨天的北京时间日期
          const yesterdayBeijing = new Date(nowBeijingMs - 24 * 60 * 60 * 1000);
          const yesterdayStr = `${yesterdayBeijing.getUTCFullYear()}-${String(yesterdayBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBeijing.getUTCDate()).padStart(2, '0')}`;
          
          console.log('[DEBUG SYNC] 今天:', todayStr, '昨天:', yesterdayStr, '最新记录:', dates[0], '所有日期:', dates.join(','));
          
          if (dates[0] === todayStr || dates[0] === yesterdayStr) {
            let consecutive = 1;
            for (let i = 0; i < dates.length - 1; i++) {
              const currentParts = dates[i].split('-').map(Number);
              const nextParts = dates[i + 1].split('-').map(Number);
              const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
              const nextDate = new Date(nextParts[0], nextParts[1] - 1, nextParts[2]);
              const diffDays = Math.round((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
              
              console.log('[DEBUG SYNC] 对比:', dates[i], dates[i + 1], '相差', diffDays, '天');
              
              if (diffDays === 1) {
                consecutive++;
              } else {
                break;
              }
            }
            consecutiveDays = consecutive;
            console.log('[DEBUG SYNC] 连续天数:', consecutiveDays);
          } else {
            console.log('[DEBUG SYNC] 最新记录不是今天或昨天，连续天数为0');
          }
        }
        
        const completionRate = totalReadingsCount > 0 ? Math.round((interpretedCount / totalReadingsCount) * 100) : 0;
        
        console.log("同步完成，用户现在有:", readingRows.length, "条历史记录");
        
        if (updatedUser.length === 0) {
          console.error("同步后查询用户失败，userId:", userId);
          return res.json({
          success: true,
          addedCount: addedCount,
          stats: {
            totalReadings: totalReadingsCount,
            interpretedCount: interpretedCount,
            completionRate: completionRate,
            consecutiveDays: consecutiveDays
          },
          history: readingRows.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            question: row.question,
            cards: row.cards,
            interpretation: row.interpretation,
            spread: row.spread,
            createdAt: row.created_at
          }))
        });
        }
        
        res.json({
          success: true,
          addedCount: addedCount,
          user: {
            id: updatedUser[0].id,
            nickname: updatedUser[0].nickname,
            avatar: updatedUser[0].avatar,
            level: updatedUser[0].level,
            readings: totalReadingsCount,
            draw_quota: updatedUser[0].draw_quota !== undefined ? updatedUser[0].draw_quota : 10
          },
          stats: {
            totalReadings: totalReadingsCount,
            interpretedCount: interpretedCount,
            completionRate: completionRate,
            consecutiveDays: consecutiveDays
          },
          history: readingRows.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            question: row.question,
            cards: row.cards,
            interpretation: row.interpretation,
            spread: row.spread,
            createdAt: row.created_at
          }))
        });
      } else {
        res.status(500).json({ error: "数据库未连接" });
      }
    } catch (error) {
      console.error("同步历史记录失败:", error);
      res.status(500).json({ error: "同步失败" });
    }
  });

  app.post("/api/interpret", async (req, res) => {
    try {
      const { question, cards } = req.body;
      if (!question || !cards || !Array.isArray(cards)) {
        return res.status(400).json({ error: "缺少必要参数" });
      }
      const interpretation = await interpretTarot(question, cards);
      res.json({ interpretation });
    } catch (error) {
      console.error("Interpretation error:", error);
      res.status(500).json({ error: "解读失败，请稍后重试" });
    }
  });

  // 额度管理API
  app.get("/api/user/quota", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || (req.query.token as string);
      
      if (!token) {
        return res.status(401).json({ success: false, error: "未授权" });
      }

      const userId = await verifyUserToken(token);
      if (!userId) {
        return res.status(401).json({ success: false, error: "无效的token" });
      }

      if (dbPool) {
        const [rows] = await dbPool.execute('SELECT draw_quota, level FROM users WHERE id = ?', [userId]) as any[];
        if (rows.length === 0) {
          return res.status(404).json({ success: false, error: "用户不存在" });
        }

        const user = rows[0];
        
        // 同步查询统计数据
        const [countResult] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM readings WHERE user_id = ?',
          [userId]
        ) as any[];
        const totalReadingsCount = countResult[0]?.count || 0;
        
        const [interpretedResult] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM readings WHERE user_id = ? AND interpretation IS NOT NULL AND interpretation != ""',
          [userId]
        ) as any[];
        const interpretedCount = interpretedResult[0]?.count || 0;
        
        const completionRate = totalReadingsCount > 0 ? Math.round((interpretedCount / totalReadingsCount) * 100) : 0;
        
        const [allReadingDates] = await dbPool.execute(
          'SELECT created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC',
          [userId]
        ) as any[];
        
        let consecutiveDays = 0;
        if (allReadingDates.length > 0) {
          const dateSet = new Set<string>();
          for (const row of allReadingDates) {
            const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
            const beijingMs = d.getTime() + 8 * 60 * 60 * 1000;
            const beijingDate = new Date(beijingMs);
            const dateStr = `${beijingDate.getUTCFullYear()}-${String(beijingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingDate.getUTCDate()).padStart(2, '0')}`;
            dateSet.add(dateStr);
          }
          
          const dates = Array.from(dateSet).sort().reverse();
          
          const now = new Date();
          const nowBeijingMs = now.getTime() + 8 * 60 * 60 * 1000;
          const nowBeijing = new Date(nowBeijingMs);
          const todayStr = `${nowBeijing.getUTCFullYear()}-${String(nowBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(nowBeijing.getUTCDate()).padStart(2, '0')}`;
          
          const yesterdayBeijing = new Date(nowBeijingMs - 24 * 60 * 60 * 1000);
          const yesterdayStr = `${yesterdayBeijing.getUTCFullYear()}-${String(yesterdayBeijing.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBeijing.getUTCDate()).padStart(2, '0')}`;
          
          if (dates[0] === todayStr || dates[0] === yesterdayStr) {
            let consecutive = 1;
            for (let i = 0; i < dates.length - 1; i++) {
              const currentParts = dates[i].split('-').map(Number);
              const nextParts = dates[i + 1].split('-').map(Number);
              const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
              const nextDate = new Date(nextParts[0], nextParts[1] - 1, nextParts[2]);
              const diffDays = Math.round((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays === 1) {
                consecutive++;
              } else {
                break;
              }
            }
            consecutiveDays = consecutive;
          }
        }
        
        res.json({
          success: true,
          quota: user.draw_quota !== undefined ? user.draw_quota : getQuotaByLevel(user.level || '入门'),
          level: user.level,
          stats: {
            totalReadings: totalReadingsCount,
            interpretedCount: interpretedCount,
            completionRate: completionRate,
            consecutiveDays: consecutiveDays
          }
        });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("获取额度失败:", error);
      res.status(500).json({ success: false, error: "获取额度失败" });
    }
  });

  app.post("/api/user/deduct-quota", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || req.body.token;
      const { userId, amount } = req.body;

      if (!token) {
        return res.status(401).json({ success: false, error: "未授权" });
      }

      const verifiedUserId = await verifyUserToken(token);
      if (!verifiedUserId) {
        return res.status(401).json({ success: false, error: "无效的token" });
      }

      if (!userId || amount === undefined || amount === null) {
        return res.status(400).json({ success: false, error: "缺少必要参数" });
      }

      if (dbPool) {
        const [rows] = await dbPool.execute('SELECT draw_quota, level, openid FROM users WHERE id = ?', [userId]) as any[];
        if (rows.length === 0) {
          return res.status(404).json({ success: false, error: "用户不存在" });
        }

        const currentQuota = rows[0].draw_quota !== undefined ? rows[0].draw_quota : getQuotaByLevel(rows[0].level);

        if (currentQuota < amount) {
          return res.status(400).json({
            success: false,
            error: "额度不足",
            currentQuota: currentQuota,
            requiredAmount: amount
          });
        }

        const newQuota = Math.max(0, currentQuota - amount);
        await dbPool.execute('UPDATE users SET draw_quota = ? WHERE id = ?', [newQuota, userId]);

        // 发送订阅消息（额度变动提醒）
        let quotaNotifyResult: { sent: boolean; message: string } | null = null;
        if (SUBSCRIBE_QUOTA_TMPL_ID && rows[0].openid) {
          const quotaData: Record<string, { value: string }> = {};
          quotaData[QUOTA_FIELD_REMAINING] = { value: String(newQuota) };
          quotaData[QUOTA_FIELD_USED] = { value: String(amount) };

          const sendResult = await sendSubscribeMessage(rows[0].openid, SUBSCRIBE_QUOTA_TMPL_ID, quotaData);
          quotaNotifyResult = {
            sent: sendResult.success,
            message: sendResult.success ? "额度提醒已发送" : `额度提醒发送失败: ${sendResult.errmsg || '未知错误'} (errcode: ${sendResult.errcode})`
          };
        }

        res.json({
          success: true,
          newQuota: newQuota,
          deducted: amount,
          quotaNotify: quotaNotifyResult
        });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("扣除额度失败:", error);
      res.status(500).json({ success: false, error: "扣除额度失败: " + (error as any).message });
    }
  });

  app.post("/api/user/refill-quota", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || req.body.token;
      const { userId, amount } = req.body;
      
      if (!token) {
        return res.status(401).json({ success: false, error: "未授权" });
      }

      const verifiedUserId = await verifyUserToken(token);
      if (!verifiedUserId) {
        return res.status(401).json({ success: false, error: "无效的token" });
      }
      
      if (!userId || !amount) {
        return res.status(400).json({ success: false, error: "缺少必要参数" });
      }

      if (dbPool) {
        // 获取当前额度
        const [rows] = await dbPool.execute('SELECT draw_quota FROM users WHERE id = ?', [userId]) as any[];
        if (rows.length === 0) {
          return res.status(404).json({ success: false, error: "用户不存在" });
        }

        const currentQuota = rows[0].draw_quota !== undefined ? rows[0].draw_quota : getQuotaByLevel(rows[0].level || '入门');
        const newQuota = currentQuota + amount;
        
        await dbPool.execute('UPDATE users SET draw_quota = ? WHERE id = ?', [newQuota, userId]);
        
        res.json({
          success: true,
          newQuota: newQuota,
          added: amount
        });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("补充额度失败:", error);
      res.status(500).json({ success: false, error: "补充额度失败" });
    }
  });

  // 创建用户
  app.post("/api/admin/users", adminAuth, async (req, res) => {
    try {
      const { openid, nickname, level, password } = req.body;

      if (!nickname) {
        return res.status(400).json({ success: false, error: "昵称不能为空" });
      }

      if (dbPool) {
        let id: string;
        let finalOpenid: string;

        if (openid) {
          const [existing] = await dbPool.execute('SELECT id FROM users WHERE openid = ?', [openid]) as any[];
          if (existing.length > 0) {
            return res.status(409).json({ success: false, error: "该 OpenID 已存在" });
          }
          id = openid;
          finalOpenid = openid;
        } else {
          id = crypto.randomBytes(16).toString("hex");
          finalOpenid = id;
        }

        const userLevel = level || "入门";
        const userQuota = getQuotaByLevel(userLevel);
        const hashedPassword = crypto.createHash('sha256').update(password || "123456").digest('hex');

        await dbPool.execute(
          'INSERT INTO users (id, openid, nickname, level, readings, password, draw_quota) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, finalOpenid, nickname, userLevel, 0, hashedPassword, userQuota]
        );

        const [rows] = await dbPool.execute('SELECT * FROM users WHERE id = ?', [id]) as any[];
        const user = rows[0];
        res.json({
          success: true,
          user: {
            id: user.id,
            openid: user.openid,
            unionid: user.unionid,
            nickname: user.nickname,
            avatar: user.avatar,
            level: user.level,
            readings: user.readings,
            draw_quota: user.draw_quota,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("创建用户错误:", error);
      res.status(500).json({ success: false, error: "创建用户失败" });
    }
  });

  app.get("/api/admin/users", adminAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      if (dbPool) {
        const [rows] = await dbPool.execute(
          'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [limit, offset]
        ) as any[];

        const [countResult] = await dbPool.execute(
          'SELECT COUNT(*) as total FROM users'
        ) as any[];
        const total = countResult[0].total;

        res.json({
          success: true,
          users: rows.map((row: any) => ({
            id: row.id,
            openid: row.openid,
            unionid: row.unionid,
            nickname: row.nickname,
            avatar: row.avatar,
            level: row.level,
            readings: row.readings,
            draw_quota: row.draw_quota !== undefined ? row.draw_quota : getQuotaByLevel(row.level || '入门'),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("获取用户列表错误:", error);
      res.status(500).json({ success: false, error: "获取用户列表失败" });
    }
  });

  app.get("/api/admin/users/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      if (dbPool) {
        const [rows] = await dbPool.execute(
          'SELECT * FROM users WHERE id = ?',
          [id]
        ) as any[];

        if (rows.length === 0) {
          return res.status(404).json({ success: false, error: "用户不存在" });
        }

        const user = rows[0];
        res.json({
          success: true,
          user: {
            id: user.id,
            openid: user.openid,
            unionid: user.unionid,
            nickname: user.nickname,
            avatar: user.avatar,
            level: user.level,
            readings: user.readings,
            draw_quota: user.draw_quota !== undefined ? user.draw_quota : getQuotaByLevel(user.level || '入门'),
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("获取用户信息错误:", error);
      res.status(500).json({ success: false, error: "获取用户信息失败" });
    }
  });

  app.put("/api/admin/users/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { nickname, level, avatar, adjustQuota } = req.body;

      if (dbPool) {
        const updates: string[] = [];
        const params: any[] = [];

        // 先获取原用户信息
        const [oldUserRows] = await dbPool.execute('SELECT * FROM users WHERE id = ?', [id]) as any[];
        if (oldUserRows.length === 0) {
          return res.status(404).json({ success: false, error: "用户不存在" });
        }
        const oldUser = oldUserRows[0];
        const oldLevel = oldUser.level;

        if (nickname !== undefined) {
          updates.push('nickname = ?');
          params.push(nickname);
        }
        if (level !== undefined) {
          updates.push('level = ?');
          params.push(level);
        }
        if (avatar !== undefined) {
          updates.push('avatar = ?');
          params.push(avatar || null);
        }
        params.push(id);

        if (updates.length === 0) {
          return res.status(400).json({ success: false, error: "没有需要更新的字段" });
        }

        const [result] = await dbPool.execute(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          params
        ) as any;

        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, error: "用户不存在" });
        }

        // 如果等级变更，且选择了调整额度，则自动调整额度
        let newQuota = oldUser.draw_quota;
        if (level !== undefined && level !== oldLevel && adjustQuota) {
          newQuota = getQuotaByLevel(level);
          await dbPool.execute('UPDATE users SET draw_quota = ? WHERE id = ?', [newQuota, id]);
          console.log("[等级变更] 用户等级从", oldLevel, "变更为", level, "，额度从", oldUser.draw_quota, "调整为", newQuota);
        }

        if ((avatar === null || avatar === "") && oldUser.avatar && oldUser.avatar.startsWith("/uploads/avatars/")) {
          const oldFilePath = path.join(__dirname, oldUser.avatar);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }

        const [rows] = await dbPool.execute(
          'SELECT * FROM users WHERE id = ?',
          [id]
        ) as any[];

        const user = rows[0];
        res.json({
          success: true,
          user: {
            id: user.id,
            openid: user.openid,
            unionid: user.unionid,
            nickname: user.nickname,
            avatar: user.avatar,
            level: user.level,
            readings: user.readings,
            draw_quota: user.draw_quota,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("更新用户信息错误:", error);
      res.status(500).json({ success: false, error: "更新用户信息失败" });
    }
  });

  app.delete("/api/admin/users/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      if (dbPool) {
        const [result] = await dbPool.execute(
          'DELETE FROM users WHERE id = ?',
          [id]
        ) as any;

        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, error: "用户不存在" });
        }

        res.json({ success: true, message: "删除成功" });
      } else {
        res.status(500).json({ success: false, error: "数据库未连接" });
      }
    } catch (error) {
      console.error("删除用户错误:", error);
      res.status(500).json({ success: false, error: "删除用户失败" });
    }
  });

  // 批量更新所有用户的额度
  app.post("/api/admin/users/batch-update-quota", adminAuth, async (req, res) => {
    try {
      const { override } = req.body; // override: true 时覆盖所有用户额度，false 时只更新空额度用户
      
      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      // 查询所有用户
      const [users] = await dbPool.execute('SELECT id, level, draw_quota, nickname FROM users') as any[];
      
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const results = [];

      for (const user of users) {
        try {
          const newQuota = getQuotaByLevel(user.level || '入门');
          
          // 判断是否需要更新
          const shouldUpdate = override || 
            user.draw_quota === null || 
            user.draw_quota === undefined || 
            user.draw_quota < 0 || 
            user.draw_quota === 0; // 也更新额度为0的用户
          
          if (shouldUpdate) {
            await dbPool.execute(
              'UPDATE users SET draw_quota = ? WHERE id = ?',
              [newQuota, user.id]
            );
            updatedCount++;
            results.push({
              id: user.id,
              nickname: user.nickname || '未知',
              oldQuota: user.draw_quota,
              newQuota: newQuota,
              level: user.level
            });
          } else {
            skippedCount++;
          }
        } catch (err) {
          console.error(`更新用户 ${user.id} 额度失败:`, err);
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `批量更新完成：成功更新 ${updatedCount} 个用户，跳过 ${skippedCount} 个，失败 ${errorCount} 个`,
        updatedCount,
        skippedCount,
        errorCount,
        details: results
      });
    } catch (error) {
      console.error("批量更新用户额度失败:", error);
      res.status(500).json({ success: false, error: "批量更新失败: " + (error as any).message });
    }
  });

  // 用户额度使用明细
  app.get("/api/admin/users/:id/quota-detail", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      // 获取用户基本信息
      const [userRows] = await dbPool.execute('SELECT * FROM users WHERE id = ?', [id]) as any[];
      if (userRows.length === 0) {
        return res.status(404).json({ success: false, error: "用户不存在" });
      }
      const user = userRows[0];

      const baseQuota = getQuotaByLevel(user.level || '入门');
      const currentQuota = user.draw_quota !== undefined ? user.draw_quota : baseQuota;

      // 获取用户的所有解读记录（按时间倒序）作为消耗明细
      const [readingRows] = await dbPool.execute(
        'SELECT id, question, cards, created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC',
        [id]
      ) as any[];

      // 把每条记录转为北京时间日期字符串，并建立日期集合
      const toBeijingDate = (d: any) => {
        if (!d) return '';
        const date = d instanceof Date ? d : new Date(d);
        // 使用 Intl 在所有服务器时区下都得到一致的北京时间日期
        try {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).formatToParts(date);
          const obj: Record<string, string> = {};
          for (const p of parts) obj[p.type] = p.value;
          return `${obj.year}-${obj.month}-${obj.day}`;
        } catch (_) {
          // 回退方案：直接加 8 小时
          const beijingMs = date.getTime() + 8 * 60 * 60 * 1000;
          const bd = new Date(beijingMs);
          return `${bd.getUTCFullYear()}-${String(bd.getUTCMonth() + 1).padStart(2, '0')}-${String(bd.getUTCDate()).padStart(2, '0')}`;
        }
      };

      const dailyStats = new Map<string, number>();
      for (const row of readingRows) {
        const dateStr = toBeijingDate(row.created_at);
        dailyStats.set(dateStr, (dailyStats.get(dateStr) || 0) + 1);
      }

      const sortedDistinctDates = Array.from(dailyStats.keys()).sort();

      // 识别「连续签到奖励」：某天有占卜 & 前一天也有（即当天是"连续"的一天）。
      // 实际发放逻辑是：昨天有记录 & 今天是今日首次占卜时 +2。
      // 这里用"按日期首次占卜"作为奖励事件的发生时机，只要昨日也有记录则视为连续签到 +2。
      const rewardRecords: any[] = [];
      let totalReward = 0;

      for (let i = 0; i < sortedDistinctDates.length; i++) {
        const today = sortedDistinctDates[i];
        if (i === 0) continue; // 第一天不可能是连续签到
        const yesterday = sortedDistinctDates[i - 1];
        // 判断 yesterday 是否是 today 的前一天
        const tDate = new Date(today + 'T00:00:00Z');
        const yDate = new Date(yesterday + 'T00:00:00Z');
        const dayDiff = Math.round((tDate.getTime() - yDate.getTime()) / (24 * 60 * 60 * 1000));
        if (dayDiff === 1) {
          // 找到该天最早的一条 reading 作为奖励发生的时间
          let earliestRow: any = null;
          for (const row of readingRows) {
            if (toBeijingDate(row.created_at) === today) {
              if (!earliestRow || (row.created_at && earliestRow.created_at && row.created_at < earliestRow.created_at)) {
                earliestRow = row;
              }
            }
          }
          if (earliestRow) {
            rewardRecords.push({
              id: 'reward-' + today,
              type: 'reward',
              description: '连续签到奖励',
              createdAt: earliestRow.created_at,
              amount: 2
            });
            totalReward += 2;
          }
        }
      }

      // 统计历史数据
      const totalUsed = readingRows.length;
      const totalGranted = currentQuota + totalUsed; // 粗略估算：当前剩余 + 已消耗

      const dailyUsage = Array.from(dailyStats.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date));

      // 最近30天消耗统计
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let last30DaysUsed = 0;
      for (const { date, count } of dailyUsage) {
        if (new Date(date) >= thirtyDaysAgo) {
          last30DaysUsed += count;
        }
      }

      // 最近7天消耗统计
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let last7DaysUsed = 0;
      for (const { date, count } of dailyUsage) {
        if (new Date(date) >= sevenDaysAgo) {
          last7DaysUsed += count;
        }
      }

      // 生成消耗明细：每一条解读记录视为一次额度消耗
      const consumptionRecords: any[] = readingRows.map((row: any, idx: number) => {
        let questionText = row.question || '';
        let spreadName = '';
        let cardsPreview = '';

        try {
          if (row.cards) {
            let cardsData = row.cards;
            if (typeof cardsData === 'string') {
              cardsData = JSON.parse(cardsData);
            }
            if (Array.isArray(cardsData) && cardsData.length > 0) {
              cardsPreview = cardsData.map((c: any) => c?.card?.name || c?.name || '牌').join('、');
            }
          }
        } catch (_) {
          // 解析失败则忽略
        }

        return {
          id: row.id,
          index: readingRows.length - idx,
          type: 'consume',
          question: questionText,
          cards: cardsPreview,
          spreadName: spreadName,
          createdAt: row.created_at,
          amount: 1
        };
      });

      // 合并消耗记录 + 奖励记录，按时间倒序
      const usageRecords = [...consumptionRecords, ...rewardRecords].sort((a, b) => {
        const da = new Date(a.createdAt);
        const db = new Date(b.createdAt);
        return db.getTime() - da.getTime();
      });

      // 合并后重新编号（按时间倒序的序号）
      usageRecords.forEach((r, i) => {
        (r as any).index = i + 1;
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname,
          avatar: user.avatar,
          level: user.level,
          baseQuota,
          currentQuota,
          totalUsed,
          totalGranted,
          totalReward,
          rewardCount: rewardRecords.length,
          last7DaysUsed,
          last30DaysUsed,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        dailyUsage,
        usageRecords
      });
    } catch (error) {
      console.error("获取用户额度明细错误:", error);
      res.status(500).json({ success: false, error: "获取用户额度明细失败" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 订阅消息模板ID配置接口（公开，不依赖登录）
  // 前端在页面加载时调用此接口获取模板ID，缓存到本地存储
  // 用户点击按钮时从本地读取，在同步上下文中调用 wx.requestSubscribeMessage
  app.get("/api/subscribe/config", (req, res) => {
    res.json({
      success: true,
      loginTmplId: SUBSCRIBE_LOGIN_TMPL_ID || "",
      quotaTmplId: SUBSCRIBE_QUOTA_TMPL_ID || "",
      checkinTmplId: SUBSCRIBE_CHECKIN_TMPL_ID || "",
      signinSuccessTmplId: SUBSCRIBE_SIGNIN_TMPL_ID || ""
    });
  });

  // 静态文件服务 - 访问上传的头像
  app.use("/uploads", express.static(UPLOAD_DIR));

  // 头像上传接口
  app.post("/api/wechat/upload-avatar", upload.single("avatar"), (req, res) => {
    try {
      console.log('[上传] 收到上传请求, body:', req.body);
      console.log('[上传] 文件信息:', req.file);
      
      if (!req.file) {
        console.log('[上传] 没有接收到文件');
        return res.status(400).json({ success: false, error: "没有上传文件" });
      }
      
      // 返回文件的访问路径
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      console.log('[上传] 上传成功，头像URL:', avatarUrl);
      res.json({
        success: true,
        avatarUrl: avatarUrl
      });
    } catch (error) {
      console.error("上传头像错误:", error);
      res.status(500).json({ success: false, error: "上传头像失败" });
    }
  });

  app.post("/api/admin/upload-avatar", adminAuth, upload.single("avatar"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "没有上传文件" });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      res.json({
        success: true,
        avatarUrl: avatarUrl
      });
    } catch (error) {
      console.error("管理员上传头像错误:", error);
      res.status(500).json({ success: false, error: "上传头像失败" });
    }
  });

  // 管理员登录
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = generateToken(username);
      res.json({
        success: true,
        token,
        message: "登录成功"
      });
    } else {
      res.status(401).json({
        success: false,
        error: "用户名或密码错误"
      });
    }
  });

  // 验证 token
  app.get("/api/admin/verify", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (token && verifyToken(token)) {
      res.json({ success: true, valid: true });
    } else {
      res.json({ success: true, valid: false });
    }
  });

  // 管理后台统计数据
  app.get("/api/admin/stats", adminAuth, async (req, res) => {
    try {
      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      const [userCountResult] = await dbPool.execute('SELECT COUNT(*) as total FROM users') as any[];
      const totalUsers = userCountResult[0].total;

      const [readingCountResult] = await dbPool.execute('SELECT COUNT(*) as total FROM readings') as any[];
      const totalReadings = readingCountResult[0].total;

      const [todayUserResult] = await dbPool.execute(
        'SELECT COUNT(*) as total FROM users WHERE DATE(created_at) = CURDATE()'
      ) as any[];
      const todayUsers = todayUserResult[0].total;

      const [todayReadingResult] = await dbPool.execute(
        'SELECT COUNT(*) as total FROM readings WHERE DATE(created_at) = CURDATE()'
      ) as any[];
      const todayReadings = todayReadingResult[0].total;

      const [activeUsersResult] = await dbPool.execute(
        'SELECT COUNT(DISTINCT user_id) as total FROM readings WHERE DATE(created_at) = CURDATE()'
      ) as any[];
      const activeUsersToday = activeUsersResult[0].total;

      const [levelResult] = await dbPool.execute(
        'SELECT level, COUNT(*) as count FROM users GROUP BY level ORDER BY count DESC'
      ) as any[];
      const levelDistribution = levelResult.map((row: any) => ({
        level: row.level,
        count: row.count
      }));

      const [recentReadingsResult] = await dbPool.execute(
        `SELECT r.user_id, u.nickname, u.avatar, COUNT(*) as count, MAX(r.created_at) as last_read_at
         FROM readings r LEFT JOIN users u ON r.user_id = u.id
         GROUP BY r.user_id, u.nickname, u.avatar
         ORDER BY last_read_at DESC LIMIT 10`
      ) as any[];
      const recentReadings = recentReadingsResult.map((row: any) => ({
        userId: row.user_id,
        nickname: row.nickname,
        avatar: row.avatar,
        count: row.count,
        lastReadAt: row.last_read_at
      }));

      // 获取热门牌阵排行
      const [spreadResult] = await dbPool.execute(
        `SELECT spread 
         FROM readings 
         WHERE spread IS NOT NULL AND spread != '' 
         LIMIT 20`
      ) as any[];
      
      console.log("=== 调试：spread 字段原始数据 ===");
      for (let i = 0; i < Math.min(5, spreadResult.length); i++) {
        console.log(`第${i + 1}条:`, typeof spreadResult[i].spread, spreadResult[i].spread);
      }
      
      // 在代码中统计牌阵使用次数
      const spreadCounts = new Map<string, number>();
      
      // 重新查询所有数据用于统计
      const [allSpreadResult] = await dbPool.execute(
        `SELECT spread 
         FROM readings 
         WHERE spread IS NOT NULL AND spread != ''`
      ) as any[];
      
      for (const row of allSpreadResult) {
        let spreadName = '未知牌阵';
        try {
          let spreadData = row.spread;
          
          // 尝试解析JSON
          if (typeof spreadData === 'string') {
            spreadData = JSON.parse(spreadData);
          }
          
          console.log("解析后数据:", spreadData);
          
          // 获取名称，支持多种可能的结构
          if (typeof spreadData === 'object' && spreadData !== null) {
            // 尝试多种可能的字段名
            spreadName = spreadData.name || spreadData.title || spreadData.type || 
                       spreadData.spreadName || spreadData.spread_title || '未知牌阵';
            
            // 如果还是对象，尝试获取更深层
            if (typeof spreadName === 'object') {
              spreadName = spreadName.name || spreadName.title || JSON.stringify(spreadName).substring(0, 20);
            }
          } else if (typeof spreadData === 'string') {
            spreadName = spreadData;
          }
        } catch (e) {
          console.log("解析失败:", e, "原始数据:", row.spread);
          // 如果是字符串且不是JSON，直接用
          if (typeof row.spread === 'string' && row.spread.length < 50) {
            spreadName = row.spread;
          } else {
            continue;
          }
        }
        
        // 统计
        if (spreadName && spreadName !== '未知牌阵') {
          spreadCounts.set(spreadName, (spreadCounts.get(spreadName) || 0) + 1);
        }
      }
      
      console.log("统计结果:", Array.from(spreadCounts.entries()));
      
      // 排序并取前10
      const popularSpreads = Array.from(spreadCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.json({
        success: true,
        stats: {
          totalUsers,
          totalReadings,
          todayUsers,
          todayReadings,
          activeUsersToday,
          levelDistribution,
          recentReadings,
          popularSpreads
        }
      });
    } catch (error) {
      console.error("获取统计数据错误:", error);
      res.status(500).json({ success: false, error: "获取统计数据失败" });
    }
  });

  app.get("/api/admin/config", adminAuth, async (req, res) => {
    try {
      var config = { registrationEnabled: true };
      if (fs.existsSync(CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      }
      res.json({ success: true, config });
    } catch (error) {
      console.error("获取配置错误:", error);
      res.status(500).json({ success: false, error: "获取配置失败" });
    }
  });

  app.put("/api/admin/config", adminAuth, async (req, res) => {
    try {
      const { config } = req.body;
      if (!config) {
        return res.status(400).json({ success: false, error: "缺少配置参数" });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      res.json({ success: true, config });
    } catch (error) {
      console.error("保存配置错误:", error);
      res.status(500).json({ success: false, error: "保存配置失败" });
    }
  });

  // 获取解读记录列表
  app.get("/api/admin/readings", adminAuth, async (req, res) => {
    try {
      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // 筛选参数
      const userId = req.query.userId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const spreadName = req.query.spreadName as string;

      let whereConditions = [];
      let params: any[] = [];

      if (userId) {
        whereConditions.push("r.user_id = ?");
        params.push(userId);
      }

      if (startDate) {
        whereConditions.push("DATE(r.created_at) >= ?");
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push("DATE(r.created_at) <= ?");
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

      // 查询解读记录
      const [readingRows] = await dbPool.execute(`
        SELECT r.*, u.nickname, u.avatar
        FROM readings r
        LEFT JOIN users u ON r.user_id = u.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]) as any[];

      // 查询总记录数
      const [countResult] = await dbPool.execute(`
        SELECT COUNT(*) as total
        FROM readings r
        ${whereClause}
      `, params) as any[];

      const total = countResult[0].total;

      const readings = readingRows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        nickname: row.nickname,
        avatar: row.avatar,
        question: row.question,
        cards: row.cards,
        interpretation: row.interpretation,
        spread: row.spread,
        createdAt: row.created_at
      }));

      res.json({
        success: true,
        readings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("获取解读记录错误:", error);
      res.status(500).json({ success: false, error: "获取解读记录失败" });
    }
  });

  // 获取所有用户列表（用于筛选）
  app.get("/api/admin/all-users", adminAuth, async (req, res) => {
    try {
      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      const [rows] = await dbPool.execute('SELECT id, nickname FROM users ORDER BY nickname') as any[];

      res.json({
        success: true,
        users: rows.map((row: any) => ({
          id: row.id,
          nickname: row.nickname
        }))
      });
    } catch (error) {
      console.error("获取用户列表错误:", error);
      res.status(500).json({ success: false, error: "获取用户列表失败" });
    }
  });

  // 获取热门牌阵接口（小程序使用）
  app.get("/api/spreads/popular", async (req, res) => {
    try {
      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      // 查询所有 spread 数据并统计
      const [allSpreadResult] = await dbPool.execute(
        `SELECT spread 
         FROM readings 
         WHERE spread IS NOT NULL AND spread != ''`
      ) as any[];
      
      const spreadCounts = new Map<string, number>();
      
      for (const row of allSpreadResult) {
        let spreadName = '未知牌阵';
        let spreadId = null;
        try {
          let spreadData = row.spread;
          
          if (typeof spreadData === 'string') {
            spreadData = JSON.parse(spreadData);
          }
          
          if (typeof spreadData === 'object' && spreadData !== null) {
            spreadName = spreadData.name || spreadData.title || spreadData.type || 
                        spreadData.spreadName || spreadData.spread_title || '未知牌阵';
            spreadId = spreadData.id || null;
          } else if (typeof spreadData === 'string') {
            spreadName = spreadData;
          }
        } catch (e) {
          if (typeof row.spread === 'string' && row.spread.length < 50) {
            spreadName = row.spread;
          } else {
              continue;
          }
        }
        
        if (spreadName && spreadName !== '未知牌阵') {
          spreadCounts.set(spreadName, (spreadCounts.get(spreadName) || 0) + 1);
        }
      }
      
      const popularSpreads = Array.from(spreadCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.json({
        success: true,
        spreads: popularSpreads
      });
    } catch (error) {
      console.error("获取热门牌阵失败:", error);
      res.status(500).json({ success: false, error: "获取热门牌阵失败" });
    }
  });

  // 词云缓存
  let wordCloudCache: {
    data: Array<{ word: string; count: number }>;
    lastQuestionId: number;
    timestamp: number;
  } | null = null;

  // 使用 AI 整理词云词汇的辅助函数
  async function generateWordCloudWithAI(questions: string[]): Promise<Array<{ word: string; count: number }>> {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key is not configured");
    }

    // 合并所有问题
    const allQuestionsText = questions.slice(0, 200).join("\n"); // 限制数量避免 token 过多

    const prompt = `
你是一位专业的文本分析专家。请从以下用户的塔罗占卜提问中，提取和整理出最常见的热词。

【用户提问列表】
${allQuestionsText}

【任务要求】
1. 分析这些提问，识别出用户最关心的话题和关键词
2. 提取 30-50 个热词，要求：
   - 词汇应该是 2-6 个字的中文词汇
   - 按重要性/频率排序，最重要的排在前面
   - 词汇应该反映用户的真实需求，如：感情、事业、财运、复合、桃花等
3. 请以 JSON 格式返回结果，格式如下：
[
  {"word": "感情", "count": 50},
  {"word": "事业", "count": 45},
  {"word": "复合", "count": 38}
]

【重要】
- 只返回 JSON，不要有其他文字说明
- count 表示该词汇的重要程度/出现频率估算值
`;

    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "你是一位专业的文本分析专家，擅长从大量文本中提取关键词和热点话题。"
            },
            {
              role: "user",
              content: prompt.trim()
            }
          ],
          temperature: 0.3,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || "";
      
      // 尝试解析 AI 返回的 JSON
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedWords = JSON.parse(jsonMatch[0]);
        return parsedWords.slice(0, 50);
      }
      
      throw new Error("Failed to parse AI response");
    } catch (error) {
      console.error("AI 词云生成错误:", error);
      throw error;
    }
  }

  // 获取用户提问词云数据
  app.get("/api/admin/wordcloud", adminAuth, async (req, res) => {
    try {
      if (!dbPool) {
        return res.status(500).json({ success: false, error: "数据库未连接" });
      }

      // 获取最新的提问（包含ID，用于检测是否有新问题）
      const [rows] = await dbPool.execute('SELECT id, question FROM readings WHERE question IS NOT NULL AND question != "" ORDER BY created_at DESC LIMIT 500') as any[];
      const questions = rows.map((row: any) => row.question).filter((q: string) => q && q.length >= 2);
      const latestQuestionId = rows.length > 0 ? rows[0].id : 0;

      // 检查是否需要刷新：没有缓存 或 有新问题
      const needRefresh = !wordCloudCache || latestQuestionId > wordCloudCache.lastQuestionId;

      if (!needRefresh) {
        console.log("使用缓存的词云数据（无新问题）");
        return res.json({
          success: true,
          wordcloud: wordCloudCache.data,
          cached: true
        });
      }

      console.log("检测到新问题，重新生成词云...");
      let wordArray: Array<{ word: string; count: number }> = [];

      try {
        // 尝试使用 AI 生成词云
        wordArray = await generateWordCloudWithAI(questions);
      } catch (aiError) {
        console.warn("AI 词云生成失败，使用备用方案:", aiError);
        
        // 备用方案：简单的关键词提取
        const coreKeywords = [
          '感情', '爱情', '事业', '财运', '健康', '学业', '工作', '婚姻', '恋爱', '未来', 
          '运势', '运气', '贵人', '小人', '桃花', '复合', '分手', '和好', '赚钱', '投资',
          '关系', '发展', '前任', '现任', '暧昧', '暗恋', '结婚', '离婚', '家庭',
          '升职', '加薪', '跳槽', '创业', '合作', '项目', '考试', '学习',
          '身体', '疾病', '治疗', '恢复', '财富', '理财', '金钱',
          '预测', '建议', '选择', '决定', '困惑', '迷茫', '希望', '期待'
        ];
        
        const wordCount: Record<string, number> = {};
        questions.forEach(question => {
          coreKeywords.forEach(word => {
            if (question.includes(word)) {
              wordCount[word] = (wordCount[word] || 0) + 1;
            }
          });
        });
        
        wordArray = Object.entries(wordCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 30)
          .map(([word, count]) => ({ word, count }));
      }

      // 更新缓存
      wordCloudCache = {
        data: wordArray,
        lastQuestionId: latestQuestionId,
        timestamp: Date.now()
      };

      res.json({
        success: true,
        wordcloud: wordArray,
        cached: false
      });
    } catch (error) {
      console.error("获取词云数据错误:", error);
      res.status(500).json({ success: false, error: "获取词云数据失败" });
    }
  });

  // 登出

  // 服务静态文件
  app.use(express.static(path.join(process.cwd(), "dist")));
  
  // 管理页面路由
  app.get("/admin", (req, res) => {
    res.sendFile(path.join(process.cwd(), "admin.html"));
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  await initDatabase();

  // 定时任务：基于用户最后一次解读的24小时后，如果用户没有新解读则发送签到提醒
  // 每30分钟扫描一次，用 last_checkin_notified_at 字段避免重复发送
  function scheduleDailyCheckinReminder() {
    function toBeijingDateStr(dateObj: Date): string {
      const beijingMs = dateObj.getTime() + 8 * 60 * 60 * 1000;
      const d = new Date(beijingMs);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }

    function calcConsecutiveDays(allUserReadingDates: Date[], now: Date): number {
      // 去重到"天"级别，按时间倒序排列
      const dateSet = new Set<string>();
      for (const d of allUserReadingDates) {
        dateSet.add(toBeijingDateStr(d));
      }
      const dates = Array.from(dateSet).sort().reverse();
      if (dates.length === 0) return 0;

      const todayStr = toBeijingDateStr(now);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = toBeijingDateStr(yesterday);

      // 必须最近有解读（今天或昨天），才连续
      if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
        // 没有近期解读，但是之前有历史记录
        // 在发送签到提醒的场景下，最近一次解读至少是24小时前了
        // 所以用dates[0]（最近的一次解读日）作为基准计算到那天为止的连续天数
        let consecutive = 1;
        for (let i = 0; i < dates.length - 1; i++) {
          const currentParts = dates[i].split('-').map(Number);
          const nextParts = dates[i + 1].split('-').map(Number);
          const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
          const nextDate = new Date(nextParts[0], nextParts[1] - 1, nextParts[2]);
          const diffDays = Math.round((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            consecutive++;
          } else {
            break;
          }
        }
        return consecutive;
      }

      let consecutive = 1;
      for (let i = 0; i < dates.length - 1; i++) {
        const currentParts = dates[i].split('-').map(Number);
        const nextParts = dates[i + 1].split('-').map(Number);
        const currentDate = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
        const nextDate = new Date(nextParts[0], nextParts[1] - 1, nextParts[2]);
        const diffDays = Math.round((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          consecutive++;
        } else {
          break;
        }
      }
      return consecutive;
    }

    async function runCheckinReminder() {
      if (!dbPool || !SUBSCRIBE_CHECKIN_TMPL_ID) {
        console.log("[签到提醒] 条件不满足，跳过本次执行");
        return;
      }
      try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        console.log(`[签到提醒] 开始扫描 - 检查最后一次解读在24小时前的用户 (24h前: ${twentyFourHoursAgo.toISOString()})`);

        // 找出每个用户最后一次解读时间，及其对应的通知状态
        // 条件：
        //   1) 用户有解读记录且最后一次解读在24小时以上
        //   2) 尚未针对这次"解读周期"发送过通知
        //      （即 last_checkin_notified_at 为 null 或 last_checkin_notified_at < 最后一次解读时间）
        const [usersToNotify] = await dbPool.execute(`
          SELECT u.id, u.openid, u.last_checkin_notified_at,
                 MAX(r.created_at) as last_reading_at
          FROM users u
          INNER JOIN readings r ON r.user_id = u.id
          GROUP BY u.id, u.openid, u.last_checkin_notified_at
          HAVING last_reading_at <= ?
             AND (u.last_checkin_notified_at IS NULL OR u.last_checkin_notified_at < last_reading_at)
        `, [twentyFourHoursAgo]) as any[];

        console.log(`[签到提醒] 发现 ${usersToNotify.length} 个用户需要发送签到提醒`);

        if (usersToNotify.length === 0) {
          return;
        }

        // 获取所有用户的完整解读历史，用于计算连续签到天数
        const [allReadingRows] = await dbPool.execute(
          'SELECT user_id, created_at FROM readings ORDER BY user_id, created_at DESC'
        ) as any[];

        const userReadingDates = new Map<string, Date[]>();
        for (const row of allReadingRows) {
          const uid = String(row.user_id);
          const created = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
          if (!userReadingDates.has(uid)) {
            userReadingDates.set(uid, []);
          }
          userReadingDates.get(uid)!.push(created);
        }

        let totalSent = 0;
        let totalFailed = 0;
        for (const user of usersToNotify) {
          const openid = user.openid;
          if (!openid) continue;

          const userId = String(user.id);
          const datesArr = userReadingDates.get(userId) || [];
          const consecutiveDays = calcConsecutiveDays(datesArr, now);

          const checkinData: Record<string, { value: string }> = {};
          checkinData[CHECKIN_FIELD_REWARD] = { value: "连续签到奖励解读额度" };
          checkinData[CHECKIN_FIELD_TIP] = { value: "今日还未进行塔罗解读，快来探索吧～" };
          checkinData[CHECKIN_FIELD_DAYS] = { value: String(consecutiveDays) };

          console.log(`[签到提醒] 发送给 user=${userId} openid=${openid} 最后解读=${user.last_reading_at} 连续天数=${consecutiveDays}`);

          const ok = await sendSubscribeMessage(openid, SUBSCRIBE_CHECKIN_TMPL_ID, checkinData);
          if (ok.success) {
            totalSent++;
            // 更新用户的"最近一次签到通知时间"，避免重复发送
            try {
              await dbPool.execute('UPDATE users SET last_checkin_notified_at = ? WHERE id = ?', [now, user.id]);
            } catch (updateErr) {
              console.error(`[签到提醒] 更新 last_checkin_notified_at 失败:`, updateErr);
            }
          } else {
            totalFailed++;
            console.log(`[签到提醒] 发送失败 user=${user.id} errcode=${ok.errcode} errmsg=${ok.errmsg}`);
          }
        }
        console.log(`[签到提醒] 执行完毕，成功 ${totalSent} 条，失败 ${totalFailed} 条`);
      } catch (err) {
        console.error("[签到提醒] 定时任务执行异常:", err);
      }
    }

    function loop() {
      const thirtyMinMs = 30 * 60 * 1000;
      console.log(`[签到提醒] 下一次扫描将在 30 分钟后执行`);
      setTimeout(async () => {
        await runCheckinReminder();
        loop();
      }, thirtyMinMs);
    }

    // 服务器启动后立即做一次检查，然后按30分钟循环
    runCheckinReminder().then(() => {
      loop();
    });
  }

  scheduleDailyCheckinReminder();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();