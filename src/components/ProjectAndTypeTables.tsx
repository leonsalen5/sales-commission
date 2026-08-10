import React from 'react';
import { ProjectSummary, TypeSummary } from '../types';
import { Layers, PieChart } from 'lucide-react';

interface ProjectAndTypeTablesProps {
  projectSummaries: ProjectSummary[];
  typeSummaries: TypeSummary[];
}

export const ProjectAndTypeTables: React.FC<ProjectAndTypeTablesProps> = ({
  projectSummaries,
  typeSummaries,
}) => {
  const totalProjectSales = projectSummaries.reduce((s, p) => s + p.salesCount, 0);
  const totalProjectAmount = projectSummaries.reduce((s, p) => s + p.totalAmount, 0);
  const totalNewCount = projectSummaries.reduce((s, p) => s + p.newCount, 0);
  const totalRenewalCount = projectSummaries.reduce((s, p) => s + p.renewalCount, 0);
  const totalIntensiveCount = projectSummaries.reduce((s, p) => s + p.intensiveCount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Type Breakdown (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E8E6DF] shadow-2xs overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E8E6DF] bg-[#FDFCF9] flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#8C8C70] text-white flex items-center justify-center font-bold">
            <PieChart className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="font-bold text-[#5A5A40] text-base">
              按类型统计 (新/续/集训)
            </h2>
            <p className="text-xs text-[#8A8A70]">
              各类型报名的合计金额、提成与奖金分配
            </p>
          </div>
        </div>

        <div className="p-4 flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F2EB] text-[#8A8A70] font-semibold border-b border-[#E8E6DF]">
                  <th className="py-2.5 px-3">类型</th>
                  <th className="py-2.5 px-3 text-right">合计金额</th>
                  <th className="py-2.5 px-3 text-right">提成合计</th>
                  <th className="py-2.5 px-3 text-right font-bold text-[#C27838]">
                    奖金合计
                  </th>
                  <th className="py-2.5 px-3 text-center">笔数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE6] text-[#4A4A40]">
                {typeSummaries.map((t) => (
                  <tr key={t.type} className="hover:bg-[#FAF9F5]">
                    <td className="py-3 px-3 font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          t.type === '新报'
                            ? 'bg-[#F5F2EB] text-[#5A5A40] border border-[#E8E6DF]'
                            : t.type === '续费'
                            ? 'bg-[#F0EFE9] text-[#8C8C70] border border-[#E8E6DF]'
                            : 'bg-[#FAF2EB] text-[#C27838] border border-[#E8E6DF]'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-[#4A4A40]">
                      ¥{t.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-[#8C8C70]">
                      ¥{t.totalCommission.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#C27838] bg-[#FAF2EB]/60">
                      ¥{t.totalBonus.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center text-[#8A8A70]">
                      {t.recordCount} 笔
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Project Breakdown (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E8E6DF] shadow-2xs overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E8E6DF] bg-[#FDFCF9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#8C8C70] text-white flex items-center justify-center font-bold">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-[#5A5A40] text-base">
                项目/课程销量统计
              </h2>
              <p className="text-xs text-[#8A8A70]">
                按课程出现的频次统计销售量（1次即为销售1份）
              </p>
            </div>
          </div>
          <span className="text-xs text-[#5A5A40] bg-[#F5F2EB] border border-[#E8E6DF] px-2.5 py-1 rounded-full font-semibold">
            共 {totalProjectSales} 份销量
          </span>
        </div>

        <div className="p-4 flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F2EB] text-[#8A8A70] font-semibold border-b border-[#E8E6DF]">
                  <th className="py-2.5 px-3">项目/课程名称</th>
                  <th className="py-2.5 px-3 text-center font-bold text-[#5A5A40]">
                    销售量(份)
                  </th>
                  <th className="py-2.5 px-3 text-right font-bold">销售总额</th>
                  <th className="py-2.5 px-3 text-center text-[#8A8A70]">新报</th>
                  <th className="py-2.5 px-3 text-center text-[#8A8A70]">续费</th>
                  <th className="py-2.5 px-3 text-center text-[#8A8A70]">集训</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE6] text-[#4A4A40]">
                {projectSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#A8A890]">
                      暂无项目销量数据
                    </td>
                  </tr>
                ) : (
                  projectSummaries.map((p) => (
                    <tr key={p.project} className="hover:bg-[#FAF9F5]">
                      <td className="py-3 px-3 font-bold text-[#4A4A40]">
                        {p.project}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block bg-[#F5F2EB] text-[#5A5A40] font-extrabold px-2.5 py-0.5 rounded-full border border-[#E8E6DF]">
                          {p.salesCount} 份
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[#4A4A40]">
                        ¥{p.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center text-[#8A8A70]">
                        {p.newCount}
                      </td>
                      <td className="py-3 px-3 text-center text-[#8A8A70]">
                        {p.renewalCount}
                      </td>
                      <td className="py-3 px-3 text-center text-[#8A8A70]">
                        {p.intensiveCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {projectSummaries.length > 0 && (
                <tfoot>
                  <tr className="bg-[#F5F2EB] font-bold text-[#4A4A40] border-t border-[#E8E6DF]">
                    <td className="py-2.5 px-3">合计 ({projectSummaries.length}类)</td>
                    <td className="py-2.5 px-3 text-center text-[#5A5A40]">
                      {totalProjectSales} 份
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      ¥{totalProjectAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-[#5A5A40]">
                      {totalNewCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-[#5A5A40]">
                      {totalRenewalCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-[#5A5A40]">
                      {totalIntensiveCount}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
