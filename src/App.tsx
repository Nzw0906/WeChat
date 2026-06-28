import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  History as HistoryIcon, 
  Moon, 
  Sun, 
  ArrowLeft, 
  X,
  CreditCard,
  ChevronRight,
  Loader2,
  RefreshCw,
  Users,
  LogOut
} from "lucide-react";
import UserManagement from "./components/UserManagement";
import LoginModal from "./components/LoginModal";
import { tarotCards, TarotCard } from "./data/tarotCards";
import { interpretTarot } from "./services/deepseekService";
import Markdown from "react-markdown";
import { cn } from "./lib/utils";

type View = "home" | "drawing" | "result" | "history" | "admin";

interface ReadingRecord {
  id: number;
  question: string;
  cards: { card: TarotCard; isReversed: boolean }[];
  interpretation: string;
  createdAt: string;
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [question, setQuestion] = useState("");
  const [selectedCards, setSelectedCards] = useState<{ card: TarotCard; isReversed: boolean }[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ReadingRecord[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      setAuthToken(token);
      fetch(`/api/auth/check?token=${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.loggedIn && data.user) {
            setUser(data.user);
          } else {
            localStorage.removeItem("authToken");
            setAuthToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem("authToken");
          setAuthToken(null);
        });
    }
  }, []);

  useEffect(() => {
    if (view === "history") {
      fetchHistory();
    }
  }, [view]);

  const handleLoginSuccess = (data: any) => {
    const { user: userData, token } = data;
    setUser(userData);
    setAuthToken(token);
    localStorage.setItem("authToken", token);
    
    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      setTimeout(action, 100);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuthToken(null);
    setPendingAction(null);
    localStorage.removeItem("authToken");
    if (authToken) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: authToken })
      });
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startReading = () => {
    if (!question.trim()) {
      alert("请输入你想问的问题");
      return;
    }
    
    const token = localStorage.getItem("authToken");
    if (!token) {
      setPendingAction(() => {
        setSelectedCards([]);
        setInterpretation("");
        setView("drawing");
      });
      setIsLoginModalOpen(true);
      return;
    }
    
    setSelectedCards([]);
    setInterpretation("");
    setView("drawing");
  };

  const drawCard = () => {
    if (selectedCards.length >= 3) return;
    
    let randomCard: TarotCard;
    do {
      randomCard = tarotCards[Math.floor(Math.random() * tarotCards.length)];
    } while (selectedCards.some(c => c.card.id === randomCard.id));

    const isReversed = Math.random() > 0.7;
    const newCards = [...selectedCards, { card: randomCard, isReversed }];
    setSelectedCards(newCards);

    if (newCards.length === 3) {
      performInterpretation(newCards);
    }
  };

  const performInterpretation = async (cards: { card: TarotCard; isReversed: boolean }[]) => {
    setIsLoading(true);
    setView("result");
    try {
      const result = await interpretTarot(question, cards);
      setInterpretation(result || "");
      
      await fetch("/api/save-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          cards,
          interpretation: result,
          userId: user?.id || "default_user"
        })
      });
    } catch (err) {
      console.error(err);
      alert("占卜中断，请尝试重新开始");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setQuestion("");
    setSelectedCards([]);
    setInterpretation("");
    setView("home");
  };

  if (view === "admin") {
    return <UserManagement onBack={() => setView("home")} />;
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-300 font-sans selection:bg-gold/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden bg-[#0a0a0c]">
        
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 bg-gold rounded-full blur-[80px]" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-indigo-900 rounded-full blur-[100px]" />
        </div>

        <header className="flex items-center justify-between p-4 sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/5">
          {view !== "home" ? (
            <button onClick={() => setView("home")} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gold" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          <h1 className="text-sm font-display font-bold tracking-[0.2em] text-gold uppercase">塔罗启示录</h1>
          <div className="flex gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-2 py-1 bg-gold/10 rounded-full">
                  <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                    <span className="text-xs text-gold font-bold">{user.nickname?.[0] || "U"}</span>
                  </div>
                  <span className="text-xs text-gold max-w-[60px] truncate">{user.nickname || "用户"}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5 text-zinc-400" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3 py-1 text-xs bg-gold/20 text-gold rounded-full hover:bg-gold/30 transition-colors"
              >
                登录
              </button>
            )}
            <button 
              onClick={() => setView("admin")} 
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
              title="用户管理"
            >
              <Users className="w-5 h-5 text-gold" />
            </button>
            <button 
              onClick={() => setView("history")} 
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
              title="历史记录"
            >
              <HistoryIcon className="w-5 h-5 text-gold" />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.main
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 p-6 flex flex-col"
            >
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
                <div className="relative">
                  <div className="w-40 h-40 rounded-full border-2 border-gold/30 flex items-center justify-center">
                    <Sparkles className="w-16 h-16 text-gold animate-pulse" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                    <Moon className="w-4 h-4 text-gold" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-display font-bold text-white tracking-wide">揭开命运的面纱</h2>
                  <p className="text-sm text-zinc-500">让塔罗牌为你指引方向</p>
                </div>

                <div className="w-full space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="请输入你想问的问题..."
                      className="w-full px-4 py-4 bg-[#16161a] border border-white/10 rounded-xl focus:border-gold/50 focus:outline-none transition-colors text-center"
                      onKeyDown={(e) => e.key === "Enter" && startReading()}
                    />
                    <button 
                      onClick={() => setQuestion("")}
                      disabled={!question}
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors",
                        question ? "text-zinc-400 hover:text-white" : "text-zinc-600"
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={startReading}
                    disabled={!question.trim()}
                    className={cn(
                      "w-full py-4 rounded-xl font-medium tracking-wide transition-all duration-300",
                      question.trim() 
                        ? "bg-gradient-to-r from-gold to-yellow-600 text-black hover:shadow-lg hover:shadow-gold/20" 
                        : "bg-[#16161a] text-zinc-600 cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      开始占卜
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs text-zinc-500">
                  <div className="p-3 bg-[#16161a] rounded-lg">
                    <div className="text-2xl font-display font-bold text-gold">22</div>
                    <div>大阿卡纳</div>
                  </div>
                  <div className="p-3 bg-[#16161a] rounded-lg">
                    <div className="text-2xl font-display font-bold text-gold">56</div>
                    <div>小阿卡纳</div>
                  </div>
                  <div className="p-3 bg-[#16161a] rounded-lg">
                    <div className="text-2xl font-display font-bold text-gold">78</div>
                    <div>总计牌数</div>
                  </div>
                </div>
              </div>
            </motion.main>
          )}

          {view === "drawing" && (
            <motion.main
              key="drawing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 p-6 flex flex-col"
            >
              <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                <p className="text-sm text-zinc-400 text-center">
                  请点击下方区域抽取塔罗牌
                </p>

                <div className="flex gap-4">
                  {[0, 1, 2].map((index) => (
                    <motion.div
                      key={index}
                      className={cn(
                        "w-20 h-28 rounded-lg border-2 transition-all",
                        selectedCards[index] 
                          ? "border-gold/50 bg-[#1a1a2e] flex items-center justify-center" 
                          : "border-white/10 bg-[#16161a] card-back-pattern"
                      )}
                      animate={selectedCards[index] ? { scale: [0, 1.2, 1], rotate: [0, 180, 0] } : {}}
                      transition={{ duration: 0.5 }}
                      onClick={() => !selectedCards[index] && drawCard()}
                    >
                      {selectedCards[index] && (
                        <div className={cn("text-center", selectedCards[index]?.isReversed && "rotate-180")}>
                          <div className="text-xs text-gold mb-1">{selectedCards[index]?.card.suit}</div>
                          <div className="text-lg font-display font-bold text-white">
                            {selectedCards[index]?.card.name}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={drawCard}
                  disabled={selectedCards.length >= 3}
                  className={cn(
                    "px-8 py-3 rounded-lg font-medium transition-all",
                    selectedCards.length >= 3 
                      ? "bg-[#16161a] text-zinc-600 cursor-not-allowed" 
                      : "bg-gold/20 text-gold hover:bg-gold/30"
                  )}
                >
                  {selectedCards.length >= 3 ? "正在解读..." : `抽取第 ${selectedCards.length + 1} 张牌`}
                </button>

                <div className="flex gap-2 text-xs text-zinc-500">
                  <span>已抽取 {selectedCards.length}/3 张牌</span>
                  {selectedCards.some(c => c.isReversed) && (
                    <span className="text-red-400">包含逆位牌</span>
                  )}
                </div>
              </div>
            </motion.main>
          )}

          {view === "result" && (
            <motion.main
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 p-6 overflow-y-auto"
            >
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto" />
                    <p className="text-zinc-400">塔罗正在为你解读...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-2">你的问题</p>
                    <p className="text-lg text-white font-medium">{question}</p>
                  </div>

                  <div className="flex justify-center gap-4">
                    {selectedCards.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                          "w-24 h-32 rounded-lg border border-gold/30 bg-[#1a1a2e] flex flex-col items-center justify-center p-2",
                          item.isReversed && "rotate-180"
                        )}
                      >
                        <div className="text-xs text-gold mb-1">{item.card.suit}</div>
                        <div className="text-sm font-display font-bold text-white text-center leading-tight">
                          {item.card.name}
                        </div>
                        {item.isReversed && (
                          <div className="text-xs text-red-400 mt-1">逆位</div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-[#16161a] rounded-xl p-5 border border-white/5">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-gold" />
                      <h3 className="font-display font-bold text-gold">塔罗启示</h3>
                    </div>
                    <div className="markdown-body text-sm leading-relaxed">
                      <Markdown>{interpretation}</Markdown>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={reset}
                      className="flex-1 py-3 bg-[#16161a] text-zinc-300 rounded-lg font-medium hover:bg-white/5 transition-colors"
                    >
                      重新占卜
                    </button>
                    <button
                      onClick={() => setView("home")}
                      className="flex-1 py-3 bg-gold text-black rounded-lg font-medium hover:bg-gold/90 transition-colors"
                    >
                      返回首页
                    </button>
                  </div>
                </div>
              )}
            </motion.main>
          )}

          {view === "history" && (
            <motion.main
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 p-4 overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display font-bold text-gold flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5" />
                  占卜历史
                </h2>
                <button
                  onClick={fetchHistory}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                  <HistoryIcon className="w-12 h-12 mb-4 opacity-30" />
                  <p>暂无占卜记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((record) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-[#16161a] rounded-xl p-4 border border-white/5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-sm text-white font-medium flex-1 pr-4">
                          {record.question}
                        </p>
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>

                      <div className="flex gap-2 mb-3">
                        {record.cards?.map((item: any, index: number) => (
                          <div
                            key={index}
                            className={cn(
                              "w-12 h-16 rounded border border-white/10 bg-[#0a0a0c] flex flex-col items-center justify-center p-1 text-xs",
                              item.isReversed && "rotate-180"
                            )}
                          >
                            <span className="text-gold text-xs">{item.card?.suit}</span>
                            <span className="text-white font-medium truncate w-full text-center">
                              {item.card?.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {record.interpretation}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.main>
          )}
        </AnimatePresence>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </div>
  );
}