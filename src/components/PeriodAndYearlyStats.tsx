import React, { useState, useMemo } from 'react';
import { SalesRecord, SalespersonConfig } from '../types';
import {
  generateYearlySummaries,
  generatePeriodSummaries,
  PeriodSummaryItem,
  calculateRecordDetails,
} from '../utils/calculations';
import {
  BarChart3,
  PieChart as PieChartIcon,
  CalendarDays,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Users,
  Award,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface PeriodAndYearlyStatsProps {
  records: SalesRecord[];
  configs: Record<string, SalespersonConfig>;
  availableMonths: string[];
  selectedMonths: string[];
  onSelectMonths: (months: string[]) => void;
}

const PIE_COLORS = ['#5E7A56', '#C27838', '#8C8C70', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

export const PeriodAndYearlyStats: React.FC<PeriodAndYearlyStatsProps> = ({
  records,
  configs,
  availableMonths,
  selectedMonths,
  onSelectMonths,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'YEARLY' | 'PERIOD'>('ALL');
  const [chartView, setChartView] = useState<'BAR' | 'PIE' | 'BOTH'>('BOTH');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Compute statistics items
  const yearlySummaries = useMemo(() => {
    return generateYearlySummaries(records, configs, availableMonths);
  }, [records, configs, availableMonths]);

  const periodSummaries = useMemo(() => {
    return generatePeriodSummaries(records, configs, availableMonths);
  }, [records, configs, availableMonths]);

  const [barMetric, setBarMetric] = useState<'PERFORMANCE' | 'COMMISSION'>('PERFORMANCE');

  // Reference years for YOY monthly comparison (今年, 去年, 前年)
  const yearsInfo = useMemo(() => {
    const yearSet = new Set<number>();
    availableMonths.forEach((m) => {
      const y = parseInt(m.split('-')[0], 10);
      if (!isNaN(y)) yearSet.add(y);
    });
    records.forEach((r) => {
      const y = parseInt(r.month.split('-')[0], 10);
      if (!isNaN(y)) yearSet.add(y);
    });

    const currentYear = yearSet.size > 0 ? Math.max(...Array.from(yearSet)) : new Date().getFullYear();
    const lastYear = currentYear - 1;
    const prevYear = currentYear - 2;

    return { currentYear, lastYear, prevYear };
  }, [availableMonths, records]);

  // Monthly data for 12 months (今年 vs 去年 vs 前年)
  const barChartData = useMemo(() => {
    const { currentYear, lastYear, prevYear } = yearsInfo;

    const getVal = (year: number, monthNum: number, metric: 'PERFORMANCE' | 'COMMISSION') => {
      const matchingRecords = records.filter((r) => {
        const parts = r.month.split('-');
        const rY = parseInt(parts[0], 10);
        const rM = parseInt(parts[1], 10);
        return rY === year && rM === monthNum;
      });

      if (metric === 'PERFORMANCE') {
        return matchingRecords.reduce((sum, r) => sum + r.amount, 0);
      } else {
        let comm = 0;
        matchingRecords.forEach((r) => {
          const calc = calculateRecordDetails(r, configs);
          comm += calc.teacherCommissionAmount + calc.salesCommissionAmount;
        });
        return Math.round(comm * 100) / 100;
      }
    };

    const keyCurrent = `今年 (${currentYear}年)`;
    const keyLast = `去年 (${lastYear}年)`;
    const keyPrev = `前年 (${prevYear}年)`;

    const list = [];
    for (let m = 1; m <= 12; m++) {
      const curVal = getVal(currentYear, m, barMetric);
      const lastVal = getVal(lastYear, m, barMetric);
      const prevVal = getVal(prevYear, m, barMetric);

      list.push({
        month: `${m}月`,
        [keyCurrent]: curVal,
        [keyLast]: lastVal,
        [keyPrev]: prevVal,
      });
    }

    return {
      list,
      keyCurrent,
      keyLast,
      keyPrev,
    };
  }, [records, configs, yearsInfo, barMetric]);

  // Combined data for Pie Charts (Overall cost structure & Project share)
  const costPieData = useMemo(() => {
    // Total numbers based on all available months
    let totalPerf = 0;
    let salesComm = 0;
    let salesBonus = 0;
    let teacherComm = 0;

    const filteredRecords = records.filter((r) => availableMonths.includes(r.month));

    filteredRecords.forEach((r) => {
      totalPerf += r.amount;
      const calc = calculateRecordDetails(r, configs);
      teacherComm += calc.teacherCommissionAmount;
      salesComm += calc.salesCommissionAmount;
    });

    // Calculate bonuses across available months
    availableMonths.forEach((m) => {
      // bonuses can be derived from period summaries
    });

    const totalSalesTotal = periodSummaries.find((p) => p.key === '12months')?.salesTotal || 0;
    const bonusEst = Math.max(0, totalSalesTotal - salesComm);

    const netRetention = Math.max(0, totalPerf - salesComm - bonusEst - teacherComm);

    return [
      { name: '销售基础提成', value: Math.round(salesComm), color: '#8C8C70' },
      { name: '销售业绩奖金', value: Math.round(bonusEst), color: '#C27838' },
      { name: '教师教学提成', value: Math.round(teacherComm), color: '#5E7A56' },
      { name: '机构留存净收益', value: Math.round(netRetention), color: '#3B82F6' },
    ].filter((d) => d.value > 0);
  }, [records, configs, availableMonths, periodSummaries]);

  // Project distribution Pie Chart
  const projectPieData = useMemo(() => {
    const map = new Map<string, number>();
    records
      .filter((r) => availableMonths.includes(r.month))
      .forEach((r) => {
        const pName = r.project?.trim() || '通用课程';
        map.set(pName, (map.get(pName) || 0) + r.amount);
      });

    const result = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Keep top 5, merge others
    if (result.length > 5) {
      const top5 = result.slice(0, 5);
      const others = result.slice(5).reduce((sum, item) => sum + item.value, 0);
      if (others > 0) {
        top5.push({ name: '其他课程项目', value: others });
      }
      return top5;
    }

    return result;
  }, [records, availableMonths]);

  if (availableMonths.length === 0) {
    return null;
  }

  const isCurrentSelection = (months: string[]) => {
    if (months.length === 0 || selectedMonths.length !== months.length) return false;
    return months.every((m) => selectedMonths.includes(m));
  };

  return (
    <div className="bg-[#FDFCF9] rounded-xl border border-[#E8E6DF] shadow-sm overflow-hidden transition-all my-6">
      {/* Top Header Control */}
      <div className="px-5 py-4 bg-[#F5F2EB] border-b border-[#E8E6DF] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8C8C70] text-white flex items-center justify-center shadow-2xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#4A4A40] flex items-center gap-2">
              多维业绩与提成图表统计概览
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white text-[#8C8C70] border border-[#E8E6DF]">
                柱状图 & 扇形图分析
              </span>
            </h2>
            <p className="text-xs text-[#8A8A70]">
              提供按年份、近一年、近半年、近三个月的业绩对比、柱状趋势图及提成占比扇形图
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Chart Display Mode */}
          <div className="flex items-center bg-white p-0.5 rounded-lg border border-[#E8E6DF] text-xs">
            <button
              onClick={() => setChartView('BOTH')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                chartView === 'BOTH'
                  ? 'bg-[#5A5A40] text-white font-bold'
                  : 'text-[#5A5A40] hover:bg-[#FAF9F5]'
              }`}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              卡片与图表
            </button>
            <button
              onClick={() => setChartView('BAR')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                chartView === 'BAR'
                  ? 'bg-[#5A5A40] text-white font-bold'
                  : 'text-[#5A5A40] hover:bg-[#FAF9F5]'
              }`}
            >
              <BarChart3 className="w-3 h-3 inline mr-1" />
              柱状图
            </button>
            <button
              onClick={() => setChartView('PIE')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                chartView === 'PIE'
                  ? 'bg-[#5A5A40] text-white font-bold'
                  : 'text-[#5A5A40] hover:bg-[#FAF9F5]'
              }`}
            >
              <PieChartIcon className="w-3 h-3 inline mr-1" />
              扇形图
            </button>
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-[#5A5A40] hover:bg-white rounded-lg border border-[#E8E6DF] transition-colors cursor-pointer"
            title={isExpanded ? '折叠统计面板' : '展开统计面板'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-[#8C8C70]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8C8C70]" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {isExpanded && (
        <div className="p-5 space-y-6">

          {/* Section A: Visual Charts (Bar Chart & Pie Chart) */}
          {(chartView === 'BOTH' || chartView === 'BAR' || chartView === 'PIE') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Bar Chart Panel */}
              {(chartView === 'BOTH' || chartView === 'BAR') && (
                <div
                  className={`bg-white p-4 rounded-xl border border-[#E8E6DF] shadow-2xs ${
                    chartView === 'BAR' ? 'lg:col-span-12' : 'lg:col-span-7'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <h3 className="text-xs font-bold text-[#4A4A40] flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#5E7A56]" />
                      12个月历年同期对比 ({barMetric === 'PERFORMANCE' ? '销售业绩' : '提成支出'})
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-[#FAF9F5] p-0.5 rounded-md border border-[#E8E6DF] text-[11px]">
                        <button
                          onClick={() => setBarMetric('PERFORMANCE')}
                          className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                            barMetric === 'PERFORMANCE'
                              ? 'bg-[#8C8C70] text-white font-bold'
                              : 'text-[#5A5A40] hover:bg-[#E8E6DF]'
                          }`}
                        >
                          销售业绩
                        </button>
                        <button
                          onClick={() => setBarMetric('COMMISSION')}
                          className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                            barMetric === 'COMMISSION'
                              ? 'bg-[#8C8C70] text-white font-bold'
                              : 'text-[#5A5A40] hover:bg-[#E8E6DF]'
                          }`}
                        >
                          提成支出
                        </button>
                      </div>
                      <span className="text-[10px] text-[#8A8A70]">单位：元 (¥)</span>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData.list} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0EFE9" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: '#5A5A40' }}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#8A8A70' }}
                          tickFormatter={(v) => `¥${v >= 10000 ? (v / 10000).toFixed(1) + 'w' : v}`}
                        />
                        <Tooltip
                          formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '']}
                          contentStyle={{
                            backgroundColor: '#FDFCF9',
                            borderColor: '#E8E6DF',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                        />
                        <Bar dataKey={barChartData.keyCurrent} fill="#5E7A56" radius={[4, 4, 0, 0]} name={barChartData.keyCurrent} />
                        <Bar dataKey={barChartData.keyLast} fill="#C27838" radius={[4, 4, 0, 0]} name={barChartData.keyLast} />
                        <Bar dataKey={barChartData.keyPrev} fill="#8C8C70" radius={[4, 4, 0, 0]} name={barChartData.keyPrev} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Pie Charts Panel */}
              {(chartView === 'BOTH' || chartView === 'PIE') && (
                <div
                  className={`bg-white p-4 rounded-xl border border-[#E8E6DF] shadow-2xs grid grid-cols-1 gap-6 ${
                    chartView === 'PIE' ? 'lg:col-span-12' : 'lg:col-span-5'
                  }`}
                >
                  {/* Pie 1: Cost Structure */}
                  <div className="flex flex-col items-center">
                    <h3 className="text-xs font-bold text-[#4A4A40] flex items-center gap-1.5 mb-1 self-start">
                      <PieChartIcon className="w-4 h-4 text-[#C27838]" />
                      业绩收益与提成支出占比扇形图
                    </h3>
                    <p className="text-[10px] text-[#8A8A70] self-start mb-2">
                      提成支出与机构留存收益构成
                    </p>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={costPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                              if (percent < 0.05) return null;
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="#FFFFFF"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontSize={11}
                                  fontWeight="bold"
                                >
                                  {`${(percent * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                            labelLine={false}
                          >
                            {costPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '金额']}
                            contentStyle={{
                              backgroundColor: '#FDFCF9',
                              borderColor: '#E8E6DF',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend List for Cost Structure (Single column layout) */}
                    <div className="w-full mt-2 pt-2 border-t border-[#E8E6DF] space-y-2">
                      {costPieData.map((item) => {
                        const totalCost = costPieData.reduce((s, i) => s + i.value, 0);
                        const pct = totalCost > 0 ? ((item.value / totalCost) * 100).toFixed(1) : '0';
                        return (
                          <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-[#4A4A40] font-medium whitespace-nowrap">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#8A8A70] font-mono shrink-0 ml-3">
                              <span>¥{item.value.toLocaleString()}</span>
                              <span className="font-bold text-[#4A4A40]">({pct}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pie 2: Course Project Share */}
                  <div className="flex flex-col items-center">
                    <h3 className="text-xs font-bold text-[#4A4A40] flex items-center gap-1.5 mb-1 self-start">
                      <Layers className="w-4 h-4 text-[#3B82F6]" />
                      课程项目销售额占比扇形图
                    </h3>
                    <p className="text-[10px] text-[#8A8A70] self-start mb-2">
                      按课程项目的收入分布
                    </p>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={projectPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                              if (percent < 0.05) return null;
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="#FFFFFF"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontSize={11}
                                  fontWeight="bold"
                                >
                                  {`${(percent * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                            labelLine={false}
                          >
                            {projectPieData.map((entry, index) => (
                              <Cell key={`cell-proj-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '销售额']}
                            contentStyle={{
                              backgroundColor: '#FDFCF9',
                              borderColor: '#E8E6DF',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend List for Project Share (Single column layout) */}
                    <div className="w-full mt-2 pt-2 border-t border-[#E8E6DF] space-y-2">
                      {projectPieData.map((item, index) => {
                        const totalProj = projectPieData.reduce((s, i) => s + i.value, 0);
                        const pct = totalProj > 0 ? ((item.value / totalProj) * 100).toFixed(1) : '0';
                        const color = PIE_COLORS[index % PIE_COLORS.length];
                        return (
                          <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-[#4A4A40] font-medium whitespace-nowrap">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#8A8A70] font-mono shrink-0 ml-3">
                              <span>¥{item.value.toLocaleString()}</span>
                              <span className="font-bold text-[#4A4A40]">({pct}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section B: Detail Cards */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F5] p-3 rounded-xl border border-[#E8E6DF] shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#8C8C70] text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#4A4A40]">周期与年度数据统计卡片</h3>
                <p className="text-[10px] text-[#8A8A70]">选择下方统计维度，即时对比滚动周期与历年明细数据</p>
              </div>
            </div>

            {/* View Filter Tabs moved here for seamless scrolling/interaction */}
            <div className="flex items-center bg-white p-1 rounded-lg border border-[#E8E6DF] text-xs shadow-2xs">
              <span className="text-[11px] text-[#8A8A70] font-medium px-2 hidden sm:inline">筛选显示:</span>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-[#8C8C70] text-white font-bold shadow-2xs'
                    : 'text-[#5A5A40] hover:bg-[#FAF9F5]'
                }`}
              >
                全部阶段
              </button>
              <button
                onClick={() => setActiveTab('PERIOD')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === 'PERIOD'
                    ? 'bg-[#8C8C70] text-white font-bold shadow-2xs'
                    : 'text-[#5A5A40] hover:bg-[#FAF9F5]'
                }`}
              >
                近1年/半年/3月
              </button>
              <button
                onClick={() => setActiveTab('YEARLY')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === 'YEARLY'
                    ? 'bg-[#8C8C70] text-white font-bold shadow-2xs'
                    : 'text-[#5A5A40] hover:bg-[#FAF9F5]'
                }`}
              >
                按年份
              </button>
            </div>
          </div>

          {/* Section 1: 近1年 / 近半年 / 近3个月统计 */}
          {(activeTab === 'ALL' || activeTab === 'PERIOD') && (
            <div>
              <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-[#5A5A40]">
                <CalendarDays className="w-4 h-4 text-[#8C8C70]" />
                <span>周期滚动统计 (近3个月 / 近半年 / 近一年)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {periodSummaries.map((item) => (
                  <StatCard
                    key={item.key}
                    item={item}
                    isCurrent={isCurrentSelection(item.months)}
                    onApply={() => onSelectMonths(item.months)}
                    accentColor="emerald"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 2: 按年份统计 */}
          {(activeTab === 'ALL' || activeTab === 'YEARLY') && (
            <div>
              <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-[#5A5A40]">
                <TrendingUp className="w-4 h-4 text-[#C27838]" />
                <span>按年份统计 (历史年度数据汇总)</span>
              </div>

              {yearlySummaries.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#A8A890] bg-[#FAF9F5] rounded-lg border border-[#E8E6DF]">
                  暂无年度统计数据
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yearlySummaries.map((item) => (
                    <StatCard
                      key={item.key}
                      item={item}
                      isCurrent={isCurrentSelection(item.months)}
                      onApply={() => onSelectMonths(item.months)}
                      accentColor="amber"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  item: PeriodSummaryItem;
  isCurrent: boolean;
  onApply: () => void;
  accentColor: 'emerald' | 'amber';
}

const StatCard: React.FC<StatCardProps> = ({
  item,
  isCurrent,
  onApply,
}) => {
  return (
    <div
      className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
        isCurrent
          ? 'bg-amber-50/60 border-amber-300 shadow-sm ring-2 ring-amber-400/30'
          : 'bg-white border-[#E8E6DF] hover:border-[#8C8C70] hover:shadow-2xs'
      }`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#4A4A40] flex items-center gap-1.5">
              {item.title}
            </h3>
            <p className="text-[11px] text-[#8A8A70] font-mono mt-0.5">
              {item.subTitle}
            </p>
          </div>

          {isCurrent ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
              <CheckCircle2 className="w-3 h-3 text-amber-600" />
              当前生效
            </span>
          ) : (
            <button
              onClick={onApply}
              className="text-[11px] font-bold text-[#5A5A40] hover:text-white bg-[#F5F2EB] hover:bg-[#8C8C70] px-2.5 py-1 rounded-md border border-[#E8E6DF] transition-colors cursor-pointer shrink-0"
            >
              应用查看
            </button>
          )}
        </div>

        {/* Main Metric: Total Revenue */}
        <div className="mb-3.5 bg-[#FAF9F5] p-2.5 rounded-lg border border-[#E8E6DF]/80">
          <div className="text-[11px] font-medium text-[#8A8A70]">总销售业绩</div>
          <div className="flex items-baseline justify-between gap-1 mt-0.5">
            <span className="text-lg font-black text-[#5E7A56] font-mono">
              ¥{item.totalPerformance.toLocaleString()}
            </span>
            {item.months.length > 1 && (
              <span className="text-[11px] text-[#8A8A70] font-mono">
                月均: ¥{item.monthlyAverage.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Detailed Metrics Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="p-2 rounded bg-[#FAF9F5] border border-[#E8E6DF]/60">
            <div className="text-[10px] text-[#8A8A70] flex items-center gap-1">
              <Award className="w-3 h-3 text-[#C27838]" />
              销售提成+奖金
            </div>
            <div className="font-bold text-[#4A4A40] mt-0.5 font-mono">
              ¥{item.salesTotal.toLocaleString()}
            </div>
            {item.bonus > 0 && (
              <div className="text-[9px] text-[#8A8A70]">
                (提成¥{item.salesCommission.toLocaleString()} + 奖金¥{item.bonus.toLocaleString()})
              </div>
            )}
          </div>

          <div className="p-2 rounded bg-[#FAF9F5] border border-[#E8E6DF]/60">
            <div className="text-[10px] text-[#8A8A70] flex items-center gap-1">
              <Users className="w-3 h-3 text-[#5E7A56]" />
              教师提成合计
            </div>
            <div className="font-bold text-[#5E7A56] mt-0.5 font-mono">
              ¥{item.teacherCommission.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Info */}
      <div className="pt-2 border-t border-[#E8E6DF]/60 flex items-center justify-between text-[11px] text-[#8A8A70]">
        <span>
          总单数: <strong className="text-[#4A4A40] font-mono">{item.recordCount}</strong> 笔
        </span>
        <span>
          新报: <strong className="text-[#4A4A40] font-mono">{item.newSignupCount}</strong> 人
        </span>
        <span>
          总支出: <strong className="text-[#C27838] font-mono">¥{item.grandTotalCommission.toLocaleString()}</strong>
        </span>
      </div>
    </div>
  );
};
