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
 * Enhances raw record with sales & teacher commission rates and amounts
 */
export function calculateRecordDetails(
  record: SalesRecord,
  salespersonConfigs: Record<string, SalespersonConfig>
): CalculatedRecord {
  const salesperson = record.salesperson?.trim() || '未填销售';
  const role: SalespersonRole =
    salespersonConfigs[salesperson]?.role || '普通课程顾问';

  // 1. Sales Commission Rate
  let salesCommissionRate = 0.05; // Default 5%
  const cleanType = record.type?.trim() || '';

  if (cleanType === '新') {
    salesCommissionRate = role === '非自主招生课程顾问' ? 0.05 : 0.07;
  } else if (cleanType === '续' || cleanType === '集训') {
    salesCommissionRate = 0.05;
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
    const totalCommission =
      Math.round(
        (renewalCommission + newSignupCommission + intensiveCommission) * 100
      ) / 100;

    const newSignupBonus = calculateNewSignupBonus(data.newSignupAmount);
    const renewalBonus = calculateRenewalBonus(data.renewalAmount);
    const bonus = newSignupBonus + renewalBonus;

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
