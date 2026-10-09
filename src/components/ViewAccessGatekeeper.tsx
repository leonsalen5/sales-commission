import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Loader2,
  UserCheck,
  Shield,
  HelpCircle,
} from 'lucide-react';
import {
  hashString,
  DEFAULT_ADMIN_PASSWORD_HASH,
  DEFAULT_VIEW_PASSWORD_HASH,
  ADMIN_PERMISSION_CODE_HASH,
} from '../utils/crypto';
import { fetchAuthoritativeData } from '../utils/firebaseStorage';
import { SystemData } from '../types';

interface ViewAccessGatekeeperProps {
  currentViewPasswordHash?: string;
  currentManagerPasswordHash?: string;
  onViewSuccess: () => void;
  onManagerSuccess: () => void;
  onDataLoaded?: (data: SystemData) => void;
}

export const ViewAccessGatekeeper: React.FC<ViewAccessGatekeeperProps> = ({
  currentViewPasswordHash: initialViewHash,
  currentManagerPasswordHash: initialManagerHash,
  onViewSuccess,
  onManagerSuccess,
  onDataLoaded,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPermissionCode, setAdminPermissionCode] = useState('');

  const [activeViewHash, setActiveViewHash] = useState<string | undefined>(
    initialViewHash || DEFAULT_VIEW_PASSWORD_HASH
  );
  const [activeManagerHash, setActiveManagerHash] = useState<string | undefined>(
    initialManagerHash || DEFAULT_ADMIN_PASSWORD_HASH
  );

  // Sync props if updated by parent
  useEffect(() => {
    if (initialViewHash) setActiveViewHash(initialViewHash);
    if (initialManagerHash) setActiveManagerHash(initialManagerHash);
  }, [initialViewHash, initialManagerHash]);

  // Fast pre-fetch authoritative cloud state on mount (vital for fresh devices like Safari iOS)
  useEffect(() => {
    let isMounted = true;
    fetchAuthoritativeData().then((cloudData) => {
      if (!isMounted || !cloudData) return;
      if (cloudData.viewPasswordHash) setActiveViewHash(cloudData.viewPasswordHash);
      if (cloudData.passwordHash) setActiveManagerHash(cloudData.passwordHash);
      if (onDataLoaded) onDataLoaded(cloudData);
    });
    return () => {
      isMounted = false;
    };
  }, [onDataLoaded]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setError('请输入浏览密码或管理员密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const inputHash = await hashString(trimmed);
      let viewHash = activeViewHash || DEFAULT_VIEW_PASSWORD_HASH;
      let mgrHash = activeManagerHash || DEFAULT_ADMIN_PASSWORD_HASH;

      // If hashes not yet ready from prop, fetch live state from server/cloud immediately
      if (!viewHash || !mgrHash) {
        const freshData = await fetchAuthoritativeData();
        if (freshData) {
          if (freshData.viewPasswordHash) {
            viewHash = freshData.viewPasswordHash;
            setActiveViewHash(freshData.viewPasswordHash);
          }
          if (freshData.passwordHash) {
            mgrHash = freshData.passwordHash;
            setActiveManagerHash(freshData.passwordHash);
          }
          if (onDataLoaded) onDataLoaded(freshData);
        }
      }

      // 1. Matches configured or default Manager Password Hash -> Grant FULL Manager Access!
      if ((mgrHash && inputHash === mgrHash) || inputHash === DEFAULT_ADMIN_PASSWORD_HASH) {
        onManagerSuccess();
        return;
      }

      // 2. Matches Master Admin Permission Code Hash -> Grant FULL Manager Access!
      if (inputHash === ADMIN_PERMISSION_CODE_HASH) {
        onManagerSuccess();
        return;
      }

      // 3. Matches configured or default View Password Hash -> Grant Visitor Browsing Access (read-only)!
      if ((viewHash && inputHash === viewHash) || inputHash === DEFAULT_VIEW_PASSWORD_HASH) {
        onViewSuccess();
        return;
      }

      setError('密码不正确！请输入正确的访客浏览密码或管理员密码');
    } catch (err) {
      setError('密码验证失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockAdminByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPermissionCode.trim()) {
      setError('请输入管理员密码或专属权限码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const inputHash = await hashString(adminPermissionCode.trim());

      // Master permission code hash check
      if (inputHash === ADMIN_PERMISSION_CODE_HASH) {
        onManagerSuccess();
        return;
      }

      let mgrHash = activeManagerHash || DEFAULT_ADMIN_PASSWORD_HASH;
      if (!mgrHash) {
        const freshData = await fetchAuthoritativeData();
        if (freshData?.passwordHash) {
          mgrHash = freshData.passwordHash;
          setActiveManagerHash(freshData.passwordHash);
          if (onDataLoaded) onDataLoaded(freshData);
        }
      }

      // Matches Manager Password Hash
      if ((mgrHash && inputHash === mgrHash) || inputHash === DEFAULT_ADMIN_PASSWORD_HASH) {
        onManagerSuccess();
        return;
      }

      setError('管理员密码或权限码不正确，请重新输入');
    } catch (err) {
      setError('验证失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5EE] flex flex-col justify-center items-center p-4 selection:bg-[#8C8C70] selection:text-white">
      {/* Background Decorative Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#E8E6DF] blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#E5E2D8] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Top Branding Card */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#8C8C70] text-white shadow-md mb-3.5 ring-4 ring-white">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#4A4A38] tracking-tight">
            培训学校提成与奖金统计系统
          </h1>
          <p className="text-xs sm:text-sm text-[#8A8A70] mt-1 font-medium">
            内部财务核算与数据统计平台
          </p>
        </div>

        {/* Main Access Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E8E6DF] p-6 sm:p-8 backdrop-blur-sm">
          {!isAdminMode ? (
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-[#F0EFEA]">
                <div className="w-10 h-10 rounded-xl bg-[#8C8C70]/10 flex items-center justify-center text-[#8C8C70] shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#4A4A38]">受限访问 • 请输入密码进入</h2>
                  <p className="text-xs text-[#8A8A70]">输入浏览密码或管理员密码即可进入</p>
                </div>
              </div>

              {/* Permission description callout */}
              <div className="mt-4 p-3.5 bg-[#FAF9F5] border border-[#EBE8DF] rounded-xl text-xs text-[#5A5A40] space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#8C8C70] shrink-0 mt-0.5" />
                  <div className="font-semibold text-[#5A5A40]">双权限安全访问模式：</div>
                </div>
                <div className="pl-6 space-y-1.5 text-[11px] text-[#7A7A60]">
                  <div className="flex items-baseline gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 self-center" />
                    <span>
                      <strong className="text-[#5A5A40]">访客浏览密码</strong>：仅能查看数据与报表，禁止上传、删除或下载到本地。
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8C8C70] shrink-0 self-center" />
                    <span>
                      <strong className="text-[#5A5A40]">管理员密码</strong>：拥有全部权限（导入、修改、删除、导出、密码设置）。可使用初始管理密码或权限码登录。
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUnlock} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#5A5A40] mb-1.5">
                    访问密码（浏览密码或管理密码）
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="请输入浏览密码或管理密码"
                      className="w-full px-4 py-2.5 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A890] hover:text-[#5A5A40] p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] active:bg-[#686850] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>正在安全验证...</span>
                    </>
                  ) : (
                    <>
                      <span>进入系统</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminMode(true);
                      setError('');
                    }}
                    className="text-xs text-[#8C8C70] hover:text-[#5A5A40] hover:underline font-medium cursor-pointer"
                  >
                    管理者忘记密码？使用专属权限码直连 →
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-[#F0EFEA]">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#4A4A38]">管理员通道 • 权限码直连</h2>
                  <p className="text-xs text-[#8A8A70]">输入管理员密码或专属权限码即可直通管理</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
                管理员专属权限码可直接解锁最高管理员权限，进入后可重新修改管理员密码与访客浏览密码。
              </div>

              <form onSubmit={handleUnlockAdminByCode} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#5A5A40] mb-1.5">
                    管理员密码或专属权限码
                  </label>
                  <input
                    type="password"
                    value={adminPermissionCode}
                    onChange={(e) => {
                      setAdminPermissionCode(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="请输入管理密码或专属权限码"
                    className="w-full px-4 py-2.5 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all font-mono"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminMode(false);
                      setError('');
                    }}
                    className="w-1/3 py-2.5 text-xs font-semibold text-[#8A8A70] hover:bg-[#F5F2EB] rounded-xl transition-colors cursor-pointer"
                  >
                    返回普通登录
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 py-2.5 px-4 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>管理员直通验证</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-[#A8A890]">
          培训学校提成与奖金统计系统 • 多端云同步保障
        </div>
      </div>
    </div>
  );
};
