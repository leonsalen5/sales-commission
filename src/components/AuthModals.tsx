import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckCircle2,
  Sliders,
  Shield,
  Smartphone,
  Info,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  hashString,
  DEFAULT_ADMIN_PASSWORD_HASH,
  DEFAULT_VIEW_PASSWORD_HASH,
  ADMIN_PERMISSION_CODE_HASH,
} from '../utils/crypto';
import { fetchAuthoritativeData } from '../utils/firebaseStorage';

interface SetInitialPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetPassword: (passwordHash: string) => Promise<void>;
}

export const SetInitialPasswordModal: React.FC<SetInitialPasswordModalProps> = ({
  isOpen,
  onClose,
  onSetPassword,
}) => {
  const [permissionCode, setPermissionCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPermissionCode('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissionCode.trim()) {
      setError('请输入管理员专属权限码');
      return;
    }

    // Verify Admin Permission Code Hash
    const codeHash = await hashString(permissionCode);
    if (codeHash !== ADMIN_PERMISSION_CODE_HASH) {
      setError('权限码不正确！仅拥有专属权限码的管理者方可设置系统管理密码');
      return;
    }

    if (!password.trim()) {
      setError('请输入新密码');
      return;
    }
    if (password.length < 4) {
      setError('密码长度不能少于4个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const pwdHash = await hashString(password);
      await onSetPassword(pwdHash);
      onClose();
    } catch (err: any) {
      setError(err.message || '密码设置失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E6DF] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#8C8C70]/10 flex items-center justify-center text-[#8C8C70]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#5A5A40]">设置管理员密码</h3>
              <p className="text-xs text-[#8A8A70]">使用管理员专属权限码设置操作密码</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A8A890] hover:text-[#5A5A40] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl text-xs text-[#5A5A40] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#8C8C70] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-[#5A5A40]">权限安全说明：</span>
            输入管理员专属权限码后即可自定义管理密码。设置后将长期生效并同步至云端。
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              管理员专属权限码 <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={permissionCode}
              onChange={(e) => setPermissionCode(e.target.value)}
              placeholder="请输入管理员专属权限码"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              设置新管理密码 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入新密码（至少4位）"
                className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A890] hover:text-[#5A5A40]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              确认新管理密码 <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#8A8A70] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : '确认设置密码'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface VerifyPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPasswordHash?: string;
  expectedHash?: string;
  onOpenChangePassword?: () => void;
}

export const VerifyPasswordModal: React.FC<VerifyPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentPasswordHash,
  expectedHash,
  onOpenChangePassword,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入管理员密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const inputHash = await hashString(password.trim());

      // 1. Matches Master Permission Code Hash -> Grant Full Manager Access
      if (inputHash === ADMIN_PERMISSION_CODE_HASH) {
        onSuccess();
        onClose();
        return;
      }

      // 2. Matches Default Admin Password Hash -> Grant Full Manager Access
      if (inputHash === DEFAULT_ADMIN_PASSWORD_HASH) {
        onSuccess();
        onClose();
        return;
      }

      // 3. Fetch latest cloud state if targetHash is missing or needs checking
      let targetHash = currentPasswordHash || expectedHash || DEFAULT_ADMIN_PASSWORD_HASH;
      if (!targetHash) {
        const cloudData = await fetchAuthoritativeData();
        if (cloudData?.passwordHash) {
          targetHash = cloudData.passwordHash;
        }
      }

      // 4. Matches Active Stored Admin Password Hash
      if (targetHash && inputHash === targetHash) {
        onSuccess();
        onClose();
        return;
      }

      setError('管理员密码不正确！请输入正确的管理密码或专属权限码');
    } catch (err) {
      setError('密码验证失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E8E6DF] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#5A5A40]">管理员权限验证</h3>
              <p className="text-xs text-[#8A8A70]">当前处于访客模式，需验证管理密码</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A8A890] hover:text-[#5A5A40] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3.5 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
          访客仅支持在线查阅数据。执行<strong>导入Excel、单条录入、删除记录、下载导出Excel</strong>或<strong>安全设置</strong>需输入管理员密码或专属权限码进行授权。
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              管理员密码或专属权限码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="请输入管理员密码或专属权限码"
                className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A890] hover:text-[#5A5A40]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          {onOpenChangePassword && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChangePassword();
                }}
                className="text-xs text-[#8C8C70] hover:text-[#5A5A40] hover:underline font-medium cursor-pointer"
              >
                使用专属权限码修改管理密码 →
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#8A8A70] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? '验证中...' : '确认验证并执行'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isManagerAuthenticated: boolean;
  onChangeAdminPassword: (newPasswordHash: string) => Promise<void>;
  onChangeViewPassword: (newViewPasswordHash: string, enabled: boolean) => Promise<void>;
  currentViewPasswordHash?: string;
  hasCustomViewPassword?: boolean;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose,
  isManagerAuthenticated,
  onChangeAdminPassword,
  onChangeViewPassword,
  hasCustomViewPassword = false,
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'admin'>('view');

  // View Password State
  const [viewPassword, setViewPassword] = useState('');
  const [confirmViewPassword, setConfirmViewPassword] = useState('');
  const [viewAuthCode, setViewAuthCode] = useState('');
  const [showViewPwd, setShowViewPwd] = useState(false);

  // Admin Password State
  const [permissionCode, setPermissionCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setViewPassword('');
      setConfirmViewPassword('');
      setViewAuthCode('');
      setPermissionCode('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccessMsg('');
      setShowViewPwd(false);
      setShowAdminPwd(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle View Password Update (Only Manager can update)
  const handleUpdateViewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // If not already authenticated as manager on this device, require manager password or code
    if (!isManagerAuthenticated) {
      if (!viewAuthCode.trim()) {
        setError('请输入管理员密码或专属权限码以授权此修改');
        return;
      }

      const inputAuthHash = await hashString(viewAuthCode.trim());
      const isMasterCode = inputAuthHash === ADMIN_PERMISSION_CODE_HASH;
      const isDefaultAdmin = inputAuthHash === DEFAULT_ADMIN_PASSWORD_HASH;

      const cloudData = await fetchAuthoritativeData();
      const isStoredAdmin = cloudData?.passwordHash && inputAuthHash === cloudData.passwordHash;

      if (!isMasterCode && !isDefaultAdmin && !isStoredAdmin) {
        setError('管理员身份验证失败！仅管理员可创建或修改访客浏览密码');
        return;
      }
    }

    if (!viewPassword.trim()) {
      setError('请输入新的访客浏览密码');
      return;
    }
    if (viewPassword !== confirmViewPassword) {
      setError('两次输入的访客浏览密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const newHash = await hashString(viewPassword.trim());
      await onChangeViewPassword(newHash, true);
      setSuccessMsg('访客浏览密码已成功保存并即时同步至所有设备！');
      setTimeout(() => {
        onClose();
      }, 1300);
    } catch (err: any) {
      setError(err.message || '更新失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Admin Password Update
  const handleUpdateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!permissionCode.trim()) {
      setError('请输入管理员专属权限码');
      return;
    }

    const codeHash = await hashString(permissionCode.trim());
    if (codeHash !== ADMIN_PERMISSION_CODE_HASH) {
      setError('专属权限码不正确，无法修改管理员操作密码');
      return;
    }

    if (!newPassword.trim()) {
      setError('请输入新的管理员密码');
      return;
    }
    if (newPassword.length < 4) {
      setError('新管理密码长度不能少于4个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新管理员密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const newPwdHash = await hashString(newPassword.trim());
      await onChangeAdminPassword(newPwdHash);
      setSuccessMsg('管理员操作密码已成功更新并即时同步至所有设备！');
      setTimeout(() => {
        onClose();
      }, 1300);
    } catch (err: any) {
      setError(err.message || '修改密码失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E6DF] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#8C8C70]/10 flex items-center justify-center text-[#8C8C70]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#5A5A40]">安全与密码设置中心</h3>
              <p className="text-xs text-[#8A8A70]">配置访客浏览密码及管理员操作密码</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A8A890] hover:text-[#5A5A40] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-[#E8E6DF] mt-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('view');
              setError('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-4 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === 'view'
                ? 'text-[#5A5A40] border-b-2 border-[#8C8C70]'
                : 'text-[#8A8A70] hover:text-[#5A5A40]'
            }`}
          >
            🔒 访客浏览密码（仅管理可改）
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-4 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === 'admin'
                ? 'text-[#5A5A40] border-b-2 border-[#8C8C70]'
                : 'text-[#8A8A70] hover:text-[#5A5A40]'
            }`}
          >
            🔑 管理员操作密码设置
          </button>
        </div>

        {activeTab === 'view' ? (
          /* View Password Tab */
          <form onSubmit={handleUpdateViewPassword} className="mt-4 space-y-4">
            <div className="p-3 bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl text-xs text-[#5A5A40] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#5A5A40]">
                <Info className="w-4 h-4 text-[#8C8C70]" />
                <span>访客浏览密码管理说明（仅管理权限可修改）</span>
              </div>
              <p className="text-[#8A8A70] leading-relaxed">
                创建或修改访客浏览密码后，分发给教职员工查看数据。持有该密码的用户<strong className="text-[#5A5A40]">仅能查阅数据与统计，无法上传、删除或下载表格到本地</strong>。
              </p>
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[11px] text-[#8C8C70] font-medium">当前保护状态：</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {hasCustomViewPassword ? '已设置自定义访客浏览密码' : '已启用标准访客浏览保护'}
                </span>
              </div>
            </div>

            {!isManagerAuthenticated && (
              <div>
                <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
                  管理员身份验证（请输入管理密码或专属权限码） <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={viewAuthCode}
                  onChange={(e) => setViewAuthCode(e.target.value)}
                  placeholder="请输入管理员密码或专属权限码以授权"
                  className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all font-mono"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
                设置新访客浏览密码 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showViewPwd ? 'text' : 'password'}
                  value={viewPassword}
                  onChange={(e) => setViewPassword(e.target.value)}
                  placeholder="例如：6688 或自定义访客密码"
                  className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowViewPwd(!showViewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A890] hover:text-[#5A5A40]"
                >
                  {showViewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
                确认新访客浏览密码 <span className="text-rose-500">*</span>
              </label>
              <input
                type={showViewPwd ? 'text' : 'password'}
                value={confirmViewPassword}
                onChange={(e) => setConfirmViewPassword(e.target.value)}
                placeholder="请再次输入新访客浏览密码"
                className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#8A8A70] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? '保存中...' : '保存新访客浏览密码'}
              </button>
            </div>
          </form>
        ) : (
          /* Admin Password Tab */
          <form onSubmit={handleUpdateAdminPassword} className="mt-4 space-y-4">
            <div className="p-3 bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl text-xs text-[#5A5A40] space-y-1.5 leading-relaxed">
              <div className="font-semibold text-[#5A5A40]">管理员密码管理说明：</div>
              <p className="text-[#8A8A70]">
                持有管理员密码者拥有系统全部权限（导入、修改、删除、导出、密码管理）。系统初始化时已重置为默认管理密码。
              </p>
              <p className="text-[#8A8A70]">
                管理者可通过输入专属权限码自行修改管理密码。
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
                管理员专属权限码 <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={permissionCode}
                onChange={(e) => setPermissionCode(e.target.value)}
                placeholder="请输入管理员专属权限码"
                className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all font-mono"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
                设置新管理员密码 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showAdminPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新管理密码（至少4位）"
                  className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPwd(!showAdminPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A890] hover:text-[#5A5A40]"
                >
                  {showAdminPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
                确认新管理员密码 <span className="text-rose-500">*</span>
              </label>
              <input
                type={showAdminPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新管理密码"
                className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#8A8A70] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? '提交中...' : '确认更新管理员密码'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
