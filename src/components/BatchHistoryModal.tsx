import React, { useState } from 'react';
import { X, History, Trash2, Calendar, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { ImportBatch } from '../types';

interface BatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batches: ImportBatch[];
  onDeleteBatch: (batchId: string) => void;
}

export const BatchHistoryModal: React.FC<BatchHistoryModalProps> = ({
  isOpen,
  onClose,
  batches,
  onDeleteBatch,
}) => {
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A4A40]/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E8E6DF] my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8C8C70] text-white flex items-center justify-center font-bold shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#5A5A40]">历史导入批次管理</h3>
              <p className="text-xs text-[#8A8A70]">
                可查看每次导入的Excel记录，并支持一键删除某次导入的数据
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A8A890] hover:text-[#5A5A40] hover:bg-[#F5F2EB] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-3 max-h-96 overflow-y-auto">
          {batches.length === 0 ? (
            <div className="py-12 text-center text-[#A8A890] text-xs">
              暂无任何导入记录
            </div>
          ) : (
            batches.map((batch) => {
              const uploadDate = new Date(batch.uploadedAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isConfirming = deletingBatchId === batch.id;

              return (
                <div
                  key={batch.id}
                  className="bg-[#F5F2EB] p-4 rounded-xl border border-[#E8E6DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F0EFE9] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#8C8C70]" />
                      <span className="font-bold text-[#4A4A40] text-sm">
                        {batch.fileName}
                      </span>
                      <span className="text-[10px] font-bold bg-[#E8E6DF] text-[#5A5A40] px-2 py-0.5 rounded-full border border-[#D8D6CF]">
                        {batch.month}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#8A8A70] pt-1">
                      <span>导入时间: {uploadDate}</span>
                      <span>数据: <strong className="text-[#4A4A40]">{batch.recordCount}</strong> 笔</span>
                      <span>金额: <strong className="text-[#5E7A56]">¥{batch.totalAmount.toLocaleString()}</strong></span>
                    </div>
                  </div>

                  {/* Delete Button with Inline Confirmation */}
                  {isConfirming ? (
                    <div className="flex items-center gap-2 self-end sm:self-auto bg-rose-50 border border-rose-200 p-1.5 rounded-lg">
                      <span className="text-xs font-semibold text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        确认删除这 {batch.recordCount} 笔数据？
                      </span>
                      <button
                        onClick={() => {
                          onDeleteBatch(batch.id);
                          setDeletingBatchId(null);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors cursor-pointer"
                      >
                        确定删除
                      </button>
                      <button
                        onClick={() => setDeletingBatchId(null)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingBatchId(batch.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors self-end sm:self-auto cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除此批数据
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E8E6DF] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-lg shadow-2xs cursor-pointer"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
