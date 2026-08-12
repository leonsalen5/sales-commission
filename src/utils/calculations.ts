import {
  SalesRecord,
  CalculatedRecord,
  SalespersonConfig,
  SalespersonSummary,
  TeacherSummary,
  ProjectSummary,
  TypeSummary,
  SalespersonRole,
} from '../types';

/**
 * Calculates new signup bonus according to rules:
 * - Amount >= 18,000: 1,000元
 * - Amount >= 26,000: 2,000元
 * - Thereafter for every additional 10,000元: +1,000元
 */
export function calculateNewSignupBonus(amount: number): number {
  if (amount < 18000) return 0;
  if (amount < 26000) return 1000;
  return 2000 + Math.floor((amount - 26000) / 10000) * 1000;
}

/**
 * Calculates renewal bonus according to rules:
 * - Amount >= 50,000: 800元
 * - Thereafter for every additional 30,000元: +800元
 */
export function calculateRenewalBonus(amount: number): number {
  if (amount < 50000) return 0;
  return 800 + Math.floor((amount - 50000) / 30000) * 800;
}

/**
 * Utility to check if salesperson field is missing/empty/blank
 */
export function isMissingSalesperson(salesperson?: string): boolean {
  if (!salesperson) return true;
  const s = salesperson.trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (
    [
      '未填销售',
      '未名销售',
      '未名',
      '未填写',
      '无',
      '空缺',
      '未分配',
      '未分派',
      '-',
      '--',
      '暂无',
      '未知',
      'none',
      'null',
    ].includes(s)
  ) {
    return true;
  }
  return lower.includes('未名') || lower.includes('未填');
}

/**
 * Enhances raw record with sales & teacher commission rates and amounts
 */
export function calculateRecordDetails(
  record: SalesRecord,
  salespersonConfigs: Record<string, SalespersonConfig>
): CalculatedRecord {
  const salesperson = record.salesperson?.trim() || '未填销售';
  const spConfig = salespersonConfigs[salesperson];
  const role: SalespersonRole = spConfig?.role || '普通课程顾问';

  // 1. Sales Commission Rate
  let salesCommissionRate = 0.05; // Default 5%
  const cleanType = record.type?.trim() || '';

  if (cleanType === '新') {
    if (
      spConfig?.customNewRate !== undefined &&
      spConfig?.customNewRate !== null &&
      !isNaN(spConfig.customNewRate)
    ) {
      salesCommissionRate = spConfig.customNewRate;
    } else {
      salesCommissionRate = role === '非自主招生课程顾问' ? 0.05 : 0.07;
    }
  } else if (cleanType === '续' || cleanType === '集训') {
    salesCommissionRate = 0.05;
  }

  // Override if custom sales commission rate is set
  if (
    record.customSalesCommissionRate !== undefined &&
    record.customSalesCommissionRate !== null &&
    !isNaN(record.customSalesCommissionRate)
  ) {
    salesCommissionRate = record.customSalesCommissionRate;
  }

  const salesCommissionAmount = record.amount * salesCommissionRate;

  // 2. Teacher Commission Rate
  let teacherCommissionRate = 0;
  const teacherName = record.teacher?.trim() || '';

  if (teacherName.length > 0) {
    if (cleanType === '新' || cleanType === '续') {
      teacherCommissionRate = 0.01; // 1%
    } else if (cleanType === '集训') {
      teacherCommissionRate = 0; // 集训 0%
    }
  } else {
    // 老师为空，不计提成
    teacherCommissionRate = 0;
  }

  // Override if custom teacher commission rate is set
  if (
    record.customTeacherCommissionRate !== undefined &&
    record.customTeacherCommissionRate !== null &&
    !isNaN(record.customTeacherCommissionRate)
  ) {
    teacherCommissionRate = record.customTeacherCommissionRate;
  }

  const teacherCommissionAmount = record.amount * teacherCommissionRate;

  return {
    ...record,
    salesCommissionRate,
    salesCommissionAmount: Math.round(salesCommissionAmount * 100) / 100,
    teacherCommissionRate,
    teacherCommissionAmount: Math.round(teacherCommissionAmount * 100) / 100,
  };
}

/**
 * Generates Salesperson Commission & Bonus Summary
 */
