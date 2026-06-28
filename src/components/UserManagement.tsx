import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Users, 
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Camera,
  Trash
} from "lucide-react";
import { cn } from "../lib/utils";

interface User {
  id: string;
  openid: string;
  unionid?: string;
  nickname: string;
  avatar?: string;
  level: string;
  readings: number;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const LEVELS = ["入门", "学徒", "进阶", "资深", "大师"];

export default function UserManagement({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 1 });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ nickname: "", level: "", avatar: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchUsers = async (page: number = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=${pagination.limit}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({ nickname: user.nickname, level: user.level, avatar: user.avatar || "" });
    setAvatarPreview(user.avatar || null);
    setAvatarFile(null);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setAvatarFile(file);
    setEditForm({ ...editForm, avatar: "" });
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarDelete = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditForm({ ...editForm, avatar: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      let avatarUrl = editForm.avatar;

      if (avatarFile) {
        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const uploadRes = await fetch("/api/admin/upload-avatar", {
          method: "POST",
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          avatarUrl = uploadData.avatarUrl;
        }
        setUploadingAvatar(false);
      } else if (avatarPreview === null && !editForm.avatar) {
        avatarUrl = "";
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, avatar: avatarUrl })
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === editingUser.id ? data.user : u));
        setEditingUser(null);
        setAvatarPreview(null);
        setAvatarFile(null);
      }
    } catch (err) {
      console.error(err);
      setUploadingAvatar(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== userId));
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(user => 
    user.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.openid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      "入门": "bg-gray-500",
      "学徒": "bg-green-500",
      "进阶": "bg-blue-500",
      "资深": "bg-purple-500",
      "大师": "bg-yellow-500"
    };
    return colors[level] || "bg-gray-500";
  };

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-300">
      <div className="max-w-4xl mx-auto min-h-screen flex flex-col">
        <header className="flex items-center justify-between p-4 sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/5">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gold" />
          </button>
          <h1 className="text-lg font-display font-bold tracking-[0.15em] text-gold flex items-center gap-2">
            <Users className="w-5 h-5" />
            用户管理
          </h1>
          <div className="w-9" />
        </header>

        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="搜索用户昵称或 OpenID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#16161a] border border-white/10 rounded-lg focus:border-gold/50 focus:outline-none transition-colors text-sm"
            />
          </div>

          <div className="bg-[#0c0c0e] rounded-lg border border-white/5 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-black/30 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <div className="col-span-3">用户信息</div>
              <div className="col-span-2">等级</div>
              <div className="col-span-2">占卜次数</div>
              <div className="col-span-3">创建时间</div>
              <div className="col-span-2 text-right">操作</div>
            </div>

            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 text-gold animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂无用户数据</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={cn(
                      "grid grid-cols-12 gap-2 px-4 py-4 border-b border-white/5 last:border-b-0",
                      editingUser?.id === user.id && "bg-gold/5"
                    )}
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full bg-[#1a1a2e] flex items-center justify-center overflow-hidden relative group",
                            editingUser?.id === user.id && "cursor-pointer"
                          )}
                          onClick={() => editingUser?.id === user.id && fileInputRef.current?.click()}
                        >
                          {editingUser?.id === user.id && avatarPreview ? (
                            <img src={avatarPreview} alt={user.nickname} className="w-full h-full object-cover" />
                          ) : editingUser?.id === user.id && !avatarPreview ? (
                            <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
                              <Camera className="w-5 h-5 text-zinc-500" />
                            </div>
                          ) : user.avatar ? (
                            <img src={user.avatar} alt={user.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <Crown className="w-5 h-5 text-gold" />
                          )}
                          {editingUser?.id === user.id && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Camera className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                        {editingUser?.id === user.id && (avatarPreview || editForm.avatar) && (
                          <button
                            onClick={handleAvatarDelete}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                            title="删除头像"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleAvatarSelect}
                      />
                      <div className="min-w-0">
                        {editingUser?.id === user.id ? (
                          <input
                            type="text"
                            value={editForm.nickname}
                            onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                            className="bg-[#16161a] border border-white/10 rounded px-2 py-1 text-sm w-full focus:border-gold/50 focus:outline-none"
                          />
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate">{user.nickname}</p>
                            <p className="text-xs text-zinc-500 truncate">{user.openid.slice(0, 12)}...</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center">
                      {editingUser?.id === user.id ? (
                        <select
                          value={editForm.level}
                          onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                          className="bg-[#16161a] border border-white/10 rounded px-2 py-1 text-sm focus:border-gold/50 focus:outline-none"
                        >
                          {LEVELS.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn("px-2 py-1 rounded text-xs font-medium", getLevelColor(user.level))}>
                          {user.level}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center">
                      {editingUser?.id === user.id ? (
                        <input
                          type="number"
                          value={user.readings}
                          readOnly
                          className="bg-[#16161a] border border-white/10 rounded px-2 py-1 text-sm w-20 focus:border-gold/50 focus:outline-none opacity-50"
                        />
                      ) : (
                        <span className="text-sm">{user.readings}</span>
                      )}
                    </div>

                    <div className="col-span-3 flex items-center">
                      <span className="text-xs text-zinc-500">{formatDate(user.createdAt)}</span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2">
                      {editingUser?.id === user.id ? (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={uploadingAvatar}
                            className={cn(
                              "p-2 rounded transition-colors",
                              uploadingAvatar ? "text-zinc-600 cursor-not-allowed" : "text-green-500 hover:bg-green-500/10"
                            )}
                            title={uploadingAvatar ? "上传中..." : "保存"}
                          >
                            {uploadingAvatar ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(null);
                              setAvatarPreview(null);
                              setAvatarFile(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }}
                            className="p-2 text-zinc-500 hover:bg-white/5 rounded transition-colors"
                            title="取消"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-gold hover:bg-gold/10 rounded transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {!loading && filteredUsers.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">
                共 {pagination.total} 条记录
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pagination.page > 1 && fetchUsers(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className={cn(
                    "p-2 rounded transition-colors",
                    pagination.page <= 1 ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:bg-white/5"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 bg-[#16161a] rounded">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => pagination.page < pagination.pages && fetchUsers(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className={cn(
                    "p-2 rounded transition-colors",
                    pagination.page >= pagination.pages ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:bg-white/5"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#0c0c0e] rounded-xl border border-white/10 p-6 w-full max-w-sm"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Trash2 className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">确认删除</h3>
                  <p className="text-zinc-400 text-sm mb-6">
                    删除后无法恢复，确定要删除此用户吗？
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 py-2 bg-[#16161a] text-zinc-300 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleDelete(deleteConfirm)}
                      className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}