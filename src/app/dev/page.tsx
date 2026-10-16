/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  CheckCircle2,
  User,
  PlayCircle,
  Clock,
  Bug,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Rocket,
  PlusCircle,
  ExternalLink,
  X,
  Upload,
  Layers,
  Smartphone,
  ShieldAlert,
} from "lucide-react";
import {
  MaintenanceReport,
  DevPriority,
  ProgressLog,
  ReportStatus,
} from "@/types/report";
import {
  getAllReports,
  updateReportWorkspace,
  uploadProgressAttachment,
} from "@/services/reportService";
import { getMasterData } from "@/services/settingsService";

type DevTab = "active" | "triage" | "release" | "history";
type ModalMode = "analyze" | "progress" | "finish" | "release" | null;

const ACTIVE_DEV_STORAGE_KEY = "portal_active_dev_v1";

export default function DevDashboard() {
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [programmers, setProgrammers] = useState<string[]>([]);
  const [activeDev, setActiveDev] = useState("");
  const [activeTab, setActiveTab] = useState<DevTab>("active");
  const [loading, setLoading] = useState(true);

  // Notification Banner States
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modal & Action States
  const [selectedReport, setSelectedReport] =
    useState<MaintenanceReport | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Form States for Modals
  const [estimatedCause, setEstimatedCause] = useState("");
  const [targetDays, setTargetDays] = useState<number>(1);
  const [devPriority, setDevPriority] = useState<DevPriority>("medium");
  const [internalDevNote, setInternalDevNote] = useState("");
  const [qcInstructionNote, setQcInstructionNote] = useState("");
  const [publicProgressNote, setPublicProgressNote] = useState("");

  // Progress Log States
  const [progressNote, setProgressNote] = useState("");
  const [progressFile, setProgressFile] = useState<File | null>(null);

  // Release States
  const [releaseVersion, setReleaseVersion] = useState("");
  const [deliverableLink, setDeliverableLink] = useState("");

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, master] = await Promise.all([
        getAllReports(),
        getMasterData(),
      ]);
      setReports(reportsData);
      const sortedProgrammers = [...(master.programmers || [])].sort((a, b) =>
        a.localeCompare(b)
      );
      setProgrammers(sortedProgrammers);

      setActiveDev((prev) => {
        if (prev && sortedProgrammers.includes(prev)) return prev;
        try {
          const saved = localStorage.getItem(ACTIVE_DEV_STORAGE_KEY);
          if (saved && sortedProgrammers.includes(saved)) return saved;
        } catch {
          // Abaikan jika localStorage tidak tersedia
        }
        return sortedProgrammers[0] || "";
      });
    } catch (err: unknown) {
      console.error("[DevDashboard] Gagal memuat data:", err);
      showFeedback("error", "Gagal memuat data laporan dari server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectDev = (devName: string) => {
    setActiveDev(devName);
    try {
      localStorage.setItem(ACTIVE_DEV_STORAGE_KEY, devName);
    } catch {
      // Abaikan
    }
  };

  // Kategorisasi Tiket untuk Programmer
  const activeTasks = reports.filter(
    (r) =>
      r.workspace.assignedDev === activeDev &&
      ["scheduled", "in_progress", "qc_rejected"].includes(r.status)
  );

  const triageTasks = reports.filter(
    (r) =>
      r.status === "submitted" ||
      (r.status === "analyzed" &&
        (!r.workspace.assignedDev || r.workspace.assignedDev === activeDev))
  );

  const releaseTasks = reports.filter(
    (r) =>
      (r.workspace.assignedDev === activeDev || !r.workspace.assignedDev) &&
      ["ready_to_release", "releasing"].includes(r.status)
  );

  const historyTasks = reports.filter(
    (r) =>
      r.workspace.assignedDev === activeDev &&
      ["waiting_qc", "released"].includes(r.status)
  );

  const displayedTasks =
    activeTab === "active"
      ? activeTasks
      : activeTab === "triage"
      ? triageTasks
      : activeTab === "release"
      ? releaseTasks
      : historyTasks;

  const formatSafeDate = (dateStr?: string | null): string => {
    if (!dateStr) return "Belum ditentukan";
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const openModal = (report: MaintenanceReport, mode: ModalMode) => {
    setSelectedReport(report);
    setModalMode(mode);
    setEstimatedCause(report.workspace.estimatedCause || "");
    setTargetDays(report.workspace.targetDays || 1);
    setDevPriority(
      report.devPriority === "unset" ? "medium" : report.devPriority
    );
    setInternalDevNote(report.workspace.internalDevNote || "");
    setQcInstructionNote(report.workspace.qcInstructionNote || "");
    setPublicProgressNote(report.workspace.publicProgressNote || "");
    setProgressNote("");
    setProgressFile(null);
    setReleaseVersion(report.workspace.releaseVersion || "v1.0.0");
    setDeliverableLink(report.workspace.finalDeliverable?.link || "");
  };

  const closeModal = () => {
    setSelectedReport(null);
    setModalMode(null);
    setProgressFile(null);
  };

  // Aksi Cepat: Mulai Pengerjaan atau Mulai Deploy
  const handleQuickStatusChange = async (
    report: MaintenanceReport,
    targetStatus: ReportStatus
  ) => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const autoPublicNote =
        targetStatus === "in_progress"
          ? `Sedang dikerjakan oleh tim Developer (${activeDev}).`
          : targetStatus === "releasing"
          ? `Perbaikan telah lolos QC dan sedang dalam proses deploy ke server produksi.`
          : report.workspace.publicProgressNote;

      await updateReportWorkspace(
        report,
        {
          status: targetStatus,
          devPriority: report.devPriority,
          workspace: {
            ...report.workspace,
            assignedDev: report.workspace.assignedDev || activeDev,
            timerStartedAt:
              targetStatus === "in_progress"
                ? now
                : report.workspace.timerStartedAt,
            publicProgressNote: autoPublicNote,
          },
        },
        true
      );
      showFeedback(
        "success",
        `Status tiket #${report.ticketNumber} diperbarui menjadi ${targetStatus.replace(
          /_/g,
          " "
        ).toUpperCase()}.`
      );
      await fetchData();
    } catch (err: unknown) {
      console.error(err);
      showFeedback("error", "Gagal memperbarui status tiket.");
    } finally {
      setIsSaving(false);
    }
  };

  // Simpan Analisis & Estimasi Awal (Submitted -> Analyzed)
  const handleSaveAnalysis = async (startImmediately: boolean = false) => {
    if (!selectedReport) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const nextStatus: ReportStatus = startImmediately
        ? "in_progress"
        : "analyzed";

      const estimatedFinish = new Date();
      estimatedFinish.setDate(
        estimatedFinish.getDate() + Math.max(1, Number(targetDays) || 1)
      );

      await updateReportWorkspace(
        selectedReport,
        {
          status: nextStatus,
          devPriority,
          workspace: {
            ...selectedReport.workspace,
            assignedDev: activeDev,
            estimatedCause: estimatedCause.trim(),
            targetDays: Math.max(1, Number(targetDays) || 1),
            estimatedFinishDate: estimatedFinish.toISOString(),
            timerStartedAt: startImmediately
              ? now
              : selectedReport.workspace.timerStartedAt,
            publicProgressNote: startImmediately
              ? `Laporan telah dianalisis dan langsung dikerjakan oleh ${activeDev}.`
              : `Laporan telah dianalisis oleh ${activeDev} (estimasi pengerjaan ${targetDays} hari kerja) dan menunggu penjadwalan QC.`,
          },
        },
        true
      );

      closeModal();
      showFeedback(
        "success",
        `Analisis tiket #${selectedReport.ticketNumber} berhasil disimpan.`
      );
      if (startImmediately) setActiveTab("active");
      await fetchData();
    } catch (err: unknown) {
      console.error(err);
      showFeedback("error", "Gagal menyimpan hasil analisis.");
    } finally {
      setIsSaving(false);
    }
  };

  // Tambah Catatan Progres Harian (ProgressLog)
  const handleAddProgressLog = async () => {
    if (!selectedReport || !progressNote.trim()) return;
    setIsSaving(true);
    try {
      let uploadedUrl: string | null = null;
      if (progressFile) {
        uploadedUrl = await uploadProgressAttachment(
          selectedReport.ticketNumber,
          progressFile
        );
      }

      const newLog: ProgressLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        note: progressNote.trim(),
        attachmentUrl: uploadedUrl,
      };

      const existingLogs = selectedReport.workspace.progressLogs || [];

      await updateReportWorkspace(
        selectedReport,
        {
          status: "in_progress",
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            progressLogs: [...existingLogs, newLog],
            publicProgressNote: progressNote.trim(),
          },
        },
        true
      );

      closeModal();
      showFeedback(
        "success",
        `Progres pengerjaan #${selectedReport.ticketNumber} berhasil dicatat & dikirim ke pelapor.`
      );
      await fetchData();
    } catch (err: unknown) {
      console.error(err);
      showFeedback("error", "Gagal menambahkan log progres.");
    } finally {
      setIsSaving(false);
    }
  };

  // Serahkan ke QC (In Progress / QC Rejected -> Waiting QC)
  const handleFinishCoding = async () => {
    if (!selectedReport || !qcInstructionNote.trim()) return;
    setIsSaving(true);
    try {
      await updateReportWorkspace(
        selectedReport,
        {
          status: "waiting_qc",
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            internalDevNote: internalDevNote.trim(),
            qcInstructionNote: qcInstructionNote.trim(),
            publicProgressNote:
              publicProgressNote.trim() ||
              `Pengerjaan teknis oleh ${activeDev} telah selesai dan kini sedang dalam tahap pengujian Quality Control (QC).`,
          },
        },
        true
      );
      closeModal();
      showFeedback(
        "success",
        `Tiket #${selectedReport.ticketNumber} berhasil diserahkan ke tim QC.`
      );
      await fetchData();
    } catch (err: unknown) {
      console.error(err);
      showFeedback("error", "Gagal menyerahkan tiket ke QC.");
    } finally {
      setIsSaving(false);
    }
  };

  // Konfirmasi Selesai Rilis Produksi (Ready to Release / Releasing -> Released)
  const handleCompleteRelease = async () => {
    if (!selectedReport || !releaseVersion.trim()) return;
    setIsSaving(true);
    try {
      await updateReportWorkspace(
        selectedReport,
        {
          status: "released",
          devPriority: selectedReport.devPriority,
          workspace: {
            ...selectedReport.workspace,
            releaseVersion: releaseVersion.trim(),
            finalDeliverable: {
              ...selectedReport.workspace.finalDeliverable,
              link: deliverableLink.trim(),
            },
            publicProgressNote:
              publicProgressNote.trim() ||
              `Pembaruan telah resmi dirilis pada versi ${releaseVersion.trim()}. Silakan muat ulang (refresh) aplikasi Anda.`,
          },
        },
        true
      );
      closeModal();
      showFeedback(
        "success",
        `Tiket #${selectedReport.ticketNumber} telah resmi dirilis (${releaseVersion.trim()})!`
      );
      await fetchData();
    } catch (err: unknown) {
      console.error(err);
      showFeedback("error", "Gagal menyelesaikan status rilis.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 pb-16">
      {/* TOP HEADER DENGAN LOGO */}
      <header className="border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-4 bg-slate-950 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1.5 overflow-hidden">
            <img
              src="/logo.png"
              alt="Logo Sistem"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                Engineering Portal
              </span>
            </div>
            <h1 className="text-lg font-bold text-white leading-tight">
              Developer Workspace
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title="Muat Ulang Data"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`}
            />
          </button>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-400 hidden sm:inline">
              Programmer:
            </span>
            <select
              value={activeDev}
              onChange={(e) => handleSelectDev(e.target.value)}
              className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer pr-1"
            >
              {programmers.map((p) => (
                <option key={p} value={p} className="bg-slate-900 text-white">
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 mt-2 space-y-6">
        {/* BANNER NOTIFIKASI */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-sm font-medium ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                : "bg-rose-950/60 border-rose-800 text-rose-300"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* RINGKASAN & TAB FILTER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Halo, {activeDev || "Developer"}!
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Anda memiliki{" "}
              <strong className="text-indigo-400">
                {activeTasks.length} tugas pengerjaan aktif
              </strong>{" "}
              dan{" "}
              <strong className="text-amber-400">
                {triageTasks.length} antrean analisis
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            {[
              {
                id: "active",
                label: "Tugas Aktif",
                count: activeTasks.length,
              },
              {
                id: "triage",
                label: "Analisis Baru",
                count: triageTasks.length,
              },
              {
                id: "release",
                label: "Siap Rilis",
                count: releaseTasks.length,
              },
              {
                id: "history",
                label: "Uji QC & Selesai",
                count: historyTasks.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as DevTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.id
                      ? "bg-indigo-800 text-indigo-100"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* DAFTAR TIKET */}
        {loading ? (
          <div className="p-12 text-center border border-slate-800 rounded-2xl bg-slate-800/40 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-sm text-slate-400">
              Memuat daftar tugas dari server...
            </p>
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="p-12 text-center border border-slate-800 rounded-2xl bg-slate-800/40">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60" />
            <p className="text-slate-300 font-semibold">
              Tidak ada tiket pada tab ini!
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Semua antrean di kategori ini sudah tertangani dengan baik ☕
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedTasks.map((task) => {
              const deadlineDate =
                task.workspace.scheduledDeadline ||
                task.workspace.estimatedFinishDate;

              return (
                <div
                  key={task.id || task.ticketNumber}
                  className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700/80 flex flex-col lg:flex-row justify-between items-start gap-5 hover:border-slate-600 transition"
                >
                  <div className="flex-1 space-y-3 w-full">
                    {/* BARIS BADGE TIKET */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-indigo-400 font-bold bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-0.5 rounded-lg">
                        #{task.ticketNumber}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                          task.type === "bug"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        }`}
                      >
                        {task.type === "bug" ? (
                          <Bug className="w-3 h-3" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        {task.type === "bug" ? "Bug / Error" : "Request Fitur"}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          task.status === "qc_rejected"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : task.status === "in_progress"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : task.status === "ready_to_release" ||
                              task.status === "releasing"
                            ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {task.status.replace(/_/g, " ")}
                      </span>

                      {task.devPriority === "blocker" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-rose-600 text-white flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> BLOCKER
                        </span>
                      )}

                      {task.userUrgency === "critical" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Urgensi Pelapor: Darurat
                        </span>
                      )}
                    </div>

                    {/* JUDUL & MODUL */}
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-slate-300 font-medium">
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                          {task.appName} — {task.moduleName}
                        </span>
                        <span>•</span>
                        <span>
                          Pelapor: {task.reporter.name} ({task.reporter.division}
                          )
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-slate-500" />
                          {task.deviceMeta?.os} / {task.deviceMeta?.browser}
                        </span>
                      </p>
                    </div>

                    {/* DETAIL MASALAH / REQUEST */}
                    <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-700/80 text-sm text-slate-200 space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                          {task.type === "bug"
                            ? "Kronologi Error:"
                            : "Tujuan Fitur:"}
                        </span>
                        <p className="text-xs leading-relaxed text-slate-300">
                          {task.type === "bug"
                            ? task.chronology
                            : task.featureGoal}
                        </p>
                      </div>

                      {(task.expectedResult || task.featureWorkflow) && (
                        <div className="pt-2 border-t border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                            {task.type === "bug"
                              ? "Hasil yang Seharusnya:"
                              : "Alur yang Diinginkan:"}
                          </span>
                          <p className="text-xs leading-relaxed text-slate-300">
                            {task.type === "bug"
                              ? task.expectedResult
                              : task.featureWorkflow}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* LAMPIRAN SCREENSHOT PELAPOR */}
                    {task.attachments && task.attachments.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                          Bukti Foto / Screenshot ({task.attachments.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {task.attachments.map((url, idx) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => setPreviewImageUrl(url)}
                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 group"
                            >
                              <img
                                src={url}
                                alt={`Bukti ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ALASAN REJECT DARI QC */}
                    {task.status === "qc_rejected" &&
                      task.workspace.qcRejectReason && (
                        <div className="text-xs p-3.5 bg-rose-950/40 border border-rose-800/70 rounded-xl text-rose-200 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-rose-300 mb-0.5">
                              Catatan Revisi dari QC (Reopen #{task.workspace.reopenCount || 1}):
                            </strong>
                            {task.workspace.qcRejectReason}
                          </div>
                        </div>
                      )}

                    {/* RIWAYAT LOG PROGRES SINGKAT */}
                    {task.workspace.progressLogs &&
                      task.workspace.progressLogs.length > 0 && (
                        <div className="text-xs bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-indigo-400 block">
                            Log Progres Terakhir ({task.workspace.progressLogs.length}):
                          </span>
                          {task.workspace.progressLogs
                            .slice(-2)
                            .map((logItem) => (
                              <div
                                key={logItem.id}
                                className="flex items-center justify-between text-slate-300 gap-2"
                              >
                                <span className="truncate">• {logItem.note}</span>
                                {logItem.attachmentUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewImageUrl(
                                        logItem.attachmentUrl || null
                                      )
                                    }
                                    className="text-indigo-400 hover:underline shrink-0 text-[11px]"
                                  >
                                    Lihat Foto
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                  </div>

                  {/* KOLOM AKSI KANAN */}
                  <div className="w-full lg:w-56 flex flex-col gap-2.5 shrink-0 border-t lg:border-t-0 border-slate-700/60 pt-3 lg:pt-0">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 lg:justify-end">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Target:</span>
                      <strong className="text-white">
                        {formatSafeDate(deadlineDate)}
                      </strong>
                    </div>

                    {/* TOMBOL SESUAI STATUS TIKET */}
                    {(task.status === "submitted" ||
                      task.status === "analyzed") && (
                      <button
                        type="button"
                        onClick={() => openModal(task, "analyze")}
                        className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                      >
                        <FileText className="w-4 h-4" />
                        {task.status === "submitted"
                          ? "Analisis & Estimasi"
                          : "Update Estimasi"}
                      </button>
                    )}

                    {task.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickStatusChange(task, "in_progress")
                        }
                        disabled={isSaving}
                        className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                      >
                        <PlayCircle className="w-4 h-4" /> Mulai Kerjakan
                      </button>
                    )}

                    {(task.status === "in_progress" ||
                      task.status === "qc_rejected") && (
                      <>
                        <button
                          type="button"
                          onClick={() => openModal(task, "finish")}
                          className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Selesai & Kirim QC
                        </button>
                        <button
                          type="button"
                          onClick={() => openModal(task, "progress")}
                          className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Catat Log Progres
                        </button>
                      </>
                    )}

                    {task.status === "ready_to_release" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickStatusChange(task, "releasing")
                          }
                          disabled={isSaving}
                          className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                          <Rocket className="w-4 h-4" /> Mulai Deploy
                        </button>
                        <button
                          type="button"
                          onClick={() => openModal(task, "release")}
                          className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Tandai Rilis Selesai
                        </button>
                      </>
                    )}

                    {task.status === "releasing" && (
                      <button
                        type="button"
                        onClick={() => openModal(task, "release")}
                        className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                      >
                        <Rocket className="w-4 h-4" /> Konfirmasi Sudah Rilis
                      </button>
                    )}

                    {task.workspace.finalDeliverable?.link && (
                      <a
                        href={task.workspace.finalDeliverable.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-400 hover:underline flex items-center justify-end gap-1 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Link Hasil Rilis
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL LIGHTBOX GAMBAR */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
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
              alt="Preview Bukti Laporan"
              className="max-w-full max-h-[85vh] object-contain rounded-xl border border-slate-700"
            />
          </div>
        </div>
      )}

      {/* MODAL 1: ANALISIS & ESTIMASI AWAL */}
      {selectedReport && modalMode === "analyze" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Analisis & Estimasi Teknis
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Tiket:{" "}
              <strong className="text-indigo-400">
                #{selectedReport.ticketNumber}
              </strong>{" "}
              — {selectedReport.title}
            </p>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Analisis Penyebab / Kebutuhan Teknis *
                </label>
                <textarea
                  rows={3}
                  value={estimatedCause}
                  onChange={(e) => setEstimatedCause(e.target.value)}
                  placeholder="Cth: Validasi token kadaluarsa saat request API..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">
                    Estimasi Pengerjaan (Hari) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={targetDays}
                    onChange={(e) => setTargetDays(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">
                    Prioritas Teknis
                  </label>
                  <select
                    value={devPriority}
                    onChange={(e) =>
                      setDevPriority(e.target.value as DevPriority)
                    }
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="blocker">Blocker (Darurat)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => handleSaveAnalysis(false)}
                disabled={!estimatedCause.trim() || isSaving}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Simpan Estimasi (Ke QC)"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveAnalysis(true)}
                disabled={!estimatedCause.trim() || isSaving}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                Langsung Kerjakan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CATAT LOG PROGRES */}
      {selectedReport && modalMode === "progress" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Catat Progres Pengerjaan
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Update Progres (Dikirim juga ke Pelapor) *
                </label>
                <textarea
                  rows={3}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Cth: Perbaikan fungsi cetak struk sudah selesai, sedang uji coba koneksi database..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Lampiran Foto Progres (Opsional)
                </label>
                <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-slate-600 rounded-xl bg-slate-900/50 hover:bg-slate-900 cursor-pointer text-xs text-slate-300">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>
                    {progressFile
                      ? progressFile.name
                      : "Pilih gambar screenshot progres"}
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
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddProgressLog}
                disabled={!progressNote.trim() || isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Simpan Log Progres"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PENYERAHAN KE QC */}
      {selectedReport && modalMode === "finish" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Serahkan ke QC</h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Tiket:{" "}
              <strong className="text-indigo-400">
                #{selectedReport.ticketNumber}
              </strong>
            </p>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Instruksi Testing untuk QC *
                </label>
                <textarea
                  rows={3}
                  value={qcInstructionNote}
                  onChange={(e) => setQcInstructionNote(e.target.value)}
                  placeholder="Cth: Tolong tes login pakai akun kasir di staging dan cek cetak struk..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Catatan Teknis Internal (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={internalDevNote}
                  onChange={(e) => setInternalDevNote(e.target.value)}
                  placeholder="Cth: Fix query transaksi di file Auth.ts"
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Pesan Progres untuk Pelapor (Email)
                </label>
                <input
                  type="text"
                  value={publicProgressNote}
                  onChange={(e) => setPublicProgressNote(e.target.value)}
                  placeholder="Cth: Perbaikan selesai, sedang diuji oleh tim QC."
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinishCoding}
                disabled={!qcInstructionNote.trim() || isSaving}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Kirim ke QC"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KONFIRMASI RILIS PRODUKSI */}
      {selectedReport && modalMode === "release" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Konfirmasi Rilis ke Produksi
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Versi Rilis (Release Version) *
                </label>
                <input
                  type="text"
                  value={releaseVersion}
                  onChange={(e) => setReleaseVersion(e.target.value)}
                  placeholder="Cth: v1.4.2"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Link Hasil / Aplikasi (Opsional)
                </label>
                <input
                  type="url"
                  value={deliverableLink}
                  onChange={(e) => setDeliverableLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Catatan Rilis untuk Pelapor
                </label>
                <textarea
                  rows={2}
                  value={publicProgressNote}
                  onChange={(e) => setPublicProgressNote(e.target.value)}
                  placeholder="Cth: Perbaikan sudah tayang di server utama. Silakan refresh browser Anda."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCompleteRelease}
                disabled={!releaseVersion.trim() || isSaving}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                {isSaving ? "Merilis..." : "Rilis & Beritahu Pelapor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}