export function generateSalespersonSummaries(
  records: SalesRecord[],
  salespersonConfigs: Record<string, SalespersonConfig>,
  selectedMonths: string[] = []
): SalespersonSummary[] {
  // Map of salesperson name -> aggregated metrics
  const map = new Map<
    string,
    {
      renewalAmount: number;
      newSignupAmount: number;
      intensiveAmount: number;
      renewalCommission: number;
      newSignupCommission: number;
      intensiveCommission: number;
      newSignupCount: number;
      totalRecordCount: number;
    }
  >();

  // Filter records if selectedMonths specified
  const filteredRecords =
    selectedMonths.length > 0
      ? records.filter((r) => selectedMonths.includes(r.month))
      : records;

  for (const rawRecord of filteredRecords) {
    const calc = calculateRecordDetails(rawRecord, salespersonConfigs);
    const sp = calc.salesperson?.trim() || '未填销售';

    if (!map.has(sp)) {
      map.set(sp, {
        renewalAmount: 0,
        newSignupAmount: 0,
        intensiveAmount: 0,
        renewalCommission: 0,
        newSignupCommission: 0,
        intensiveCommission: 0,
        newSignupCount: 0,
        totalRecordCount: 0,
      });
    }

    const entry = map.get(sp)!;
    entry.totalRecordCount += 1;

    const t = calc.type?.trim() || '';
    if (t === '续') {
      entry.renewalAmount += calc.amount;
      entry.renewalCommission += calc.salesCommissionAmount;
    } else if (t === '新') {
      entry.newSignupAmount += calc.amount;
      entry.newSignupCommission += calc.salesCommissionAmount;
      entry.newSignupCount += 1;
    } else if (t === '集训') {
      entry.intensiveAmount += calc.amount;
      entry.intensiveCommission += calc.salesCommissionAmount;
    }
  }

  const result: SalespersonSummary[] = [];

  for (const [sp, data] of map.entries()) {
    const config = salespersonConfigs[sp];
    const role: SalespersonRole = config?.role || '普通课程顾问';

    // Sum other amount for the selected months (or all if none specified)
    let otherAmount = 0;
    if (config?.otherAmountByMonth) {
      if (selectedMonths.length > 0) {
        selectedMonths.forEach((m) => {
          otherAmount += config.otherAmountByMonth?.[m] || 0;
        });
      } else {
        Object.values(config.otherAmountByMonth).forEach((val) => {
          otherAmount += val || 0;
        });
      }
    }

    const totalPerformance =
      data.renewalAmount + data.newSignupAmount + data.intensiveAmount;
    const renewalCommission = Math.round(data.renewalCommission * 100) / 100;
    const newSignupCommission =
      Math.round(data.newSignupCommission * 100) / 100;
    const intensiveCommission =
      Math.round(data.intensiveCommission * 100) / 100;
    const newSignupBonus = calculateNewSignupBonus(data.newSignupAmount);
    const renewalBonus = calculateRenewalBonus(data.renewalAmount);
    const bonus = newSignupBonus + renewalBonus;

    const totalCommission =
      Math.round(
        (renewalCommission + newSignupCommission + intensiveCommission + bonus) *
          100
      ) / 100;

    result.push({
      salesperson: sp,
      role,
      renewalAmount: data.renewalAmount,
      newSignupAmount: data.newSignupAmount,
      intensiveAmount: data.intensiveAmount,
      otherAmount,
      totalPerformance,
      renewalCommission,
      newSignupCommission,
      intensiveCommission,
      totalCommission,
      newSignupBonus,
      renewalBonus,
      bonus,
      newSignupCount: data.newSignupCount,
      totalRecordCount: data.totalRecordCount,
    });
  }

  // Sort by total performance descending
  return result.sort((a, b) => b.totalPerformance - a.totalPerformance);
}

/**
 * Generates Teacher Commission Summary
 */
