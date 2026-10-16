/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Rocket,
  Layers,
  RefreshCw,
  Clock,
  ExternalLink,
  Paperclip,
  Upload,
  X,
  Eye,
  User,
  History,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Settings,
  Plus,
  Trash2,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Bug,
  Sparkles,
  CheckSquare,
} from "lucide-react";
import {
  MaintenanceReport,
  DevPriority,
  ProgressLog,
} from "@/types/report";
import {
  getAllReports,
  updateReportWorkspace,
  uploadProgressAttachment,
} from "@/services/reportService";
import {
  getMasterData,
  updateMasterData,
  MasterData,
} from "@/services/settingsService";

type QCTabType = "jadwal" | "kalender" | "antrean" | "rilis";
type QCModalType = "schedule" | "qc" | "detail" | "estimasi" | "settings" | null;

const QC_TESTER_STORAGE_KEY = "portal_active_qc_tester_v1";

// Helper untuk format tanggal lokal YYYY-MM-DD (mencegah pergeseran timezone)
const getLocalYYYYMMDD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDaysToYYYYMMDD = (startDateStr: string, daysToAdd: number): string => {
  const base = startDateStr ? new Date(startDateStr) : new Date();
  if (isNaN(base.getTime())) return getLocalYYYYMMDD(new Date());
  base.setDate(base.getDate() + Math.max(1, daysToAdd));
  return getLocalYYYYMMDD(base);
};

const formatDateShort = (isoString?: string | null): string => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
};

