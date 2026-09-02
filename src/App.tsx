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
  processLocalUpdateRecord,
  processLocalDeleteRecord,
  processLocalSetPassword,
} from './utils/storage';
import {
  saveSystemDataToCloud,
  subscribeToCloudSystemData,
} from './utils/firebaseStorage';
import { testConnection } from './firebase';
import { getTodayDateString } from './utils/crypto';

// UI Components
import { Header } from './components/Header';
import { MonthFilter } from './components/MonthFilter';
import { PeriodAndYearlyStats } from './components/PeriodAndYearlyStats';
import { SalespersonTable } from './components/SalespersonTable';
import { TeacherTable } from './components/TeacherTable';
import { ProjectAndTypeTables } from './components/ProjectAndTypeTables';
import { DetailRecordsTable } from './components/DetailRecordsTable';
import { ImportModal } from './components/ImportModal';
import { BatchHistoryModal } from './components/BatchHistoryModal';
import { RuleModal } from './components/RuleModal';
import { SingleRecordModal } from './components/SingleRecordModal';
import {
  SetInitialPasswordModal,
  VerifyPasswordModal,
  ChangePasswordModal,
} from './components/AuthModals';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<SystemData>(() => getLocalSystemData());
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [cloudSyncState, setCloudSyncState] = useState<'synced' | 'syncing' | 'offline'>('synced');

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSingleRecordModalOpen, setIsSingleRecordModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [recordToEdit, setRecordToEdit] = useState<SalesRecord | null>(null);

  // Auth Modals & Persistent Verification State
  const [isSetPasswordModalOpen, setIsSetPasswordModalOpen] = useState<boolean>(false);
  const [isVerifyPasswordModalOpen, setIsVerifyPasswordModalOpen] = useState<boolean>(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState<boolean>(
    () => localStorage.getItem('auth_manager_authenticated') === 'true'
  );

  // Guard protected sensitive actions
  const runWithAuth = (action: () => void) => {
    const isAuth = localStorage.getItem('auth_manager_authenticated') === 'true';

    if (isAuth) {
      action();
      return;
    }

    setPendingAction(() => action);

    if (!data.passwordHash) {
      setIsSetPasswordModalOpen(true);
      return;
    }

    setIsVerifyPasswordModalOpen(true);
  };

  // Real-time Cloud Synchronization with Firebase Firestore
  useEffect(() => {
    testConnection();

    // 1. Initialize local cache immediately
    const localData = getLocalSystemData();
    setData(localData);

    const monthsSet = new Set<string>();
    localData.records.forEach((r) => {
      if (r.month) monthsSet.add(r.month);
    });
    const monthArray = Array.from(monthsSet).sort().reverse();
    if (monthArray.length > 0) {
      setSelectedMonths((prev) => (prev.length === 0 ? [monthArray[0]] : prev));
    }

    // 2. Start Real-time Firebase Cloud Listener
    setCloudSyncState('syncing');
    const unsubscribe = subscribeToCloudSystemData(
      (cloudData) => {
        setCloudSyncState('synced');
        setData(cloudData);
        saveLocalSystemData(cloudData);

        setSelectedMonths((prev) => {
          if (prev.length === 0) {
            const cSet = new Set<string>();
            cloudData.records.forEach((r) => r.month && cSet.add(r.month));
            const cArr = Array.from(cSet).sort().reverse();
            return cArr.length > 0 ? [cArr[0]] : [];
          }
          return prev;
        });
      },
      (err) => {
        console.warn('Firebase cloud listener offline fallback:', err);
        setCloudSyncState('offline');
      }
    );

    // 3. Fallback check & Initial upload if cloud is uninitialized
    fetch('/api/data')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverData) => {
        if (serverData && Array.isArray(serverData.records) && serverData.records.length > 0) {
          setData(serverData);
          saveLocalSystemData(serverData);
          saveSystemDataToCloud(serverData);
        }
      })
      .catch(() => {});

    return () => {
      unsubscribe();
    };
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
    let nextData: SystemData;
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, fileName, records }),
      });

      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API import failed');
      }
    } catch (err) {
      console.warn('API import fallback to local calculation:', err);
      nextData = processLocalImport(month, fileName, records);
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);

    const importedMonths = Array.from(new Set(records.map((r) => r.month))).filter(Boolean).sort().reverse();
    if (importedMonths.length > 0) {
      setSelectedMonths([importedMonths[0]]);
    } else {
      setSelectedMonths([month]);
    }
  };

  // Action: Delete Batch
  const handleDeleteBatch = async (batchId: string) => {
    let nextData: SystemData;
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API delete failed');
      }
    } catch (err) {
      console.warn('API delete failed, processing locally:', err);
      nextData = processLocalDeleteBatch(batchId, data);
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);
  };

  // Action: Update Single Record
  const handleUpdateRecord = async (updatedRecord: SalesRecord) => {
    let nextData: SystemData;
    try {
      const res = await fetch(`/api/records/${updatedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord),
      });
      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API update record failed');
      }
    } catch (err) {
      console.warn('API update record failed, processing locally:', err);
      nextData = processLocalUpdateRecord(updatedRecord, data);
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);
  };

  // Action: Delete Single Record
  const handleDeleteRecord = async (recordId: string) => {
    let nextData: SystemData;
    try {
      const res = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API delete record failed');
      }
    } catch (err) {
      console.warn('API delete record failed, processing locally:', err);
      nextData = processLocalDeleteRecord(recordId, data);
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);
  };

  // Action: Update Salesperson Role & Custom New Rate
  const handleUpdateRole = async (
    salesperson: string,
    role: SalespersonRole,
    customNewRate?: number | null
  ) => {
    let nextData: SystemData;
    try {
      const res = await fetch('/api/salesperson-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesperson, role, customNewRate }),
      });
      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API update role failed');
      }
    } catch (err) {
      console.warn('API update role failed, processing locally:', err);
      nextData = processLocalUpdateConfig(
        salesperson,
        role,
        undefined,
        undefined,
        customNewRate
      );
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);
  };

  // Action: Update Salesperson Other Amount
  const handleUpdateOtherAmount = async (
    salesperson: string,
    amount: number
  ) => {
    const monthStr = selectedMonths[0] || '2026-07';
    let nextData: SystemData;
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
        nextData = json.data;
      } else {
        throw new Error('API update amount failed');
      }
    } catch (err) {
      console.warn('API update amount failed, processing locally:', err);
      nextData = processLocalUpdateConfig(
        salesperson,
        undefined,
        monthStr,
        amount
      );
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);
  };

  // Auth Handlers
  const handleSetPassword = async (pwdHash: string) => {
    let nextData: SystemData;
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordHash: pwdHash }),
      });
      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API password set failed');
      }
    } catch (err) {
      console.warn('Set password API failed, saving locally:', err);
      nextData = processLocalSetPassword(pwdHash, data);
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);

    localStorage.setItem('auth_manager_authenticated', 'true');
    setIsManagerAuthenticated(true);

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleVerifySuccess = () => {
    localStorage.setItem('auth_manager_authenticated', 'true');
    setIsManagerAuthenticated(true);

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleChangePassword = async (newPwdHash: string) => {
    let nextData: SystemData;
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordHash: newPwdHash }),
      });
      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API change password failed');
      }
    } catch (err) {
      console.warn('Change password API failed, saving locally:', err);
      nextData = processLocalSetPassword(newPwdHash, data);
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);

    localStorage.setItem('auth_manager_authenticated', 'true');
    setIsManagerAuthenticated(true);
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
    let nextData: SystemData;
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        nextData = json.data;
      } else {
        throw new Error('API reset failed');
      }
    } catch (err) {
      console.warn('API reset failed, resetting locally:', err);
      nextData = processLocalResetData();
    }

    setData(nextData);
    saveLocalSystemData(nextData);
    saveSystemDataToCloud(nextData);
    setSelectedMonths([]);
    setIsResetConfirmOpen(false);
  };

  // Unique lists for autocompletion
  const existingSalespersons = useMemo(() => {
    const set = new Set<string>();
    data.records.forEach((r) => r.salesperson && set.add(r.salesperson.trim()));
    Object.keys(data.configs).forEach((sp) => sp && set.add(sp.trim()));
    return Array.from(set).sort();
  }, [data.records, data.configs]);

  const existingTeachers = useMemo(() => {
    const set = new Set<string>();
    data.records.forEach((r) => r.teacher && set.add(r.teacher.trim()));
    return Array.from(set).sort();
  }, [data.records]);

  const existingProjects = useMemo(() => {
    const set = new Set<string>();
    data.records.forEach((r) => r.project && set.add(r.project.trim()));
    return Array.from(set).sort();
  }, [data.records]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col">
      {/* App Header */}
      <Header
        onOpenImportModal={() => runWithAuth(() => setIsImportModalOpen(true))}
        onOpenSingleRecordModal={() =>
          runWithAuth(() => {
            setRecordToEdit(null);
            setIsSingleRecordModalOpen(true);
          })
        }
        onOpenBatchHistory={() => setIsHistoryModalOpen(true)}
        onDownloadSample={() => runWithAuth(handleDownloadSample)}
        onExportExcel={() => runWithAuth(handleExportExcel)}
        onResetData={() => runWithAuth(() => setIsResetConfirmOpen(true))}
        onOpenChangePasswordModal={() => setIsChangePasswordModalOpen(true)}
        isManagerAuthenticated={isManagerAuthenticated}
        hasPassword={!!data.passwordHash}
        cloudSyncState={cloudSyncState}
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
              onUpdateRole={(sp, role) => runWithAuth(() => handleUpdateRole(sp, role))}
              onUpdateOtherAmount={(sp, amt) =>
                runWithAuth(() => handleUpdateOtherAmount(sp, amt))
              }
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
              onEditRecord={(record) =>
                runWithAuth(() => {
                  setRecordToEdit(record);
                  setIsSingleRecordModalOpen(true);
                })
              }
              onDeleteRecord={(id) => runWithAuth(() => handleDeleteRecord(id))}
            />

            {/* 5. 多维业绩与提成统计概览 (按年份、近一年、近半年、近三个月) - 含柱状图与扇形图 */}
            <PeriodAndYearlyStats
              records={data.records}
              configs={data.configs}
              availableMonths={availableMonths}
              selectedMonths={selectedMonths}
              onSelectMonths={setSelectedMonths}
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

      <SingleRecordModal
        isOpen={isSingleRecordModalOpen}
        onClose={() => {
          setIsSingleRecordModalOpen(false);
          setRecordToEdit(null);
        }}
        onAddRecord={handleConfirmImport}
        onUpdateRecord={handleUpdateRecord}
        recordToEdit={recordToEdit}
        existingSalespersons={existingSalespersons}
        existingTeachers={existingTeachers}
        existingProjects={existingProjects}
      />

      <BatchHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        batches={data.batches}
        onDeleteBatch={(batchId) => runWithAuth(() => handleDeleteBatch(batchId))}
      />

      <RuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
      />

      {/* Auth Modals */}
      <SetInitialPasswordModal
        isOpen={isSetPasswordModalOpen}
        onClose={() => {
          setIsSetPasswordModalOpen(false);
          setPendingAction(null);
        }}
        onSetPassword={handleSetPassword}
      />

      <VerifyPasswordModal
        isOpen={isVerifyPasswordModalOpen}
        onClose={() => {
          setIsVerifyPasswordModalOpen(false);
          setPendingAction(null);
        }}
        currentPasswordHash={data.passwordHash || ''}
        onSuccess={handleVerifySuccess}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onChangePassword={handleChangePassword}
      />

      {/* System Reset Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E8E6DF] shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#4A4A40]">重置系统数据警告</h3>
                <p className="text-xs text-[#8A8A70]">此操作将清空所有销售记录与历史导入数据</p>
              </div>
            </div>

            <div className="my-4 p-3 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-800 leading-relaxed">
              您确定要清空系统数据吗？清空后所有已录入和导入的销售数据、批次记录以及规则配置将全部重置，建议在重置前先导出Excel备份！
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6DF]">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#5A5A40] bg-[#F5F2EB] hover:bg-[#E8E6DF] rounded-lg transition-colors border border-[#E8E6DF] cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleResetData}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
