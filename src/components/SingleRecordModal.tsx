import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Pencil, Calendar, User, BookOpen, Tag, DollarSign, UserCheck, GraduationCap, FileText, Percent, RotateCcw } from 'lucide-react';
import { RecordType, SalesRecord } from '../types';

interface SingleRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (month: string, fileName: string, records: SalesRecord[]) => Promise<void>;
  onUpdateRecord?: (updatedRecord: SalesRecord) => Promise<void>;
  recordToEdit?: SalesRecord | null;
  existingSalespersons?: string[];
  existingTeachers?: string[];
  existingProjects?: string[];
}

export const SingleRecordModal: React.FC<SingleRecordModalProps> = ({
  isOpen,
  onClose,
  onAddRecord,
  onUpdateRecord,
  recordToEdit,
  existingSalespersons = [],
  existingTeachers = [],
  existingProjects = [],
}) => {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonthInt = now.getMonth() + 1;
  const defaultMonthStr = `${defaultYear}-${String(defaultMonthInt).padStart(2, '0')}`;
  const defaultDateStr = `${defaultYear}/${defaultMonthInt}/${now.getDate()}`;

  const isEditing = Boolean(recordToEdit);

  const [date, setDate] = useState<string>(defaultDateStr);
  const [month, setMonth] = useState<string>(defaultMonthStr);
  const [incomeName, setIncomeName] = useState<string>('');
  const [project, setProject] = useState<string>('');
  const [type, setType] = useState<RecordType>('新');
  const [amount, setAmount] = useState<string>('');
  const [salesperson, setSalesperson] = useState<string>('');
  const [teacher, setTeacher] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [customSalesRate, setCustomSalesRate] = useState<string>('');
  const [customTeacherRate, setCustomTeacherRate] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto update month when date changes
  const handleDateChange = (val: string) => {
    setDate(val);
    const dateMatch = val.match(/(\d{4})[年/.-]\s*(\d{1,2})/);
    if (dateMatch) {
      const y = dateMatch[1];
      const m = String(parseInt(dateMatch[2], 10)).padStart(2, '0');
      setMonth(`${y}-${m}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);

      if (recordToEdit) {
        setDate(recordToEdit.date || defaultDateStr);
        setMonth(recordToEdit.month || defaultMonthStr);
        setIncomeName(recordToEdit.incomeName || '');
        setProject(recordToEdit.project || '');
        setType(recordToEdit.type || '新');
        setAmount(recordToEdit.amount !== undefined ? String(recordToEdit.amount) : '');
        setSalesperson(recordToEdit.salesperson || '');
        setTeacher(recordToEdit.teacher || '');
        setNotes(recordToEdit.notes || '');
        setCustomSalesRate(
          recordToEdit.customSalesCommissionRate !== undefined && recordToEdit.customSalesCommissionRate !== null
            ? String(Math.round(recordToEdit.customSalesCommissionRate * 1000) / 10)
            : ''
        );
        setCustomTeacherRate(
          recordToEdit.customTeacherCommissionRate !== undefined && recordToEdit.customTeacherCommissionRate !== null
            ? String(Math.round(recordToEdit.customTeacherCommissionRate * 1000) / 10)
            : ''
        );
      } else {
        setDate(defaultDateStr);
        setMonth(defaultMonthStr);
        setIncomeName('');
        setProject('');
        setType('新');
        setAmount('');
        setSalesperson('');
        setTeacher('');
        setNotes('');
        setCustomSalesRate('');
        setCustomTeacherRate('');
      }
    }
  }, [isOpen, recordToEdit]);

  if (!isOpen) return null;

  const defaultSalesRatePercent = type === '新' ? 7 : 5;
  const defaultTeacherRatePercent = teacher.trim().length > 0 && type !== '集训' ? 1 : 0;

  const effectiveSalesRatePercent =
    customSalesRate !== '' && !isNaN(parseFloat(customSalesRate))
      ? parseFloat(customSalesRate)
      : defaultSalesRatePercent;

  const effectiveTeacherRatePercent =
    customTeacherRate !== '' && !isNaN(parseFloat(customTeacherRate))
      ? parseFloat(customTeacherRate)
      : defaultTeacherRatePercent;

  const numAmount = parseFloat(amount) || 0;
  const previewSalesComm = Math.round(numAmount * (effectiveSalesRatePercent / 100) * 100) / 100;
  const previewTeacherComm = Math.round(numAmount * (effectiveTeacherRatePercent / 100) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeName.trim()) {
      setErrorMsg('请填写学生/收入姓名');
      return;
    }
    const valAmount = parseFloat(amount);
    if (isNaN(valAmount) || valAmount < 0) {
      setErrorMsg('请填写有效的数字金额');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');

    const parsedCustomSalesRate =
      customSalesRate.trim() !== '' && !isNaN(parseFloat(customSalesRate))
        ? parseFloat(customSalesRate) / 100
        : undefined;

    const parsedCustomTeacherRate =
      customTeacherRate.trim() !== '' && !isNaN(parseFloat(customTeacherRate))
        ? parseFloat(customTeacherRate) / 100
        : undefined;

    try {
      if (isEditing && recordToEdit && onUpdateRecord) {
        const updatedRecord: SalesRecord = {
          ...recordToEdit,
          month: month.trim() || defaultMonthStr,
          date: date.trim() || defaultDateStr,
          incomeName: incomeName.trim(),
          project: project.trim() || '通用课程',
          type: type || '新',
          amount: valAmount,
          salesperson: salesperson.trim() || '未填销售',
          teacher: teacher.trim(),
          notes: notes.trim(),
          customSalesCommissionRate: parsedCustomSalesRate,
          customTeacherCommissionRate: parsedCustomTeacherRate,
        };
        await onUpdateRecord(updatedRecord);
      } else {
        const newRecord: SalesRecord = {
          id: `manual_${Date.now()}`,
          batchId: '',
          month: month.trim() || defaultMonthStr,
          date: date.trim() || defaultDateStr,
          incomeName: incomeName.trim(),
          project: project.trim() || '通用课程',
          type: type || '新',
          amount: valAmount,
          salesperson: salesperson.trim() || '未填销售',
          teacher: teacher.trim(),
          notes: notes.trim() || '手动补录',
          customSalesCommissionRate: parsedCustomSalesRate,
          customTeacherCommissionRate: parsedCustomTeacherRate,
        };
        const fileName = `单条补录 - ${newRecord.incomeName}`;
        await onAddRecord(newRecord.month, fileName, [newRecord]);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('保存记录失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E6DF] my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#8C8C70]/10 flex items-center justify-center text-[#8C8C70]">
              {isEditing ? <Pencil className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#5A5A40]">
                {isEditing ? '修改销售记录' : '单条销售记录补录'}
              </h3>
              <p className="text-xs text-[#8A8A70]">
                {isEditing ? '更新该笔收入明细与信息' : '手动录入单个学生收入明细'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
              {errorMsg}
            </div>
          )}

          {/* Row 1: Date & Month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#8A8A70]" />
                交易日期 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                placeholder="例如: 2026/7/1"
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#8A8A70]" />
                归属月份 (YYYY-MM)
              </label>
              <input
                type="text"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="例如: 2026-07"
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
                required
              />
            </div>
          </div>

          {/* Row 2: Income Name & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#8A8A70]" />
                学生 / 收入姓名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={incomeName}
                onChange={(e) => setIncomeName(e.target.value)}
                placeholder="输入学生姓名"
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-[#8A8A70]" />
                金额 (元) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="例如: 3800"
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
                required
              />
            </div>
          </div>

          {/* Row 3: Type & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#8A8A70]" />
                报读类型 <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RecordType)}
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70] bg-white"
              >
                <option value="新">新报 (新)</option>
                <option value="续">续费 (续)</option>
                <option value="集训">集训</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#8A8A70]" />
                课程项目
              </label>
              <input
                type="text"
                list="existing-projects"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="如: 油画精品班"
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
              />
              <datalist id="existing-projects">
                {existingProjects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 4: Salesperson & Teacher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-[#8A8A70]" />
                课程顾问 / 销售人 <span className="text-[#8A8A70] text-[10px] font-normal">(不填将标记为空缺)</span>
              </label>
              <input
                type="text"
                list="existing-salespersons"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                placeholder="顾问姓名 (若留空则加亮显示为空缺销售人)"
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
              />
              <datalist id="existing-salespersons">
                {existingSalespersons.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-[#8A8A70]" />
                带生教师
              </label>
              <input
                type="text"
                list="existing-teachers"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="教师姓名 (可选)"
                className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
              />
              <datalist id="existing-teachers">
                {existingTeachers.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 5: Custom Commission Rates */}
          <div className="p-3.5 bg-[#FAF9F5] rounded-xl border border-[#E8E6DF] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#4A4A40] flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-[#5E7A56]" />
                提成百分比设置
              </label>
              <span className="text-[10px] text-[#8A8A70]">
                留空则自动按系统默认规则计算
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Sales Commission Rate % */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[#5A5A40]">
                    销售提成比例 (%)
                  </label>
                  {customSalesRate !== '' && (
                    <button
                      type="button"
                      onClick={() => setCustomSalesRate('')}
                      className="text-[10px] text-[#8C8C70] hover:text-[#5A5A40] underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> 恢复默认 ({defaultSalesRatePercent}%)
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={customSalesRate}
                    onChange={(e) => setCustomSalesRate(e.target.value)}
                    placeholder={`默认 (${defaultSalesRatePercent}%)`}
                    className={`w-full pl-3 pr-7 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 ${
                      customSalesRate !== ''
                        ? 'border-[#8C8C70] bg-amber-50/40 font-bold text-[#4A4A40]'
                        : 'border-[#E8E6DF] bg-white'
                    }`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8A8A70]">
                    %
                  </span>
                </div>
              </div>

              {/* Teacher Commission Rate % */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[#5A5A40]">
                    教师提成比例 (%)
                  </label>
                  {customTeacherRate !== '' && (
                    <button
                      type="button"
                      onClick={() => setCustomTeacherRate('')}
                      className="text-[10px] text-[#8C8C70] hover:text-[#5A5A40] underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> 恢复默认 ({defaultTeacherRatePercent}%)
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={customTeacherRate}
                    onChange={(e) => setCustomTeacherRate(e.target.value)}
                    placeholder={`默认 (${defaultTeacherRatePercent}%)`}
                    className={`w-full pl-3 pr-7 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 ${
                      customTeacherRate !== ''
                        ? 'border-[#8C8C70] bg-amber-50/40 font-bold text-[#4A4A40]'
                        : 'border-[#E8E6DF] bg-white'
                    }`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8A8A70]">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Realtime estimated result */}
            {numAmount > 0 && (
              <div className="pt-2 border-t border-[#E8E6DF]/80 flex items-center justify-between text-xs text-[#5A5A40] flex-wrap gap-2">
                <div>
                  预估销售提成：
                  <span className="font-bold font-mono text-[#8C8C70] ml-1">
                    ¥{previewSalesComm.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#8A8A70] ml-1">
                    ({effectiveSalesRatePercent}%{customSalesRate !== '' ? ' 自定义' : ''})
                  </span>
                </div>
                <div>
                  预估教师提成：
                  <span className="font-bold font-mono text-[#5E7A56] ml-1">
                    ¥{previewTeacherComm.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#8A8A70] ml-1">
                    ({effectiveTeacherRatePercent}%{customTeacherRate !== '' ? ' 自定义' : ''})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Row 6: Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#5A5A40] mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#8A8A70]" />
              备注信息
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="如：线下刷卡 / 补录第7笔交易"
              className="w-full px-3 py-2 text-xs border border-[#E8E6DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8C8C70]/30 focus:border-[#8C8C70]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E8E6DF] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] active:bg-[#686850] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : isEditing ? '确认保存修改' : '确认补录保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
