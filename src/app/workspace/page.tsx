/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldCheck,
  Rocket,
  X,
  User,
  PlayCircle,
  History,
  Upload,
  Link as LinkIcon,
  Paperclip,
  MessageSquare,
  AlertTriangle,
  Layers,
  Calendar,
  ArrowRight,
  GitBranch,
  Copy,
  Check,
  Smartphone,
  BarChart3,
  Filter,
  ExternalLink,
  Bug,
  Sparkles,
} from "lucide-react";
import {
  MaintenanceReport,
  ReportStatus,
  ProgressLog,
  FinalDeliverable,
  DevPriority,
} from "@/types/report";
import {
  getAllReports,
  updateReportWorkspace,
  uploadProgressAttachment,
} from "@/services/reportService";
import { getMasterData, MasterData } from "@/services/settingsService";

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; badgeClass: string }
> = {
  submitted: {
    label: "1. Laporan Masuk",
    badgeClass: "bg-slate-200 text-slate-800",
  },
  analyzed: {
    label: "2. Menunggu Jadwal QC",
    badgeClass: "bg-fuchsia-200 text-fuchsia-900",
  },
  scheduled: {
    label: "3. Dijadwalkan (Siap)",
    badgeClass: "bg-blue-200 text-blue-900",
  },
  in_progress: {
    label: "4. Sedang Di-coding",
    badgeClass: "bg-indigo-200 text-indigo-900",
  },
  waiting_qc: {
    label: "5. Menunggu Cek QC",
    badgeClass: "bg-amber-200 text-amber-900",
  },
  qc_rejected: {
    label: "X. Revisi (Ditolak QC)",
    badgeClass: "bg-rose-200 text-rose-900",
  },
  ready_to_release: {
    label: "6. Lolos QC (Siap)",
    badgeClass: "bg-teal-200 text-teal-900",
  },
  releasing: {
    label: "7. Proses Rilis",
    badgeClass: "bg-orange-200 text-orange-900",
  },
  released: {
    label: "8. Sudah Rilis",
    badgeClass: "bg-emerald-200 text-emerald-900",
  },
};

const PRIORITY_BADGE: Record<
  DevPriority,
  { label: string; className: string }
> = {
  unset: {
    label: "Prioritas: Belum Diset",
    className: "bg-slate-800 text-slate-400 border-slate-700",
  },
  low: {
    label: "Low Priority",
    className: "bg-slate-800 text-slate-300 border-slate-600",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-950/70 text-blue-300 border-blue-700/60",
  },
  high: {
    label: "High Priority",
    className: "bg-amber-950/70 text-amber-300 border-amber-700/60",
  },
  blocker: {
    label: "BLOCKER",
    className: "bg-rose-600 text-white border-rose-500",
  },
};

type TabType = "masuk" | "siap" | "ngoding" | "qc" | "rilis";

