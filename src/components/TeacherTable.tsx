import React from 'react';
import { TeacherSummary } from '../types';
import { GraduationCap, Users } from 'lucide-react';

interface TeacherTableProps {
  summaries: TeacherSummary[];
}

export const TeacherTable: React.FC<TeacherTableProps> = ({ summaries }) => {
  const totals = summaries.reduce(
    (acc, t) => ({
      totalCommission: acc.totalCommission + t.totalCommission,
      newSignupCount: acc.newSignupCount + t.newSignupCount,
      renewalCount: acc.renewalCount + t.renewalCount,
      intensiveCount: acc.intensiveCount + t.intensiveCount,
      totalAmount: acc.totalAmount + t.totalAmount,
      totalRecords: acc.totalRecords + t.totalRecords,
    }),
    {
      totalCommission: 0,
      newSignupCount: 0,
      renewalCount: 0,
      intensiveCount: 0,
      totalAmount: 0,
      totalRecords: 0,
    }
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E8E6DF] shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E8E6DF] bg-[#FDFCF9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#6B8E62] text-white flex items-center justify-center font-bold">
            <GraduationCap className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="font-bold text-[#5A5A40] text-base">
              老师提成合计表
            </h2>
            <p className="text-xs text-[#8A8A70]">
              新报(1%)、续费(1%)提成汇总及学员带班情况（集训0%提成，无老师不计提成）
            </p>
          </div>
        </div>
        <span className="text-xs text-[#5E7A56] bg-[#F0F5EF] border border-[#D4E3D2] px-2.5 py-1 rounded-full font-medium self-start sm:self-auto">
          共 {summaries.length} 位老师
        </span>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F5F2EB] text-[#8A8A70] font-semibold border-b border-[#E8E6DF]">
              <th className="py-3 px-4 font-bold">老师姓名</th>
              <th className="py-3 px-4 text-right font-bold text-[#5E7A56] bg-[#F0F5EF]/60">
                提成合计金额 (1%新/续)
              </th>
              <th className="py-3 px-4 text-center font-bold">
                新报人数 (1记录=1人)
              </th>
              <th className="py-3 px-4 text-center">续费单数</th>
              <th className="py-3 px-4 text-center text-[#A8A890]">
                集训单数 (0%)
              </th>
              <th className="py-3 px-4 text-right">总指导课时/业绩额</th>
              <th className="py-3 px-4 text-center">总课时记录数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EEE6] text-[#4A4A40]">
            {summaries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#A8A890]">
                  所选范围内暂无老师提成数据
                </td>
              </tr>
            ) : (
              summaries.map((t) => (
                <tr
                  key={t.teacher}
                  className="hover:bg-[#FAF9F5] transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-[#4A4A40]">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#6B8E62]" />
                      <span>{t.teacher}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#5E7A56] bg-[#F0F5EF]/40 text-sm">
                    ¥{t.totalCommission.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block bg-[#F0F5EF] text-[#5E7A56] font-bold px-2.5 py-0.5 rounded-full border border-[#D4E3D2]">
                      {t.newSignupCount} 人
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-medium">
                    {t.renewalCount} 单
                  </td>
                  <td className="py-3 px-4 text-center text-[#A8A890]">
                    {t.intensiveCount} 单
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-[#4A4A40]">
                    ¥{t.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center text-[#8A8A70]">
                    {t.totalRecords} 笔
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Footer Totals */}
          {summaries.length > 0 && (
            <tfoot>
              <tr className="bg-[#F5F2EB] font-bold text-[#4A4A40] border-t-2 border-[#E8E6DF]">
                <td className="py-3.5 px-4">合计 ({summaries.length}人)</td>
                <td className="py-3.5 px-4 text-right text-[#5E7A56] bg-[#F0F5EF]/80 text-sm font-black">
                  ¥{totals.totalCommission.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-center text-[#5E7A56]">
                  {totals.newSignupCount} 人
                </td>
                <td className="py-3.5 px-4 text-center">
                  {totals.renewalCount} 单
                </td>
                <td className="py-3.5 px-4 text-center text-[#8A8A70]">
                  {totals.intensiveCount} 单
                </td>
                <td className="py-3.5 px-4 text-right">
                  ¥{totals.totalAmount.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-center">
                  {totals.totalRecords} 笔
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
