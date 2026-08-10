import React from 'react';
import { X, Award, Percent, UserCheck, CheckCircle2 } from 'lucide-react';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RuleModal: React.FC<RuleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A4A40]/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E8E6DF] my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8C8C70] text-white flex items-center justify-center font-bold shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#5A5A40]">提成与奖金计算规则</h3>
              <p className="text-xs text-[#8A8A70]">培训学校标准化核算逻辑</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A8A890] hover:text-[#5A5A40] hover:bg-[#F5F2EB] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-6 text-sm text-[#4A4A40]">
          {/* Section 1: Sales Commission */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#5A5A40]">
              <Percent className="w-4 h-4 text-[#8C8C70]" />
              <span>1. 销售人员提成比例说明</span>
            </div>
            <div className="bg-[#F5F2EB] p-3.5 rounded-xl border border-[#E8E6DF] space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-[#8C8C70] w-16 shrink-0">【新报】</span>
                <span>
                  根据销售顾问工作性质分为两类：
                  <br />
                  • <strong>普通课程顾问</strong>：新报提成 <strong>7%</strong>
                  <br />• <strong>非自主招生课程顾问</strong>：新报提成 <strong>5%</strong>
                </span>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-[#E8E6DF]">
                <span className="font-semibold text-[#8C8C70] w-16 shrink-0">【续费】</span>
                <span>所有销售人员续费提成均为 <strong>5%</strong></span>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-[#E8E6DF]">
                <span className="font-semibold text-[#8C8C70] w-16 shrink-0">【集训】</span>
                <span>所有销售人员集训班提成均为 <strong>5%</strong></span>
              </div>
            </div>
          </div>

          {/* Section 2: Teacher Commission */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#5A5A40]">
              <UserCheck className="w-4 h-4 text-[#5E7A56]" />
              <span>2. 教师提成比例说明</span>
            </div>
            <div className="bg-[#F5F2EB] p-3.5 rounded-xl border border-[#E8E6DF] space-y-1.5 text-xs">
              <p>• <strong>新报课程</strong>：老师提成比例为 <strong>1%</strong></p>
              <p>• <strong>续费课程</strong>：老师提成比例为 <strong>1%</strong></p>
              <p>• <strong>集训课程</strong>：老师提成比例为 <strong>0%</strong></p>
              <p className="text-rose-700 font-medium pt-1 border-t border-[#E8E6DF]">
                ⚠️ 特别规定：当记录中“老师”一栏为空时，无论是否新报或续费，该笔交易均不计算老师提成（提成为0）。
              </p>
            </div>
          </div>

          {/* Section 3: Bonus Rules */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#5A5A40]">
              <Award className="w-4 h-4 text-[#C27838]" />
              <span>3. 销售人员奖金阶梯规则</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* New signup bonus */}
              <div className="bg-[#FAF2EB] border border-[#E8E6DF] p-3.5 rounded-xl space-y-2">
                <div className="font-bold text-[#C27838] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#C27838]" />
                  新报业绩奖金阶梯
                </div>
                <ul className="space-y-1 text-[#4A4A40] leading-relaxed">
                  <li>• 新报合计 <strong>&lt; 18,000元</strong>：奖金 0元</li>
                  <li>• 新报合计达到 <strong>18,000元</strong>：奖金 <strong>1,000元</strong></li>
                  <li>• 新报合计达到 <strong>26,000元</strong>：奖金 <strong>2,000元</strong></li>
                  <li>• 之后新报金额每增加 <strong>10,000元</strong>，奖金再增加 <strong>1,000元</strong>（以此类推，多到多得）</li>
                </ul>
              </div>

              {/* Renewal bonus */}
              <div className="bg-[#F0EFE9] border border-[#E8E6DF] p-3.5 rounded-xl space-y-2">
                <div className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#8C8C70]" />
                  续费业绩奖金阶梯
                </div>
                <ul className="space-y-1 text-[#4A4A40] leading-relaxed">
                  <li>• 续费合计 <strong>&lt; 50,000元</strong>：奖金 0元</li>
                  <li>• 续费合计达到 <strong>50,000元</strong>：奖金 <strong>800元</strong></li>
                  <li>• 之后续费金额每增加 <strong>30,000元</strong>，奖金增加 <strong>800元</strong>（以此累计）</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E8E6DF] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#8C8C70] hover:bg-[#7A7A60] rounded-lg shadow-2xs"
          >
            我已了解
          </button>
        </div>
      </div>
    </div>
  );
};
