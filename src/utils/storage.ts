import * as XLSX from 'xlsx';
import { SystemData, ImportBatch, SalesRecord, SalespersonRole, SalespersonConfig } from '../types';

const LOCAL_STORAGE_KEY = 'TRAINING_SCHOOL_COMMISSION_DATA_V1';

export const EMPTY_SYSTEM_DATA: SystemData = {
  batches: [],
  records: [],
  configs: {},
  viewPasswordEnabled: true,
};

export function getLocalSystemData(): SystemData {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.batches) && Array.isArray(parsed.records)) {
        return parsed as SystemData;
      }
    }
  } catch (err) {
    console.error('Failed to read from localStorage:', err);
  }
  return EMPTY_SYSTEM_DATA;
}

export function saveLocalSystemData(data: SystemData) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Client-side Excel Template Generator
export function generateAndDownloadSampleExcel() {
  const sampleRows = [
    {
      日期: '2026/7/1',
      收入: '张小明',
      项目: '少儿美术',
      类型: '新',
      金额: 3800,
      销售人: '王顾问',
      老师: '李老师',
      备注: '标准年卡课程',
    },
    {
      日期: '2026/7/2',
      收入: '李思思',
      项目: '硬笔书法',
      类型: '新',
      金额: 4500,
      销售人: '王顾问',
      老师: '陈老师',
      备注: '暑期班+硬笔套装',
    },
    {
      日期: '2026/7/3',
      收入: '赵雷',
      项目: '少儿英语',
      类型: '续',
      金额: 8000,
      销售人: '王顾问',
      老师: '张老师',
      备注: '续费两年套餐',
    },
    {
      日期: '2026/7/5',
      收入: '孙悟空',
      项目: '夏令营集训',
      类型: '集训',
      金额: 6800,
      销售人: '王顾问',
      老师: '李老师',
      备注: '7天闭环特训',
    },
    {
      日期: '2026/7/6',
      收入: '钱七',
      项目: '少儿美术',
      类型: '新',
      金额: 12000,
      销售人: '王顾问',
      老师: '李老师',
      备注: '三年VIP班',
    },
    {
      日期: '2026/7/10',
      收入: '吴九',
      项目: '硬笔书法',
      类型: '续',
      金额: 45000,
      销售人: '王顾问',
      老师: '陈老师',
      备注: '老学员高额续费',
    },
    {
      日期: '2026/7/12',
      收入: '郑十',
      项目: '少儿美术',
      类型: '续',
      金额: 10000,
      销售人: '王顾问',
      老师: '',
      备注: '无指定老师续费',
    },
    {
      日期: '2026/7/15',
      收入: '林一',
      项目: '少儿英语',
      类型: '新',
      金额: 22000,
      销售人: '张顾问',
      老师: '张老师',
      备注: '非自主招生顾问招收',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, '销售记录');

  XLSX.writeFile(wb, '培训学校销售记录模板.xlsx');
}

// Local Import Handler
export function processLocalImport(
  month: string,
  fileName: string,
  records: SalesRecord[],
  baseDataParam?: SystemData
): SystemData {
  const currentData = baseDataParam || getLocalSystemData();
  const batchId = `batch_${Date.now()}`;
  
  // If the existing data only has the demo sample batch, remove sample batch and records
  const isOnlySample = currentData.batches.length === 1 && currentData.batches[0].id.startsWith('sample_');
  const existingBatches = isOnlySample ? [] : currentData.batches;
  const existingRecords = isOnlySample ? [] : currentData.records;

  // Collect all distinct months from records
  const monthsInRecords = Array.from(new Set(records.map((r) => r.month))).filter(Boolean);
  const isMultiMonth = monthsInRecords.length > 1;

  const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);

  const newBatches: ImportBatch[] = [];
  if (isMultiMonth) {
    monthsInRecords.forEach((m, idx) => {
      const recsInMonth = records.filter((r) => r.month === m);
      newBatches.push({
        id: `${batchId}_m_${idx + 1}`,
        month: m,
        fileName: fileName ? `${fileName} (${m})` : `销售记录_${m}.xlsx`,
        uploadedAt: new Date().toISOString(),
        recordCount: recsInMonth.length,
        totalAmount: recsInMonth.reduce((s, r) => s + (r.amount || 0), 0),
      });
    });
  } else {
    const targetMonth = month || records[0]?.month || '2026-07';
    newBatches.push({
      id: batchId,
      month: targetMonth,
      fileName: fileName || `销售记录_${targetMonth}.xlsx`,
      uploadedAt: new Date().toISOString(),
      recordCount: records.length,
      totalAmount,
    });
  }

  const formattedRecords: SalesRecord[] = records.map((r, idx) => {
    const rMonth = r.month || month || '2026-07';
    const rBatchId = isMultiMonth
      ? `${batchId}_m_${Math.max(0, monthsInRecords.indexOf(rMonth)) + 1}`
      : batchId;
    return {
      id: `${batchId}_${idx + 1}`,
      batchId: rBatchId,
      month: rMonth,
      date: r.date || `${rMonth}/1`,
      incomeName: r.incomeName || '未名学生',
      project: r.project || '通用课程',
      type: r.type || '新',
      amount: r.amount || 0,
      salesperson: r.salesperson || '未名销售',
      teacher: r.teacher || '',
      notes: r.notes || '',
      customSalesCommissionRate: r.customSalesCommissionRate,
      customTeacherCommissionRate: r.customTeacherCommissionRate,
    };
  });

  // Maintain sales configs
  formattedRecords.forEach((r) => {
    const sp = r.salesperson?.trim();
    if (sp && !currentData.configs[sp]) {
      currentData.configs[sp] = {
        salesperson: sp,
        role: '普通课程顾问',
        otherAmountByMonth: {},
      };
    }
  });

  const updatedData: SystemData = {
    ...currentData,
    batches: [...newBatches, ...existingBatches],
    records: [...formattedRecords, ...existingRecords],
    configs: { ...currentData.configs },
  };

  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Delete Batch
export function processLocalDeleteBatch(
  batchId: string,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    batches: baseData.batches.filter((b) => b.id !== batchId),
    records: baseData.records.filter((r) => r.batchId !== batchId),
    configs: { ...baseData.configs },
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Update Record
export function processLocalUpdateRecord(
  updatedRecord: SalesRecord,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedRecords = baseData.records.map((r) =>
    r.id === updatedRecord.id ? updatedRecord : r
  );
  const updatedData: SystemData = {
    ...baseData,
    records: updatedRecords,
  };

  // Ensure salesperson config exists
  const sp = updatedRecord.salesperson?.trim();
  if (sp && !updatedData.configs[sp]) {
    updatedData.configs[sp] = {
      salesperson: sp,
      role: '普通课程顾问',
      otherAmountByMonth: {},
    };
  }

  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Delete Record
export function processLocalDeleteRecord(
  recordId: string,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedRecords = baseData.records.filter((r) => r.id !== recordId);
  const updatedData: SystemData = {
    ...baseData,
    records: updatedRecords,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Update Config
export function processLocalUpdateConfig(
  salesperson: string,
  role?: SalespersonRole,
  month?: string,
  otherAmount?: number,
  customNewRate?: number | null,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const configs = { ...baseData.configs };

  if (!configs[salesperson]) {
    configs[salesperson] = {
      salesperson,
      role: role || '普通课程顾问',
      otherAmountByMonth: {},
    };
  } else {
    configs[salesperson] = { ...configs[salesperson] };
  }

  if (role) {
    configs[salesperson].role = role;
  }

  if (customNewRate === null) {
    delete configs[salesperson].customNewRate;
  } else if (typeof customNewRate === 'number' && !isNaN(customNewRate)) {
    configs[salesperson].customNewRate = customNewRate;
  }

  if (month && typeof otherAmount === 'number') {
    if (!configs[salesperson].otherAmountByMonth) {
      configs[salesperson].otherAmountByMonth = {};
    }
    configs[salesperson].otherAmountByMonth = {
      ...configs[salesperson].otherAmountByMonth,
      [month]: otherAmount,
    };
  }

  const updatedData: SystemData = {
    ...baseData,
    configs,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Set / Update Admin Password
export function processLocalSetPassword(
  passwordHash: string,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    ...baseData,
    passwordHash,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Set / Update View Password
export function processLocalSetViewPassword(
  viewPasswordHash: string,
  enabled: boolean = true,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    ...baseData,
    viewPasswordHash,
    viewPasswordEnabled: enabled,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Toggle View Password Protection
export function processLocalToggleViewPassword(
  enabled: boolean,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    ...baseData,
    viewPasswordEnabled: enabled,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Reset Data
export function processLocalResetData(currentData?: SystemData): SystemData {
  const baseData = currentData || getLocalSystemData();
  const emptyData: SystemData = {
    batches: [],
    records: [],
    configs: {},
    passwordHash: baseData.passwordHash,
    viewPasswordHash: baseData.viewPasswordHash,
    viewPasswordEnabled: baseData.viewPasswordEnabled,
  };
  saveLocalSystemData(emptyData);
  return emptyData;
}
