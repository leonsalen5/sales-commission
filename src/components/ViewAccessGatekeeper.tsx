import React, { useState, useEffect, useRef } from 'react';
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
import { fetchAuthoritativeData, subscribeToCloudSystemData } from '../utils/firebaseStorage';
import { SystemData } from '../types';

const AUTH_CACHE_KEY = 'TRAINING_AUTH_CACHE_V2';

function getCachedHashes(): { viewHash?: string; managerHash?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return {};
}

function saveCachedHashes(viewHash?: string, managerHash?: string) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getCachedHashes();
    localStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({
        viewHash: viewHash || existing.viewHash,
        managerHash: managerHash || existing.managerHash,
      })
    );
  } catch (e) {
    // ignore
  }
}

/**
 * Normalizes input from mobile keyboards (especially iOS with Chinese/Pinyin IME):
 * - Converts full-width numbers (０-９) to standard ASCII (0-9)
 * - Converts full-width Latin letters (Ａ-Ｚ, ａ-ｚ) to standard ASCII (A-Z, a-z)
 * - Removes invisible zero-width spaces (\u200B, \u200C, \u200D, \uFEFF)
 * - Normalizes full-width ideographic spaces (\u3000) and non-breaking spaces (\u00A0)
 */
function normalizeInput(str: string): string {
  return str
    .replace(/[\uFF10-\uFF19]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0))
    .replace(/[\uFF21-\uFF3A]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0))
    .replace(/[\uFF41-\uFF5A]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0))
    .replace(/[\u200B-\u200D\uFEFF\u3000\u00A0]/g, '')
    .trim();
}

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

  // Read local cache immediately to eliminate zero-state delay on mobile Safari
  const cached = getCachedHashes();
  const [activeViewHash, setActiveViewHash] = useState<string | undefined>(
    initialViewHash || cached.viewHash || DEFAULT_VIEW_PASSWORD_HASH
  );
  const [activeManagerHash, setActiveManagerHash] = useState<string | undefined>(
    initialManagerHash || cached.managerHash || DEFAULT_ADMIN_PASSWORD_HASH
  );

  // Sync props if updated by parent
  useEffect(() => {
    if (initialViewHash) {
      setActiveViewHash(initialViewHash);
      saveCachedHashes(initialViewHash, undefined);
    }
    if (initialManagerHash) {
      setActiveManagerHash(initialManagerHash);
      saveCachedHashes(undefined, initialManagerHash);
    }
  }, [initialViewHash, initialManagerHash]);

  // Keep a stable ref to onDataLoaded so parent re-renders don't re-trigger subscription
  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;

  // Pre-fetch authoritative cloud state on mount and maintain continuous real-time sync
  useEffect(() => {
    let isMounted = true;

    const handleCloudUpdate = (cloudData: SystemData) => {
      if (!isMounted || !cloudData) return;
      if (cloudData.viewPasswordHash) {
        setActiveViewHash(cloudData.viewPasswordHash);
      }
      if (cloudData.passwordHash) {
        setActiveManagerHash(cloudData.passwordHash);
      }
      saveCachedHashes(cloudData.viewPasswordHash, cloudData.passwordHash);

      if (onDataLoadedRef.current && cloudData.records && cloudData.records.length > 0) {
        onDataLoadedRef.current(cloudData);
      }
    };

    // 1. Initial direct fetch
    fetchAuthoritativeData().then((cloudData) => {
      if (cloudData) handleCloudUpdate(cloudData);
    });

    // 2. Real-time broadcast listener
    const unsubscribe = subscribeToCloudSystemData(
      (cloudData) => {
        handleCloudUpdate(cloudData);
      },
      undefined,
      (err) => {
        console.warn('Realtime gatekeeper listener notice:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = password;
    if (!raw.trim()) {
      setError('请输入浏览密码或管理员密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const trimmed = raw.trim();
      const normalized = normalizeInput(raw);
      const lowerNormalized = normalized.toLowerCase();

      // Collect all plausible hash variations to tolerate mobile IME quirks
      const candidateHashes = new Set<string>();
      candidateHashes.add(await hashString(trimmed));
      if (normalized !== trimmed) {
        candidateHashes.add(await hashString(normalized));
      }
      if (lowerNormalized !== normalized) {
        candidateHashes.add(await hashString(lowerNormalized));
      }

      const evaluateMatches = (vHash?: string, mHash?: string) => {
        let matchedMgr = false;
        let matchedVw = false;

        for (const h of candidateHashes) {
          if (
            (mHash && h === mHash) ||
            h === DEFAULT_ADMIN_PASSWORD_HASH ||
            h === ADMIN_PERMISSION_CODE_HASH
          ) {
            matchedMgr = true;
            break;
          }
          if (
            (vHash && h === vHash) ||
            h === DEFAULT_VIEW_PASSWORD_HASH
          ) {
            matchedVw = true;
          }
        }
        return { matchedMgr, matchedVw };
      };

      let { matchedMgr, matchedVw } = evaluateMatches(activeViewHash, activeManagerHash);

      // If neither matched in memory, refresh fresh authoritative server data
      if (!matchedMgr && !matchedVw) {
        const freshData = await fetchAuthoritativeData();
        if (freshData) {
          if (freshData.viewPasswordHash) {
            setActiveViewHash(freshData.viewPasswordHash);
          }
          if (freshData.passwordHash) {
            setActiveManagerHash(freshData.passwordHash);
          }
          saveCachedHashes(freshData.viewPasswordHash, freshData.passwordHash);

          if (onDataLoadedRef.current) {
            onDataLoadedRef.current(freshData);
          }

          const retryMatches = evaluateMatches(
            freshData.viewPasswordHash || activeViewHash,
            freshData.passwordHash || activeManagerHash
          );
          matchedMgr = retryMatches.matchedMgr;
          matchedVw = retryMatches.matchedVw;
        }
      }

      // 1. Grant FULL Manager Access
      if (matchedMgr) {
        onManagerSuccess();
        return;
      }

      // 2. Grant Visitor Browsing Access (read-only)
      if (matchedVw) {
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
    const raw = adminPermissionCode;
    if (!raw.trim()) {
      setError('请输入管理员密码或专属权限码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const trimmed = raw.trim();
      const normalized = normalizeInput(raw);

      const candidateHashes = new Set<string>();
      candidateHashes.add(await hashString(trimmed));
      if (normalized !== trimmed) {
        candidateHashes.add(await hashString(normalized));
      }

      let matched = false;
      for (const h of candidateHashes) {
        if (
          h === ADMIN_PERMISSION_CODE_HASH ||
          (activeManagerHash && h === activeManagerHash) ||
          h === DEFAULT_ADMIN_PASSWORD_HASH
        ) {
          matched = true;
          break;
        }
      }

      if (!matched) {
        const freshData = await fetchAuthoritativeData();
        if (freshData?.passwordHash) {
          setActiveManagerHash(freshData.passwordHash);
          saveCachedHashes(undefined, freshData.passwordHash);
          if (onDataLoadedRef.current) onDataLoadedRef.current(freshData);

          for (const h of candidateHashes) {
            if (
              h === ADMIN_PERMISSION_CODE_HASH ||
              h === freshData.passwordHash ||
              h === DEFAULT_ADMIN_PASSWORD_HASH
            ) {
              matched = true;
              break;
            }
          }
        }
      }

      if (matched) {
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
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="current-password"
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
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
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
