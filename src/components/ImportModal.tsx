import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Calendar } from 'lucide-react';
import { SalesRecord } from '../types';
import { parseExcelFile } from '../utils/excel';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (
    month: string,
    fileName: string,
    records: SalesRecord[]
  ) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [targetMonth, setTargetMonth] = useState<string>('');
  const [parsedRecords, setParsedRecords] = useState<SalesRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processSelectedFile(selectedFile);
  };

  const processSelectedFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const batchId = `temp_import_${Date.now()}`;
      const records = parseExcelFile(buffer, batchId, targetMonth);

      if (records.length === 0) {
        setErrorMsg('文件解析为空，或未匹配到标准的销售记录表头（日期、收入、项目、类型、金额、销售人、老师、备注）');
        setParsedRecords([]);
        return;
      }

      setParsedRecords(records);

      // Auto set target month from first record if empty
      if (!targetMonth && records[0]?.month) {
        setTargetMonth(records[0].month);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Excel文件解析失败，请确保格式正确');
      setParsedRecords([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const handleMonthChange = (newMonth: string) => {
    setTargetMonth(newMonth);
    // Update month on preview records
    if (parsedRecords.length > 0) {
      setParsedRecords((prev) =>
        prev.map((r) => ({ ...r, month: newMonth }))
      );
    }
  };

  const handleConfirm = async () => {
    if (!file || parsedRecords.length === 0) return;
    const monthStr = targetMonth.trim() || new Date().toISOString().substring(0, 7);

    setIsUploading(true);
    try {
      const recordsToImport = parsedRecords.map((r) => ({
        ...r,
        month: monthStr,
      }));
      await onConfirmImport(monthStr, file.name, recordsToImport);
      // Reset state & close
      setFile(null);
      setParsedRecords([]);
      setIsUploading(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '导入数据提交失败');
      setIsUploading(false);
    }
  };

  const totalAmount = parsedRecords.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A4A40]/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E8E6DF] my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8C8C70] text-white flex items-center justify-center font-bold shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#5A5A40]">
                导入销售记录Excel表格
              </h3>
              <p className="text-xs text-[#8A8A70]">
                上传Excel (.xlsx / .xls)，支持自动解析并存储到云端
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

        {/* Modal Body */}
        <div className="py-5 space-y-5">
          {/* File Upload Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              file
                ? 'border-[#8C8C70] bg-[#F5F2EB]'
                : 'border-[#E8E6DF] hover:border-[#8C8C70] bg-[#FAF9F5]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <FileSpreadsheet className="w-10 h-10 text-[#8C8C70] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#4A4A40]">
              {file ? file.name : '点击选择或将Excel表格拖拽至此处'}
            </p>
            <p className="text-xs text-[#A8A890] mt-1">
              支持包含 日期、收入、项目、类型、金额、销售人、老师、备注 表头的Excel
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Month Target Configuration */}
          {parsedRecords.length > 0 && (
            <div className="space-y-4 bg-[#F5F2EB] p-4 rounded-xl border border-[#E8E6DF]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#8C8C70]" />
                  <label className="text-xs font-bold text-[#5A5A40]">
                    归属月份设置 (YYYY-MM):
                  </label>
                </div>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-[#E8E6DF] rounded-lg focus:outline-none focus:border-[#8C8C70] font-bold text-[#4A4A40]"
                />
              </div>

              {/* Parsed Summary Card */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-[#E8E6DF]">
                <div>
                  <span className="text-[#8A8A70]">识别条数:</span>
                  <span className="ml-2 font-bold text-[#4A4A40]">
                    {parsedRecords.length} 笔销售记录
                  </span>
                </div>
                <div>
                  <span className="text-[#8A8A70]">累计金额:</span>
                  <span className="ml-2 font-bold text-[#5E7A56]">
                    ¥{totalAmount.toLocaleString()} 元
                  </span>
                </div>
              </div>

              {/* Data Preview Table */}
              <div>
                <p className="text-[11px] font-bold text-[#5A5A40] mb-1.5">
                  解析前5条数据预览:
                </p>
                <div className="overflow-x-auto max-h-36 border border-[#E8E6DF] rounded-lg bg-white">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#F5F2EB] text-[#8A8A70] font-semibold border-b border-[#E8E6DF]">
                      <tr>
                        <th className="p-1.5">日期</th>
                        <th className="p-1.5">收入</th>
                        <th className="p-1.5">项目</th>
                        <th className="p-1.5">类型</th>
                        <th className="p-1.5 text-right">金额</th>
                        <th className="p-1.5">销售人</th>
                        <th className="p-1.5">老师</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EEE6] text-[#4A4A40]">
                      {parsedRecords.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td className="p-1.5">{r.date}</td>
                          <td className="p-1.5 font-semibold">{r.incomeName}</td>
                          <td className="p-1.5">{r.project}</td>
                          <td className="p-1.5">{r.type}</td>
                          <td className="p-1.5 text-right font-semibold">
                            ¥{r.amount}
                          </td>
                          <td className="p-1.5">{r.salesperson}</td>
                          <td className="p-1.5">{r.teacher || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-[#E8E6DF] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#8A8A70] hover:bg-[#F5F2EB] rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={parsedRecords.length === 0 || isUploading}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white rounded-lg transition-all shadow-2xs ${
              parsedRecords.length > 0 && !isUploading
                ? 'bg-[#8C8C70] hover:bg-[#7A7A60]'
                : 'bg-[#A8A890] cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <span>正在保存并同步...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>确认导入并提交存储</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
