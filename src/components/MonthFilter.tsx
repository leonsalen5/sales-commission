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

  const handleSelectP3 = () => {
    if (availableMonths.length > 0) {
      onSelectMonths(availableMonths.slice(0, 3));
    }
  };

  const handleSelectP6 = () => {
    if (availableMonths.length > 0) {
      onSelectMonths(availableMonths.slice(0, 6));
    }
  };

  const handleSelectP12 = () => {
    if (availableMonths.length > 0) {
      onSelectMonths(availableMonths.slice(0, 12));
    }
  };

  const handleSelectYear = (yearStr: string) => {
    const ym = availableMonths.filter((m) => m.startsWith(`${yearStr}-`));
    if (ym.length > 0) {
      onSelectMonths(ym);
    }
  };

  // Derive unique years
  const uniqueYears = React.useMemo(() => {
    const set = new Set<string>();
    availableMonths.forEach((m) => {
      const y = m.split('-')[0];
      if (y) set.add(y);
    });
    return Array.from(set).sort().reverse();
  }, [availableMonths]);

  // Check active states
  const p3Months = availableMonths.slice(0, 3);
  const isP3Active =
    p3Months.length > 0 &&
    selectedMonths.length === p3Months.length &&
    p3Months.every((m) => selectedMonths.includes(m));

  const p6Months = availableMonths.slice(0, 6);
  const isP6Active =
    p6Months.length > 0 &&
    selectedMonths.length === p6Months.length &&
    p6Months.every((m) => selectedMonths.includes(m));

  const p12Months = availableMonths.slice(0, 12);
  const isP12Active =
    p12Months.length > 0 &&
    selectedMonths.length === p12Months.length &&
    p12Months.every((m) => selectedMonths.includes(m));

  return (
    <div className="bg-[#FDFCF9] border-b border-[#E8E6DF] py-3 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Month selection chips */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center text-xs font-semibold text-[#5A5A40] mr-1 gap-1.5">
            <Calendar className="w-4 h-4 text-[#8C8C70]" />
            <span>快捷时间范围:</span>
          </div>

          {availableMonths.length === 0 ? (
            <span className="text-xs text-[#A8A890] italic">暂无月份数据</span>
          ) : (
            <>
              {/* Presets */}
              <div className="flex items-center flex-wrap gap-1">
                <button
                  onClick={handleSelectLatest}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                    selectedMonths.length === 1 &&
                    selectedMonths[0] === availableMonths[0]
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                >
                  最新单月 ({availableMonths[0]})
                </button>

                <button
                  onClick={handleSelectP3}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                    isP3Active
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                  title="统计最近 3 个月数据"
                >
                  近三个月
                </button>

                <button
                  onClick={handleSelectP6}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                    isP6Active
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                  title="统计最近 6 个月（半年）数据"
                >
                  近半年
                </button>

                <button
                  onClick={handleSelectP12}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                    isP12Active
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                  title="统计最近 12 个月（一年）数据"
                >
                  近一年
                </button>

                {/* Years quick buttons */}
                {uniqueYears.map((yr) => {
                  const yrMonths = availableMonths.filter((m) =>
                    m.startsWith(`${yr}-`)
                  );
                  const isYrActive =
                    yrMonths.length > 0 &&
                    selectedMonths.length === yrMonths.length &&
                    yrMonths.every((m) => selectedMonths.includes(m));

                  return (
                    <button
                      key={yr}
                      onClick={() => handleSelectYear(yr)}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                        isYrActive
                          ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-2xs font-bold'
                          : 'bg-[#FAF9F5] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                      }`}
                      title={`统计 ${yr} 全年数据`}
                    >
                      {yr}年
                    </button>
                  );
                })}

                <button
                  onClick={handleSelectAll}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                    isAllSelected
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                >
                  全部历史月份
                </button>
              </div>

              <div className="h-4 w-px bg-[#E8E6DF] mx-1 hidden sm:block" />

              {/* Individual month chips */}
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