export default function DevProjectDashboard() {
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [masterData, setMasterData] = useState<MasterData>({
    apps: [],
    programmers: [],
    branches: [],
  });
  const [loading, setLoading] = useState(true);
  const [isSilentlyRefreshing, setIsSilentlyRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("masuk");
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [devFilter, setDevFilter] = useState<string>("all");

  // Modals & Drawer States
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [selectedReport, setSelectedReport] =
    useState<MaintenanceReport | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedGitType, setCopiedGitType] = useState<
    "branch" | "commit" | null
  >(null);

  // Form States inside Drawer
  const [assignedDev, setAssignedDev] = useState("");
  const [devPriority, setDevPriority] = useState<DevPriority>("medium");
  const [estimatedCause, setEstimatedCause] = useState("");
  const [targetDays, setTargetDays] = useState<number | string>("");
  const [internalDevNote, setInternalDevNote] = useState("");

  // Progress Form States
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [newProgressNote, setNewProgressNote] = useState("");
  const [progressFile, setProgressFile] = useState<File | null>(null);
  const [notifyReporterOnProgress, setNotifyReporterOnProgress] =
    useState(true);

  // Final Submission to QC States
  const [showFinalForm, setShowFinalForm] = useState(false);
  const [finalLink, setFinalLink] = useState("");
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [qcInstruction, setQcInstruction] = useState("");

  // Release Form States
  const [releaseVersionInput, setReleaseVersionInput] = useState("");
  const [releasePublicNote, setReleasePublicNote] = useState("");

  // Clock Update for Live Coding Timers
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // FITUR: AUTO REFRESH REAL-TIME (Tanpa Kedip / Silently)
  const fetchSilentData = useCallback(async () => {
    if (selectedReport) return;
    setIsSilentlyRefreshing(true);
    try {
      const [reportsData, master] = await Promise.all([
        getAllReports(),
        getMasterData(),
      ]);
      setReports(reportsData);
      setMasterData(master);
    } catch (error: unknown) {
      console.error("[Workspace] Auto-refresh gagal:", error);
    } finally {
      setIsSilentlyRefreshing(false);
    }
  }, [selectedReport]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchSilentData();
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [fetchSilentData]);

  // Initial & Manual Data Fetch
  const fetchManualData = useCallback(
    async ( activeTicketId?: string ) => {
      setLoading((prev) => (reports.length === 0 ? true : prev));
      setIsSilentlyRefreshing(true);
      try {
        const [reportsData, master] = await Promise.all([
          getAllReports(),
          getMasterData(),
        ]);
        setReports(reportsData);
        setMasterData(master);

        const targetId = activeTicketId ?? selectedReport?.id;
        if (targetId) {
          const updated = reportsData.find((r) => r.id === targetId);
          if (updated) setSelectedReport(updated);
        }
      } catch (error: unknown) {
        console.error("[Workspace] Gagal memuat data:", error);
      } finally {
        setLoading(false);
        setIsSilentlyRefreshing(false);
      }
    },
    [reports.length, selectedReport?.id]
  );

  useEffect(() => {
    fetchManualData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openReportDetail = (report: MaintenanceReport) => {
    setSelectedReport(report);
    setAssignedDev(
      report.workspace.assignedDev ||
        (devFilter !== "all" ? devFilter : masterData.programmers[0] || "")
    );
    setDevPriority(
      report.devPriority === "unset" ? "medium" : report.devPriority
    );
    setEstimatedCause(report.workspace.estimatedCause || "");
    setTargetDays(report.workspace.targetDays || "");
    setInternalDevNote(report.workspace.internalDevNote || "");
    setShowProgressForm(false);
    setShowFinalForm(false);
    setNewProgressNote("");
    setProgressFile(null);
    setFinalLink(report.workspace.finalDeliverable?.link || "");
    setFinalFile(null);
    setQcInstruction(report.workspace.qcInstructionNote || "");
    setReleaseVersionInput(report.workspace.releaseVersion || "v1.0.0");
    setReleasePublicNote(
      report.workspace.publicProgressNote ||
        "Pembaruan telah resmi dirilis ke server produksi."
    );
  };

  // Helper Git Branch & Commit Generator untuk Programmer
  const generateGitSnippet = (
    report: MaintenanceReport,
    mode: "branch" | "commit"
  ): string => {
    const slug = report.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 32);
    const prefix = report.type === "bug" ? "fix" : "feat";
    if (mode === "branch") {
      return `git checkout -b ${prefix}/${report.ticketNumber.toLowerCase()}-${slug}`;
    }
    const scope = report.moduleName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 18);
    return `${prefix}(${scope || "app"}): ${report.title.toLowerCase()} (#${
      report.ticketNumber
    })`;
  };

  const handleCopyGit = async (
    report: MaintenanceReport,
    mode: "branch" | "commit"
  ) => {
    try {
      await navigator.clipboard.writeText(generateGitSnippet(report, mode));
      setCopiedGitType(mode);
      setTimeout(() => setCopiedGitType(null), 2000);
    } catch {
      // Abaikan jika clipboard tidak diizinkan
    }
  };

  // Helper Live Timer Pengerjaan
  const formatElapsedDuration = (timerStartedAt?: string | null): string => {
    if (!timerStartedAt) return "Belum dimulai";
    const startMs = new Date(timerStartedAt).getTime();
    if (isNaN(startMs)) return "-";
    const diffMinutes = Math.max(1, Math.floor((nowTick - startMs) / 60000));
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days}h ${remHours}j ${mins}m`;
    }
    return hours > 0 ? `${hours} jam ${mins} mnt` : `${mins} menit`;
  };

  const handleSaveAnalysis = async () => {
    if (!selectedReport) return;
    setIsSaving(true);
    try {
      const daysNum = Math.max(1, Number(targetDays) || 1);
      const estFinish = new Date();
      estFinish.setDate(estFinish.getDate() + daysNum);

      await updateReportWorkspace(
        selectedReport,
        {
          status: "analyzed",
          devPriority,
          workspace: {
            ...selectedReport.workspace,
            assignedDev:
              assignedDev || selectedReport.workspace.assignedDev || "",
            estimatedCause: estimatedCause.trim(),
            targetDays: daysNum,
            internalDevNote: internalDevNote.trim(),
            estimatedFinishDate:
              selectedReport.workspace.estimatedFinishDate ||
              estFinish.toISOString(),
            publicProgressNote: `Laporan telah dianalisis oleh tim teknis (estimasi pengerjaan ${daysNum} hari kerja) dan sedang menunggu penjadwalan QC.`,
          },
        },
        false
      );
      await fetchManualData(selectedReport.id);
      setSelectedReport(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTimer = async () => {
    if (!selectedReport) return;
    setIsSaving(true);
    try {
      const pic =
        assignedDev ||
        selectedReport.workspace.assignedDev ||
        (devFilter !== "all" ? devFilter : "");
      await updateReportWorkspace(
        selectedReport,
        {
          status: "in_progress",
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            assignedDev: pic,
            timerStartedAt: new Date().toISOString(),
            publicProgressNote: pic
              ? `Laporan sedang dalam proses pengerjaan oleh Developer (${pic}).`
              : "Laporan sedang dalam proses pengerjaan oleh tim Developer.",
          },
        },
        true
      );
      await fetchManualData(selectedReport.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProgress = async () => {
    if (!selectedReport || !newProgressNote.trim()) return;
    setIsSaving(true);
    try {
      let attachmentUrl: string | null = null;
      if (progressFile) {
        attachmentUrl = await uploadProgressAttachment(
          selectedReport.ticketNumber,
          progressFile
        );
      }
      const newLog: ProgressLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        note: newProgressNote.trim(),
        attachmentUrl,
      };
      const updatedLogs = [
        ...(selectedReport.workspace.progressLogs || []),
        newLog,
      ];
      await updateReportWorkspace(
        selectedReport,
        {
          status: "in_progress",
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            internalDevNote: internalDevNote.trim(),
            progressLogs: updatedLogs,
            publicProgressNote: newProgressNote.trim(),
          },
        },
        notifyReporterOnProgress
      );
      await fetchManualData(selectedReport.id);
      setShowProgressForm(false);
      setNewProgressNote("");
      setProgressFile(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitToQC = async () => {
    if (!selectedReport || !qcInstruction.trim()) return;
    setIsSaving(true);
    try {
      let attachmentUrl =
        selectedReport.workspace.finalDeliverable?.attachmentUrl || null;
      if (finalFile) {
        attachmentUrl = await uploadProgressAttachment(
          `${selectedReport.ticketNumber}_FINAL`,
          finalFile
        );
      }
      const finalDeliverable: FinalDeliverable = {
        link: finalLink.trim(),
        attachmentUrl,
      };
      await updateReportWorkspace(
        selectedReport,
        {
          status: "waiting_qc",
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            finalDeliverable,
            internalDevNote: internalDevNote.trim(),
            qcInstructionNote: qcInstruction.trim(),
            publicProgressNote:
              "Pengerjaan kode oleh Developer telah selesai dan kini sedang diuji oleh tim Quality Control (QC).",
          },
        },
        true
      );
      await fetchManualData(selectedReport.id);
      setSelectedReport(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReleaseAction = async (action: "start" | "finish") => {
    if (!selectedReport) return;
    setIsSaving(true);
    try {
      const nextStatus: ReportStatus =
        action === "start" ? "releasing" : "released";
      const ver =
        releaseVersionInput.trim() ||
        selectedReport.workspace.releaseVersion ||
        "v1.0.0";
      const note =
        action === "start"
          ? `Perbaikan/fitur sedang dalam proses instalasi (deploy) ke server produksi (${ver}).`
          : releasePublicNote.trim() ||
            `Laporan telah selesai dan resmi dirilis pada versi ${ver}.`;

      await updateReportWorkspace(
        selectedReport,
        {
          status: nextStatus,
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            releaseVersion: ver,
            publicProgressNote: note,
          },
        },
        true
      );
      await fetchManualData(selectedReport.id);
      if (action === "finish") setSelectedReport(null);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
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

  const formatWhatsAppUrl = (phone: string, ticketNumber: string): string => {
    const digits = phone.replace(/[^0-9]/g, "");
    const normalized = digits.startsWith("0")
      ? `62${digits.slice(1)}`
      : digits;
    const text = encodeURIComponent(
      `Halo, kami dari Tim Developer terkait laporan tiket #${ticketNumber}...`
    );
    return `https://wa.me/${normalized}?text=${text}`;
  };

  // Penyaringan Laporan Berdasarkan Search, Aplikasi, dan PIC Developer
  const filteredReports = reports.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      r.ticketNumber.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.moduleName.toLowerCase().includes(q) ||
      r.reporter.name.toLowerCase().includes(q);
    const matchApp = appFilter === "all" || r.appName === appFilter;
    const matchDev =
      devFilter === "all" ||
      r.workspace.assignedDev === devFilter ||
      (!r.workspace.assignedDev && r.status === "submitted");
    return matchSearch && matchApp && matchDev;
  });

  const listMasuk = filteredReports.filter(
    (r) => r.status === "submitted" || r.status === "analyzed"
  );
  const listSiap = filteredReports.filter((r) => r.status === "scheduled");
  const listNgoding = filteredReports.filter(
    (r) => r.status === "in_progress" || r.status === "qc_rejected"
  );
  const listQC = filteredReports.filter((r) => r.status === "waiting_qc");
  const listRilis = filteredReports.filter(
    (r) =>
      r.status === "ready_to_release" ||
      r.status === "releasing" ||
      r.status === "released"
  );

  const getActiveList = (): MaintenanceReport[] => {
    switch (activeTab) {
      case "masuk":
        return listMasuk;
      case "siap":
        return listSiap;
      case "ngoding":
        return listNgoding;
      case "qc":
        return listQC;
      case "rilis":
        return listRilis;
      default:
        return [];
    }
  };

  // Perhitungan Statistik untuk Modal Dev Insights
  const totalFinished = reports.filter((r) =>
    ["ready_to_release", "releasing", "released"].includes(r.status)
  ).length;
  const firstTimePassCount = reports.filter(
    (r) =>
      ["ready_to_release", "releasing", "released"].includes(r.status) &&
      (r.workspace.reopenCount || 0) === 0
  ).length;
  const qcPassRate =
    totalFinished > 0
      ? Math.round((firstTimePassCount / totalFinished) * 100)
      : 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold">
            Memuat Workspace Developer...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-16">
      {/* HEADER UTAMA */}
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
                Developer Workspace
                {isSilentlyRefreshing && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Live Sync
                  </span>
                )}
              </h1>
              <p className="text-xs text-indigo-400 font-medium">
                Engineering Task, Live Timer &amp; Deployment Manager
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* FILTER PIC DEVELOPER */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-2 rounded-xl">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs text-slate-400 hidden sm:inline">
                PIC Dev:
              </span>
              <select
                value={devFilter}
                onChange={(e) => setDevFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">
                  Semua Developer
                </option>
                {masterData.programmers.map((dev) => (
                  <option key={dev} value={dev} className="bg-slate-900">
                    {dev}
                  </option>
                ))}
              </select>
            </div>

            {/* TOMBOL PENGGANTI PENGATURAN: DEV INSIGHTS & WORKLOAD */}
            <button
              type="button"
              onClick={() => setShowInsightsModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold flex items-center gap-1.5 border border-indigo-500/30 transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Statistik &amp;
              Beban Dev
            </button>

            <button
              type="button"
              onClick={() => fetchManualData()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh Data Sekarang"
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
        {/* BARIS PENCARIAN & FILTER APLIKASI */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor tiket, judul kendala, modul, atau pelapor..."
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

          <div className="flex items-center gap-2">
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

        {/* TAB FILTERS (DENGAN STATIC CLASS MAPPING AGAR AMAN DI BUILD VERCEL) */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 w-full md:w-max">
          {[
            {
              id: "masuk" as TabType,
              label: "Analisa Masuk",
              count: listMasuk.length,
              icon: AlertTriangle,
              activeClass: "bg-rose-600 text-white shadow-lg shadow-rose-950/50",
            },
            {
              id: "siap" as TabType,
              label: "Antrean Dijadwalkan",
              count: listSiap.length,
              icon: Calendar,
              activeClass: "bg-blue-600 text-white shadow-lg shadow-blue-950/50",
            },
            {
              id: "ngoding" as TabType,
              label: "Ruang Ngoding",
              count: listNgoding.length,
              icon: Wrench,
              activeClass:
                "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50",
            },
            {
              id: "qc" as TabType,
              label: "Menunggu QC",
              count: listQC.length,
              icon: ShieldCheck,
              activeClass:
                "bg-amber-600 text-white shadow-lg shadow-amber-950/50",
            },
            {
              id: "rilis" as TabType,
              label: "Eksekusi Rilis",
              count: listRilis.filter((r) => r.status !== "released").length,
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

        {/* LIST TIKET */}
        <div className="grid grid-cols-1 gap-3">
          {getActiveList().map((report) => {
            const priorityMeta =
              PRIORITY_BADGE[report.devPriority || "unset"] ||
              PRIORITY_BADGE.unset;

            return (
              <div
                key={report.id || report.ticketNumber}
                onClick={() => openReportDetail(report)}
                className="bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800 hover:border-indigo-500/50 rounded-xl p-4 shadow-sm cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all group"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md shrink-0">
                      #{report.ticketNumber}
                    </span>

                    <span
                      className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                        STATUS_CONFIG[report.status].badgeClass
                      }`}
                    >
                      {STATUS_CONFIG[report.status].label}
                    </span>

                    <span
                      className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-md border ${priorityMeta.className}`}
                    >
                      {priorityMeta.label}
                    </span>

                    {report.workspace.assignedDev && (
                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-900 text-indigo-300 border border-slate-700 flex items-center gap-1">
                        <User className="w-3 h-3" />{" "}
                        {report.workspace.assignedDev}
                      </span>
                    )}

                    {report.status === "in_progress" &&
                      report.workspace.timerStartedAt && (
                        <span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-pulse" />{" "}
                          {formatElapsedDuration(
                            report.workspace.timerStartedAt
                          )}
                        </span>
                      )}
                  </div>

                  <div className="flex items-center gap-2">
                    {report.type === "bug" ? (
                      <Bug className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                    <h3 className="text-sm font-bold text-slate-100 truncate pr-2">
                      {report.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1 shrink-0">
                      <Layers className="w-3 h-3" /> {report.appName} —{" "}
                      {report.moduleName}
                    </span>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <User className="w-3 h-3 text-slate-500" />
                      <span className="font-medium text-slate-300">
                        {report.reporter.name}
                      </span>
                      <span>({report.reporter.division})</span>
                    </div>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1.5 min-w-0 max-w-md">
                      <MessageSquare className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {report.chronology || report.featureGoal}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-end gap-2">
                  {report.workspace.scheduledDeadline && (
                    <span className="text-[11px] text-slate-400 bg-slate-900/90 border border-slate-700 px-2.5 py-1.5 rounded-lg">
                      Deadline:{" "}
                      <strong className="text-slate-200">
                        {report.workspace.scheduledDeadline}
                      </strong>
                    </span>
                  )}
                  <button
                    type="button"
                    className="w-full md:w-auto px-4 py-2 bg-slate-700/50 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white text-xs font-bold rounded-lg transition-colors border border-slate-600/50 group-hover:border-indigo-500 flex items-center justify-center gap-2"
                  >
                    Kelola Tiket <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {getActiveList().length === 0 && (
            <div className="p-12 text-center text-slate-500 bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl">
              Belum ada tiket di antrean ini yang sesuai dengan filter.
            </div>
          )}
        </div>
      </main>

      {/* DRAWER KONTROL DEV */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 h-full flex flex-col">
            {/* HEADER DRAWER */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 shrink-0">
                  #{selectedReport.ticketNumber}
                </span>
                <h2 className="text-base font-bold text-white truncate">
                  {selectedReport.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BODY DRAWER */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* FITUR PROGRAMMER: GIT BRANCH & COMMIT HELPER */}
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-300 min-w-0">
                  <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-mono text-[11px] text-slate-400 truncate">
                    {generateGitSnippet(selectedReport, "branch")}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyGit(selectedReport, "branch")}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 flex items-center gap-1"
                  >
                    {copiedGitType === "branch" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyGit(selectedReport, "commit")}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 flex items-center gap-1"
                  >
                    {copiedGitType === "commit" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy Commit Msg
                  </button>
                </div>
              </div>

              {/* BANNER REVISI JIKA DITOLAK QC */}
              {selectedReport.status === "qc_rejected" && (
                <div className="bg-rose-950/40 border border-rose-500/40 p-4 rounded-xl space-y-1.5">
                  <p className="text-xs font-bold text-rose-400 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Dikembalikan oleh QC
                    (Reopen #{selectedReport.workspace.reopenCount || 1})
                  </p>
                  <p className="text-sm text-rose-200 whitespace-pre-line">
                    {selectedReport.workspace.qcRejectReason ||
                      "Perlu perbaikan ulang sesuai temuan pengujian QC."}
                  </p>
                </div>
              )}

              {/* INFORMASI LENGKAP TIKET */}
              <div className="bg-slate-800/40 border border-slate-700 p-5 rounded-xl space-y-5">
                <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-700 pb-3">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Aplikasi &amp; Modul
                    </p>
                    <p className="text-sm font-bold text-indigo-300">
                      {selectedReport.appName}{" "}
                      <span className="text-slate-500 mx-1">—</span>{" "}
                      {selectedReport.moduleName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" /> Waktu Laporan
                    </p>
                    <p className="text-sm font-semibold text-slate-300">
                      {formatDateTime(selectedReport.dates.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center shrink-0 border border-slate-600">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {selectedReport.reporter.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {selectedReport.reporter.division}{" "}
                        <span className="mx-1">•</span>{" "}
                        {selectedReport.reporter.contact}
                      </p>
                    </div>
                  </div>

                  {selectedReport.reporter.contact && (
                    <a
                      href={formatWhatsAppUrl(
                        selectedReport.reporter.contact,
                        selectedReport.ticketNumber
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Hubungi WA
                      Pelapor
                    </a>
                  )}
                </div>

                {/* DEVICE METADATA UNTUK DEBUGGING */}
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    Environment Pelapor:
                  </span>
                  <span className="font-mono text-slate-300">
                    {selectedReport.deviceMeta?.os || "-"} •{" "}
                    {selectedReport.deviceMeta?.browser || "-"} (
                    {selectedReport.deviceMeta?.screen || "-"})
                  </span>
                </div>

                <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800/50 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/80" />
                    <p className="text-[10px] text-rose-400 uppercase font-bold mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Masalah /
                      Kendala User (Kronologi)
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line pl-1">
                      {selectedReport.chronology ||
                        selectedReport.featureGoal ||
                        "Tidak ada detail yang diberikan."}
                    </p>
                  </div>
                  <div className="p-4 relative bg-indigo-950/20">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/80" />
                    <p className="text-[10px] text-indigo-400 uppercase font-bold mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Harapan / Hasil
                      Yang Seharusnya
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line pl-1">
                      {selectedReport.expectedResult ||
                        selectedReport.featureWorkflow ||
                        "Tidak ada detail ekspektasi spesifik yang dilampirkan oleh pelapor."}
                    </p>
                  </div>
                </div>

                {selectedReport.attachments?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" /> Foto Lampiran
                      Pelapor ({selectedReport.attachments.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedReport.attachments.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setPreviewImageUrl(url)}
                          className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors shadow-sm"
                        >
                          <img
                            src={url}
                            alt={`Lampiran ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TAHAP 1: ANALISA & ESTIMASI DEV */}
              {(selectedReport.status === "submitted" ||
                selectedReport.status === "analyzed") && (
                <div className="bg-slate-800 border border-indigo-500/30 p-5 rounded-xl space-y-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-indigo-400 text-sm flex items-center gap-2">
                      <Search className="w-4 h-4" /> Tahap 1: Analisa &amp;
                      Estimasi Dev
                    </h3>
                    {selectedReport.status === "analyzed" && (
                      <span className="text-[11px] text-fuchsia-300 bg-fuchsia-950/60 border border-fuchsia-700/50 px-2.5 py-0.5 rounded-full">
                        Menunggu Jadwal QC
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">
                        PIC Developer
                      </label>
                      <select
                        value={assignedDev}
                        onChange={(e) => setAssignedDev(e.target.value)}
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 text-sm text-white rounded-xl outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Pilih Developer --</option>
                        {masterData.programmers.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">
                        Prioritas Teknis
                      </label>
                      <select
                        value={devPriority}
                        onChange={(e) =>
                          setDevPriority(e.target.value as DevPriority)
                        }
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 text-sm text-white rounded-xl outline-none focus:border-indigo-500"
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="blocker">Blocker (Darurat)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">
                      Rencana Pengerjaan / Analisa Penyebab *
                    </label>
                    <textarea
                      rows={2}
                      value={estimatedCause}
                      onChange={(e) => setEstimatedCause(e.target.value)}
                      placeholder="Perkiraan penyebab error dan rencana solusinya..."
                      className="w-full p-3 bg-slate-900 border border-slate-700 text-sm text-white rounded-xl outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">
                      Estimasi Waktu Pengerjaan (Hari Kerja) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={targetDays}
                      onChange={(e) => setTargetDays(e.target.value)}
                      placeholder="Cth: 2"
                      className="w-full p-3 bg-slate-900 border border-slate-700 text-sm text-white rounded-xl outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAnalysis}
                    disabled={!estimatedCause.trim() || !targetDays || isSaving}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {selectedReport.status === "submitted"
                          ? "Kirim ke QC untuk Dijadwalkan"
                          : "Perbarui Hasil Analisa"}{" "}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* TAHAP 2: MULAI KERJAKAN */}
              {["scheduled", "qc_rejected"].includes(selectedReport.status) && (
                <div className="bg-slate-800 border border-emerald-500/30 p-5 rounded-xl text-center space-y-3 shadow-lg">
                  <h3 className="font-bold text-emerald-400 text-sm flex items-center justify-center gap-2">
                    <PlayCircle className="w-4 h-4" /> Tiket Siap Dieksekusi
                  </h3>
                  <p className="text-xs text-slate-300">
                    Jadwal dari QC:{" "}
                    <strong className="text-white">
                      {selectedReport.workspace.scheduledStartDate ||
                        "Segera"}
                    </strong>{" "}
                    s/d{" "}
                    <strong className="text-white">
                      {selectedReport.workspace.scheduledDeadline ||
                        "Sesuai Estimasi"}
                    </strong>
                  </p>
                  <button
                    type="button"
                    onClick={handleStartTimer}
                    disabled={isSaving}
                    className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <PlayCircle className="w-5 h-5" /> Mulai Kerjakan (Start
                        Timer)
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* TAHAP 3: IN PROGRESS */}
              {selectedReport.status === "in_progress" && (
                <div className="space-y-4">
                  <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Clock className="w-6 h-6 text-amber-500 animate-pulse" />
                      <div>
                        <p className="text-[10px] text-amber-500/80 font-bold uppercase">
                          Sedang Dikerjakan • Durasi:{" "}
                          {formatElapsedDuration(
                            selectedReport.workspace.timerStartedAt
                          )}
                        </p>
                        <p className="text-sm font-bold text-amber-400">
                          Target Selesai QC:{" "}
                          {selectedReport.workspace.scheduledDeadline ||
                            "Sesuai Estimasi"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!showProgressForm && !showFinalForm && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowProgressForm(true)}
                        className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-indigo-400" />{" "}
                        Update Progres
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFinalForm(true)}
                        className="py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Setor Hasil ke QC
                      </button>
                    </div>
                  )}

                  {showProgressForm && (
                    <div className="bg-slate-900 border border-indigo-500/30 p-5 rounded-xl mt-4 space-y-3">
                      <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Catat Progres
                        Harian
                      </h4>
                      <textarea
                        rows={3}
                        value={newProgressNote}
                        onChange={(e) => setNewProgressNote(e.target.value)}
                        placeholder="Tuliskan apa saja yang sudah dikerjakan..."
                        className="w-full p-3 bg-slate-950 border border-slate-700 text-sm text-white rounded-xl outline-none focus:border-indigo-500"
                      />
                      <label className="flex items-center gap-3 p-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl cursor-pointer hover:bg-slate-700">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-300 flex-1 truncate">
                          {progressFile
                            ? progressFile.name
                            : "Lampirkan Foto/Bukti Progres (Opsional)"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setProgressFile(e.target.files?.[0] || null)
                          }
                          className="hidden"
                        />
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifyReporterOnProgress}
                          onChange={(e) =>
                            setNotifyReporterOnProgress(e.target.checked)
                          }
                          className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        Kirim notifikasi email progres ini ke Pelapor
                      </label>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowProgressForm(false)}
                          className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleAddProgress}
                          disabled={!newProgressNote.trim() || isSaving}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                          {isSaving ? "Menyimpan..." : "Simpan Progres"}
                        </button>
                      </div>
                    </div>
                  )}

                  {showFinalForm && (
                    <div className="bg-slate-900 border border-teal-500/30 p-5 rounded-xl mt-4">
                      <h4 className="text-xs font-bold text-teal-400 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Penyerahan Hasil
                        Akhir ke QC
                      </h4>
                      <div className="space-y-4 mb-5">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                            Link Pengerjaan / Staging / PR (Opsional)
                          </label>
                          <div className="flex bg-slate-950 border border-slate-700 rounded-xl overflow-hidden">
                            <span className="p-3 bg-slate-800 text-slate-400">
                              <LinkIcon className="w-4 h-4" />
                            </span>
                            <input
                              type="url"
                              value={finalLink}
                              onChange={(e) => setFinalLink(e.target.value)}
                              placeholder="https://..."
                              className="w-full p-2.5 bg-transparent text-sm text-white outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                            Lampiran Screenshot Hasil Akhir (Opsional)
                          </label>
                          <label className="flex items-center gap-3 p-3 bg-slate-950 border border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-teal-500">
                            <Upload className="w-4 h-4 text-teal-400" />
                            <span className="text-xs text-slate-300 flex-1 truncate">
                              {finalFile
                                ? finalFile.name
                                : "Unggah bukti screenshot hasil perbaikan"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                setFinalFile(e.target.files?.[0] || null)
                              }
                              className="hidden"
                            />
                          </label>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                            Catatan Teknis Internal Dev (Opsional)
                          </label>
                          <input
                            type="text"
                            value={internalDevNote}
                            onChange={(e) => setInternalDevNote(e.target.value)}
                            placeholder="Cth: Refactor fungsi hitung diskon di modul transaksi"
                            className="w-full p-2.5 bg-slate-950 border border-slate-700 text-sm text-white rounded-xl outline-none focus:border-teal-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                            Instruksi Testing untuk QC *
                          </label>
                          <textarea
                            rows={3}
                            value={qcInstruction}
                            onChange={(e) => setQcInstruction(e.target.value)}
                            placeholder="Tulis skenario langkah demi langkah yang harus dites oleh QC..."
                            className="w-full p-3 bg-slate-950 border border-slate-700 text-sm text-white rounded-xl outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-slate-800/50 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowFinalForm(false)}
                          className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitToQC}
                          disabled={!qcInstruction.trim() || isSaving}
                          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                          {isSaving ? "Mengirim..." : "Kirim ke QC"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* RIWAYAT PROGRES */}
              {selectedReport.workspace.progressLogs &&
                selectedReport.workspace.progressLogs.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-3">
                      <History className="w-4 h-4" /> Riwayat Progres Pengerjaan
                    </h4>
                    <div className="space-y-3 border-l-2 border-slate-700 ml-2 pl-4 py-1">
                      {[...selectedReport.workspace.progressLogs]
                        .reverse()
                        .map((log) => (
                          <div
                            key={log.id}
                            className="relative p-4 bg-slate-900/60 border border-slate-800 rounded-xl"
                          >
                            <div className="absolute -left-5.25 top-4 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                            <p className="text-[10px] text-indigo-400 font-bold mb-1.5">
                              {formatDateTime(log.timestamp)}
                            </p>
                            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                              {log.note}
                            </p>
                            {log.attachmentUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImageUrl(log.attachmentUrl || null)
                                }
                                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] text-indigo-300 font-semibold"
                              >
                                <Paperclip className="w-3.5 h-3.5" /> Lihat
                                Bukti/Lampiran
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* TAHAP 4: RILIS & DEPLOY */}
              {[
                "waiting_qc",
                "ready_to_release",
                "releasing",
                "released",
              ].includes(selectedReport.status) && (
                <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl space-y-4 shadow-md">
                  {selectedReport.status === "waiting_qc" && (
                    <p className="text-amber-400 font-bold text-center flex items-center justify-center gap-2">
                      <ShieldCheck className="w-5 h-5" /> Sedang Diuji oleh Tim
                      QC...
                    </p>
                  )}

                  {selectedReport.status === "ready_to_release" && (
                    <div className="space-y-4">
                      <p className="text-emerald-400 font-bold flex justify-center items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> Lolos Verifikasi
                        QC! Siap Deploy ke Produksi
                      </p>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                          Tag / Versi Rilis
                        </label>
                        <input
                          type="text"
                          value={releaseVersionInput}
                          onChange={(e) =>
                            setReleaseVersionInput(e.target.value)
                          }
                          placeholder="Cth: v1.2.0"
                          className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReleaseAction("start")}
                        disabled={isSaving}
                        className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2"
                      >
                        <Rocket className="w-5 h-5" /> Mulai Proses Rilis /
                        Deploy Server
                      </button>
                    </div>
                  )}

                  {selectedReport.status === "releasing" && (
                    <div className="space-y-4">
                      <p className="text-orange-400 font-bold flex justify-center items-center gap-2 animate-pulse">
                        <RefreshCw className="w-5 h-5 animate-spin" /> Sedang
                        Proses Rilis / Upload ke Server...
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                            Versi Rilis Final
                          </label>
                          <input
                            type="text"
                            value={releaseVersionInput}
                            onChange={(e) =>
                              setReleaseVersionInput(e.target.value)
                            }
                            placeholder="Cth: v1.2.0"
                            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                            Catatan Rilis untuk Email Pelapor
                          </label>
                          <textarea
                            rows={2}
                            value={releasePublicNote}
                            onChange={(e) =>
                              setReleasePublicNote(e.target.value)
                            }
                            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReleaseAction("finish")}
                        disabled={isSaving}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" /> Konfirmasi Rilis
                        Selesai &amp; Kirim Email!
                      </button>
                    </div>
                  )}

                  {selectedReport.status === "released" && (
                    <div className="text-center space-y-1">
                      <p className="text-emerald-400 font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> Telah Sukses
                        Dirilis ({selectedReport.workspace.releaseVersion || "Production"})
                      </p>
                      <p className="text-xs text-slate-400">
                        Dirilis pada:{" "}
                        {formatDateTime(selectedReport.dates.releasedAt)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGGANTI PENGATURAN: DEV INSIGHTS & WORKLOAD */}
      {showInsightsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-xl border border-slate-700 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-white font-bold text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" /> Statistik
                  Engineering &amp; Beban Kerja Developer
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ringkasan distribusi tiket dan kualitas pengerjaan tim Dev
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInsightsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KARTU METRIK UTAMA */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Sedang Di-coding
                </p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">
                  {
                    reports.filter((r) =>
                      ["in_progress", "qc_rejected"].includes(r.status)
                    ).length
                  }
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  First-Time QC Pass
                </p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {qcPassRate}%
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Total Selesai Rilis
                </p>
                <p className="text-2xl font-bold text-teal-400 mt-1">
                  {reports.filter((r) => r.status === "released").length}
                </p>
              </div>
            </div>

            {/* DISTRIBUSI BEBAN PER PROGRAMMER */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase text-slate-400">
                Beban Tugas per Developer (PIC)
              </h3>
              <div className="space-y-2">
                {masterData.programmers.map((dev) => {
                  const devReports = reports.filter(
                    (r) => r.workspace.assignedDev === dev
                  );
                  const activeCount = devReports.filter((r) =>
                    ["scheduled", "in_progress", "qc_rejected"].includes(
                      r.status
                    )
                  ).length;
                  const qcCount = devReports.filter(
                    (r) => r.status === "waiting_qc"
                  ).length;
                  const doneCount = devReports.filter(
                    (r) => r.status === "released"
                  ).length;

                  return (
                    <div
                      key={dev}
                      className="p-3 bg-slate-800/70 border border-slate-700/80 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-bold text-white">
                          {dev}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                          {activeCount} Aktif
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                          {qcCount} di QC
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                          {doneCount} Rilis
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInsightsModal(false)}
              className="w-full py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-bold text-sm"
            >
              Tutup Statistik
            </button>
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