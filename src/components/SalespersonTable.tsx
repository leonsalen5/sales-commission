import React, { useState } from 'react';
import {
  SalespersonSummary,
  SalespersonRole,
  SalespersonConfig,
} from '../types';
import { User, Award, Edit3, Check, HelpCircle } from 'lucide-react';

interface SalespersonTableProps {
  summaries: SalespersonSummary[];
  configs: Record<string, SalespersonConfig>;
  onUpdateRole: (salesperson: string, role: SalespersonRole) => void;
  onUpdateOtherAmount: (salesperson: string, amount: number) => void;
  selectedMonth: string;
}

export const SalespersonTable: React.FC<SalespersonTableProps> = ({
  summaries,
  configs,
  onUpdateRole,
  onUpdateOtherAmount,
  selectedMonth,
}) => {
  const [editingSp, setEditingSp] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState<string>('');

  const handleStartEdit = (sp: string, currentVal: number) => {
    setEditingSp(sp);
    setEditingVal(String(currentVal || 0));
  };

  const handleSaveOther = (sp: string) => {
    const num = parseFloat(editingVal) || 0;
    onUpdateOtherAmount(sp, num);
    setEditingSp(null);
  };

  // Totals calculation
  const totals = summaries.reduce(
    (acc, item) => ({
      renewalAmount: acc.renewalAmount + item.renewalAmount,
      newSignupAmount: acc.newSignupAmount + item.newSignupAmount,
      intensiveAmount: acc.intensiveAmount + item.intensiveAmount,
      otherAmount: acc.otherAmount + item.otherAmount,
      totalPerformance: acc.totalPerformance + item.totalPerformance,
      renewalCommission: acc.renewalCommission + item.renewalCommission,
      newSignupCommission: acc.newSignupCommission + item.newSignupCommission,
      intensiveCommission: acc.intensiveCommission + item.intensiveCommission,
      totalCommission: acc.totalCommission + item.totalCommission,
      bonus: acc.bonus + item.bonus,
      newSignupCount: acc.newSignupCount + item.newSignupCount,
    }),
    {
      renewalAmount: 0,
      newSignupAmount: 0,
      intensiveAmount: 0,
      otherAmount: 0,
      totalPerformance: 0,
      renewalCommission: 0,
      newSignupCommission: 0,
      intensiveCommission: 0,
      totalCommission: 0,
      bonus: 0,
      newSignupCount: 0,
    }
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E8E6DF] shadow-2xs overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-[#E8E6DF] bg-[#FDFCF9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#8C8C70] text-white flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-[#5A5A40] text-base">
              销售人员提成与奖金汇总表
            </h2>
            <p className="text-xs text-[#8A8A70]">
              各销售顾问业绩、各项提成、其它补贴与多阶梯奖金明细
            </p>
          </div>
        </div>
        <span className="text-xs text-[#5A5A40] bg-[#F5F2EB] border border-[#E8E6DF] px-2.5 py-1 rounded-full self-start sm:self-auto font-medium">
          共 {summaries.length} 名销售人员
        </span>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F5F2EB] text-[#8A8A70] font-semibold border-b border-[#E8E6DF]">
              <th className="py-3 px-3.5 sticky left-0 bg-[#F5F2EB] z-10 shadow-2xs">
                销售人
              </th>
              <th className="py-3 px-3">工作性质(提成率)</th>
              <th className="py-3 px-3 text-right">续费合计</th>
              <th className="py-3 px-3 text-right">新报合计</th>
              <th className="py-3 px-3 text-right">集训合计</th>
              <th className="py-3 px-3 text-right text-[#8C8C70]">其它(可填)</th>
              <th className="py-3 px-3 text-right font-bold text-[#4A4A40] bg-[#E8E6DF]/50">
                总业绩
              </th>
              <th className="py-3 px-3 text-right">续提(5%)</th>
              <th className="py-3 px-3 text-right">新提(7%/5%)</th>
              <th className="py-3 px-3 text-right">集提(5%)</th>
              <th className="py-3 px-3 text-right font-bold text-[#5A5A40] bg-[#F0EFE9]">
                总提成
              </th>
              <th className="py-3 px-3 text-right font-bold text-[#C27838] bg-[#FAF2EB]">
                奖金
              </th>
              <th className="py-3 px-3 text-center">新报人数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EEE6] text-[#4A4A40]">
            {summaries.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-[#A8A890]">
                  当前范围内暂无销售记录，请先导入Excel表格
                </td>
              </tr>
            ) : (
              summaries.map((s, idx) => (
                <tr
                  key={s.salesperson}
                  className="hover:bg-[#FAF9F5] transition-colors"
                >
                  {/* 销售人 */}
                  <td className="py-3 px-3.5 font-bold text-[#4A4A40] sticky left-0 bg-white z-10 shadow-2xs border-r border-[#E8E6DF]">
                    <div className="flex items-center gap-1.5">
                      {idx === 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#FAF2EB] text-[#C27838] flex items-center justify-center text-[10px] font-black border border-[#E8E6DF]">
                          1
                        </span>
                      )}
                      <span>{s.salesperson}</span>
                    </div>
                  </td>

                  {/* 工作性质 */}
                  <td className="py-2.5 px-3">
                    <select
                      value={s.role}
                      onChange={(e) =>
                        onUpdateRole(
                          s.salesperson,
                          e.target.value as SalespersonRole
                        )
                      }
                      className="text-[11px] bg-[#F5F2EB] hover:bg-[#E8E6DF] border border-[#E8E6DF] rounded-md px-1.5 py-1 text-[#4A4A40] font-medium focus:outline-none focus:border-[#8C8C70]"
                    >
                      <option value="普通课程顾问">普通顾问 (新报7%)</option>
                      <option value="非自主招生课程顾问">
                        非自主招生 (新报5%)
                      </option>
                    </select>
                  </td>

                  {/* 续费合计 */}
                  <td className="py-3 px-3 text-right font-medium text-[#4A4A40]">
                    ¥{s.renewalAmount.toLocaleString()}
                  </td>

                  {/* 新报合计 */}
                  <td className="py-3 px-3 text-right font-medium text-[#4A4A40]">
                    ¥{s.newSignupAmount.toLocaleString()}
                  </td>

                  {/* 集训合计 */}
                  <td className="py-3 px-3 text-right font-medium text-[#4A4A40]">
                    ¥{s.intensiveAmount.toLocaleString()}
                  </td>

                  {/* 其它 */}
                  <td className="py-2 px-3 text-right">
                    {editingSp === s.salesperson ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={editingVal}
                          onChange={(e) => setEditingVal(e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-xs text-right border border-[#8C8C70] rounded-md focus:outline-none bg-[#F0EFE9]"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveOther(s.salesperson)}
                          className="p-1 text-[#5E7A56] hover:bg-[#F0F5EF] rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          handleStartEdit(s.salesperson, s.otherAmount)
                        }
                        className="group inline-flex items-center gap-1 font-semibold text-[#8C8C70] hover:text-[#7A7A60] bg-[#F5F2EB] hover:bg-[#E8E6DF] px-2 py-0.5 rounded transition-colors border border-[#E8E6DF]"
                        title="点击编辑其它手动调整项目金额"
                      >
                        <span>¥{s.otherAmount.toLocaleString()}</span>
                        <Edit3 className="w-3 h-3 text-[#A8A890] group-hover:text-[#8C8C70]" />
                      </button>
                    )}
                  </td>

                  {/* 总业绩 */}
                  <td className="py-3 px-3 text-right font-bold text-[#4A4A40] bg-[#FAF9F5]">
                    ¥{s.totalPerformance.toLocaleString()}
                  </td>

                  {/* 续提 */}
                  <td className="py-3 px-3 text-right text-[#8A8A70]">
                    ¥{s.renewalCommission.toLocaleString()}
                  </td>

                  {/* 新提 */}
                  <td className="py-3 px-3 text-right text-[#8A8A70]">
                    ¥{s.newSignupCommission.toLocaleString()}
                  </td>

                  {/* 集提 */}
                  <td className="py-3 px-3 text-right text-[#8A8A70]">
                    ¥{s.intensiveCommission.toLocaleString()}
                  </td>

                  {/* 总提成 */}
                  <td className="py-3 px-3 text-right font-bold text-[#5A5A40] bg-[#F0EFE9]">
                    ¥{s.totalCommission.toLocaleString()}
                  </td>

                  {/* 奖金 */}
                  <td className="py-3 px-3 text-right font-bold text-[#C27838] bg-[#FAF2EB]">
                    <div
                      className="cursor-help inline-flex items-center gap-1 justify-end"
                      title={`新报奖金: ¥${s.newSignupBonus.toLocaleString()} | 续费奖金: ¥${s.renewalBonus.toLocaleString()}`}
                    >
                      <Award className="w-3.5 h-3.5 text-[#C27838]" />
                      <span>¥{s.bonus.toLocaleString()}</span>
                    </div>
                  </td>

                  {/* 新报人数 */}
                  <td className="py-3 px-3 text-center font-medium">
                    <span className="inline-block bg-[#F5F2EB] text-[#5A5A40] border border-[#E8E6DF] px-2 py-0.5 rounded-full font-bold">
                      {s.newSignupCount} 人
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Footer Totals */}
          {summaries.length > 0 && (
            <tfoot>
              <tr className="bg-[#F5F2EB] font-bold text-[#4A4A40] border-t-2 border-[#E8E6DF]">
                <td className="py-3.5 px-3.5 sticky left-0 bg-[#F5F2EB] z-10 border-r border-[#E8E6DF]">
                  合计 ({summaries.length}人)
                </td>
                <td className="py-3.5 px-3 text-[#A8A890] font-normal">-</td>
                <td className="py-3.5 px-3 text-right">
                  ¥{totals.renewalAmount.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right">
                  ¥{totals.newSignupAmount.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right">
                  ¥{totals.intensiveAmount.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right text-[#8C8C70]">
                  ¥{totals.otherAmount.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right text-[#4A4A40] bg-[#E8E6DF]/60">
                  ¥{totals.totalPerformance.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right">
                  ¥{totals.renewalCommission.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right">
                  ¥{totals.newSignupCommission.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right">
                  ¥{totals.intensiveCommission.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right text-[#5A5A40] bg-[#F0EFE9] font-black">
                  ¥{totals.totalCommission.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-right text-[#C27838] bg-[#FAF2EB] font-black">
                  ¥{totals.bonus.toLocaleString()}
                </td>
                <td className="py-3.5 px-3 text-center text-[#4A4A40]">
                  {totals.newSignupCount} 人
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
