import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Server,
  HardDrive,
  GitMerge,
  ArrowRight,
  Clock,
  FileSpreadsheet,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { SystemData } from '../types';

interface SyncConflictModalProps {
  isOpen: boolean;
  serverData: SystemData;
  localData: SystemData;
  onKeepServer: () => void;
  onKeepLocal: () => void;
  onMergeBoth: () => void;
  onClose?: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  serverData,
  localData,
  onKeepServer,
  onKeepLocal,
  onMergeBoth,
}) => {
  if (!isOpen) return null;

  const serverMonths = useMemo(() => {
    const set = new Set<string>();
    serverData.records?.forEach((r) => r.month && set.add(r.month));
    serverData.batches?.forEach((b) => b.month && set.add(b.month));
    return Array.from(set).sort().reverse();
  }, [serverData]);

  const localMonths = useMemo(() => {
    const set = new Set<string>();
    localData.records?.forEach((r) => r.month && set.add(r.month));
    localData.batches?.forEach((b) => b.month && set.add(b.month));
    return Array.from(set).sort().reverse();
  }, [localData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FAF8F5] border border-[#E2DDD5] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden text-[#2C2C24]">
        {/* Header */}
        <div className="px-6 py-5 bg-[#F5F1EA] border-b border-[#E8E3DA] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#2C2C24] flex items-center gap-2">
              服务器端数据更新提醒
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 border border-amber-200">
                时间冲突检测
              </span>
            </h3>
            <p className="text-xs text-[#7A7A66] mt-0.5">
              检测到服务器端存在更新的导入记录。为保障数据完整性，请管理员选择要保留的数据版本。
            </p>
          </div>
        </div>

        {/* Content Comparison */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server Data Card */}
            <div className="bg-white rounded-xl p-4 border-2 border-emerald-500/40 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                服务器端（较新推荐）
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-[#2C2C24]">服务器端数据</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-1.5 text-[#5A5A48]">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#8A8A70]">最后导入时间：</span>
                    <span className="font-semibold text-emerald-800 ml-1">
                      {serverData.lastImportTime || '未记录精确时间'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[#5A5A48]">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>批次数量：</span>
                  <span className="font-semibold text-[#2C2C24] ml-auto">
                    {serverData.batches?.length || 0} 批
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#5A5A48]">
                  <span>销售记录明细：</span>
                  <span className="font-bold text-emerald-700">
                    {serverData.records?.length || 0} 条
                  </span>
                </div>

                <div className="pt-2 border-t border-[#F0EBE1] text-[11px] text-[#7A7A66]">
                  <span>涉及月份：</span>
                  <span className="text-[#4A4A38] ml-1 font-mono">
                    {serverMonths.length > 0 ? serverMonths.slice(0, 4).join(', ') + (serverMonths.length > 4 ? ' 等' : '') : '暂无'}
                  </span>
                </div>
              </div>
            </div>

            {/* Local Data Card */}
            <div className="bg-white rounded-xl p-4 border border-[#E2DDD5] shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-slate-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                当前本地设备
              </div>
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-4 h-4 text-slate-600" />
                <h4 className="text-sm font-bold text-[#2C2C24]">本地缓存数据</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-1.5 text-[#5A5A48]">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#8A8A70]">本地记录时间：</span>
                    <span className="font-semibold text-slate-700 ml-1">
                      {localData.lastImportTime || '未记录精确时间'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[#5A5A48]">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>批次数量：</span>
                  <span className="font-semibold text-[#2C2C24] ml-auto">
                    {localData.batches?.length || 0} 批
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#5A5A48]">
                  <span>销售记录明细：</span>
                  <span className="font-bold text-slate-700">
                    {localData.records?.length || 0} 条
                  </span>
                </div>

                <div className="pt-2 border-t border-[#F0EBE1] text-[11px] text-[#7A7A66]">
                  <span>涉及月份：</span>
                  <span className="text-[#4A4A38] ml-1 font-mono">
                    {localMonths.length > 0 ? localMonths.slice(0, 4).join(', ') + (localMonths.length > 4 ? ' 等' : '') : '暂无'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              请谨慎选择：如果使用其他设备或浏览器（例如谷歌浏览器）刚导入过数据，建议选择<strong>【保留服务器端数据】</strong>；若两边都有新增批次，建议选择<strong>【合并两者数据】</strong>。浏览模式下仅可查看，禁止向服务器同步。
            </p>
          </div>
        </div>

        {/* Action Options */}
        <div className="px-6 py-4 bg-[#F2EDE4] border-t border-[#E8E3DA] flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {/* Option 1: Keep Server Data (Recommended) */}
          <button
            type="button"
            onClick={onKeepServer}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 shadow-sm transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>保留服务器端数据（推荐）</span>
          </button>

          {/* Option 2: Merge Both */}
          <button
            type="button"
            onClick={onMergeBoth}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 transition-all cursor-pointer"
          >
            <GitMerge className="w-4 h-4 text-sky-700" />
            <span>智能合并两者数据</span>
          </button>

          {/* Option 3: Keep Local and Overwrite */}
          <button
            type="button"
            onClick={onKeepLocal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-amber-900 bg-white hover:bg-amber-50 border border-amber-300 transition-all cursor-pointer"
          >
            <span>保留本地数据覆盖服务器</span>
          </button>
        </div>
      </div>
    </div>
  );
};
