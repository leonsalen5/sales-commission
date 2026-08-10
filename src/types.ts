export type RecordType = '新' | '续' | '集训' | string;

export interface SalesRecord {
  id: string;
  batchId: string;
  month: string; // YYYY-MM
  date: string; // e.g. 2026/7/1
  incomeName: string; // 收入 / 学生姓名
  project: string; // 项目 / 课程种类
  type: RecordType; // 类型：新、续、集训
  amount: number; // 金额
  salesperson: string; // 销售人
  teacher: string; // 老师
  notes: string; // 备注
  customSalesCommissionRate?: number; // 自定义销售提成比例 (如 0.07 代表 7%)
  customTeacherCommissionRate?: number; // 自定义教师提成比例 (如 0.01 代表 1%)
}

export interface ImportBatch {
  id: string;
  month: string; // YYYY-MM
  fileName: string;
  uploadedAt: string;
  recordCount: number;
  totalAmount: number;
}

export type SalespersonRole = '普通课程顾问' | '非自主招生课程顾问';

export interface SalespersonConfig {
  salesperson: string;
  role: SalespersonRole;
  customNewRate?: number; // 自定义新报默认提成比例 (如 0.05 代表 5%)
  // Month string (YYYY-MM) -> other amount
  otherAmountByMonth?: Record<string, number>;
}

// Calculations interface
export interface CalculatedRecord extends SalesRecord {
  salesCommissionRate: number; // 0.07, 0.05, etc.
  salesCommissionAmount: number; // amount * salesCommissionRate
  teacherCommissionRate: number; // 0.01, 0, etc.
  teacherCommissionAmount: number; // amount * teacherCommissionRate
}

export interface SalespersonSummary {
  salesperson: string;
  role: SalespersonRole;
  renewalAmount: number; // 续费合计
  newSignupAmount: number; // 新报合计
  intensiveAmount: number; // 集训合计
  otherAmount: number; // 其它（手动填写）
  totalPerformance: number; // 总业绩 = 续费合计 + 新报合计 + 集训合计
  renewalCommission: number; // 续费提成
  newSignupCommission: number; // 新报提成
  intensiveCommission: number; // 集训提成
  totalCommission: number; // 总提成 = 续费提成 + 新报提成 + 集训提成
  newSignupBonus: number; // 新报奖金
  renewalBonus: number; // 续费奖金
  bonus: number; // 奖金合计 = 新报奖金 + 续费奖金
  newSignupCount: number; // 新报人数（记录条数）
  totalRecordCount: number; // 总单数
}

export interface TeacherSummary {
  teacher: string;
  totalCommission: number; // 提成合计金额
  newSignupCount: number; // 新报人数
  renewalCount: number; // 续费人数/单数
  intensiveCount: number; // 集训单数
  totalAmount: number; // 总带生金额/对应业绩
  totalRecords: number; // 总带单数量
}

export interface ProjectSummary {
  project: string;
  salesCount: number; // 销售量（出现次数）
  totalAmount: number; // 销售总额
  newCount: number;
  renewalCount: number;
  intensiveCount: number;
}

export interface TypeSummary {
  type: string; // 新、续、集训
  totalAmount: number; // 合计金额
  totalCommission: number; // 提成合计
  totalBonus: number; // 对应奖金合计
  recordCount: number; // 记录数
}

export interface SystemData {
  batches: ImportBatch[];
  records: SalesRecord[];
  configs: Record<string, SalespersonConfig>;
  passwordHash?: string;
}
