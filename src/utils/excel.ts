import * as XLSX from 'xlsx';
import {
  SalesRecord,
  SalespersonConfig,
  SalespersonSummary,
  TeacherSummary,
  ProjectSummary,
  TypeSummary,
} from '../types';
import { calculateRecordDetails } from './calculations';

/**
 * Parses Excel date cell or string into YYYY/M/D and YYYY-MM
 */
export function parseExcelDate(val: any): { dateStr: string; monthStr: string } {
  if (!val) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return { dateStr: `${y}/${now.getMonth() + 1}/${now.getDate()}`, monthStr: `${y}-${m}` };
  }

  // Handle JavaScript Date
  if (val instanceof Date) {
    let y = val.getFullYear();
    let mInt = val.getMonth() + 1;
    let d = val.getDate();

    // If UTC time is exact midnight, use UTC components
    if (val.getUTCHours() === 0 && val.getUTCMinutes() === 0 && val.getUTCSeconds() === 0) {
      y = val.getUTCFullYear();
      mInt = val.getUTCMonth() + 1;
      d = val.getUTCDate();
    }

    const m = String(mInt).padStart(2, '0');
    return { dateStr: `${y}/${mInt}/${d}`, monthStr: `${y}-${m}` };
  }

  // Handle Excel serial date number (e.g., 45474, 46204)
  if (typeof val === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(val);
    if (parsedDate) {
      const y = parsedDate.y;
      const mInt = parsedDate.m;
      const m = String(mInt).padStart(2, '0');
      const d = parsedDate.d;
      return { dateStr: `${y}/${mInt}/${d}`, monthStr: `${y}-${m}` };
    }
  }

  // Handle string (e.g. "2026/7/1", "2026-07-01", "2026年7月1日")
  const cleanStr = String(val).trim();

  // Try matching full year format first (e.g. "2026年7月1日", "2026-07-01", "2026/7/1")
  const fullYearMatch = cleanStr.match(/(\d{4})[年/.-]\s*(\d{1,2})[月/.-]?\s*(\d{1,2})?/);
  if (fullYearMatch) {
    const y = parseInt(fullYearMatch[1], 10);
    const mInt = parseInt(fullYearMatch[2], 10);
    const d = fullYearMatch[3] ? parseInt(fullYearMatch[3], 10) : 1;
    const m = String(mInt).padStart(2, '0');
    return { dateStr: `${y}/${mInt}/${d}`, monthStr: `${y}-${m}` };
  }

  // Fallback for strings like "7/1" or "07-01"
  const str = cleanStr.replace(/\./g, '/').replace(/-/g, '/');
  const parts = str.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    let y = new Date().getFullYear();
    let mInt = 1;
    let d = 1;

    if (parts[0].length === 4) {
      y = parseInt(parts[0], 10);
      mInt = parseInt(parts[1], 10) || 1;
      d = parts[2] ? parseInt(parts[2], 10) || 1 : 1;
    } else {
      mInt = parseInt(parts[0], 10) || 1;
      d = parseInt(parts[1], 10) || 1;
    }

    const m = String(mInt).padStart(2, '0');
    return { dateStr: `${y}/${mInt}/${d}`, monthStr: `${y}-${m}` };
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { dateStr: cleanStr || `${y}/${now.getMonth() + 1}/${now.getDate()}`, monthStr: `${y}-${m}` };
}

/**
 * Parses raw Excel file buffer or ArrayBuffer into array of raw SalesRecord objects
 */
export function parseExcelFile(
  fileBuffer: ArrayBuffer,
  batchId: string,
  overrideMonth?: string
): SalesRecord[] {
  // Disable cellDates so Excel serial numbers are parsed without timezone shifts
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to array of objects
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (rawRows.length === 0) return [];

  const records: SalesRecord[] = [];

  rawRows.forEach((row, index) => {
    // Column header fuzzy matching
    let dateVal = '';
    let incomeName = '';
    let project = '';
    let type = '';
    let amount = 0;
    let salesperson = '';
    let teacher = '';
    let notes = '';

    for (const key of Object.keys(row)) {
      const cleanKey = key.trim();
      const val = row[key];

      if (/日期|时间|Date/i.test(cleanKey)) {
        dateVal = val;
      } else if (/收入|学生|学员|姓名/i.test(cleanKey)) {
        incomeName = String(val).trim();
      } else if (/项目|课程|科目|班型/i.test(cleanKey)) {
        project = String(val).trim();
      } else if (/类型|类别|班级/i.test(cleanKey)) {
        type = String(val).trim();
      } else if (/金额|费用|款项/i.test(cleanKey)) {
        amount = parseFloat(val) || 0;
      } else if (/销售人|销售|顾问/i.test(cleanKey)) {
        salesperson = String(val).trim();
      } else if (/老师|教师/i.test(cleanKey)) {
        teacher = String(val).trim();
      } else if (/备注|说明/i.test(cleanKey)) {
        notes = String(val).trim();
      }
    }

    const { dateStr, monthStr } = parseExcelDate(dateVal);
    const finalMonth = overrideMonth && overrideMonth.trim() ? overrideMonth.trim() : monthStr;

    // Standardize record type
    let cleanType = type;
    if (type.includes('新')) cleanType = '新';
    else if (type.includes('续')) cleanType = '续';
    else if (type.includes('集训')) cleanType = '集训';
    else cleanType = '新'; // Fallback

    records.push({
      id: `${batchId}_rec_${index + 1}`,
      batchId,
      month: finalMonth,
      date: dateStr,
      incomeName: incomeName || '未名学生',
      project: project || '通用课程',
      type: cleanType,
      amount: Math.max(0, amount),
      salesperson: salesperson || '未名销售',
      teacher: teacher || '',
      notes: notes || '',
    });
  });

  return records;
}

