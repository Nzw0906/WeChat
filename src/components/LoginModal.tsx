import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, User, Lock, MessageCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [loginMethod, setLoginMethod] = useState<"wechat" | "account">("wechat");
  const [accountForm, setAccountForm] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleWeChatLogin = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const returnUrl = `${window.location.origin}/?login=wechat`;
      window.location.href = `/api/auth/wechat?returnUrl=${encodeURIComponent(returnUrl)}`;
    } catch (err) {
      setError("微信登录失败，请稍后重试");
      setIsLoading(false);
    }
  };

  const handleAccountLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm)
      });

      const data = await res.json();

      if (data.success) {
        onLoginSuccess(data);
        onClose();
      } else {
        setError(data.message || "登录失败，请检查用户名和密码");
      }
    } catch (err) {
      setError("登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeChatCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    if (code) {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/auth/wechat/callback?code=${code}`);
        const data = await res.json();
        
        if (data.success) {
          onLoginSuccess(data.user);
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch (err) {
        setError("微信登录失败，请稍后重试");
      } finally {
        setIsLoading(false);
      }
    }
  };

  React.useEffect(() => {
    handleWeChatCallback();
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0c0c0e] rounded-2xl border border-white/10 p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-white">登录</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setLoginMethod("wechat")}
                className={cn(
                  "flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                  loginMethod === "wechat"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-[#16161a] text-zinc-400 hover:bg-white/5"
                )}
              >
                <MessageCircle className="w-5 h-5" />
                微信登录
              </button>
              <button
                onClick={() => setLoginMethod("account")}
                className={cn(
                  "flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                  loginMethod === "account"
                    ? "bg-gold/20 text-gold border border-gold/30"
                    : "bg-[#16161a] text-zinc-400 hover:bg-white/5"
                )}
              >
                <User className="w-5 h-5" />
                账号登录
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {loginMethod === "wechat" ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <MessageCircle className="w-10 h-10 text-green-500" />
                </div>
                <p className="text-zinc-400 mb-6">点击下方按钮使用微信登录</p>
                <button
                  onClick={handleWeChatLogin}
                  disabled={isLoading}
                  className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      跳转中...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-5 h-5" />
                      微信登录
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleAccountLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">用户名</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="text"
                      value={accountForm.username}
                      onChange={e => setAccountForm({ ...accountForm, username: e.target.value })}
                      placeholder="请输入用户名"
                      className="w-full pl-11 pr-4 py-3 bg-[#16161a] border border-white/10 rounded-lg focus:border-gold/50 focus:outline-none transition-colors text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      value={accountForm.password}
                      onChange={e => setAccountForm({ ...accountForm, password: e.target.value })}
                      placeholder="请输入密码"
                      className="w-full pl-11 pr-4 py-3 bg-[#16161a] border border-white/10 rounded-lg focus:border-gold/50 focus:outline-none transition-colors text-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gold text-black rounded-lg font-medium hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    "登录"
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-zinc-500">
                登录即表示同意我们的{" "}
                <button className="text-gold hover:underline">服务条款</button>{" "}
                和{" "}
                <button className="text-gold hover:underline">隐私政策</button>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