export function generateTeacherSummaries(
  records: SalesRecord[],
  salespersonConfigs: Record<string, SalespersonConfig>,
  selectedMonths: string[] = []
): TeacherSummary[] {
  const map = new Map<
    string,
    {
      totalCommission: number;
      newSignupCount: number;
      renewalCount: number;
      intensiveCount: number;
      totalAmount: number;
      totalRecords: number;
    }
  >();

  const filteredRecords =
    selectedMonths.length > 0
      ? records.filter((r) => selectedMonths.includes(r.month))
      : records;

  for (const rawRecord of filteredRecords) {
    const tName = rawRecord.teacher?.trim();
    if (!tName) continue; // Skip if no teacher assigned

    const calc = calculateRecordDetails(rawRecord, salespersonConfigs);

    if (!map.has(tName)) {
      map.set(tName, {
        totalCommission: 0,
        newSignupCount: 0,
        renewalCount: 0,
        intensiveCount: 0,
        totalAmount: 0,
        totalRecords: 0,
      });
    }

    const entry = map.get(tName)!;
    entry.totalRecords += 1;
    entry.totalAmount += calc.amount;
    entry.totalCommission += calc.teacherCommissionAmount;

    const typeStr = calc.type?.trim();
    if (typeStr === '新') {
      entry.newSignupCount += 1;
    } else if (typeStr === '续') {
      entry.renewalCount += 1;
    } else if (typeStr === '集训') {
      entry.intensiveCount += 1;
    }
  }

  const result: TeacherSummary[] = [];
  for (const [teacher, data] of map.entries()) {
    result.push({
      teacher,
      totalCommission: Math.round(data.totalCommission * 100) / 100,
      newSignupCount: data.newSignupCount,
      renewalCount: data.renewalCount,
      intensiveCount: data.intensiveCount,
      totalAmount: data.totalAmount,
      totalRecords: data.totalRecords,
    });
  }

  return result.sort((a, b) => b.totalCommission - a.totalCommission);
}

/**
 * Generates Project / Course Sales Breakdown
 */
export function generateProjectSummaries(
  records: SalesRecord[],
  selectedMonths: string[] = []
): ProjectSummary[] {
  const map = new Map<
    string,
    {
      salesCount: number;
      totalAmount: number;
      newCount: number;
      renewalCount: number;
      intensiveCount: number;
    }
  >();

  const filteredRecords =
    selectedMonths.length > 0
      ? records.filter((r) => selectedMonths.includes(r.month))
      : records;

  for (const r of filteredRecords) {
    const proj = r.project?.trim() || '通用课程';

    if (!map.has(proj)) {
      map.set(proj, {
        salesCount: 0,
        totalAmount: 0,
        newCount: 0,
        renewalCount: 0,
        intensiveCount: 0,
      });
    }

    const entry = map.get(proj)!;
    entry.salesCount += 1;
    entry.totalAmount += r.amount;

    const t = r.type?.trim();
    if (t === '新') entry.newCount += 1;
    else if (t === '续') entry.renewalCount += 1;
    else if (t === '集训') entry.intensiveCount += 1;
  }

  const result: ProjectSummary[] = [];
  for (const [project, data] of map.entries()) {
    result.push({
      project,
      salesCount: data.salesCount,
      totalAmount: data.totalAmount,
      newCount: data.newCount,
      renewalCount: data.renewalCount,
      intensiveCount: data.intensiveCount,
    });
  }

  return result.sort((a, b) => b.salesCount - a.salesCount);
}

/**
 * Generates Summary by Category/Type (新、续、集训)
 */
export function generateTypeSummaries(
  records: SalesRecord[],
  salespersonConfigs: Record<string, SalespersonConfig>,
  selectedMonths: string[] = []
): TypeSummary[] {
  const types = ['新', '续', '集训'];
  const filteredRecords =
    selectedMonths.length > 0
      ? records.filter((r) => selectedMonths.includes(r.month))
      : records;

  const spSummaries = generateSalespersonSummaries(
    records,
    salespersonConfigs,
    selectedMonths
  );

  const totalNewBonus = spSummaries.reduce(
    (sum, s) => sum + s.newSignupBonus,
    0
  );
  const totalRenewalBonus = spSummaries.reduce(
    (sum, s) => sum + s.renewalBonus,
    0
  );

  return types.map((t) => {
    const typeRecords = filteredRecords.filter((r) => r.type?.trim() === t);
    const totalAmount = typeRecords.reduce((sum, r) => sum + r.amount, 0);

    let totalCommission = 0;
    typeRecords.forEach((r) => {
      const calc = calculateRecordDetails(r, salespersonConfigs);
      totalCommission += calc.salesCommissionAmount;
    });

    let totalBonus = 0;
    if (t === '新') totalBonus = totalNewBonus;
    else if (t === '续') totalBonus = totalRenewalBonus;

    return {
      type: t === '新' ? '新报' : t === '续' ? '续费' : '集训',
      totalAmount,
      totalCommission: Math.round(totalCommission * 100) / 100,
      totalBonus,
      recordCount: typeRecords.length,
    };
  });
}

/**
 * Interface for Period or Year Summary
 */
export interface PeriodSummaryItem {
  key: string;
  title: string;
  subTitle: string;
  months: string[];
  totalPerformance: number;
  salesCommission: number;
  bonus: number;
  salesTotal: number; // salesCommission + bonus
  teacherCommission: number;
  grandTotalCommission: number; // salesTotal + teacherCommission
  recordCount: number;
  newSignupCount: number;
  monthlyAverage: number;
}

