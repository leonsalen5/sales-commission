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
  processLocalSetViewPassword,
  processLocalToggleViewPassword,
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
  SecuritySettingsModal,
} from './components/AuthModals';
import { ViewAccessGatekeeper } from './components/ViewAccessGatekeeper';
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
  const [isSecuritySettingsModalOpen, setIsSecuritySettingsModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState<boolean>(
    () => localStorage.getItem('auth_manager_authenticated') === 'true'
  );
  const [isViewAuthenticated, setIsViewAuthenticated] = useState<boolean>(() => {
    return (
      localStorage.getItem('auth_view_authenticated') === 'true' ||
      localStorage.getItem('auth_manager_authenticated') === 'true'
    );
  });

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

    // 1. Initialize local cache immediately (if available)
    const localData = getLocalSystemData();
    if (localData && (localData.records.length > 0 || localData.batches.length > 0 || localData.passwordHash || localData.viewPasswordHash)) {
      setData(localData);

      const monthsSet = new Set<string>();
      localData.records.forEach((r) => {
        if (r.month) monthsSet.add(r.month);
      });
      const monthArray = Array.from(monthsSet).sort().reverse();
      if (monthArray.length > 0) {
        setSelectedMonths((prev) => (prev.length === 0 ? [monthArray[0]] : prev));
      }
    }

    // 2. Start Real-time Firebase Cloud Listener (Authoritative Single Source of Truth)
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

        // Mirror to server for offline/download fallback
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: cloudData }),
        }).catch(() => {});
      },
      () => {
        // Cloud document does not exist yet in fresh project
        setCloudSyncState('synced');
        // If current local data has user content, initialize cloud with it
        const currentLocal = getLocalSystemData();
        if (currentLocal.records.length > 0 || currentLocal.passwordHash || currentLocal.viewPasswordHash) {
          saveSystemDataToCloud(currentLocal);
        }
      },
      (err) => {
        console.warn('Firebase cloud listener offline fallback:', err);
        setCloudSyncState('offline');
      }
    );

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

  // Helper to atomically commit data updates to state, local storage, cloud, and server mirror
  const commitDataUpdate = async (nextData: SystemData) => {
    setData(nextData);
    saveLocalSystemData(nextData);
    await saveSystemDataToCloud(nextData);
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: nextData }),
    }).catch(() => {});
  };

  // Action: Confirm Import
  const handleConfirmImport = async (
    month: string,
    fileName: string,
    records: SalesRecord[]
  ) => {
    const nextData = processLocalImport(month, fileName, records, data);
    await commitDataUpdate(nextData);

    const importedMonths = Array.from(new Set(records.map((r) => r.month))).filter(Boolean).sort().reverse();
    if (importedMonths.length > 0) {
      setSelectedMonths([importedMonths[0]]);
    } else if (month) {
      setSelectedMonths([month]);
    }
  };

  // Action: Delete Batch
  const handleDeleteBatch = async (batchId: string) => {
    const nextData = processLocalDeleteBatch(batchId, data);
    await commitDataUpdate(nextData);
  };

  // Action: Update Single Record
  const handleUpdateRecord = async (updatedRecord: SalesRecord) => {
    const nextData = processLocalUpdateRecord(updatedRecord, data);
    await commitDataUpdate(nextData);
  };

  // Action: Delete Single Record
  const handleDeleteRecord = async (recordId: string) => {
    const nextData = processLocalDeleteRecord(recordId, data);
    await commitDataUpdate(nextData);
  };

  // Action: Update Salesperson Role & Custom New Rate
  const handleUpdateRole = async (
    salesperson: string,
    role: SalespersonRole,
    customNewRate?: number | null
  ) => {
    const nextData = processLocalUpdateConfig(
      salesperson,
      role,
      undefined,
      undefined,
      customNewRate,
      data
    );
    await commitDataUpdate(nextData);
  };

  // Action: Update Salesperson Other Amount
  const handleUpdateOtherAmount = async (
    salesperson: string,
    amount: number
  ) => {
    const monthStr = selectedMonths[0] || '2026-07';
    const nextData = processLocalUpdateConfig(
      salesperson,
      undefined,
      monthStr,
      amount,
      undefined,
      data
    );
    await commitDataUpdate(nextData);
  };

  // Auth Handlers
  const handleSetPassword = async (pwdHash: string) => {
    const nextData = processLocalSetPassword(pwdHash, data);
    await commitDataUpdate(nextData);

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
    const nextData = processLocalSetPassword(newPwdHash, data);
    await commitDataUpdate(nextData);

    localStorage.setItem('auth_manager_authenticated', 'true');
    setIsManagerAuthenticated(true);
  };

  const handleChangeViewPassword = async (newViewPasswordHash: string, enabled: boolean) => {
    const nextData = processLocalSetViewPassword(newViewPasswordHash, enabled, data);
    await commitDataUpdate(nextData);
  };

  const handleToggleViewPassword = async (enabled: boolean) => {
    const nextData = processLocalToggleViewPassword(enabled, data);
    await commitDataUpdate(nextData);
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
    const nextData = processLocalResetData(data);
    await commitDataUpdate(nextData);
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

  // View Access Gatekeeper: If device is not yet authenticated for browsing or management
  if (!isViewAuthenticated && !isManagerAuthenticated) {
    return (
      <ViewAccessGatekeeper
        currentViewPasswordHash={data.viewPasswordHash}
        currentManagerPasswordHash={data.passwordHash}
        onViewSuccess={() => {
          localStorage.setItem('auth_view_authenticated', 'true');
          setIsViewAuthenticated(true);
        }}
        onManagerSuccess={() => {
          localStorage.setItem('auth_view_authenticated', 'true');
          localStorage.setItem('auth_manager_authenticated', 'true');
          setIsViewAuthenticated(true);
          setIsManagerAuthenticated(true);
        }}
      />
    );
  }

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
        onOpenChangePasswordModal={() => setIsSecuritySettingsModalOpen(true)}
        isManagerAuthenticated={isManagerAuthenticated}
        isViewAuthenticated={isViewAuthenticated}
        hasPassword={!!data.passwordHash}
        hasViewPassword={!!data.viewPasswordHash}
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
        onOpenChangePassword={() => setIsSecuritySettingsModalOpen(true)}
      />

      <SecuritySettingsModal
        isOpen={isSecuritySettingsModalOpen}
        onClose={() => setIsSecuritySettingsModalOpen(false)}
        onChangeAdminPassword={handleChangePassword}
        onChangeViewPassword={handleChangeViewPassword}
        onToggleViewPassword={handleToggleViewPassword}
        isViewPasswordEnabled={data.viewPasswordEnabled ?? true}
        hasCustomViewPassword={!!data.viewPasswordHash}
        hasAdminPassword={!!data.passwordHash}
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
