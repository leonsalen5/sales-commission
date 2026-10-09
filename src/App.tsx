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
  mergeSystemDatasets,
} from './utils/storage';
import {
  saveSystemDataToCloud,
  subscribeToCloudSystemData,
  fetchAuthoritativeData,
  fetchServerStatus,
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
import { SyncConflictModal } from './components/SyncConflictModal';
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

  // Auth Modals & Session-based Verification State
  const [isSetPasswordModalOpen, setIsSetPasswordModalOpen] = useState<boolean>(false);
  const [isVerifyPasswordModalOpen, setIsVerifyPasswordModalOpen] = useState<boolean>(false);
  const [isSecuritySettingsModalOpen, setIsSecuritySettingsModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('auth_role') === 'manager';
  });
  const [isViewAuthenticated, setIsViewAuthenticated] = useState<boolean>(() => {
    const role = sessionStorage.getItem('auth_role');
    return role === 'manager' || role === 'view';
  });

  // Server vs Local Data Sync Conflict State
  const [syncConflict, setSyncConflict] = useState<{
    serverData: SystemData;
    localData: SystemData;
  } | null>(null);

  // Guard protected sensitive actions
  const runWithAuth = async (action: () => void) => {
    if (isManagerAuthenticated) {
      action();
      return;
    }

    setPendingAction(() => action);
    setIsVerifyPasswordModalOpen(true);
  };

  // Compare timestamps & check server sync state
  const checkServerSyncState = async (allowPrompt: boolean = true) => {
    try {
      const serverData = await fetchAuthoritativeData();
      if (!serverData) return;

      const currentLocal = getLocalSystemData();
      const serverTs = serverData.lastImportTimestamp || (serverData.lastImportTime ? Math.floor(new Date(serverData.lastImportTime).getTime() / 1000) : 0);
      const localTs = currentLocal.lastImportTimestamp || (currentLocal.lastImportTime ? Math.floor(new Date(currentLocal.lastImportTime).getTime() / 1000) : 0);

      const currentRole = sessionStorage.getItem('auth_role');
      const isManager = currentRole === 'manager';

      // 浏览模式下：禁止向服务器端同步数据，直接且仅在本地更新并展示服务器最新数据
      if (!isManager) {
        setData(serverData);
        saveLocalSystemData(serverData);
        setCloudSyncState('synced');
        return;
      }

      // 管理员模式下：
      // 如果服务器端的数据更新 (serverTs > localTs)：
      if (serverTs > localTs && (serverData.records?.length > 0 || serverData.batches?.length > 0)) {
        const localHasData = (currentLocal.records?.length || 0) > 0 || (currentLocal.batches?.length || 0) > 0;
        const isDifferent = localHasData && (
          serverData.records?.length !== currentLocal.records?.length ||
          serverData.batches?.length !== currentLocal.batches?.length
        );

        if (allowPrompt && isDifferent) {
          // 弹出提示，告知服务器端数据更新，并要求管理员选择需要保留的数据
          setSyncConflict({
            serverData,
            localData: currentLocal,
          });
        } else {
          setData(serverData);
          saveLocalSystemData(serverData);
        }
      } else if (serverTs === localTs) {
        // 时间戳一致时，确保多浏览器刷新状态同步（比如Chrome已导入，Safari刷新）
        if (serverData.records?.length !== data.records?.length || serverData.batches?.length !== data.batches?.length) {
          setData(serverData);
          saveLocalSystemData(serverData);
        }
      } else if (serverData.records?.length > 0 && (currentLocal.records?.length || 0) === 0) {
        setData(serverData);
        saveLocalSystemData(serverData);
      }
      setCloudSyncState('synced');
    } catch (err) {
      console.warn('Sync comparison check error:', err);
    }
  };

  // Real-time Cloud Synchronization & Event listeners for tab switching
  useEffect(() => {
    testConnection();

    // 1. Initialize local cache immediately (if available) for zero-latency initial render
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

    // 2. Fetch and compare authoritative state immediately
    checkServerSyncState(true);

    // 3. Tab switch listeners (switching between Google Chrome and Safari or returning to window)
    const handleWindowFocus = () => {
      checkServerSyncState(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkServerSyncState(true);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Start Real-time Server SSE and Cloud Listener
    setCloudSyncState('syncing');
    const unsubscribe = subscribeToCloudSystemData(
      (cloudData) => {
        setCloudSyncState('synced');
        const role = sessionStorage.getItem('auth_role');
        const isManager = role === 'manager';

        // 浏览模式下：只更新本地显示，绝不向服务器回写
        if (!isManager) {
          setData(cloudData);
          saveLocalSystemData(cloudData);
          return;
        }

        // 管理员模式下：核对时间戳，绝不被旧数据回退
        const currentLocal = getLocalSystemData();
        const incomingTs = cloudData.lastImportTimestamp || (cloudData.lastImportTime ? Math.floor(new Date(cloudData.lastImportTime).getTime() / 1000) : 0);
        const localTs = currentLocal.lastImportTimestamp || (currentLocal.lastImportTime ? Math.floor(new Date(currentLocal.lastImportTime).getTime() / 1000) : 0);

        // 如果传入数据时间比本地旧，绝不可用旧数据覆盖本地
        if (incomingTs < localTs && (currentLocal.records?.length || 0) > 0) {
          return;
        }

        if (incomingTs > localTs && (cloudData.batches?.length > 0 || cloudData.records?.length > 0)) {
          const hasDiff = (currentLocal.records?.length || 0) > 0 && (
            cloudData.records?.length !== currentLocal.records?.length ||
            cloudData.batches?.length !== currentLocal.batches?.length
          );
          if (hasDiff) {
            setSyncConflict({
              serverData: cloudData,
              localData: currentLocal,
            });
            return;
          }
        }

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
      () => {
        // Document not found in fresh setup
        setCloudSyncState('synced');
      },
      (err) => {
        console.warn('Sync listener warning:', err);
        setCloudSyncState('synced');
      }
    );

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
  const commitDataUpdate = async (nextData: SystemData, force: boolean = false) => {
    // 浏览模式下，禁止向服务器端同步数据
    if (!isManagerAuthenticated) {
      console.warn('浏览模式下禁止向服务器端同步数据');
      return;
    }

    setData(nextData);
    saveLocalSystemData(nextData);

    const result = await saveSystemDataToCloud(nextData, { force });
    if (result.conflict && result.serverData) {
      // 弹出冲突提示，要求管理员选择
      setSyncConflict({
        serverData: result.serverData,
        localData: nextData,
      });
    }
  };

  // 冲突解决：保留服务器端数据（推荐）
  const handleKeepServerData = () => {
    if (!syncConflict) return;
    const sData = syncConflict.serverData;
    setData(sData);
    saveLocalSystemData(sData);
    setSyncConflict(null);
  };

  // 冲突解决：强制以本地数据覆盖服务器
  const handleKeepLocalData = async () => {
    if (!syncConflict) return;
    const lData = syncConflict.localData;
    await commitDataUpdate(lData, true);
    setSyncConflict(null);
  };

  // 冲突解决：智能合并两者数据
  const handleMergeBothData = async () => {
    if (!syncConflict) return;
    const merged = mergeSystemDatasets(syncConflict.localData, syncConflict.serverData);
    await commitDataUpdate(merged, true);
    setSyncConflict(null);
  };

  // Action: Confirm Import
  const handleConfirmImport = async (
    month: string,
    fileName: string,
    records: SalesRecord[]
  ) => {
    if (!isManagerAuthenticated) return;

    // Pull freshest cloud data before merging to prevent overwriting any data from another device!
    const latestCloud = await fetchAuthoritativeData();
    const baseData = latestCloud || data;

    const nextData = processLocalImport(month, fileName, records, baseData);
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

    sessionStorage.setItem('auth_role', 'manager');
    setIsManagerAuthenticated(true);
    setIsViewAuthenticated(true);

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleVerifySuccess = () => {
    sessionStorage.setItem('auth_role', 'manager');
    setIsManagerAuthenticated(true);
    setIsViewAuthenticated(true);

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleDemoteToView = () => {
    sessionStorage.setItem('auth_role', 'view');
    setIsManagerAuthenticated(false);
  };

  const handleChangePassword = async (newPwdHash: string) => {
    const latestCloud = await fetchAuthoritativeData();
    const baseData = latestCloud || data;
    const nextData = processLocalSetPassword(newPwdHash, baseData);
    await commitDataUpdate(nextData);

    sessionStorage.setItem('auth_role', 'manager');
    setIsManagerAuthenticated(true);
    setIsViewAuthenticated(true);
  };

  const handleChangeViewPassword = async (newViewPasswordHash: string, enabled: boolean) => {
    const latestCloud = await fetchAuthoritativeData();
    const baseData = latestCloud || data;
    const nextData = processLocalSetViewPassword(newViewPasswordHash, enabled, baseData);
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
          sessionStorage.setItem('auth_role', 'view');
          setIsViewAuthenticated(true);
          setIsManagerAuthenticated(false);
        }}
        onManagerSuccess={() => {
          sessionStorage.setItem('auth_role', 'manager');
          setIsViewAuthenticated(true);
          setIsManagerAuthenticated(true);
        }}
        onDataLoaded={(freshData) => {
          setData(freshData);
          saveLocalSystemData(freshData);
          if (freshData.records.length > 0) {
            const monthsSet = new Set<string>();
            freshData.records.forEach((r) => r.month && monthsSet.add(r.month));
            const monthArray = Array.from(monthsSet).sort().reverse();
            if (monthArray.length > 0) {
              setSelectedMonths((prev) => (prev.length === 0 ? [monthArray[0]] : prev));
            }
          }
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
        onOpenChangePasswordModal={() => runWithAuth(() => setIsSecuritySettingsModalOpen(true))}
        onPromoteToManager={() => runWithAuth(() => {})}
        onDemoteToView={handleDemoteToView}
        isManagerAuthenticated={isManagerAuthenticated}
        isViewAuthenticated={isViewAuthenticated}
        hasPassword={!!data.passwordHash}
        hasViewPassword={!!data.viewPasswordHash}
        cloudSyncState={cloudSyncState}
        batchCount={data.batches.length}
        recordCount={filteredRecords.length}
        lastImportTime={data.lastImportTime}
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
              onUpdateRole={(sp, role, customRate) => runWithAuth(() => handleUpdateRole(sp, role, customRate))}
              onUpdateOtherAmount={(sp, amt) =>
                runWithAuth(() => handleUpdateOtherAmount(sp, amt))
              }
              selectedMonth={selectedMonths[0] || ''}
              isManagerAuthenticated={isManagerAuthenticated}
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
              isManagerAuthenticated={isManagerAuthenticated}
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
        isManagerAuthenticated={isManagerAuthenticated}
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
        isManagerAuthenticated={isManagerAuthenticated}
        onChangeAdminPassword={handleChangePassword}
        onChangeViewPassword={handleChangeViewPassword}
        currentViewPasswordHash={data.viewPasswordHash}
        hasCustomViewPassword={!!data.viewPasswordHash}
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
      {/* System Sync Conflict Resolution Modal */}
      {syncConflict && (
        <SyncConflictModal
          isOpen={!!syncConflict}
          serverData={syncConflict.serverData}
          localData={syncConflict.localData}
          onKeepServer={handleKeepServerData}
          onKeepLocal={handleKeepLocalData}
          onMergeBoth={handleMergeBothData}
          onClose={() => setSyncConflict(null)}
        />
      )}
    </div>
  );
}
