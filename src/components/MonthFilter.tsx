import React, { useState, useMemo } from 'react';
import { Calendar, Check, Info, ChevronDown, ChevronUp, Layers, Filter } from 'lucide-react';

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
  // Collapsible state for detailed month selection drawer
  // Auto-expand if 12 months or fewer, default collapsed if > 12 months
  const [isDetailExpanded, setIsDetailExpanded] = useState<boolean>(() => availableMonths.length <= 12);

  const isAllSelected =
    availableMonths.length > 0 &&
    selectedMonths.length === availableMonths.length;

  const handleToggleMonth = (m: string) => {
    if (selectedMonths.includes(m)) {
      if (selectedMonths.length === 1) return; // Keep at least one selected
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

  // Toggle all months in a specific year
  const handleToggleYearMonths = (yearStr: string) => {
    const yrMonths = availableMonths.filter((m) => m.startsWith(`${yearStr}-`));
    const isAllYrSelected = yrMonths.every((m) => selectedMonths.includes(m));

    if (isAllYrSelected) {
      // Remove this year's months (ensure at least 1 month remains)
      const newSelected = selectedMonths.filter((m) => !m.startsWith(`${yearStr}-`));
      if (newSelected.length > 0) {
        onSelectMonths(newSelected);
      }
    } else {
      // Add all missing months of this year
      const set = new Set([...selectedMonths, ...yrMonths]);
      onSelectMonths(Array.from(set));
    }
  };

  // Group months by year
  const monthsByYear = useMemo(() => {
    const map = new Map<string, string[]>();
    availableMonths.forEach((m) => {
      const year = m.split('-')[0] || '未知年份';
      let list = map.get(year);
      if (!list) {
        list = [];
        map.set(year, list);
      }
      list.push(m);
    });
    return map;
  }, [availableMonths]);

  // Unique sorted years (descending)
  const uniqueYears = useMemo(() => {
    return Array.from(monthsByYear.keys()).sort().reverse();
  }, [monthsByYear]);

  // Preset active states
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
    <div className="bg-[#FDFCF9] border-b border-[#E8E6DF] py-3 px-4 sm:px-6 lg:px-8 shadow-2xs">
      <div className="max-w-7xl mx-auto space-y-2.5">
        {/* Top Control Bar: Header & Quick Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Filter Icon & Preset Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center text-xs font-bold text-[#4A4A38] shrink-0 mr-1 gap-1.5">
              <Calendar className="w-4 h-4 text-[#8C8C70]" />
              <span>时间范围:</span>
            </div>

            {availableMonths.length === 0 ? (
              <span className="text-xs text-[#A8A890] italic">暂无月份数据</span>
            ) : (
              <div className="flex items-center flex-wrap gap-1.5">
                {/* Standard presets */}
                <button
                  onClick={handleSelectLatest}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border cursor-pointer ${
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
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border cursor-pointer ${
                    isP3Active
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                  title="统计最近 3 个月数据"
                >
                  近3个月
                </button>

                <button
                  onClick={handleSelectP6}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border cursor-pointer ${
                    isP6Active
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                  title="统计最近 6 个月数据"
                >
                  近半年
                </button>

                <button
                  onClick={handleSelectP12}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border cursor-pointer ${
                    isP12Active
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                  title="统计最近 12 个月数据"
                >
                  近一年
                </button>

                <button
                  onClick={handleSelectAll}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border cursor-pointer ${
                    isAllSelected
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70] shadow-2xs font-bold'
                      : 'bg-[#F5F2EB] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                  }`}
                >
                  全部历史 ({availableMonths.length}个月)
                </button>

                {/* Vertical Divider */}
                <div className="h-4 w-px bg-[#E8E6DF] mx-1 hidden sm:block" />

                {/* Quick Year Selectors */}
                {uniqueYears.map((yr) => {
                  const yrMonths = monthsByYear.get(yr) || [];
                  const isYrActive =
                    yrMonths.length > 0 &&
                    selectedMonths.length === yrMonths.length &&
                    yrMonths.every((m) => selectedMonths.includes(m));

                  return (
                    <button
                      key={yr}
                      onClick={() => handleSelectYear(yr)}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border cursor-pointer ${
                        isYrActive
                          ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-2xs font-bold'
                          : 'bg-[#FAF9F5] text-[#5A5A40] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                      }`}
                      title={`选择 ${yr} 年全年的 ${yrMonths.length} 个月份`}
                    >
                      {yr}年 ({yrMonths.length}个月)
                    </button>
                  );
                })}

                {/* Expand/Collapse Detailed Months Toggle */}
                <button
                  onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-semibold transition-colors border cursor-pointer ml-1 ${
                    isDetailExpanded
                      ? 'bg-[#8C8C70] text-white border-[#8C8C70]'
                      : 'bg-amber-50/80 text-amber-900 border-amber-200/80 hover:bg-amber-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    具体月份 ({selectedMonths.length}/{availableMonths.length})
                  </span>
                  {isDetailExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right: Selected Summary Badge & Rules Button */}
          <div className="flex items-center gap-2.5 self-end lg:self-auto shrink-0">
            <div className="flex items-center gap-2 bg-[#F5F2EB] px-3 py-1.5 rounded-lg border border-[#E8E6DF] text-xs">
              <span className="text-[#8A8A70]">已选:</span>
              <span className="font-semibold text-[#5A5A40]">{recordCount} 笔</span>
              <span className="text-[#E8E6DF]">|</span>
              <span className="text-[#8A8A70]">总业绩:</span>
              <span className="font-bold text-[#5E7A56]">
                ¥{totalPerformance.toLocaleString()}
              </span>
            </div>

            <button
              onClick={onShowRuleModal}
              className="inline-flex items-center gap-1 text-xs text-[#8C8C70] hover:text-[#7A7A60] font-medium hover:underline bg-[#F5F2EB] px-2.5 py-1.5 rounded-lg border border-[#E8E6DF] cursor-pointer transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              规则说明
            </button>
          </div>
        </div>

        {/* Bottom Drawer: Grouped Detailed Month Selector (Collapsible & Max Height Scrollable) */}
        {isDetailExpanded && availableMonths.length > 0 && (
          <div className="mt-2 pt-2.5 border-t border-[#E8E6DF] bg-[#FAF9F5] p-3 rounded-xl border border-[#E8E6DF] max-h-52 overflow-y-auto space-y-2.5 shadow-inner">
            {uniqueYears.map((yr) => {
              const yrMonths = monthsByYear.get(yr) || [];
              const isAllYrSelected = yrMonths.every((m) => selectedMonths.includes(m));

              return (
                <div
                  key={yr}
                  className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 bg-white p-2 rounded-lg border border-[#E8E6DF]/80"
                >
                  {/* Year Group Tag & Select All Year */}
                  <div className="flex items-center justify-between sm:justify-start gap-2 min-w-[110px] shrink-0 border-b sm:border-b-0 sm:border-r border-[#E8E6DF] pb-1 sm:pb-0 sm:pr-3">
                    <span className="text-xs font-bold text-[#5A5A40]">
                      {yr} 年明细
                    </span>
                    <button
                      onClick={() => handleToggleYearMonths(yr)}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors border cursor-pointer ${
                        isAllYrSelected
                          ? 'bg-[#8C8C70] text-white border-[#8C8C70]'
                          : 'bg-[#F5F2EB] text-[#7A7A60] border-[#E8E6DF] hover:bg-[#E8E6DF]'
                      }`}
                    >
                      {isAllYrSelected ? '已全选' : '全选此年'}
                    </button>
                  </div>

                  {/* Individual Month Chips for this Year */}
                  <div className="flex items-center flex-wrap gap-1.5 flex-1">
                    {yrMonths.map((m) => {
                      const active = selectedMonths.includes(m);
                      const monthNum = m.split('-')[1] || m;
                      return (
                        <button
                          key={m}
                          onClick={() => handleToggleMonth(m)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-all border cursor-pointer ${
                            active
                              ? 'bg-[#F0EFE9] text-[#5A5A40] border-[#8C8C70] font-semibold shadow-2xs'
                              : 'bg-[#FAF9F5] text-[#8A8A70] border-[#E8E6DF] hover:bg-[#F5F2EB]'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 text-[#8C8C70]" />}
                          <span>{m}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