const formatDateTimeFull = (isoString?: string | null): string => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function QCDashboard() {
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [masterData, setMasterData] = useState<MasterData>({
    apps: [],
    programmers: [],
    branches: [],
  });
  const [loading, setLoading] = useState(true);
  const [isSilentlyRefreshing, setIsSilentlyRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<QCTabType>("kalender");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [includeSubmittedInSchedule, setIncludeSubmittedInSchedule] =
    useState<boolean>(true);

  // Global Modal & Lightbox States
  const [activeModal, setActiveModal] = useState<QCModalType>(null);
  const [selectedReport, setSelectedReport] =
    useState<MaintenanceReport | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Scheduling & Estimasi States
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");
  const [priority, setPriority] = useState<DevPriority>("medium");
  const [assignedDev, setAssignedDev] = useState("");
  const [estimasiDate, setEstimasiDate] = useState("");

  // QC Execution States
  const [qcTesterName, setQcTesterName] = useState("Tim QC");
  const [qcVerdict, setQcVerdict] = useState<"pass" | "fail" | null>(null);
  const [qcRejectReason, setQcRejectReason] = useState("");
  const [qcRejectFile, setQcRejectFile] = useState<File | null>(null);
  const [releaseVersion, setReleaseVersion] = useState("");
  const [qcChecklist, setQcChecklist] = useState({
    functional: true,
    uiResponsive: true,
    noRegression: true,
  });

  // Master Data Input States
  const [newAppInput, setNewAppInput] = useState("");
  const [newProgInput, setNewProgInput] = useState("");
  const [newBranchInput, setNewBranchInput] = useState("");


 // Interactive Calendar States
const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date(2026, 0, 1));

useEffect(() => {
  setCalendarMonth(new Date());
}, []);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(
    null
  );

  // Load saved QC Tester name
  useEffect(() => {
    try {
      const savedQc = localStorage.getItem(QC_TESTER_STORAGE_KEY);
      if (savedQc) setQcTesterName(savedQc);
    } catch {
      // Abaikan jika localStorage diblokir
    }
  }, []);

  const fetchData = useCallback(async (silent: boolean = false) => {
    if (silent) {
      setIsSilentlyRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [data, master] = await Promise.all([
        getAllReports(),
        getMasterData(),
      ]);
      setReports(data);
      setMasterData({
        apps: [...(master.apps || [])].sort((a, b) => a.localeCompare(b)),
        programmers: [...(master.programmers || [])].sort((a, b) =>
          a.localeCompare(b)
        ),
        branches: [...(master.branches || [])].sort((a, b) =>
          a.localeCompare(b)
        ),
      });
    } catch (error: unknown) {
      console.error("[QCDashboard] Gagal memuat data:", error);
    } finally {
      setLoading(false);
      setIsSilentlyRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Auto-Refresh Real-Time setiap 15 detik jika tidak ada modal yang sedang dibuka
  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeModal) {
        fetchData(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [activeModal, fetchData]);

  const openScheduleModal = (report: MaintenanceReport) => {
    const today = getLocalYYYYMMDD(new Date());
    const defaultStart = report.workspace.scheduledStartDate || today;
    const estDays = report.workspace.targetDays || 2;
    const defaultEnd =
      report.workspace.scheduledDeadline ||
      addDaysToYYYYMMDD(defaultStart, estDays);

    setSelectedReport(report);
    setAssignedDev(
      report.workspace.assignedDev || masterData.programmers[0] || ""
    );
    setSchedStart(defaultStart);
    setSchedEnd(defaultEnd);
    setPriority(
      report.devPriority === "unset" ? "medium" : report.devPriority
    );
    setActiveModal("schedule");
  };

  const openQCModal = (report: MaintenanceReport) => {
    setSelectedReport(report);
    setQcVerdict(null);
    setQcRejectReason("");
    setQcRejectFile(null);
    setReleaseVersion(report.workspace.releaseVersion || "v1.0.0");
    setQcChecklist({
      functional: true,
      uiResponsive: true,
      noRegression: true,
    });
    setActiveModal("qc");
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedReport(null);
    setQcRejectFile(null);
  };

  // Kelola Master Data (Apps, Programmers, Branches)
  const handleUpdateMaster = async (
    key: keyof MasterData,
    value: string,
    action: "add" | "remove"
  ) => {
    const trimmed = value.trim();
    if (action === "add" && !trimmed) return;

    const currentList = masterData[key] || [];
    if (action === "add" && currentList.includes(trimmed)) return;

    const newList =
      action === "add"
        ? [...currentList, trimmed].sort((a, b) => a.localeCompare(b))
        : currentList.filter((item) => item !== value);

    const updatedMaster: MasterData = { ...masterData, [key]: newList };
    await updateMasterData(updatedMaster);
    setMasterData(updatedMaster);

    if (key === "apps") setNewAppInput("");
    if (key === "programmers") setNewProgInput("");
    if (key === "branches") setNewBranchInput("");
  };

  // Simpan Jadwal Pengerjaan & PIC Developer
  const handleSaveSchedule = async () => {
    if (!selectedReport || !assignedDev || !schedStart || !schedEnd) return;
    setIsSaving(true);
    try {
      await updateReportWorkspace(
        selectedReport,
        {
          status: "scheduled",
          devPriority: priority,
          workspace: {
            ...selectedReport.workspace,
            scheduledStartDate: schedStart,
            scheduledDeadline: schedEnd,
            estimatedFinishDate:
              selectedReport.workspace.estimatedFinishDate || schedEnd,
            assignedDev,
            qcTester: qcTesterName.trim() || "Tim QC",
            publicProgressNote: `Jadwal pengerjaan telah ditetapkan oleh QC (${formatDateShort(
              schedStart
            )} s/d ${formatDateShort(schedEnd)}) dengan PIC Developer: ${assignedDev}.`,
          },
        },
        true
      );
      closeModal();
      await fetchData(true);
    } catch (error: unknown) {
      console.error("Error save schedule:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Simpan Estimasi Tanggal Rilis (Menggunakan field resmi estimatedFinishDate)
  const handleSetEstimasi = async () => {
    if (!selectedReport || !estimasiDate) return;
    setIsSaving(true);
    try {
      await updateReportWorkspace(
        selectedReport,
        {
          status: selectedReport.status,
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            estimatedFinishDate: estimasiDate,
          },
        },
        false
      );
      closeModal();
      await fetchData(true);
    } catch (error: unknown) {
      console.error("Error set estimasi:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Eksekusi Keputusan QC (Lolos / Revisi)
  const handleQCAction = async () => {
    if (!selectedReport || !qcVerdict) return;
    setIsSaving(true);

    try {
      try {
        localStorage.setItem(QC_TESTER_STORAGE_KEY, qcTesterName.trim());
      } catch {
        // Abaikan
      }

      let rejectAttachmentUrl: string | null = null;
      if (qcVerdict === "fail" && qcRejectFile) {
        rejectAttachmentUrl = await uploadProgressAttachment(
          `${selectedReport.ticketNumber}_QC_REJECT`,
          qcRejectFile
        );
      }

      const existingLogs = selectedReport.workspace.progressLogs || [];
      const qcLogEntry: ProgressLog = {
        id: `qc_${Date.now()}`,
        timestamp: new Date().toISOString(),
        note:
          qcVerdict === "pass"
            ? `[LOLOS QC oleh ${qcTesterName}] Siap rilis untuk versi ${releaseVersion.trim()}.`
            : `[REVISI QC oleh ${qcTesterName}] ${qcRejectReason.trim()}`,
        attachmentUrl: rejectAttachmentUrl,
      };

      await updateReportWorkspace(
        selectedReport,
        {
          status: qcVerdict === "pass" ? "ready_to_release" : "qc_rejected",
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            qcTester: qcTesterName.trim() || "Tim QC",
            qcRejectReason:
              qcVerdict === "fail" ? qcRejectReason.trim() : "",
            releaseVersion:
              qcVerdict === "pass"
                ? releaseVersion.trim()
                : selectedReport.workspace.releaseVersion,
            progressLogs: [...existingLogs, qcLogEntry],
            publicProgressNote:
              qcVerdict === "pass"
                ? `Telah lolos pengujian Quality Control (QC) untuk versi ${releaseVersion.trim()} dan siap dirilis ke server utama.`
                : `Hasil pengujian QC memerlukan penyempurnaan ulang oleh tim Developer: ${qcRejectReason.trim()}`,
          },
        },
        true
      );

      closeModal();
      await fetchData(true);
    } catch (error: unknown) {
      console.error("Error QC action:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenExternalLink = (url?: string | null) => {
    if (!url) return;
    const cleanUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(cleanUrl, "_blank", "noopener,noreferrer");
  };

  // Fitur Baru QC: Export Rekap Laporan ke CSV
  const handleExportCSV = () => {
    if (reports.length === 0) return;
    const headers = [
      "No Tiket",
      "Tipe",
      "Status",
      "Prioritas Dev",
      "Aplikasi",
      "Modul",
      "Judul",
      "Pelapor",
      "Divisi",
      "PIC Developer",
      "PIC QC",
      "Mulai Jadwal",
      "Deadline",
      "Est. Rilis",
      "Versi Rilis",
      "Jumlah Reopen",
      "Waktu Lapor",
    ];

    const escapeCsv = (val?: string | number | null) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = reports.map((r) =>
      [
        r.ticketNumber,
        r.type.toUpperCase(),
        r.status,
        r.devPriority,
        r.appName,
        r.moduleName,
        r.title,
        r.reporter.name,
        r.reporter.division,
        r.workspace.assignedDev || "-",
        r.workspace.qcTester || "-",
        r.workspace.scheduledStartDate || "-",
        r.workspace.scheduledDeadline || "-",
        r.workspace.estimatedFinishDate || "-",
        r.workspace.releaseVersion || "-",
        r.workspace.reopenCount || 0,
        r.dates.createdAt,
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rekap_Portal_Maintenance_${getLocalYYYYMMDD(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter Global Pencarian & Aplikasi
  const filteredReports = reports.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      r.ticketNumber.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.moduleName.toLowerCase().includes(q) ||
      r.reporter.name.toLowerCase().includes(q) ||
      (r.workspace.assignedDev || "").toLowerCase().includes(q);
    const matchApp = appFilter === "all" || r.appName === appFilter;
    return matchSearch && matchApp;
  });

  // Kategori Data per Tab
  const listToSchedule = filteredReports.filter((r) =>
    includeSubmittedInSchedule
      ? r.status === "analyzed" || r.status === "submitted"
      : r.status === "analyzed"
  );
  const listToQC = filteredReports.filter((r) => r.status === "waiting_qc");
  const listReleases = filteredReports.filter((r) =>
    ["ready_to_release", "releasing", "released"].includes(r.status)
  );

  const scheduledReports = filteredReports
    .filter((r) => Boolean(r.workspace.scheduledStartDate))
    .sort(
      (a, b) =>
        new Date(a.workspace.scheduledStartDate!).getTime() -
        new Date(b.workspace.scheduledStartDate!).getTime()
    );

  const displayedTimeline = selectedDateFilter
    ? scheduledReports.filter((r) => {
        if (
          !r.workspace.scheduledStartDate ||
          !r.workspace.scheduledDeadline
        ) {
          return false;
        }
        return (
          selectedDateFilter >= r.workspace.scheduledStartDate &&
          selectedDateFilter <= r.workspace.scheduledDeadline
        );
      })
    : scheduledReports;

  // Calendar Variables
  const currentYear = calendarMonth.getFullYear();
  const currentMonthIdx = calendarMonth.getMonth();
  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonthIdx, 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayStr = getLocalYYYYMMDD(new Date());
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const handlePrevMonth = () =>
    setCalendarMonth(new Date(currentYear, currentMonthIdx - 1, 1));
  const handleNextMonth = () =>
    setCalendarMonth(new Date(currentYear, currentMonthIdx + 1, 1));

  // Hitung Beban Kerja Developer Aktif untuk Panduan Penjadwalan QC
  const getDevActiveCount = (devName: string): number => {
    return reports.filter(
      (r) =>
        r.workspace.assignedDev === devName &&
        ["scheduled", "in_progress", "qc_rejected"].includes(r.status)
    ).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold">
            Memuat Portal Quality Control &amp; Project Manager...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-16">
      {/* HEADER UTAMA (SENADA DENGAN WORKSPACE + LOGO.PNG) */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden bg-slate-800 border border-slate-700 p-1.5">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                QC &amp; Project Manager Portal
                {isSilentlyRefreshing && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Live Sync
                  </span>
                )}
              </h1>
              <p className="text-xs text-amber-400 font-medium">
                Quality Assurance, Timeline Scheduling &amp; Master Data Control
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* TOMBOL EXPORT CSV REKAP LAPORAN */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30 transition-colors"
              title="Download Rekap Semua Tiket (CSV/Excel)"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Export Rekap CSV
            </button>

            {/* TOMBOL PENGATURAN MASTER DATA */}
            <button
              type="button"
              onClick={() => setActiveModal("settings")}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4 text-indigo-400" /> Pengaturan Master
            </button>

            {/* TOMBOL REFRESH MANUAL */}
            <button
              type="button"
              onClick={() => fetchData(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isSilentlyRefreshing ? "animate-spin text-indigo-400" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* BARIS SEARCH & FILTER SISTEM */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tiket, judul, modul, pelapor, atau PIC Dev..."
              className="w-full pl-10 pr-8 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-3 py-2 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">Sistem:</span>
              <select
                value={appFilter}
                onChange={(e) => setAppFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">
                  Semua Aplikasi ({reports.length})
                </option>
                {masterData.apps.map((app) => (
                  <option key={app} value={app} className="bg-slate-900">
                    {app}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TAB NAVIGASI (STATIC TAILWIND CLASSES AGAR AMAN DI VERCEL) */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 w-full md:w-max">
          {[
            {
              id: "kalender" as QCTabType,
              label: "Kalender & Timeline",
              count: scheduledReports.length,
              icon: CalendarIcon,
              activeClass:
                "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50",
            },
            {
              id: "jadwal" as QCTabType,
              label: "Perlu Dijadwalkan",
              count: listToSchedule.length,
              icon: Layers,
              activeClass:
                "bg-blue-600 text-white shadow-lg shadow-blue-950/50",
            },
            {
              id: "antrean" as QCTabType,
              label: "Antrean Tes QC",
              count: listToQC.length,
              icon: ShieldCheck,
              activeClass:
                "bg-amber-600 text-white shadow-lg shadow-amber-950/50",
            },
            {
              id: "rilis" as QCTabType,
              label: "Pantauan Rilis",
              count: listReleases.length,
              icon: Rocket,
              activeClass:
                "bg-emerald-600 text-white shadow-lg shadow-emerald-950/50",
            },
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  isActive
                    ? tab.activeClass
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      isActive
                        ? "bg-white/20 text-white"
                        : tab.id === "antrean" || tab.id === "jadwal"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ================= TAB 1: PERLU DIJADWALKAN ================= */}
        {activeTab === "jadwal" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl">
              <p className="text-xs text-slate-400">
                Menampilkan tiket yang sudah diestimasi Dev atau baru masuk agar
                bisa langsung ditugaskan ke PIC Developer.
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={includeSubmittedInSchedule}
                  onChange={(e) =>
                    setIncludeSubmittedInSchedule(e.target.checked)
                  }
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                Tampilkan juga tiket Baru Masuk (`submitted`)
              </label>
            </div>

            {listToSchedule.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl">
                Tidak ada tiket yang menunggu penjadwalan saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {listToSchedule.map((r) => (
                  <div
                    key={r.id || r.ticketNumber}
                    className="bg-slate-800/80 border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between gap-6 transition"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-md border border-indigo-500/30">
                          #{r.ticketNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                            r.status === "analyzed"
                              ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {r.status === "analyzed"
                            ? "Sudah Dianalisa Dev"
                            : "Baru Masuk (Belum Dianalisa)"}
                        </span>
                        <span className="text-xs text-slate-400">
                          Pelapor:{" "}
                          <strong className="text-slate-200">
                            {r.reporter.name}
                          </strong>{" "}
                          ({r.reporter.division})
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        {r.type === "bug" ? (
                          <Bug className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                        )}
                        {r.title}
                      </h3>

                      <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-start gap-2.5">
                        <Layers className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                        <div className="space-y-1 text-xs">
                          <p className="text-slate-300">
                            <strong className="text-slate-400">
                              Sistem &amp; Modul:
                            </strong>{" "}
                            {r.appName} — {r.moduleName}
                          </p>
                          <p className="text-slate-300">
                            <strong className="text-slate-400">
                              Rencana / Analisa Dev:
                            </strong>{" "}
                            {r.workspace.estimatedCause ||
                              r.chronology ||
                              r.featureGoal}
                          </p>
                          {r.workspace.targetDays ? (
                            <p className="text-indigo-400 font-bold pt-0.5">
                              Estimasi Dev: {r.workspace.targetDays} Hari Kerja
                              {r.workspace.assignedDev
                                ? ` (Oleh: ${r.workspace.assignedDev})`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-56 shrink-0 flex flex-col justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-700/70 pt-4 md:pt-0 md:pl-6">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReport(r);
                          setActiveModal("detail");
                        }}
                        className="w-full py-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-slate-600 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detail Tiket
                      </button>
                      <button
                        type="button"
                        onClick={() => openScheduleModal(r)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition"
                      >
                        Atur Jadwal &amp; PIC &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: KALENDER & TIMELINE ================= */}
        {activeTab === "kalender" && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* KIRI: TIMELINE PENGERJAAN */}
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-indigo-400" />
                  <h2 className="font-bold text-lg text-white">
                    Timeline Pengerjaan Developer
                  </h2>
                </div>
                {selectedDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter(null)}
                    className="flex items-center gap-1.5 text-xs font-bold bg-rose-500/20 text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-500/30 transition border border-rose-500/30"
                  >
                    Filter Tanggal: {formatDateShort(selectedDateFilter)}{" "}
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {displayedTimeline.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl">
                  {selectedDateFilter
                    ? `Tidak ada jadwal pengerjaan aktif pada tanggal ${formatDateShort(
                        selectedDateFilter
                      )}.`
                    : "Belum ada tiket yang dijadwalkan pada timeline."}
                </div>
              ) : (
                displayedTimeline.map((r) => {
                  const isOverdue =
                    r.workspace.scheduledDeadline &&
                    r.workspace.scheduledDeadline < todayStr &&
                    ![
                      "waiting_qc",
                      "ready_to_release",
                      "releasing",
                      "released",
                    ].includes(r.status);

                  return (
                    <div
                      key={r.id || r.ticketNumber}
                      className={`bg-slate-800/80 border rounded-xl p-3.5 shadow-sm hover:border-indigo-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition group ${
                        isOverdue
                          ? "border-rose-500/60 bg-rose-950/20"
                          : "border-slate-700/80"
                      }`}
                    >
                      {/* Info Tiket & PIC */}
                      <div
                        onClick={() => {
                          setSelectedReport(r);
                          setActiveModal("detail");
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="font-mono text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded-md border border-indigo-500/30 shrink-0">
                          #{r.ticketNumber}
                        </span>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <h3
                              className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition"
                              title={r.title}
                            >
                              {r.title}
                            </h3>
                            {isOverdue && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-rose-600 text-white rounded shrink-0">
                                Lewat Deadline
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span className="flex items-center gap-1 text-indigo-300 font-medium">
                              <User className="w-3 h-3" />{" "}
                              {r.workspace.assignedDev || "Belum ada PIC"}
                            </span>
                            <span>•</span>
                            <span className="uppercase text-[10px] text-slate-400">
                              {r.status.replace(/_/g, " ")}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Waktu & Tombol Aksi */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:ml-auto w-full sm:w-auto border-t sm:border-t-0 border-slate-700/60 pt-3 sm:pt-0">
                        {/* Rentang Jadwal Dev */}
                        <div className="flex flex-col sm:items-end min-w-28.75">
                          <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-400" /> Jadwal
                            Dev
                          </span>
                          <span className="text-xs font-bold text-slate-200">
                            {formatDateShort(r.workspace.scheduledStartDate)} —{" "}
                            {formatDateShort(r.workspace.scheduledDeadline)}
                          </span>
                        </div>

                        <div className="w-px h-8 bg-slate-700 shrink-0 hidden sm:block" />

                        {/* Estimasi Rilis (Menggunakan estimatedFinishDate) */}
                        <div className="flex flex-col sm:items-end min-w-22.5">
                          <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                            <Rocket className="w-3 h-3 text-emerald-400" /> Est.
                            Rilis
                          </span>
                          {r.workspace.estimatedFinishDate ? (
                            <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                              {formatDateShort(r.workspace.estimatedFinishDate)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-amber-400 italic">
                              Belum diatur
                            </span>
                          )}
                        </div>

                        {/* Tombol Ubah Estimasi Rilis */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReport(r);
                            setEstimasiDate(
                              r.workspace.estimatedFinishDate
                                ? r.workspace.estimatedFinishDate.slice(0, 10)
                                : r.workspace.scheduledDeadline || ""
                            );
                            setActiveModal("estimasi");
                          }}
                          className="p-2.5 bg-slate-900 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-500 rounded-xl transition shrink-0"
                          title="Atur Estimasi Tanggal Rilis"
                        >
                          <CalendarDays className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* KANAN: MINI KALENDER INTERAKTIF */}
            <div className="w-full lg:w-82.5 shrink-0 sticky top-24">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
                {/* Header Kalender */}
                <div className="flex justify-between items-center mb-4">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="font-bold text-white text-sm">
                    {monthNames[currentMonthIdx]} {currentYear}
                  </h3>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Grid Kalender */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(
                    (d) => (
                      <div
                        key={d}
                        className="text-[10px] font-bold text-slate-500 mb-2 uppercase"
                      >
                        {d}
                      </div>
                    )
                  )}
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-2" />
                  ))}

                  {calendarDays.map((day) => {
                    const dateStr = `${currentYear}-${String(
                      currentMonthIdx + 1
                    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDateFilter;

                    const tasksOnDate = scheduledReports.filter((r) => {
                      if (
                        !r.workspace.scheduledStartDate ||
                        !r.workspace.scheduledDeadline
                      ) {
                        return false;
                      }
                      return (
                        dateStr >= r.workspace.scheduledStartDate &&
                        dateStr <= r.workspace.scheduledDeadline
                      );
                    });
                    const hasTask = tasksOnDate.length > 0;

                    let bgClass =
                      "bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-transparent";
                    if (isSelected) {
                      bgClass =
                        "bg-indigo-600 text-white font-bold shadow-md ring-2 ring-indigo-400";
                    } else if (hasTask) {
                      bgClass =
                        "bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40 hover:bg-indigo-500/30";
                    } else if (isToday) {
                      bgClass =
                        "border border-amber-400 text-amber-300 font-bold";
                    }

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setSelectedDateFilter(isSelected ? null : dateStr)
                        }
                        className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition relative ${bgClass}`}
                        title={
                          hasTask
                            ? `${tasksOnDate.length} tiket dijadwalkan (Klik untuk filter)`
                            : ""
                        }
                      >
                        <span>{day}</span>
                        {hasTask && (
                          <span className="w-1 h-1 rounded-full bg-indigo-400 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-500/40 border border-indigo-400 inline-block" />
                    Ada Jadwal Dev
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded border border-amber-400 inline-block" />
                    Hari Ini
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ANTREAN TES QC ================= */}
        {activeTab === "antrean" && (
          <div className="grid grid-cols-1 gap-4">
            {listToQC.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl">
                Antrean pengujian QC kosong. Semua setoran Developer sudah
                terverifikasi!
              </div>
            ) : (
              listToQC.map((r) => (
                <div
                  key={r.id || r.ticketNumber}
                  className="bg-slate-800/80 border border-slate-700/80 hover:border-amber-500/50 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between gap-6 transition"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                        #{r.ticketNumber}
                      </span>
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase bg-amber-500/20 text-amber-300">
                        Menunggu Verifikasi QC
                      </span>
                      {r.workspace.reopenCount > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Revisi Ke-{r.workspace.reopenCount}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white">
                      {r.title}
                    </h3>

                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                      <p className="text-slate-300">
                        <strong className="text-slate-400">
                          Aplikasi &amp; Modul:
                        </strong>{" "}
                        {r.appName} — {r.moduleName}
                      </p>
                      <p className="text-slate-300">
                        <strong className="text-slate-400">
                          PIC Programmer:
                        </strong>{" "}
                        <span className="text-indigo-300 font-semibold">
                          {r.workspace.assignedDev || "-"}
                        </span>
                      </p>
                      <p className="text-slate-200 whitespace-pre-line pt-1 border-t border-slate-800">
                        <strong className="text-amber-400 block mb-0.5">
                          Instruksi Testing dari Developer:
                        </strong>
                        {r.workspace.qcInstructionNote ||
                          "Tidak ada catatan khusus, silakan cek fungsionalitas sesuai detail laporan."}
                      </p>
                    </div>
                  </div>

                  <div className="w-full md:w-56 shrink-0 flex flex-col justify-center gap-2.5 border-t md:border-t-0 md:border-l border-slate-700/70 pt-4 md:pt-0 md:pl-6">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReport(r);
                        setActiveModal("detail");
                      }}
                      className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition"
                    >
                      <Eye className="w-4 h-4 text-indigo-400" /> Lihat Detail
                      &amp; Bukti
                    </button>
                    <button
                      type="button"
                      onClick={() => openQCModal(r)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition"
                    >
                      Eksekusi Hasil QC &rarr;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 4: PANTAUAN RILIS ================= */}
        {activeTab === "rilis" && (
          <div className="grid grid-cols-1 gap-3">
            {listReleases.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl">
                Belum ada tiket yang masuk tahap rilis.
              </div>
            ) : (
              listReleases.map((r) => (
                <div
                  key={r.id || r.ticketNumber}
                  onClick={() => {
                    setSelectedReport(r);
                    setActiveModal("detail");
                  }}
                  className="bg-slate-800/80 border border-slate-700/80 hover:border-indigo-500/40 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md">
                        #{r.ticketNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        {r.appName} — {r.moduleName}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base">
                      {r.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                      <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-md font-bold border border-indigo-500/30">
                        Versi: {r.workspace.releaseVersion || "v1.0.0"}
                      </span>
                      <span className="text-slate-400">
                        PIC Dev:{" "}
                        <strong className="text-slate-200">
                          {r.workspace.assignedDev || "-"}
                        </strong>
                      </span>
                      {r.workspace.qcTester && (
                        <span className="text-slate-400">
                          Verified by:{" "}
                          <strong className="text-emerald-300">
                            {r.workspace.qcTester}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end shrink-0">
                    {r.status === "ready_to_release" && (
                      <span className="bg-teal-500/20 text-teal-300 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-teal-500/30">
                        <Clock className="w-3.5 h-3.5" /> Menunggu Dev Deploy
                      </span>
                    )}
                    {r.status === "releasing" && (
                      <span className="bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse border border-amber-500/30">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                        Sedang Deploy ke Server
                      </span>
                    )}
                    {r.status === "released" && (
                      <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selesai Dirilis
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* ================= MODAL 1: PENGATURAN MASTER DATA ================= */}
      {activeModal === "settings" && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-lg border border-slate-700 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-white font-bold text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-400" /> Pengaturan
                  Master Data Sistem
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kelola daftar Aplikasi, PIC Developer, dan Cabang Pelapor
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Kelola Apps */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Daftar Aplikasi / Web ({masterData.apps.length})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAppInput}
                  onChange={(e) => setNewAppInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleUpdateMaster("apps", newAppInput, "add")
                  }
                  placeholder="Tambah Nama Aplikasi..."
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleUpdateMaster("apps", newAppInput, "add")}
                  className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {masterData.apps.map((app) => (
                  <span
                    key={app}
                    className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center gap-1.5"
                  >
                    {app}
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateMaster("apps", app, "remove")
                      }
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Kelola Programmers */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Daftar Developer / PIC ({masterData.programmers.length})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProgInput}
                  onChange={(e) => setNewProgInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleUpdateMaster("programmers", newProgInput, "add")
                  }
                  placeholder="Tambah Nama Developer..."
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateMaster("programmers", newProgInput, "add")
                  }
                  className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {masterData.programmers.map((prog) => (
                  <span
                    key={prog}
                    className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center gap-1.5"
                  >
                    {prog}
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateMaster("programmers", prog, "remove")
                      }
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Kelola Branches */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Daftar Cabang / Divisi ({masterData.branches.length})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleUpdateMaster("branches", newBranchInput, "add")
                  }
                  placeholder="Tambah Cabang / Divisi..."
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateMaster("branches", newBranchInput, "add")
                  }
                  className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {masterData.branches.map((branch) => (
                  <span
                    key={branch}
                    className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center gap-1.5"
                  >
                    {branch}
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateMaster("branches", branch, "remove")
                      }
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="w-full py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-bold text-sm mt-4"
            >
              Selesai &amp; Tutup
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: INPUT ESTIMASI RILIS ================= */}
      {activeModal === "estimasi" && selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-white text-lg mb-1">
              Target Rilis Sistem
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Atur perkiraan tanggal rilis untuk tiket{" "}
              <span className="font-mono font-bold text-indigo-400">
                #{selectedReport.ticketNumber}
              </span>
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                  Tanggal Estimasi Rilis
                </label>
                <input
                  type="date"
                  value={estimasiDate}
                  onChange={(e) => setEstimasiDate(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-950 border border-slate-700 text-white rounded-xl outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSetEstimasi}
              disabled={!estimasiDate || isSaving}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition shadow-md"
            >
              {isSaving ? (
                <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Simpan Estimasi Rilis"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: DETAIL LAPORAN LENGKAP ================= */}
      {activeModal === "detail" && selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-md">
                  #{selectedReport.ticketNumber}
                </span>
                <h2 className="text-lg font-bold text-white mt-1">
                  {selectedReport.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* KIRI: DATA PELAPOR */}
                <div className="space-y-6">
                  <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                      <User className="w-4 h-4 text-indigo-400" /> Informasi
                      Pelapor &amp; Detail Kendala
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Nama / Divisi
                          </p>
                          <p className="text-sm font-bold text-slate-200">
                            {selectedReport.reporter.name}{" "}
                            <span className="text-slate-400 font-normal">
                              ({selectedReport.reporter.division})
                            </span>
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Waktu Laporan
                          </p>
                          <p className="text-sm font-semibold text-slate-300">
                            {formatDateTimeFull(selectedReport.dates.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-700/70">
                        <p className="text-[10px] uppercase font-bold text-rose-400 mb-1">
                          Kronologi / Kebutuhan User
                        </p>
                        <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                          {selectedReport.chronology ||
                            selectedReport.featureGoal}
                        </p>
                      </div>

                      {(selectedReport.expectedResult ||
                        selectedReport.featureWorkflow) && (
                        <div className="pt-3 border-t border-slate-700/70">
                          <p className="text-[10px] uppercase font-bold text-indigo-400 mb-1">
                            Hasil yang Diharapkan User
                          </p>
                          <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                            {selectedReport.expectedResult ||
                              selectedReport.featureWorkflow}
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedReport.attachments &&
                      selectedReport.attachments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-700/70">
                          <p className="text-[10px] uppercase font-bold text-slate-400 mb-2.5">
                            Foto Lampiran Pelapor (
                            {selectedReport.attachments.length})
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {selectedReport.attachments.map((url, i) => (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setPreviewImageUrl(url)}
                                className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition"
                              >
                                <img
                                  src={url}
                                  className="w-full h-full object-cover"
                                  alt={`Lampiran Pelapor ${i + 1}`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* KANAN: HASIL DEV & RIWAYAT PROGRES */}
                <div className="space-y-6">
                  <div className="bg-indigo-950/60 p-5 rounded-2xl border border-indigo-500/30 text-white">
                    <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />{" "}
                      Hasil Pengerjaan Developer
                    </h3>
                    <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 mb-4 space-y-2">
                      <p className="text-[10px] uppercase font-bold text-indigo-300">
                        Instruksi Testing dari Dev (
                        {selectedReport.workspace.assignedDev || "Tim Dev"})
                      </p>
                      <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                        {selectedReport.workspace.qcInstructionNote ||
                          "Tidak ada catatan khusus, silakan test fungsionalitasnya secara langsung."}
                      </p>
                      {selectedReport.workspace.internalDevNote && (
                        <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                          <strong>Catatan Teknis Dev:</strong>{" "}
                          {selectedReport.workspace.internalDevNote}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {selectedReport.workspace.finalDeliverable?.link && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenExternalLink(
                              selectedReport.workspace.finalDeliverable?.link
                            )
                          }
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition"
                        >
                          <ExternalLink className="w-4 h-4" /> Buka Link
                          Staging / Hasil
                        </button>
                      )}
                      {selectedReport.workspace.finalDeliverable
                        ?.attachmentUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImageUrl(
                              selectedReport.workspace.finalDeliverable
                                ?.attachmentUrl || null
                            )
                          }
                          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition"
                        >
                          <Paperclip className="w-4 h-4" /> Lihat Screenshot
                          Final
                        </button>
                      )}
                      {!selectedReport.workspace.finalDeliverable?.link &&
                        !selectedReport.workspace.finalDeliverable
                          ?.attachmentUrl && (
                          <p className="text-xs text-slate-400 italic w-full text-center py-2">
                            Tidak ada tautan eksternal atau file lampiran akhir
                            dari Developer.
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                      <History className="w-4 h-4 text-amber-400" /> Riwayat
                      Progres &amp; Log QC
                    </h3>
                    {selectedReport.workspace.progressLogs &&
                    selectedReport.workspace.progressLogs.length > 0 ? (
                      <div className="space-y-4 border-l-2 border-slate-700 ml-2 pl-4 py-1">
                        {[...selectedReport.workspace.progressLogs]
                          .reverse()
                          .map((log) => (
                            <div key={log.id} className="relative">
                              <div className="absolute -left-5.25 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                              <p className="text-[10px] font-bold text-indigo-400 mb-1">
                                {formatDateTimeFull(log.timestamp)}
                              </p>
                              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                {log.note}
                              </p>
                              {log.attachmentUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImageUrl(
                                      log.attachmentUrl || null
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-indigo-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition"
                                >
                                  <Paperclip className="w-3 h-3" /> Lihat Bukti
                                  Foto
                                </button>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-xs text-slate-500 italic">
                          Belum ada catatan jurnal progres pada tiket ini.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Tutup Detail
              </button>
              {selectedReport.status === "waiting_qc" && (
                <button
                  type="button"
                  onClick={() => openQCModal(selectedReport)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition"
                >
                  Lanjut Eksekusi QC &rarr;
                </button>
              )}
              {(selectedReport.status === "analyzed" ||
                selectedReport.status === "submitted") && (
                <button
                  type="button"
                  onClick={() => openScheduleModal(selectedReport)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition"
                >
                  Atur Jadwal Pengerjaan &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: SET JADWAL & PIC ================= */}
      {activeModal === "schedule" && selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-md relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-white text-lg mb-1 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-400" /> Set Jadwal
              &amp; PIC Developer
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Tiket{" "}
              <span className="font-mono font-bold text-indigo-400">
                #{selectedReport.ticketNumber}
              </span>{" "}
              {selectedReport.workspace.targetDays
                ? `(Estimasi Dev: ${selectedReport.workspace.targetDays} Hari Kerja)`
                : ""}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Pilih PIC Developer (Beserta Beban Tugas Aktif)
                </label>
                <select
                  value={assignedDev}
                  onChange={(e) => setAssignedDev(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-950 border border-slate-700 text-white rounded-xl focus:border-indigo-500 outline-none"
                >
                  <option value="">-- Pilih Programmer --</option>
                  {masterData.programmers.map((p) => (
                    <option key={p} value={p}>
                      {p} ({getDevActiveCount(p)} Tugas Aktif)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={schedStart}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setSchedStart(newStart);
                      if (selectedReport.workspace.targetDays) {
                        setSchedEnd(
                          addDaysToYYYYMMDD(
                            newStart,
                            selectedReport.workspace.targetDays
                          )
                        );
                      }
                    }}
                    className="w-full p-2.5 text-sm bg-slate-950 border border-slate-700 text-white rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={schedEnd}
                    onChange={(e) => setSchedEnd(e.target.value)}
                    className="w-full p-2.5 text-sm bg-slate-950 border border-slate-700 text-white rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Prioritas Penanganan
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as DevPriority)}
                  className="w-full p-2.5 text-sm bg-slate-950 border border-slate-700 text-white rounded-xl outline-none focus:border-indigo-500"
                >
                  <option value="low">Low (Santai)</option>
                  <option value="medium">Medium (Standar)</option>
                  <option value="high">High (Mendesak)</option>
                  <option value="blocker">Blocker (Darurat / Prioritas Utama)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={!assignedDev || !schedStart || !schedEnd || isSaving}
                className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition shadow-lg"
              >
                {isSaving
                  ? "Menyimpan Jadwal..."
                  : "Simpan Jadwal & Tugaskan Developer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: EKSEKUSI PENGUJIAN QC ================= */}
      {activeModal === "qc" && selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 md:p-7 rounded-2xl shadow-2xl w-full max-w-md relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <span className="font-mono text-xs font-bold text-indigo-400">
                #{selectedReport.ticketNumber}
              </span>
              <h3 className="font-bold text-white text-xl mt-0.5">
                Eksekusi Pengujian QC
              </h3>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
                Nama Pemeriksa QC (Tester) *
              </label>
              <input
                type="text"
                value={qcTesterName}
                onChange={(e) => setQcTesterName(e.target.value)}
                placeholder="Cth: Tim QC / Nama Anda"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {!qcVerdict ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-400 mb-1">
                  Pilih keputusan hasil verifikasi untuk perbaikan/fitur ini:
                </p>
                <button
                  type="button"
                  onClick={() => setQcVerdict("pass")}
                  className="py-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold rounded-xl flex items-center justify-center gap-2 border border-emerald-500/40 transition text-sm"
                >
                  <CheckCircle2 className="w-5 h-5" /> Lolos QC (Sistem Siap
                  Rilis)
                </button>
                <button
                  type="button"
                  onClick={() => setQcVerdict("fail")}
                  className="py-3.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold rounded-xl flex items-center justify-center gap-2 border border-rose-500/40 transition text-sm"
                >
                  <XCircle className="w-5 h-5" /> Tolak &amp; Minta Dev Revisi
                </button>
              </div>
            ) : qcVerdict === "fail" ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setQcVerdict(null)}
                  className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
                >
                  &larr; Ubah Keputusan
                </button>

                <div>
                  <label className="text-[10px] font-bold uppercase text-rose-400 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Catatan Temuan
                    Bug / Revisi untuk Dev *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Sebutkan bagian yang masih error saat dites..."
                    value={qcRejectReason}
                    onChange={(e) => setQcRejectReason(e.target.value)}
                    className="w-full p-3 border border-slate-700 rounded-xl text-sm bg-slate-950 text-white outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">
                    Bukti Screenshot Temuan QC (Opsional)
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-slate-950 border border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-rose-500 transition">
                    <Upload className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-xs text-slate-300 flex-1 truncate">
                      {qcRejectFile
                        ? qcRejectFile.name
                        : "Pilih gambar screenshot bukti error"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setQcRejectFile(e.target.files?.[0] || null)
                      }
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleQCAction}
                  disabled={!qcRejectReason.trim() || isSaving}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    "Kirim Revisi ke Developer"
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setQcVerdict(null)}
                  className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
                >
                  &larr; Ubah Keputusan
                </button>

                {/* CHECKLIST STANDAR VERIFIKASI QC */}
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" /> Checklist Standar
                    Kelayakan Rilis
                  </p>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qcChecklist.functional}
                      onChange={(e) =>
                        setQcChecklist((p) => ({
                          ...p,
                          functional: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 text-emerald-600"
                    />
                    Fungsi utama sesuai dengan ekspektasi laporan
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qcChecklist.uiResponsive}
                      onChange={(e) =>
                        setQcChecklist((p) => ({
                          ...p,
                          uiResponsive: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 text-emerald-600"
                    />
                    Tampilan UI rapi &amp; responsif di perangkat target
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qcChecklist.noRegression}
                      onChange={(e) =>
                        setQcChecklist((p) => ({
                          ...p,
                          noRegression: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 text-emerald-600"
                    />
                    Aman dari efek samping pada fitur lain (No Regression)
                  </label>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">
                    Nomor Versi Rilis *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: v1.0.4"
                    value={releaseVersion}
                    onChange={(e) => setReleaseVersion(e.target.value)}
                    className="w-full p-3 border border-slate-700 rounded-xl text-sm bg-slate-950 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleQCAction}
                  disabled={
                    !releaseVersion.trim() ||
                    !qcChecklist.functional ||
                    isSaving
                  }
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    "Setujui & Siapkan Rilis"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX PREVIEW GAMBAR */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 p-2 bg-slate-800 text-white rounded-full hover:bg-rose-600"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Preview Lampiran"
              className="max-w-full max-h-[85vh] object-contain rounded-xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}