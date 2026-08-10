/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { SystemData, SalespersonRole, SalesRecord } from './types';
import {
  generateSalespersonSummaries,
  generateTeacherSummaries,
  generateProjectSummaries,
  generateTypeSummaries,
} from './utils/calculations';
import { exportExcelWorkbook } from './utils/excel';
import {
  getLocalSystemData,
  saveLocalSystemData,
  generateAndDownloadSampleExcel,
  processLocalImport,
  processLocalDeleteBatch,
  processLocalUpdateConfig,
  processLocalResetData,
} from './utils/storage';

// UI Components
import { Header } from './components/Header';
import { MonthFilter } from './components/MonthFilter';
import { SalespersonTable } from './components/SalespersonTable';
import { TeacherTable } from './components/TeacherTable';
import { ProjectAndTypeTables } from './components/ProjectAndTypeTables';
import { DetailRecordsTable } from './components/DetailRecordsTable';
import { ImportModal } from './components/ImportModal';
import { BatchHistoryModal } from './components/BatchHistoryModal';
import { RuleModal } from './components/RuleModal';

export default function App() {
  const [data, setData] = useState<SystemData>({
    batches: [],
    records: [],
    configs: {},
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);

  // Fetch initial data from server or fallback to LocalStorage
  const loadData = async () => {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const json: SystemData = await res.json();
        setData(json);
        saveLocalSystemData(json);

        const monthsSet = new Set<string>();
        json.records.forEach((r) => {
          if (r.month) monthsSet.add(r.month);
        });
        const monthArray = Array.from(monthsSet).sort().reverse();
        if (selectedMonths.length === 0 && monthArray.length > 0) {
          setSelectedMonths([monthArray[0]]);
        }
      } else {
        throw new Error('Server API unavailable');
      }
    } catch (err) {
      console.warn('API unavailable or failed, falling back to LocalStorage:', err);
      const localData = getLocalSystemData();
      setData(localData);

      const monthsSet = new Set<string>();
      localData.records.forEach((r) => {
        if (r.month) monthsSet.add(r.month);
      });
      const monthArray = Array.from(monthsSet).sort().reverse();
      if (selectedMonths.length === 0 && monthArray.length > 0) {
        setSelectedMonths([monthArray[0]]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Available unique months list (e.g. ['2026-07', '2026-06'])
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    data.records.forEach((r) => {
      if (r.month) set.add(r.month);
    });
    data.batches.forEach((b) => {
      if (b.month) set.add(b.month);
    });
    return Array.from(set).sort().reverse();
  }, [data]);

  // Keep selectedMonths synced if empty
  useEffect(() => {
    if (selectedMonths.length === 0 && availableMonths.length > 0) {
      setSelectedMonths([availableMonths[0]]);
    }
  }, [availableMonths]);

  // Filtered records according to selected months
  const filteredRecords = useMemo(() => {
    if (selectedMonths.length === 0) return data.records;
    return data.records.filter((r) => selectedMonths.includes(r.month));
  }, [data.records, selectedMonths]);

  // Total performance sum
  const totalPerformance = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [filteredRecords]);

  // Summary tables calculation
  const salespersonSummaries = useMemo(() => {
    return generateSalespersonSummaries(
      data.records,
      data.configs,
      selectedMonths
    );
  }, [data.records, data.configs, selectedMonths]);

  const teacherSummaries = useMemo(() => {
    return generateTeacherSummaries(
      data.records,
      data.configs,
      selectedMonths
    );
  }, [data.records, data.configs, selectedMonths]);

  const projectSummaries = useMemo(() => {
    return generateProjectSummaries(data.records, selectedMonths);
  }, [data.records, selectedMonths]);

  const typeSummaries = useMemo(() => {
    return generateTypeSummaries(
      data.records,
      data.configs,
      selectedMonths
    );
  }, [data.records, data.configs, selectedMonths]);

  // Action: Confirm Import
  const handleConfirmImport = async (
    month: string,
    fileName: string,
    records: SalesRecord[]
  ) => {
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, fileName, records }),
      });

      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        saveLocalSystemData(json.data);
        setSelectedMonths([month]);
        return;
      }
      throw new Error('API import failed');
    } catch (err) {
      console.warn('API import failed, processing locally:', err);
      const updatedData = processLocalImport(month, fileName, records);
      setData(updatedData);
      setSelectedMonths([month]);
    }
  };

  // Action: Delete Batch
  const handleDeleteBatch = async (batchId: string) => {
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        saveLocalSystemData(json.data);
        return;
      }
    } catch (err) {
      console.warn('API delete failed, processing locally:', err);
    }

    const updatedData = processLocalDeleteBatch(batchId, data);
    setData(updatedData);
  };

  // Action: Update Salesperson Role
  const handleUpdateRole = async (
    salesperson: string,
    role: SalespersonRole
  ) => {
    try {
      const res = await fetch('/api/salesperson-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesperson, role }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        saveLocalSystemData(json.data);
        return;
      }
      throw new Error('API update role failed');
    } catch (err) {
      console.warn('API update role failed, processing locally:', err);
      const updatedData = processLocalUpdateConfig(salesperson, role);
      setData(updatedData);
    }
  };

  // Action: Update Salesperson Other Amount
  const handleUpdateOtherAmount = async (
    salesperson: string,
    amount: number
  ) => {
    const monthStr = selectedMonths[0] || '2026-07';
    try {
      const res = await fetch('/api/salesperson-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesperson,
          month: monthStr,
          otherAmount: amount,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        saveLocalSystemData(json.data);
        return;
      }
      throw new Error('API update amount failed');
    } catch (err) {
      console.warn('API update amount failed, processing locally:', err);
      const updatedData = processLocalUpdateConfig(
        salesperson,
        undefined,
        monthStr,
        amount
      );
      setData(updatedData);
    }
  };

  // Action: Download Sample Template
  const handleDownloadSample = () => {
    try {
      generateAndDownloadSampleExcel();
    } catch (err) {
      window.open('/api/sample-excel', '_blank');
    }
  };

  // Action: Export Excel
  const handleExportExcel = () => {
    const monthLabel =
      selectedMonths.length === 1
        ? selectedMonths[0]
        : selectedMonths.length > 1
        ? `${selectedMonths[selectedMonths.length - 1]}至${selectedMonths[0]}`
        : '全部月份';

    const filename = `培训学校提成与奖金统计表_${monthLabel}.xlsx`;

    exportExcelWorkbook(
      filteredRecords,
      data.configs,
      salespersonSummaries,
      teacherSummaries,
      projectSummaries,
      typeSummaries,
      filename
    );
  };

  // Action: Reset Data
  const handleResetData = async () => {
    if (
      window.confirm('警告：此操作将清空所有月份的销售数据与导入记录，确定要重置吗？')
    ) {
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
          saveLocalSystemData(json.data);
          setSelectedMonths([]);
          return;
        }
        throw new Error('API reset failed');
      } catch (err) {
        console.warn('API reset failed, resetting locally:', err);
        const emptyData = processLocalResetData();
        setData(emptyData);
        setSelectedMonths([]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col">
      {/* App Header */}
      <Header
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenBatchHistory={() => setIsHistoryModalOpen(true)}
        onDownloadSample={handleDownloadSample}
        onExportExcel={handleExportExcel}
        onResetData={handleResetData}
        batchCount={data.batches.length}
        recordCount={filteredRecords.length}
      />

      {/* Month Filter & Controls */}
      <MonthFilter
        availableMonths={availableMonths}
        selectedMonths={selectedMonths}
        onSelectMonths={setSelectedMonths}
        recordCount={filteredRecords.length}
        totalPerformance={totalPerformance}
        onShowRuleModal={() => setIsRuleModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            正在加载云端销售与提成数据...
          </div>
        ) : (
          <>
            {/* 1. 销售人员提成与奖金汇总表 */}
            <SalespersonTable
              summaries={salespersonSummaries}
              configs={data.configs}
              onUpdateRole={handleUpdateRole}
              onUpdateOtherAmount={handleUpdateOtherAmount}
              selectedMonth={selectedMonths[0] || ''}
            />

            {/* 2. 老师提成合计表 */}
            <TeacherTable summaries={teacherSummaries} />

            {/* 3. 按类型与按项目销量统计 */}
            <ProjectAndTypeTables
              projectSummaries={projectSummaries}
              typeSummaries={typeSummaries}
            />

            {/* 4. 销售记录明细表 */}
            <DetailRecordsTable
              records={filteredRecords}
              salespersonConfigs={data.configs}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-400">
        培训学校提成与奖金统计系统 • 支持多设备访问、Excel在线解析与离线备份
      </footer>

      {/* Modals */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleConfirmImport}
      />

      <BatchHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        batches={data.batches}
        onDeleteBatch={handleDeleteBatch}
      />

      <RuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
      />
    </div>
  );
}
