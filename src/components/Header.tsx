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
  Unlock,
  UserCheck,
  Eye,
  LogOut,
  KeyRound,
  Clock,
} from 'lucide-react';

interface HeaderProps {
  onOpenImportModal: () => void;
  onOpenSingleRecordModal: () => void;
  onOpenBatchHistory: () => void;
  onDownloadSample: () => void;
  onExportExcel: () => void;
  onResetData: () => void;
  onOpenChangePasswordModal: () => void;
  onPromoteToManager?: () => void;
  onDemoteToView?: () => void;
  isManagerAuthenticated?: boolean;
  isViewAuthenticated?: boolean;
  hasPassword?: boolean;
  hasViewPassword?: boolean;
  cloudSyncState?: 'synced' | 'syncing' | 'offline';
  batchCount: number;
  recordCount: number;
  lastImportTime?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImportModal,
  onOpenSingleRecordModal,
  onOpenBatchHistory,
  onDownloadSample,
  onExportExcel,
  onResetData,
  onOpenChangePasswordModal,
  onPromoteToManager,
  onDemoteToView,
  isManagerAuthenticated = false,
  isViewAuthenticated = true,
  hasPassword = false,
  hasViewPassword = false,
  cloudSyncState = 'synced',
  batchCount,
  recordCount,
  lastImportTime,
}) => {
  return (
    <header className="bg-white border-b border-[#E8E6DF] sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title & Status Badges */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#8C8C70] flex items-center justify-center text-white shadow-sm shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[#5A5A40] tracking-tight">
                  培训学校提成与奖金统计系统
                </h1>

                {/* Cloud Sync State */}
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
                      ? '云端实时同步'
                      : cloudSyncState === 'syncing'
                      ? '同步中...'
                      : '离线存储'}
                  </span>
                </span>

                {/* Role Status Badge */}
                {isManagerAuthenticated ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200"
                    title="管理员模式：拥有导入、编辑、删除、下载导出、密码管理等全部权限"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>管理员模式 (全部权限)</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50/80 text-amber-800 border-amber-200"
                    title="访客浏览模式：仅支持查看数据，不能上传、删除或下载到本地。点击可切换为管理员。"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                    <span>访客浏览模式 (只读)</span>
                  </span>
                )}

                {/* Fast Mode Switch Button */}
                {isManagerAuthenticated ? (
                  onDemoteToView && (
                    <button
                      type="button"
                      onClick={onDemoteToView}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-[#7A7A60] hover:text-[#4A4A38] bg-[#F5F2EB] hover:bg-[#E8E6DF] border border-[#E8E6DF] transition-colors cursor-pointer"
                      title="点击退出管理员全权，切换为访客只读模式以供安全阅览"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>切为访客</span>
                    </button>
                  )
                ) : (
                  onPromoteToManager && (
                    <button
                      type="button"
                      onClick={onPromoteToManager}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[#5A5A40] hover:text-[#3A3A28] bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer shadow-2xs"
                      title="输入管理员密码或专属权限码切换至管理员模式"
                    >
                      <KeyRound className="w-3 h-3 text-amber-700" />
                      <span>切换至管理员</span>
                    </button>
                  )
                )}

                {/* Server Last Import Time (Accurate to second) */}
                {lastImportTime && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F2EB] text-[#5A5A40] border border-[#E8E6DF]"
                    title="服务器端记录的最后导入时间（精确到秒）"
                  >
                    <Clock className="w-3 h-3 text-[#8A8A70]" />
                    <span>最后导入: <strong className="font-mono text-[#2C2C24] font-semibold">{lastImportTime}</strong></span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8A8A70] mt-0.5">
                月度销售Excel导入 • 销售与教师提成自动核算 • 多档位奖金阶梯计算 • 多月份导出
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Batch History (Viewable by everyone) */}
            <button
              onClick={onOpenBatchHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] relative cursor-pointer"
              title="查看历史导入的批次列表与导入时间"
            >
              <History className="w-3.5 h-3.5 text-[#8A8A70]" />
              <span>导入批次</span>
              {batchCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#8C8C70] text-white">
                  {batchCount}
                </span>
              )}
            </button>

            {/* Administrator Only Features - Hidden in visitor/guest mode */}
            {isManagerAuthenticated && (
              <>
                {/* Download Sample Template */}
                <button
                  onClick={onDownloadSample}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors border cursor-pointer text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] border-[#E8E6DF]"
                  title="下载包含了正确表头格式和示例数据的Excel模板"
                >
                  <Download className="w-3.5 h-3.5 text-[#8A8A70]" />
                  <span>下载模板</span>
                </button>

                {/* Export Excel */}
                <button
                  onClick={onExportExcel}
                  disabled={recordCount === 0}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-all border ${
                    recordCount === 0
                      ? 'bg-[#F5F2EB] text-[#A8A890] border-[#E8E6DF] cursor-not-allowed'
                      : 'bg-[#F0F5EF] text-[#5E7A56] border-[#D4E3D2] hover:bg-[#E8EFE1] shadow-2xs cursor-pointer'
                  }`}
                  title={
                    recordCount === 0
                      ? '暂无销售记录可供导出'
                      : '导出完整核算明细与各类汇总报表Excel表格到本地'
                  }
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出Excel</span>
                </button>

                {/* Single Record Modal */}
                <button
                  onClick={onOpenSingleRecordModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] cursor-pointer"
                  title="手动录入单笔销售记录"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#8C8C70]" />
                  <span>单条补录</span>
                </button>

                {/* Import Excel Button */}
                <button
                  onClick={onOpenImportModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm hover:shadow-xs transition-all cursor-pointer text-white bg-[#8C8C70] hover:bg-[#7A7A60] active:bg-[#686850]"
                  title="导入销售记录Excel表格并自动计算提成与奖金"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>导入销售Excel</span>
                </button>

                {/* Security Settings */}
                <button
                  onClick={onOpenChangePasswordModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] cursor-pointer"
                  title="设置或修改访客浏览密码、管理员操作密码"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8C8C70]" />
                  <span>安全设置</span>
                </button>

                {/* Reset Data */}
                <button
                  onClick={onResetData}
                  className="p-2 text-[#A8A890] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-0.5 cursor-pointer"
                  title="清空所有数据（需确认）"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
