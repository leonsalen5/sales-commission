import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { hashString } from '../utils/crypto';

interface ViewAccessGatekeeperProps {
  currentViewPasswordHash?: string;
  currentManagerPasswordHash?: string;
  onViewSuccess: () => void;
  onManagerSuccess: () => void;
}

export const ViewAccessGatekeeper: React.FC<ViewAccessGatekeeperProps> = ({
  currentViewPasswordHash,
  currentManagerPasswordHash,
  onViewSuccess,
  onManagerSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPermissionCode, setAdminPermissionCode] = useState('');

  const isDefaultInitial = !currentViewPasswordHash;

  const handleUnlockView = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入浏览访问密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const inputHash = await hashString(password);

      // Check 1: Match against configured View Password
      if (currentViewPasswordHash && inputHash === currentViewPasswordHash) {
        onViewSuccess();
        return;
      }

      // Check 2: Match against default initial password "8888" if no custom view password was set
      if (!currentViewPasswordHash) {
        const defaultHash = await hashString('8888');
        if (inputHash === defaultHash) {
          onViewSuccess();
          return;
        }
      }

      // Check 3: If user accidentally entered Manager Password or 1502, also unlock!
      if (currentManagerPasswordHash && inputHash === currentManagerPasswordHash) {
        onManagerSuccess();
        return;
      }
      const code1502Hash = await hashString('1502');
      if (inputHash === code1502Hash) {
        onManagerSuccess();
        return;
      }

      setError('浏览密码不正确，请重新输入');
    } catch (err) {
      setError('密码验证失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPermissionCode.trim()) {
      setError('请输入管理员密码或专属权限码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const inputHash = await hashString(adminPermissionCode);
      const code1502Hash = await hashString('1502');

      if (
        inputHash === code1502Hash ||
        (currentManagerPasswordHash && inputHash === currentManagerPasswordHash)
      ) {
        onManagerSuccess();
        return;
      }

      setError('管理员密码或权限码不正确');
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
                  <h2 className="text-base font-bold text-[#4A4A38]">受限访问 • 请输入浏览密码</h2>
                  <p className="text-xs text-[#8A8A70]">新设备首次打开仅需验证一次</p>
                </div>
              </div>

              <div className="mt-4 p-3.5 bg-[#FAF9F5] border border-[#EBE8DF] rounded-xl text-xs text-[#5A5A40] leading-relaxed">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#8C8C70] shrink-0 mt-0.5" />
                  <div>
                    本系统为内部财务与提成核算平台，包含敏感明细数据。
                    <span className="block mt-1 text-[#8A8A70]">
                      请向机构管理员或财务负责人获取专属浏览访问密码。
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUnlockView} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#5A5A40] mb-1.5">
                    浏览访问密码 <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入浏览访问密码"
                      className="w-full px-4 py-2.5 text-sm bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl focus:outline-none focus:border-[#8C8C70] focus:bg-white focus:ring-2 focus:ring-[#8C8C70]/20 transition-all pr-11 text-[#4A4A38] font-medium"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8A890] hover:text-[#5A5A40] p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-[#8A8A70] bg-[#FAF9F5] px-3 py-2 rounded-lg border border-[#EBE8DF]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>验证成功后本设备将长期有效，下次访问直接进入</span>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-[#8C8C70] hover:bg-[#7A7A60] active:bg-[#686850] rounded-xl shadow-md hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    '正在验证...'
                  ) : (
                    <>
                      <span>解锁进入系统</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Fast switch for Admin */}
              <div className="mt-5 pt-4 border-t border-[#F0EFEA] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminMode(true);
                    setError('');
                  }}
                  className="text-xs text-[#8C8C70] hover:text-[#5A5A40] font-medium hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  我是管理员？使用管理员密码/权限码解锁 →
                </button>
              </div>
            </div>
          ) : (
            /* Admin Direct Unlock Mode */
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-[#F0EFEA]">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#4A4A38]">管理员专属直接解锁</h2>
                  <p className="text-xs text-[#8A8A70]">直接解锁浏览及管理全权</p>
                </div>
              </div>

              <form onSubmit={handleUnlockAdmin} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#5A5A40] mb-1.5">
                    管理员操作密码或专属权限码 <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPermissionCode}
                      onChange={(e) => setAdminPermissionCode(e.target.value)}
                      placeholder="请输入管理员操作密码或专属权限码"
                      className="w-full px-4 py-2.5 text-sm bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl focus:outline-none focus:border-[#8C8C70] focus:bg-white focus:ring-2 focus:ring-[#8C8C70]/20 transition-all pr-11 text-[#4A4A38] font-medium"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8A890] hover:text-[#5A5A40] p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminMode(false);
                      setError('');
                    }}
                    className="flex-1 py-2.5 px-3 text-xs font-bold text-[#8A8A70] bg-[#FAF9F5] hover:bg-[#F0EFEA] rounded-xl transition-colors cursor-pointer"
                  >
                    返回普通浏览验证
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-3 text-xs font-bold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? '验证中...' : '确认解锁全权'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-[#A0A088]">
          培训学校财务管理系统 • 数据安全端到端加密保护
        </div>
      </div>
    </div>
  );
};