/**
 * Helper to compute statistical summary for a set of months
 */
export function computeSummaryForMonths(
  key: string,
  title: string,
  subTitle: string,
  months: string[],
  records: SalesRecord[],
  configs: Record<string, SalespersonConfig>
): PeriodSummaryItem {
  if (!months || months.length === 0) {
    return {
      key,
      title,
      subTitle: '无数据',
      months: [],
      totalPerformance: 0,
      salesCommission: 0,
      bonus: 0,
      salesTotal: 0,
      teacherCommission: 0,
      grandTotalCommission: 0,
      recordCount: 0,
      newSignupCount: 0,
      monthlyAverage: 0,
    };
  }

  const filtered = records.filter((r) => months.includes(r.month));
  const recordCount = filtered.length;
  const totalPerformance = filtered.reduce((sum, r) => sum + r.amount, 0);
  const newSignupCount = filtered.filter((r) => r.type?.trim() === '新').length;

  let teacherCommission = 0;
  filtered.forEach((r) => {
    const calc = calculateRecordDetails(r, configs);
    teacherCommission += calc.teacherCommissionAmount;
  });

  let salesCommission = 0;
  let bonus = 0;

  // Pre-group records by month to avoid redundant O(N) array scans
  const recordsByMonth = new Map<string, SalesRecord[]>();
  for (const r of filtered) {
    let list = recordsByMonth.get(r.month);
    if (!list) {
      list = [];
      recordsByMonth.set(r.month, list);
    }
    list.push(r);
  }

  for (const m of months) {
    const monthRecords = recordsByMonth.get(m) || [];
    const spSummaries = generateSalespersonSummaries(monthRecords, configs, [m]);
    spSummaries.forEach((s) => {
      salesCommission += s.totalCommission;
      bonus += s.bonus;
    });
  }

  salesCommission = Math.round(salesCommission * 100) / 100;
  teacherCommission = Math.round(teacherCommission * 100) / 100;
  bonus = Math.round(bonus * 100) / 100;
  const salesTotal = Math.round((salesCommission + bonus) * 100) / 100;
  const grandTotalCommission = Math.round((salesTotal + teacherCommission) * 100) / 100;
  const monthlyAverage =
    months.length > 0 ? Math.round((totalPerformance / months.length) * 100) / 100 : 0;

  return {
    key,
    title,
    subTitle,
    months,
    totalPerformance,
    salesCommission,
    bonus,
    salesTotal,
    teacherCommission,
    grandTotalCommission,
    recordCount,
    newSignupCount,
    monthlyAverage,
  };
}

/**
 * Generate yearly statistics summaries
 */
export function generateYearlySummaries(
  records: SalesRecord[],
  configs: Record<string, SalespersonConfig>,
  availableMonths: string[]
): PeriodSummaryItem[] {
  const yearMap = new Map<string, string[]>();
  for (const m of availableMonths) {
    const year = m.split('-')[0];
    if (year) {
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)!.push(m);
    }
  }

  const years = Array.from(yearMap.keys()).sort().reverse();

  return years.map((year) => {
    const months = yearMap.get(year) || [];
    const minMonth = months[months.length - 1];
    const maxMonth = months[0];
    const sub = months.length === 1 ? minMonth : `${minMonth} 至 ${maxMonth} (${months.length}个月)`;
    return computeSummaryForMonths(
      year,
      `${year}年度`,
      sub,
      months,
      records,
      configs
    );
  });
}

/**
 * Generate periodical statistics (Past 3 months, Past 6 months, Past 1 year)
 */
export function generatePeriodSummaries(
  records: SalesRecord[],
  configs: Record<string, SalespersonConfig>,
  availableMonths: string[]
): PeriodSummaryItem[] {
  const p3 = availableMonths.slice(0, 3);
  const p6 = availableMonths.slice(0, 6);
  const p12 = availableMonths.slice(0, 12);

  const formatSub = (monthsList: string[]) => {
    if (monthsList.length === 0) return '无数据';
    const minM = monthsList[monthsList.length - 1];
    const maxM = monthsList[0];
    return minM === maxM ? minM : `${minM} 至 ${maxM}`;
  };

  return [
    computeSummaryForMonths('3months', '近 3 个月', formatSub(p3), p3, records, configs),
    computeSummaryForMonths('6months', '近半年 (6个月)', formatSub(p6), p6, records, configs),
    computeSummaryForMonths('12months', '近一年 (12个月)', formatSub(p12), p12, records, configs),
  ];
}

