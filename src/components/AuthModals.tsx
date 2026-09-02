import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, ShieldCheck, X, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { hashString } from '../utils/crypto';

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

    // Verify Admin Permission Code (1502)
    const codeHash = await hashString(permissionCode);
    const expectedCodeHash = await hashString('1502');

    if (codeHash !== expectedCodeHash) {
      setError('权限码不正确！仅拥有专属权限码的管理者方可设置系统密码');
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
              <h3 className="text-base font-bold text-[#5A5A40]">首次初始化管理员密码</h3>
              <p className="text-xs text-[#8A8A70]">系统首次使用需由管理者输入专属权限码设置密码</p>
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
            本系统仅需管理者在首次使用时输入专属权限码设置密码。设置后将长期有效，普通人员无需做任何密码相关操作。
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
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              设置管理员操作密码 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码（至少4位）"
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
              确认管理员密码 <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入设置的密码"
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
              {isSubmitting ? '保存中...' : '确认设置并永久授权'}
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
  currentPasswordHash: string;
  onSuccess: () => void;
  onOpenChangePassword?: () => void;
}

export const VerifyPasswordModal: React.FC<VerifyPasswordModalProps> = ({
  isOpen,
  onClose,
  currentPasswordHash,
  onSuccess,
  onOpenChangePassword,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAuth, setRememberAuth] = useState(true);
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
    if (!password) {
      setError('请输入操作密码');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const inputHash = await hashString(password);
      if (inputHash === currentPasswordHash) {
        onSuccess();
        onClose();
      } else {
        setError('密码不正确，请重新输入');
      }
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
            <div className="w-10 h-10 rounded-xl bg-[#8C8C70]/10 flex items-center justify-center text-[#8C8C70]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#5A5A40]">管理员身份验证</h3>
              <p className="text-xs text-[#8A8A70]">请输入密码以执行管理操作</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A8A890] hover:text-[#5A5A40] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              系统操作密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入您的操作密码"
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
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-[#8A8A70] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                验证通过后本设备长期有效，无需每日重输
              </span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          {onOpenChangePassword && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChangePassword();
                }}
                className="text-xs text-[#8C8C70] hover:text-[#5A5A40] hover:underline font-medium cursor-pointer"
              >
                忘记密码？使用专属权限码修改密码 →
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
              {isSubmitting ? '验证中...' : '确认验证'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (newPasswordHash: string) => Promise<void>;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onChangePassword,
}) => {
  const [permissionCode, setPermissionCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPermissionCode('');
      setNewPassword('');
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

    // Verify Permission Code (1502) via encrypted hash comparison
    const codeHash = await hashString(permissionCode);
    const expectedCodeHash = await hashString('1502');

    if (codeHash !== expectedCodeHash) {
      setError('权限码不正确，无法修改密码');
      return;
    }

    if (!newPassword.trim()) {
      setError('请输入新密码');
      return;
    }
    if (newPassword.length < 4) {
      setError('新密码长度不能少于4个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const newPwdHash = await hashString(newPassword);
      await onChangePassword(newPwdHash);
      onClose();
    } catch (err: any) {
      setError(err.message || '修改密码失败，请重试');
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
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#5A5A40]">修改/重置系统操作密码</h3>
              <p className="text-xs text-[#8A8A70]">需要校验专属管理权限码方可进行修改</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A8A890] hover:text-[#5A5A40] hover:bg-[#F5F2EB] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              管理权限码 <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={permissionCode}
              onChange={(e) => setPermissionCode(e.target.value)}
              placeholder="请输入管理员专属权限码"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F5] border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] focus:bg-white transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1">
              新操作密码 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              确认新密码 <span className="text-rose-500">*</span>
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
              {isSubmitting ? '提交中...' : '确认修改并授权'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

