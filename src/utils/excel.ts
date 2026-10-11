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
export interface ParseReport {
  records: SalesRecord[];
  sheetNames: string[];
  processedSheets: string[];
  detectedHeaders: Record<string, string>;
  totalRowsParsed: number;
  error?: string;
}

/**
 * Parses raw Excel file buffer or ArrayBuffer into array of raw SalesRecord objects
 * Supports multi-sheet workbooks, auto-detection of detailed records sheets, offset headers,
 * merged header/title rows, and multi-month files.
 */
export function parseExcelFileWithReport(
  fileBuffer: ArrayBuffer,
  batchId: string,
  overrideMonth?: string
): ParseReport {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: false });
  } catch (err: any) {
    return {
      records: [],
      sheetNames: [],
      processedSheets: [],
      detectedHeaders: {},
      totalRowsParsed: 0,
      error: `Excel文件无法读取: ${err.message || '文件损坏或格式不支持'}`,
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      records: [],
      sheetNames: [],
      processedSheets: [],
      detectedHeaders: {},
      totalRowsParsed: 0,
      error: '工作簿中未找到有效的工作表(Sheet)',
    };
  }

  interface SheetCandidate {
    name: string;
    matrix: any[][];
    bestRow: number;
    colMap: Record<string, number>;
    score: number;
    isExplicitDetailSheet: boolean;
  }

  const candidates: SheetCandidate[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    if (!ws) return;
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!matrix || matrix.length === 0) return;

    let bestRow = -1;
    let bestColMap: Record<string, number> = {};
    let maxScore = -999;

    // Scan up to the first 25 rows to discover the header row (handles title banners, empty rows, subtitles)
    for (let r = 0; r < Math.min(25, matrix.length); r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const curMap: Record<string, number> = {};
      let rowScore = 0;

      row.forEach((cell, idx) => {
        const text = String(cell || '').trim();
        if (!text) return;

        // 1. Date column
        if (
          curMap.date === undefined &&
          /^(日期|收款日期|缴费日期|交费日期|签约日期|报名日期|录入日期|报名单日期|开单日期|时间|Date|成交日期|付款日期|支付日期)$/i.test(text)
        ) {
          curMap.date = idx;
          rowScore += 30;
        } else if (
          curMap.date === undefined &&
          /日期|时间|Date|收款时间|缴费时间/i.test(text) &&
          !/生日|截止|出生/i.test(text)
        ) {
          curMap.date = idx;
          rowScore += 20;
        }

        // 2. Student / Income column
        if (
          curMap.income === undefined &&
          /^(收入|学生|学员|姓名|学员姓名|学生姓名|客户|客户姓名|缴费人|交费人|报名学生|孩子姓名|报名单学员|会员姓名|报名单姓名|报名人)$/i.test(text)
        ) {
          curMap.income = idx;
          rowScore += 30;
        } else if (
          curMap.income === undefined &&
          /学员|学生|客户|缴费人|姓名/i.test(text) &&
          !/销售|老师|顾问|合计|总计|提成|奖金/i.test(text)
        ) {
          curMap.income = idx;
          rowScore += 20;
        }

        // 3. Amount column
        if (
          curMap.amount === undefined &&
          /^(金额|实收金额|实收|学费|缴费金额|交费金额|成交金额|订单金额|收费金额|总金额|收入金额|业绩金额|签约金额|收款金额|实缴金额|费用|款项|应收金额)$/i.test(text)
        ) {
          curMap.amount = idx;
          rowScore += 35;
        } else if (
          curMap.amount === undefined &&
          /金额|实收|学费|收费|费用|款项|总额/i.test(text) &&
          !/提成|奖金|其它|其他|扣除|底薪|单价|退费|总提成|销售提成|老师提成|汇总/i.test(text)
        ) {
          curMap.amount = idx;
          rowScore += 22;
        }

        // 4. Salesperson column
        if (
          curMap.salesperson === undefined &&
          /^(销售人|销售|销售顾问|顾问|业绩归属|招生顾问|招生老师|销售人员|课程顾问|业务员|经办人|招生人|归属人|咨询师|课程老师)$/i.test(text)
        ) {
          curMap.salesperson = idx;
          rowScore += 30;
        } else if (
          curMap.salesperson === undefined &&
          /销售|顾问|业绩归属|招生人|咨询师/i.test(text) &&
          !/提成|比例|率|%|奖金|金额|合计|工作性质|人数|单数/i.test(text)
        ) {
          curMap.salesperson = idx;
          rowScore += 18;
        }

        // 5. Project / Course column
        if (
          curMap.project === undefined &&
          /^(项目|课程|科目|班型|项目名称|课程名称|报读科目|报名课程|报读课程|报读项目|购买项目|产品|班级|报名项目|科目名称)$/i.test(text)
        ) {
          curMap.project = idx;
          rowScore += 20;
        } else if (
          curMap.project === undefined &&
          /项目|课程|科目|班型/i.test(text) &&
          !/销量|提成|奖金|人数|金额|合计/i.test(text)
        ) {
          curMap.project = idx;
          rowScore += 12;
        }

        // 6. Type column
        if (
          curMap.type === undefined &&
          /^(类型|类别|班级|报名单类型|新续类别|新续|签约类型|业务类型|订单类型|新\/续\/集训|新\/续)$/i.test(text)
        ) {
          curMap.type = idx;
          rowScore += 20;
        } else if (
          curMap.type === undefined &&
          /类型|类别|新续/i.test(text) &&
          !/工作性质|岗位|合计|提成/i.test(text)
        ) {
          curMap.type = idx;
          rowScore += 12;
        }

        // 7. Teacher column
        if (
          curMap.teacher === undefined &&
          /^(老师|教师|任课老师|任课教师|授课老师|带班老师|任课|主教老师|任课教师姓名|授课教师|负责老师|班主任|任教老师)$/i.test(text)
        ) {
          curMap.teacher = idx;
          rowScore += 20;
        } else if (
          curMap.teacher === undefined &&
          /老师|教师|任课/i.test(text) &&
          !/提成|比例|率|%|奖金|金额|合计|招生|单数|服务/i.test(text)
        ) {
          curMap.teacher = idx;
          rowScore += 12;
        }

        // 8. Notes column
        if (
          curMap.notes === undefined &&
          /^(备注|说明|Note|Notes|备注信息|优惠说明|补充|备注内容)$/i.test(text)
        ) {
          curMap.notes = idx;
          rowScore += 15;
        } else if (
          curMap.notes === undefined &&
          /备注|说明/i.test(text)
        ) {
          curMap.notes = idx;
          rowScore += 10;
        }

        // 9. Month column
        if (
          curMap.month === undefined &&
          /^(月份|所属月份|Month)$/i.test(text)
        ) {
          curMap.month = idx;
          rowScore += 20;
        }
      });

      if (rowScore > maxScore) {
        maxScore = rowScore;
        bestRow = r;
        bestColMap = curMap;
      }
    }

    const isExplicitDetailSheet = /明细|记录|流水|数据|Detail|Record/i.test(sheetName);
    const isSummarySheet = /汇总|统计表|合计表|分类/i.test(sheetName) && !isExplicitDetailSheet;

    let finalScore = maxScore;
    if (isExplicitDetailSheet) finalScore += 100;
    if (isSummarySheet) finalScore -= 60;

    // Check if the sheet has minimum required columns to be a sales detail sheet
    const hasCoreSalesColumns =
      (bestColMap.amount !== undefined && bestColMap.income !== undefined) ||
      (bestColMap.amount !== undefined && bestColMap.date !== undefined) ||
      (bestColMap.amount !== undefined && bestColMap.salesperson !== undefined) ||
      (bestColMap.income !== undefined && bestColMap.salesperson !== undefined);

    if (bestRow >= 0 && hasCoreSalesColumns && finalScore > 30) {
      candidates.push({
        name: sheetName,
        matrix,
        bestRow,
        colMap: bestColMap,
        score: finalScore,
        isExplicitDetailSheet,
      });
    }
  });

  // Decide which sheets to process
  let sheetsToProcess: SheetCandidate[] = [];

  const explicitDetailSheet = candidates.find((c) => c.isExplicitDetailSheet);
  if (explicitDetailSheet) {
    sheetsToProcess = [explicitDetailSheet];
  } else if (candidates.length > 0) {
    // If multiple sheets look like monthly sheets
    const allLookValid = candidates.every((c) => c.score >= 50);
    if (allLookValid && candidates.length > 1) {
      sheetsToProcess = candidates;
    } else {
      candidates.sort((a, b) => b.score - a.score);
      sheetsToProcess = [candidates[0]];
    }
  } else {
    // Fallback: If no candidate passed threshold, try the first sheet with best effort
    const firstSheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[firstSheetName];
    if (ws) {
      const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (matrix && matrix.length > 0) {
        sheetsToProcess = [
          {
            name: firstSheetName,
            matrix,
            bestRow: 0,
            colMap: {
              date: 0,
              income: 1,
              project: 2,
              type: 3,
              amount: 4,
              salesperson: 5,
              teacher: 6,
              notes: 7,
            },
            score: 0,
            isExplicitDetailSheet: false,
          },
        ];
      }
    }
  }

  if (sheetsToProcess.length === 0) {
    return {
      records: [],
      sheetNames: workbook.SheetNames,
      processedSheets: [],
      detectedHeaders: {},
      totalRowsParsed: 0,
      error: '未能从上传的工作簿中识别出包含有效表头的销售明细表格',
    };
  }

  const allRecords: SalesRecord[] = [];
  let recordCounter = 1;
  const detectedHeadersSummary: Record<string, string> = {};

  sheetsToProcess.forEach((sheet) => {
    // Try inferring month from sheet name if contains year/month (e.g. "2024-05", "2026年7月")
    let sheetInferredMonth = '';
    const sheetMonthMatch = sheet.name.match(/(\d{4})[年/.-]?\s*(\d{1,2})/);
    if (sheetMonthMatch) {
      const y = sheetMonthMatch[1];
      const m = String(parseInt(sheetMonthMatch[2], 10)).padStart(2, '0');
      sheetInferredMonth = `${y}-${m}`;
    }

    const { matrix, bestRow, colMap } = sheet;

    // Record detected headers for diagnostics
    const headerRow = matrix[bestRow] || [];
    Object.entries(colMap).forEach(([field, colIdx]) => {
      if (headerRow[colIdx] !== undefined) {
        detectedHeadersSummary[field] = String(headerRow[colIdx]);
      }
    });

    for (let r = bestRow + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const dateVal = colMap.date !== undefined ? row[colMap.date] : '';
      const incomeName = colMap.income !== undefined ? String(row[colMap.income] || '').trim() : '';
      const project = colMap.project !== undefined ? String(row[colMap.project] || '').trim() : '';
      const rawType = colMap.type !== undefined ? String(row[colMap.type] || '').trim() : '';
      const salesperson = colMap.salesperson !== undefined ? String(row[colMap.salesperson] || '').trim() : '';
      let teacher = colMap.teacher !== undefined ? String(row[colMap.teacher] || '').trim() : '';
      if (teacher === '(无)' || teacher === '无' || teacher === 'null' || teacher === 'undefined') {
        teacher = '';
      }
      const notes = colMap.notes !== undefined ? String(row[colMap.notes] || '').trim() : '';

      // Amount parsing: strip any currency symbols, commas, or extra units
      let amount = 0;
      if (colMap.amount !== undefined && row[colMap.amount] !== undefined && row[colMap.amount] !== '') {
        const cleanedNum = String(row[colMap.amount]).replace(/[^0-9.-]/g, '');
        amount = parseFloat(cleanedNum) || 0;
      }

      // Skip summary / total rows or completely blank lines
      if (!incomeName && !salesperson && amount === 0 && !dateVal) {
        continue;
      }
      if (/合计|总计|汇总/i.test(incomeName) || /合计|总计|汇总/i.test(salesperson)) {
        continue;
      }

      // Month extraction
      let explicitMonth = '';
      if (colMap.month !== undefined && row[colMap.month] !== undefined) {
        const mVal = String(row[colMap.month]).trim();
        if (/^\d{4}-\d{2}$/.test(mVal)) {
          explicitMonth = mVal;
        } else {
          const parsedM = parseExcelDate(row[colMap.month]);
          if (parsedM?.monthStr && !parsedM.monthStr.startsWith('1970')) {
            explicitMonth = parsedM.monthStr;
          }
        }
      }

      const { dateStr, monthStr } = parseExcelDate(dateVal);
      const finalMonth =
        (overrideMonth && overrideMonth.trim()) ||
        explicitMonth ||
        (monthStr && !monthStr.startsWith('1970') ? monthStr : '') ||
        sheetInferredMonth ||
        new Date().toISOString().substring(0, 7);

      // Clean record type
      let cleanType = '新';
      if (rawType.includes('续')) cleanType = '续';
      else if (rawType.includes('集训') || rawType.includes('特训') || rawType.includes('营')) cleanType = '集训';
      else if (rawType.includes('新')) cleanType = '新';

      allRecords.push({
        id: `${batchId}_rec_${recordCounter++}`,
        batchId,
        month: finalMonth,
        date: dateStr,
        incomeName: incomeName || '未名学生',
        project: project || '常规课程',
        type: cleanType,
        amount: Math.max(0, amount),
        salesperson: salesperson || '未名销售',
        teacher: teacher,
        notes: notes,
      });
    }
  });

  return {
    records: allRecords,
    sheetNames: workbook.SheetNames,
    processedSheets: sheetsToProcess.map((s) => s.name),
    detectedHeaders: detectedHeadersSummary,
    totalRowsParsed: allRecords.length,
    error: allRecords.length === 0 ? '文件已读取，但未能在表格中识别到有效的销售记录行' : undefined,
  };
}

export function parseExcelFile(
  fileBuffer: ArrayBuffer,
  batchId: string,
  overrideMonth?: string
): SalesRecord[] {
  const report = parseExcelFileWithReport(fileBuffer, batchId, overrideMonth);
  return report.records;
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
