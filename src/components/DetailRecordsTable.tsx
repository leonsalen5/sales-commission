import React, { useState, useMemo, useEffect } from 'react';
import { SalesRecord, SalespersonConfig } from '../types';
import { calculateRecordDetails, isMissingSalesperson } from '../utils/calculations';
import { Search, Filter, ListCheck, ArrowUpDown, Pencil, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

interface DetailRecordsTableProps {
  records: SalesRecord[];
  salespersonConfigs: Record<string, SalespersonConfig>;
  onEditRecord?: (record: SalesRecord) => void;
  onDeleteRecord?: (recordId: string) => void;
}

export const DetailRecordsTable: React.FC<DetailRecordsTableProps> = ({
  records,
  salespersonConfigs,
  onEditRecord,
  onDeleteRecord,
}) => {
  const [searchKey, setSearchKey] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('ALL');
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL');
  const [recordToDelete, setRecordToDelete] = useState<SalesRecord | null>(null);

  // Pagination state for ultra-fast DOM rendering on 1000-2000+ items
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Helper to identify missing/empty teacher
  const isMissingTeacher = (teacher?: string) => {
    if (!teacher) return true;
    const trimmed = teacher.trim();
    return trimmed === '' || trimmed === '无' || trimmed === '-' || trimmed === '(无)';
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, salespersonFilter, teacherFilter, searchKey, pageSize]);

  // Unique lists for filters
  const salespersons = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.salesperson && !isMissingSalesperson(r.salesperson)) {
        set.add(r.salesperson.trim());
      }
    });
    return Array.from(set).sort();
  }, [records]);

  const teachers = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.teacher && !isMissingTeacher(r.teacher)) {
        set.add(r.teacher.trim());
      }
    });
    return Array.from(set).sort();
  }, [records]);

  // Enhanced records with calculation
  const calculatedRecords = useMemo(() => {
    return records.map((r) => calculateRecordDetails(r, salespersonConfigs));
  }, [records, salespersonConfigs]);

  // Missing salesperson & teacher count
  const missingSalespersonCount = useMemo(() => {
    return calculatedRecords.filter((r) => isMissingSalesperson(r.salesperson)).length;
  }, [calculatedRecords]);

  const missingTeacherCount = useMemo(() => {
    return calculatedRecords.filter((r) => isMissingTeacher(r.teacher)).length;
  }, [calculatedRecords]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return calculatedRecords.filter((r) => {
      if (typeFilter !== 'ALL' && r.type?.trim() !== typeFilter) return false;

      if (salespersonFilter === 'MISSING') {
        if (!isMissingSalesperson(r.salesperson)) return false;
      } else if (
        salespersonFilter !== 'ALL' &&
        r.salesperson?.trim() !== salespersonFilter
      ) {
        return false;
      }

      if (teacherFilter === 'MISSING') {
        if (!isMissingTeacher(r.teacher)) return false;
      } else if (
        teacherFilter !== 'ALL' &&
        r.teacher?.trim() !== teacherFilter
      ) {
        return false;
      }

      if (searchKey.trim()) {
        const q = searchKey.toLowerCase();
        const matchIncome = r.incomeName.toLowerCase().includes(q);
        const matchProject = r.project.toLowerCase().includes(q);
        const matchSales = r.salesperson.toLowerCase().includes(q);
        const matchTeacher = r.teacher.toLowerCase().includes(q);
        const matchNotes = r.notes.toLowerCase().includes(q);
        return (
          matchIncome || matchProject || matchSales || matchTeacher || matchNotes
        );
      }

      return true;
    });
  }, [calculatedRecords, typeFilter, salespersonFilter, teacherFilter, searchKey]);

  // Pagination slicing
  const totalPages = useMemo(() => {
    if (pageSize === 'ALL' || filteredRecords.length === 0) return 1;
    return Math.ceil(filteredRecords.length / pageSize);
  }, [filteredRecords.length, pageSize]);

  const displayedRecords = useMemo(() => {
    if (pageSize === 'ALL') return filteredRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const totalFilteredAmount = filteredRecords.reduce((s, r) => s + r.amount, 0);
  const totalSalesCommission = filteredRecords.reduce(
    (s, r) => s + r.salesCommissionAmount,
    0
  );
  const totalTeacherCommission = filteredRecords.reduce(
    (s, r) => s + r.teacherCommissionAmount,
    0
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E8E6DF] shadow-2xs overflow-hidden">
      {/* Table Header & Controls */}
      <div className="px-5 py-4 border-b border-[#E8E6DF] bg-[#FDFCF9] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#8C8C70] text-white flex items-center justify-center font-bold">
            <ListCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="font-bold text-[#5A5A40] text-base">
              销售记录提成明细表
            </h2>
            <p className="text-xs text-[#8A8A70]">
              对应月度销售记录原始条目及各自核算出的提成比例与金额
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A8A890]" />
            <input
              type="text"
              placeholder="搜索学生、项目、销售或老师..."
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E8E6DF] text-[#4A4A40] rounded-lg focus:outline-none focus:border-[#8C8C70] w-44 sm:w-56"
            />
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-[#E8E6DF] text-[#4A4A40] rounded-lg font-medium focus:outline-none focus:border-[#8C8C70]"
          >
            <option value="ALL">全部类型 (新/续/集训)</option>
            <option value="新">新报</option>
            <option value="续">续费</option>
            <option value="集训">集训</option>
          </select>

          {/* Salesperson filter */}
          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className={`px-2.5 py-1.5 text-xs border rounded-lg font-medium focus:outline-none ${
              salespersonFilter === 'MISSING'
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                : 'bg-white border-[#E8E6DF] text-[#4A4A40] focus:border-[#8C8C70]'
            }`}
          >
            <option value="ALL">全部销售人员</option>
            {missingSalespersonCount > 0 && (
              <option value="MISSING" className="font-bold text-amber-700">
                ⚠️ 空缺销售人 ({missingSalespersonCount} 笔)
              </option>
            )}
            {salespersons.map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>

          {/* Teacher filter */}
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className={`px-2.5 py-1.5 text-xs border rounded-lg font-medium focus:outline-none ${
              teacherFilter === 'MISSING'
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                : 'bg-white border-[#E8E6DF] text-[#4A4A40] focus:border-[#8C8C70]'
            }`}
          >
            <option value="ALL">全部授课老师</option>
            <option value="MISSING" className="font-bold text-amber-700">
              ⚠️ 未指定/空值老师 ({missingTeacherCount} 笔)
            </option>
            {teachers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Missing Salesperson Notice Banner */}
      {missingSalespersonCount > 0 && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              检测到 <strong className="text-amber-700 font-bold underline">{missingSalespersonCount}</strong> 笔数据销售人为空缺，系统已自动加亮提示，请及时修改补充！
            </span>
          </div>
          {salespersonFilter !== 'MISSING' && (
            <button
              onClick={() => setSalespersonFilter('MISSING')}
              className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors border border-amber-300 cursor-pointer shrink-0"
            >
              仅显示空缺销售人记录
            </button>
          )}
        </div>
      )}

      {/* Table Data */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left text-xs border-collapse sticky-header">
          <thead className="sticky top-0 z-10 bg-[#F5F2EB] text-[#8A8A70] font-semibold border-b border-[#E8E6DF] shadow-2xs">
            <tr>
              <th className="py-2.5 px-3">日期</th>
              <th className="py-2.5 px-3">收入 (学生姓名)</th>
              <th className="py-2.5 px-3">项目/课程</th>
              <th className="py-2.5 px-3 text-center">类型</th>
              <th className="py-2.5 px-3 text-right font-bold">金额</th>
              <th className="py-2.5 px-3">销售人</th>
              <th className="py-2.5 px-3 text-right text-[#8C8C70]">提成%</th>
              <th className="py-2.5 px-3 text-right font-bold text-[#5A5A40] bg-[#F0EFE9]">
                销售提成金额
              </th>
              <th className="py-2.5 px-3">老师</th>
              <th className="py-2.5 px-3 text-right text-[#5E7A56]">提成%</th>
              <th className="py-2.5 px-3 text-right font-bold text-[#5E7A56] bg-[#F0F5EF]">
                老师提成金额
              </th>
              <th className="py-2.5 px-3 max-w-[220px] min-w-[100px]">备注</th>
              <th className="py-2.5 px-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EEE6] text-[#4A4A40]">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-[#A8A890]">
                  无符合条件的销售明细记录
                </td>
              </tr>
            ) : (
              displayedRecords.map((r) => {
                const isMissing = isMissingSalesperson(r.salesperson);
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      isMissing
                        ? 'bg-amber-50/90 hover:bg-amber-100/90 border-l-4 border-l-amber-500 font-medium'
                        : 'hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-[#8A8A70] font-mono whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#4A4A40]">
                      {r.incomeName}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#4A4A40]">
                      {r.project}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.type === '新'
                            ? 'bg-[#F5F2EB] text-[#5A5A40] border border-[#E8E6DF]'
                            : r.type === '续'
                            ? 'bg-[#F0EFE9] text-[#8C8C70] border border-[#E8E6DF]'
                            : 'bg-[#FAF2EB] text-[#C27838] border border-[#E8E6DF]'
                        }`}
                      >
                        {r.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#4A4A40]">
                      ¥{r.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      {isMissing ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          {r.salesperson?.trim() || '空缺未填'}
                        </span>
                      ) : (
                        <span className="font-medium text-[#4A4A40]">
                          {r.salesperson}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#8C8C70] font-mono">
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.customSalesCommissionRate !== undefined && (
                          <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-sans font-bold" title="自定义改动提成率">改</span>
                        )}
                        {Math.round(r.salesCommissionRate * 1000) / 10}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#5A5A40] bg-[#F0EFE9]/50">
                      ¥{r.salesCommissionAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      {r.teacher ? (
                        <span className="font-medium text-[#4A4A40]">
                          {r.teacher}
                        </span>
                      ) : (
                        <span className="text-[#A8A890] italic">(无)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#5E7A56] font-mono">
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.customTeacherCommissionRate !== undefined && (
                          <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-sans font-bold" title="自定义改动提成率">改</span>
                        )}
                        {Math.round(r.teacherCommissionRate * 1000) / 10}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#5E7A56] bg-[#F0F5EF]/50">
                      ¥{r.teacherCommissionAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-[#8A8A70] text-[11px] max-w-[220px] min-w-[100px] whitespace-normal break-words leading-relaxed">
                      {r.notes || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onEditRecord && (
                          <button
                            onClick={() => onEditRecord(r)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded transition-colors border border-[#E8E6DF] cursor-pointer"
                            title="修改此条记录"
                          >
                            <Pencil className="w-3 h-3 text-[#8C8C70]" />
                            修改
                          </button>
                        )}
                        {onDeleteRecord && (
                          <button
                            onClick={() => setRecordToDelete(r)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#C25A5A] bg-[#FAF0F0] hover:bg-[#F2E0E0] rounded transition-colors border border-[#F0D5D5] cursor-pointer"
                            title="删除此条记录"
                          >
                            <Trash2 className="w-3 h-3 text-[#C25A5A]" />
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Footer Totals */}
          {filteredRecords.length > 0 && (
            <tfoot className="sticky bottom-0 bg-[#F5F2EB] z-10 border-t-2 border-[#E8E6DF] font-bold text-[#4A4A40]">
              <tr>
                <td colSpan={4} className="py-3 px-3">
                  显示明细小计 ({filteredRecords.length} 笔)
                </td>
                <td className="py-3 px-3 text-right font-extrabold text-[#4A4A40]">
                  ¥{totalFilteredAmount.toLocaleString()}
                </td>
                <td colSpan={2} className="py-3 px-3"></td>
                <td className="py-3 px-3 text-right font-extrabold text-[#5A5A40] bg-[#F0EFE9]">
                  ¥{totalSalesCommission.toLocaleString()}
                </td>
                <td colSpan={2} className="py-3 px-3"></td>
                <td className="py-3 px-3 text-right font-extrabold text-[#5E7A56] bg-[#F0F5EF]">
                  ¥{totalTeacherCommission.toLocaleString()}
                </td>
                <td colSpan={2} className="py-3 px-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Controls Footer */}
      {filteredRecords.length > 0 && (
        <div className="px-5 py-3 bg-[#FAF9F5] border-t border-[#E8E6DF] flex flex-wrap items-center justify-between gap-3 text-xs text-[#5A5A40]">
          <div className="flex items-center gap-3">
            <span className="text-[#8A8A70] flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              每页视图:
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="px-2.5 py-1 bg-white border border-[#E8E6DF] rounded-lg font-medium text-xs focus:outline-none focus:border-[#8C8C70] cursor-pointer shadow-2xs"
            >
              <option value={50}>50 条 / 页 (推荐流畅)</option>
              <option value={100}>100 条 / 页</option>
              <option value={200}>200 条 / 页</option>
              <option value={500}>500 条 / 页</option>
              <option value="ALL">显示全部 ({filteredRecords.length} 笔)</option>
            </select>
            <span className="text-[#8A8A70]">
              显示第{' '}
              <strong className="text-[#4A4A40] font-mono">
                {pageSize === 'ALL' ? 1 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              -{' '}
              <strong className="text-[#4A4A40] font-mono">
                {pageSize === 'ALL'
                  ? filteredRecords.length
                  : Math.min(currentPage * pageSize, filteredRecords.length)}
              </strong>{' '}
              条，共 <strong className="text-[#5E7A56] font-mono font-bold">{filteredRecords.length}</strong> 条符合条件的明细记录
            </span>
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs rounded-md bg-white border border-[#E8E6DF] hover:bg-[#F5F2EB] disabled:opacity-30 disabled:hover:bg-white font-medium transition-colors cursor-pointer"
              >
                首页
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded-md bg-white border border-[#E8E6DF] hover:bg-[#F5F2EB] disabled:opacity-30 disabled:hover:bg-white font-medium transition-colors cursor-pointer flex items-center gap-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                上一页
              </button>
              <span className="px-3 text-xs font-bold text-[#4A4A40]">
                {currentPage} / {totalPages} 页
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs rounded-md bg-white border border-[#E8E6DF] hover:bg-[#F5F2EB] disabled:opacity-30 disabled:hover:bg-white font-medium transition-colors cursor-pointer flex items-center gap-0.5"
              >
                下一页
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs rounded-md bg-white border border-[#E8E6DF] hover:bg-[#F5F2EB] disabled:opacity-30 disabled:hover:bg-white font-medium transition-colors cursor-pointer"
              >
                末页
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Record Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E8E6DF] shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#C25A5A] mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#4A4A40]">确认删除该销售记录</h3>
                <p className="text-xs text-[#8A8A70]">此操作将从此月明细中删除该笔记录</p>
              </div>
            </div>

            <div className="my-4 p-3.5 bg-[#FAF9F5] rounded-xl border border-[#E8E6DF] text-xs space-y-1.5 text-[#4A4A40]">
              <div><span className="text-[#8A8A70]">日期：</span><strong className="font-mono">{recordToDelete.date}</strong></div>
              <div><span className="text-[#8A8A70]">学生姓名：</span><strong>{recordToDelete.incomeName}</strong></div>
              <div><span className="text-[#8A8A70]">课程项目：</span><span>{recordToDelete.project}</span></div>
              <div><span className="text-[#8A8A70]">销售金额：</span><strong className="text-[#5E7A56] font-mono">¥{recordToDelete.amount.toLocaleString()}</strong></div>
              {recordToDelete.salesperson && <div><span className="text-[#8A8A70]">销售人员：</span><span>{recordToDelete.salesperson}</span></div>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6DF]">
              <button
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (onDeleteRecord) {
                    onDeleteRecord(recordToDelete.id);
                  }
                  setRecordToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
