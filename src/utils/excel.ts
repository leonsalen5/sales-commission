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
 * Supports multi-sheet workbooks, auto-detection of detailed records sheets, and multi-month files.
 */
export function parseExcelFile(
  fileBuffer: ArrayBuffer,
  batchId: string,
  overrideMonth?: string
): SalesRecord[] {
  // Disable cellDates so Excel serial numbers are parsed without timezone shifts
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: false });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];

  interface SheetCandidate {
    name: string;
    worksheet: XLSX.WorkSheet;
    score: number;
    rows: any[];
    isExplicitDetailSheet: boolean;
  }

  const sheetCandidates: SheetCandidate[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (rows.length === 0) return;

    // Check headers of first row
    const firstRow = rows[0] || {};
    const keys = Object.keys(firstRow);

    let score = 0;
    let hasDate = false;
    let hasIncome = false;
    let hasAmount = false;
    let hasSalesperson = false;
    let isExplicitDetailSheet = false;

    if (/明细|记录|流水|数据|Detail|Record/i.test(sheetName)) {
      score += 100;
      isExplicitDetailSheet = true;
    }
    // Penalize pure summary sheets like 销售提成与奖金统计表 / 老师提成合计表 / 项目销量统计表 / 类型分类汇总表
    if (/汇总|统计表|合计表|分类/i.test(sheetName) && !/明细|记录/i.test(sheetName)) {
      score -= 50;
    }

    keys.forEach((key) => {
      const cleanKey = key.trim();
      if (/^日期$|^收款日期$|^缴费日期$|^时间$|^Date$/i.test(cleanKey)) {
        hasDate = true;
        score += 25;
      }
      if (/^收入$|^学生$|^学员$|^姓名$|^客户$|^客户姓名$/i.test(cleanKey)) {
        hasIncome = true;
        score += 25;
      }
      if (/^金额$|^实收金额$|^学费$|^缴费金额$|^成交金额$/i.test(cleanKey)) {
        hasAmount = true;
        score += 25;
      }
      if (/^销售人$|^销售$|^顾问$|^销售顾问$|^招生顾问$/i.test(cleanKey)) {
        hasSalesperson = true;
        score += 25;
      }
      if (/^项目$|^课程$|^科目$|^班型$/i.test(cleanKey)) score += 10;
      if (/^类型$|^类别$|^班级$/i.test(cleanKey)) score += 10;
      if (/^老师$|^教师$|^任课老师$/i.test(cleanKey)) score += 10;
      if (/^月份$|^所属月份$|^Month$/i.test(cleanKey)) score += 15;
    });

    // Valid if it looks like sales records table
    if ((hasIncome && hasAmount) || (hasDate && hasAmount) || (hasSalesperson && hasAmount)) {
      score += Math.min(rows.length, 200);
      sheetCandidates.push({
        name: sheetName,
        worksheet,
        score,
        rows,
        isExplicitDetailSheet,
      });
    }
  });

  // Determine which sheets to process
  let sheetsToProcess: SheetCandidate[] = [];

  // 1. If there is a sheet explicitly named with "明细" (e.g. "销售记录提成明细"), prioritize it
  const explicitDetailSheet = sheetCandidates.find((s) => s.isExplicitDetailSheet);
  if (explicitDetailSheet && explicitDetailSheet.rows.length > 0) {
    sheetsToProcess = [explicitDetailSheet];
  } else if (sheetCandidates.length > 0) {
    // 2. If multiple monthly sheets exist (e.g. each sheet is a month like "2024-01", "2024-02", "1月", "2月")
    const looksLikeMonthlySheets =
      sheetCandidates.length > 1 &&
      sheetCandidates.every((s) => s.score > 20 && s.rows.length >= 1);

    if (looksLikeMonthlySheets && sheetCandidates.length > 1) {
      // Process all monthly sheets
      sheetsToProcess = sheetCandidates;
    } else {
      // Pick the sheet with highest score
      sheetCandidates.sort((a, b) => b.score - a.score);
      sheetsToProcess = [sheetCandidates[0]];
    }
  } else {
    // Fallback to first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    sheetsToProcess = [{ name: firstSheetName, worksheet, score: 0, rows, isExplicitDetailSheet: false }];
  }

  // Helper function to resolve column header from a row's keys
  function resolveColumnKey(
    keys: string[],
    exactRegex: RegExp,
    fuzzyRegex?: RegExp,
    excludeRegex?: RegExp
  ): string | undefined {
    // 1. Try exact match first
    const exactMatch = keys.find((k) => exactRegex.test(k.trim()));
    if (exactMatch) return exactMatch;

    // 2. Try fuzzy match without forbidden keywords
    if (fuzzyRegex) {
      return keys.find((k) => {
        const trimmed = k.trim();
        if (excludeRegex && excludeRegex.test(trimmed)) return false;
        return fuzzyRegex.test(trimmed);
      });
    }
    return undefined;
  }

  const allRecords: SalesRecord[] = [];
  let recordCounter = 1;

  sheetsToProcess.forEach((sheet) => {
    // Try inferring month from sheet name if sheet name contains year/month (e.g. "2024-05", "2024年5月")
    let sheetInferredMonth = '';
    const sheetMonthMatch = sheet.name.match(/(\d{4})[年/.-]?\s*(\d{1,2})/);
    if (sheetMonthMatch) {
      const y = sheetMonthMatch[1];
      const m = String(parseInt(sheetMonthMatch[2], 10)).padStart(2, '0');
      sheetInferredMonth = `${y}-${m}`;
    }

    if (sheet.rows.length === 0) return;

    // Detect column mapping from the keys of the first row
    const rowKeys = Object.keys(sheet.rows[0]);

    const monthCol = resolveColumnKey(
      rowKeys,
      /^月份$|^所属月份$|^Month$/i,
      /月份|所属月份|Month/i,
      /人数|合计|统计/i
    );

    const dateCol = resolveColumnKey(
      rowKeys,
      /^日期$|^收款日期$|^缴费日期$|^时间$|^Date$|^录入日期$|^报名单日期$/i,
      /日期|收款时间|缴费时间|Date/i,
      /生[日号]|结业|截止|出生/i
    );

    const incomeCol = resolveColumnKey(
      rowKeys,
      /^收入$|^学生$|^学员$|^姓名$|^学员姓名$|^学生姓名$|^客户$|^客户姓名$|^缴费人$/i,
      /学员|学生|客户姓名|学员姓名/i,
      /销售|老师|顾问|合计|总计|提成/i
    );

    const projectCol = resolveColumnKey(
      rowKeys,
      /^项目$|^课程$|^科目$|^班型$|^项目名称$|^课程名称$|^购买项目$/i,
      /项目|课程|科目|班型/i,
      /销量|提成|奖金|人数|金额|合计/i
    );

    const typeCol = resolveColumnKey(
      rowKeys,
      /^类型$|^类别$|^班级$|^报名单类型$|^新续类别$|^新续$|^签约类型$/i,
      /类型|类别|新续/i,
      /工作性质|岗位|合计|提成/i
    );

    const amountCol = resolveColumnKey(
      rowKeys,
      /^金额$|^实收金额$|^实收$|^学费$|^缴费金额$|^成交金额$|^订单金额$|^收费金额$|^总金额$/i,
      /金额|费用|款项|实收|学费/i,
      /提成|奖金|其他|其它|返还|扣除|底薪|单价|退费|总提成|销售提成|老师提成|汇总/i
    );

    const salespersonCol = resolveColumnKey(
      rowKeys,
      /^销售人$|^销售$|^销售顾问$|^顾问$|^业绩归属$|^招生顾问$|^招生老师$|^销售人员$|^课程顾问$/i,
      /销售人|销售顾问|招生顾问|课程顾问|业绩归属/i,
      /提成|比例|率|%|奖金|金额|合计|工作性质|人数|单数/i
    );

    const teacherCol = resolveColumnKey(
      rowKeys,
      /^老师$|^教师$|^任课老师$|^任课教师$|^授课老师$|^带班老师$|^任课$/i,
      /老师|教师|任课/i,
      /提成|比例|率|%|奖金|金额|合计|招生|单数|服务/i
    );

    const notesCol = resolveColumnKey(
      rowKeys,
      /^备注$|^说明$|^Notes$|^Note$/i,
      /备注|说明/i
    );

    sheet.rows.forEach((row) => {
      const explicitMonthVal = monthCol ? row[monthCol] : '';
      let explicitMonth = '';
      if (explicitMonthVal) {
        const mStr = String(explicitMonthVal).trim();
        if (/^\d{4}-\d{2}$/.test(mStr)) {
          explicitMonth = mStr;
        } else {
          const parsedM = parseExcelDate(explicitMonthVal);
          if (parsedM && parsedM.monthStr && !parsedM.monthStr.startsWith('1970')) {
            explicitMonth = parsedM.monthStr;
          }
        }
      }

      const dateVal = dateCol ? row[dateCol] : '';
      const incomeName = incomeCol ? String(row[incomeCol] || '').trim() : '';
      const project = projectCol ? String(row[projectCol] || '').trim() : '';
      const rawType = typeCol ? String(row[typeCol] || '').trim() : '';
      
      let amount = 0;
      if (amountCol && row[amountCol] !== undefined && row[amountCol] !== '') {
        const cleanedNum = String(row[amountCol]).replace(/[^0-9.-]/g, '');
        amount = parseFloat(cleanedNum) || 0;
      }

      const salesperson = salespersonCol ? String(row[salespersonCol] || '').trim() : '';
      let teacher = teacherCol ? String(row[teacherCol] || '').trim() : '';
      if (teacher === '(无)' || teacher === '无' || teacher === 'null' || teacher === 'undefined') {
        teacher = '';
      }

      const notes = notesCol ? String(row[notesCol] || '').trim() : '';

      // Ignore summary header rows, total rows, or completely empty rows
      if (!incomeName && !salesperson && amount === 0 && !dateVal) {
        return;
      }
      if (/合计|总计|汇总/i.test(incomeName) || /合计|总计/i.test(salesperson)) {
        return;
      }

      const { dateStr, monthStr } = parseExcelDate(dateVal);
      const finalMonth =
        (overrideMonth && overrideMonth.trim()) ||
        explicitMonth ||
        (monthStr && !monthStr.startsWith('1970') ? monthStr : '') ||
        sheetInferredMonth ||
        new Date().toISOString().substring(0, 7);

      // Standardize record type
      let cleanType = rawType;
      if (rawType.includes('续')) cleanType = '续';
      else if (rawType.includes('集训')) cleanType = '集训';
      else if (rawType.includes('新')) cleanType = '新';
      else cleanType = '新'; // Fallback

      allRecords.push({
        id: `${batchId}_rec_${recordCounter++}`,
        batchId,
        month: finalMonth,
        date: dateStr,
        incomeName: incomeName || '未名学生',
        project: project || '通用课程',
        type: cleanType,
        amount: Math.max(0, amount),
        salesperson: salesperson || '未名销售',
        teacher: teacher,
        notes: notes,
      });
    });
  });

  return allRecords;
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
