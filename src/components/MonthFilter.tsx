import React from 'react';
import { Calendar, Filter, Sparkles, Check, Info } from 'lucide-react';

interface MonthFilterProps {
  availableMonths: string[];
  selectedMonths: string[];
  onSelectMonths: (months: string[]) => void;
  recordCount: number;
  totalPerformance: number;
  onShowRuleModal: () => void;
}

export const MonthFilter: React.FC<MonthFilterProps> = ({
  availableMonths,
  selectedMonths,
  onSelectMonths,
  recordCount,
  totalPerformance,
  onShowRuleModal,
}) => {
  const isAllSelected =
    availableMonths.length > 0 &&
    selectedMonths.length === availableMonths.length;

  const handleToggleMonth = (m: string) => {
    if (selectedMonths.includes(m)) {
      if (selectedMonths.length === 1) return; // Keep at least one
      onSelectMonths(selectedMonths.filter((item) => item !== m));
    } else {
      onSelectMonths([...selectedMonths, m]);
    }
  };

  const handleSelectAll = () => {
    onSelectMonths([...availableMonths]);
  };

  const handleSelectLatest = () => {
    if (availableMonths.length > 0) {
      onSelectMonths([availableMonths[0]]);
    }
  };

  return (
    <div className="bg-[#FDFCF9] border-b border-[#E8E6DF] py-3 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Month selection chips */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center text-xs font-semibold text-[#5A5A40] mr-1 gap-1.5">
            <Calendar className="w-4 h-4 text-[#8C8C70]" />
            <span>统计月份范围:</span>
          </div>

          {availableMonths.length === 0 ? (
            <span className="text-xs text-[#A8A890] italic">暂无月份数据</span>
          ) : (
            <>
              <button
                onClick={handleSelectAll}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                  isAllSelected
                    ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs'
                    : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                }`}
              >
                全部月份
              </button>

              <button
                onClick={handleSelectLatest}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                  selectedMonths.length === 1 &&
                  selectedMonths[0] === availableMonths[0]
                    ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs'
                    : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                }`}
              >
                最新单月 ({availableMonths[0]})
              </button>

              <div className="h-4 w-px bg-[#E8E6DF] mx-1 hidden sm:block" />

              <div className="flex items-center flex-wrap gap-1.5">
                {availableMonths.map((m) => {
                  const active = selectedMonths.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => handleToggleMonth(m)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-all border ${
                        active
                          ? 'bg-[#F0EFE9] text-[#5A5A40] border-[#8C8C70] font-semibold shadow-2xs'
                          : 'bg-white text-[#8A8A70] border-[#E8E6DF] hover:bg-[#F5F2EB]'
                      }`}
                    >
                      {active && <Check className="w-3 h-3 text-[#8C8C70]" />}
                      {m}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right: Selected Summary Badge & Rules Explanation button */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2 bg-[#F5F2EB] px-3 py-1.5 rounded-lg border border-[#E8E6DF] text-xs">
            <span className="text-[#8A8A70]">已选数据:</span>
            <span className="font-semibold text-[#5A5A40]">{recordCount} 笔记录</span>
            <span className="text-[#E8E6DF]">|</span>
            <span className="text-[#8A8A70]">总业绩:</span>
            <span className="font-bold text-[#5E7A56]">
              ¥{totalPerformance.toLocaleString()}
            </span>
          </div>

          <button
            onClick={onShowRuleModal}
            className="inline-flex items-center gap-1 text-xs text-[#8C8C70] hover:text-[#7A7A60] font-medium hover:underline bg-[#F5F2EB] px-2.5 py-1.5 rounded-lg border border-[#E8E6DF]"
          >
            <Info className="w-3.5 h-3.5" />
            提成与奖金计算规则说明
          </button>
        </div>
      </div>
    </div>
  );
};
