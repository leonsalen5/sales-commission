import React from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  History,
  RotateCcw,
  Sparkles,
  Wifi,
  PlusCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface HeaderProps {
  onOpenImportModal: () => void;
  onOpenSingleRecordModal: () => void;
  onOpenBatchHistory: () => void;
  onDownloadSample: () => void;
  onExportExcel: () => void;
  onResetData: () => void;
  onOpenChangePasswordModal: () => void;
  onLockView?: () => void;
  isManagerAuthenticated?: boolean;
  isViewAuthenticated?: boolean;
  hasPassword?: boolean;
  hasViewPassword?: boolean;
  cloudSyncState?: 'synced' | 'syncing' | 'offline';
  batchCount: number;
  recordCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImportModal,
  onOpenSingleRecordModal,
  onOpenBatchHistory,
  onDownloadSample,
  onExportExcel,
  onResetData,
  onOpenChangePasswordModal,
  onLockView,
  isManagerAuthenticated = false,
  isViewAuthenticated = true,
  hasPassword = false,
  hasViewPassword = false,
  cloudSyncState = 'synced',
  batchCount,
  recordCount,
}) => {
  return (
    <header className="bg-white border-b border-[#E8E6DF] sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title & Badge */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#8C8C70] flex items-center justify-center text-white shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[#5A5A40] tracking-tight">
                  培训学校提成与奖金统计系统
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    cloudSyncState === 'synced'
                      ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200'
                      : cloudSyncState === 'syncing'
                      ? 'bg-amber-50/80 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                  title={
                    cloudSyncState === 'synced'
                      ? 'Firebase 云端数据库已实时连接，所有分享者同步查阅'
                      : cloudSyncState === 'syncing'
                      ? '正在同步数据至云端...'
                      : '当前处于离线模式'
                  }
                >
                  <Wifi
                    className={`w-3.5 h-3.5 ${
                      cloudSyncState === 'synced'
                        ? 'text-emerald-600 animate-pulse'
                        : cloudSyncState === 'syncing'
                        ? 'text-amber-600 animate-spin'
                        : 'text-rose-500'
                    }`}
                  />
                  <span>
                    {cloudSyncState === 'synced'
                      ? '云端实时同步中'
                      : cloudSyncState === 'syncing'
                      ? '同步中...'
                      : '离线存储'}
                  </span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    isManagerAuthenticated
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF]'
                  }`}
                  title={
                    isManagerAuthenticated
                      ? '当前设备已获得管理全权（导入、编辑、删除免密码）'
                      : '普通浏览模式，管理操作需管理员密码或权限码'
                  }
                >
                  {isManagerAuthenticated ? (
                    <>
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      管理员已授权
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-[#8C8C70]" />
                      受限浏览中
                    </>
                  )}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50/80 text-emerald-800 border-emerald-200"
                  title="全站浏览密码保护已生效，新设备必须输入密码方可查看"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  浏览密码已保护
                </span>
              </div>
              <p className="text-xs text-[#8A8A70] mt-0.5">
                月度销售Excel导入 • 销售与教师提成自动核算 • 多档位奖金阶梯计算 • 多月份导出
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={onDownloadSample}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] cursor-pointer"
              title="下载包含了正确表头格式和示例数据的Excel模板"
            >
              <Download className="w-3.5 h-3.5 text-[#8A8A70]" />
              下载Excel模板
            </button>

            <button
              onClick={onOpenBatchHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] relative cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#8A8A70]" />
              导入批次记录
              {batchCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#8C8C70] text-white">
                  {batchCount}
                </span>
              )}
            </button>

            <button
              onClick={onExportExcel}
              disabled={recordCount === 0}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-all border ${
                recordCount > 0
                  ? 'bg-[#F0F5EF] text-[#5E7A56] border-[#D4E3D2] hover:bg-[#E8EFE1] shadow-2xs cursor-pointer'
                  : 'bg-[#F5F2EB] text-[#A8A890] border-[#E8E6DF] cursor-not-allowed'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              导出Excel表格
            </button>

            <button
              onClick={onOpenSingleRecordModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] cursor-pointer"
              title="手动录入单笔销售记录"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#8C8C70]" />
              单条补录
            </button>

            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] active:bg-[#686850] rounded-lg shadow-sm hover:shadow-xs transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              导入销售记录Excel
            </button>

            <button
              onClick={onOpenChangePasswordModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] cursor-pointer"
              title="设置或修改全站浏览密码、管理员操作密码"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#8C8C70]" />
              安全与密码设置
            </button>

            <button
              onClick={onResetData}
              className="p-2 text-[#A8A890] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
              title="清空所有数据"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