/**
 * Generates formatted multi-sheet Excel Workbook and triggers browser download
 */
export function exportExcelWorkbook(
  records: SalesRecord[],
  salespersonConfigs: Record<string, SalespersonConfig>,
  spSummaries: SalespersonSummary[],
  teacherSummaries: TeacherSummary[],
  projectSummaries: ProjectSummary[],
  typeSummaries: TypeSummary[],
  filename: string = '提成与奖金统计表.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: 销售提成统计表 (Salesperson Summary)
  const spSheetData = spSummaries.map((s) => ({
    销售人: s.salesperson,
    工作性质: s.role,
    续费合计: s.renewalAmount,
    新报合计: s.newSignupAmount,
    集训合计: s.intensiveAmount,
    其它: s.otherAmount,
    总业绩: s.totalPerformance,
    续费提成: s.renewalCommission,
    新报提成: s.newSignupCommission,
    集训提成: s.intensiveCommission,
    奖金: s.bonus,
    总提成: s.totalCommission,
    新报人数: s.newSignupCount,
    新报奖金: s.newSignupBonus,
    续费奖金: s.renewalBonus,
  }));
  const wsSp = XLSX.utils.json_to_sheet(spSheetData);
  XLSX.utils.book_append_sheet(wb, wsSp, '销售提成与奖金统计表');

  // 2. Sheet 2: 老师提成合计 (Teacher Summary)
  const teacherSheetData = teacherSummaries.map((t) => ({
    老师姓名: t.teacher,
    提成合计金额: t.totalCommission,
    新报人数: t.newSignupCount,
    续费单数: t.renewalCount,
    集训单数: t.intensiveCount,
    总业绩金额: t.totalAmount,
    总服务单数: t.totalRecords,
  }));
  const wsTeacher = XLSX.utils.json_to_sheet(teacherSheetData);
  XLSX.utils.book_append_sheet(wb, wsTeacher, '老师提成合计表');

  // 3. Sheet 3: 项目销量统计 (Project Breakdown)
  const projSheetData = projectSummaries.map((p) => ({
    项目名称: p.project,
    销售量: p.salesCount,
    销售总额: p.totalAmount,
    新报单数: p.newCount,
    续费单数: p.renewalCount,
    集训单数: p.intensiveCount,
  }));
  const wsProj = XLSX.utils.json_to_sheet(projSheetData);
  XLSX.utils.book_append_sheet(wb, wsProj, '项目销量统计表');

  // 4. Sheet 4: 类型汇总 (Type Breakdown)
  const typeSheetData = typeSummaries.map((t) => ({
    类型: t.type,
    合计金额: t.totalAmount,
    提成合计: t.totalCommission,
    奖金合计: t.totalBonus,
    单数: t.recordCount,
  }));
  const wsType = XLSX.utils.json_to_sheet(typeSheetData);
  XLSX.utils.book_append_sheet(wb, wsType, '类型分类汇总表');

  // 5. Sheet 5: 提成明细记录 (Detailed Records)
  const detailSheetData = records.map((r) => {
    const calc = calculateRecordDetails(r, salespersonConfigs);
    return {
      月份: calc.month,
      日期: calc.date,
      收入: calc.incomeName,
      项目: calc.project,
      类型: calc.type,
      金额: calc.amount,
      销售人: calc.salesperson,
      '销售提成%': `${(calc.salesCommissionRate * 100).toFixed(0)}%`,
      销售提成金额: calc.salesCommissionAmount,
      老师: calc.teacher || '(无)',
      '老师提成%': `${(calc.teacherCommissionRate * 100).toFixed(0)}%`,
      老师提成金额: calc.teacherCommissionAmount,
      备注: calc.notes,
    };
  });
  const wsDetail = XLSX.utils.json_to_sheet(detailSheetData);
  XLSX.utils.book_append_sheet(wb, wsDetail, '销售记录提成明细');

  // Trigger download in browser
  XLSX.writeFile(wb, filename);
}
