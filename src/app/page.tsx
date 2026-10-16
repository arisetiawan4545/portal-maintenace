"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bug,
  Sparkles,
  Upload,
  X,
  CheckCircle2,
  Search,
  Smartphone,
  AlertTriangle,
  Copy,
  Check,
  Clock,
  Wrench,
  ShieldCheck,
  Rocket,
  Send,
  Layers,
  RotateCcw,
  Calendar,
  Mail,
  PenTool,
  Save,
} from "lucide-react";
import { ReportType, UrgencyLevel, MaintenanceReport } from "@/types/report";
import {
  createMaintenanceReport,
  getReportByTicketNumber,
} from "@/services/reportService";
import { getMasterData } from "@/services/settingsService";

interface AnnotationItem {
  x: number;
  y: number;
  text: string;
}

interface AttachmentItem {
  file: File;
  preview: string;
}

const REPORTER_STORAGE_KEY = "portal_reporter_profile_v1";

export default function ReporterPortal() {
  const [activeTab, setActiveTab] = useState<"create" | "track">("create");

  // DYNAMIC APP & BRANCH LIST
  const [availableApps, setAvailableApps] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState<boolean>(true);

  // Form States
  const [reportType, setReportType] = useState<ReportType>("bug");
  const [reporterName, setReporterName] = useState("");
  const [reporterDivision, setReporterDivision] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [appName, setAppName] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [title, setTitle] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("medium");
  const [chronology, setChronology] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [featureGoal, setFeatureGoal] = useState("");
  const [featureWorkflow, setFeatureWorkflow] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [deviceMeta, setDeviceMeta] = useState({
    os: "Mendeteksi...",
    browser: "Mendeteksi...",
    screen: "-",
  });

  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(
    null
  );
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [annotationInput, setAnnotationInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchTicketId, setSearchTicketId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [trackedResult, setTrackedResult] = useState<MaintenanceReport | null>(
    null
  );
  const [trackNotFound, setTrackNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchMaster = async () => {
      try {
        setIsLoadingMaster(true);
        const data = await getMasterData();
        if (!isMounted) return;

        const sortedApps = [...(data.apps || [])].sort((a, b) =>
          a.localeCompare(b)
        );
        const sortedBranches = [...(data.branches || [])].sort((a, b) =>
          a.localeCompare(b)
        );

        setAvailableApps(sortedApps);
        setAvailableBranches(sortedBranches);
      } catch {
       
      } finally {
        if (isMounted) setIsLoadingMaster(false);
      }
    };

    fetchMaster();

    // Load cached reporter identity from localStorage
    try {
      const savedProfile = localStorage.getItem(REPORTER_STORAGE_KEY);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile) as {
          name?: string;
          division?: string;
          contact?: string;
          email?: string;
        };
        if (parsed.name) setReporterName(parsed.name);
        if (parsed.division) setReporterDivision(parsed.division);
        if (parsed.contact) setReporterContact(parsed.contact);
        if (parsed.email) setReporterEmail(parsed.email);
      }
    } catch {
      // Abaikan jika storage tidak tersedia
    }

    // Detect Device Metadata
    const ua = navigator.userAgent;
    let os = "Unknown OS";
    if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac/i.test(ua)) os = "MacOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    let browser = "Browser";
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
    else if (/Firefox/i.test(ua)) browser = "Firefox";
    else if (/Edg/i.test(ua)) browser = "Edge";

    setDeviceMeta({
      os,
      browser,
      screen: `${window.innerWidth} x ${window.innerHeight} px`,
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const validImages = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );
    if (validImages.length === 0) return;

    setAttachments((prev) => {
      const remainingSlots = 10 - prev.length;
      if (remainingSlots <= 0) return prev;
      const sliced = validImages.slice(0, remainingSlots);
      const mapped = sliced.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      return [...prev, ...mapped];
    });
  }, []);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (activeTab !== "create" || editingImageIndex !== null) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        addFiles(pastedFiles);
      }
    },
    [activeTab, editingImageIndex, addFiles]
  );

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const openImageEditor = (index: number) => {
    imageRef.current = null;
    setEditingImageIndex(index);
    setAnnotations([]);
    setPendingAnnotation(null);
    setAnnotationInput("");
  };

  const closeImageEditor = () => {
    imageRef.current = null;
    setEditingImageIndex(null);
    setAnnotations([]);
    setPendingAnnotation(null);
    setAnnotationInput("");
  };

  const drawCanvas = useCallback(() => {
    if (editingImageIndex === null || !canvasRef.current) return;
    const currentAttachment = attachments[editingImageIndex];
    if (!currentAttachment) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderAnnotations = (
      context: CanvasRenderingContext2D,
      img: HTMLImageElement
    ) => {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      context.drawImage(img, 0, 0);

      annotations.forEach((ann, idx) => {
        // Titik penanda
        context.beginPath();
        context.arc(ann.x, ann.y, 10, 0, 2 * Math.PI);
        context.fillStyle = "#e11d48";
        context.fill();
        context.lineWidth = 3;
        context.strokeStyle = "#ffffff";
        context.stroke();

        // Garis penunjuk
        const offsetX = ann.x + 180 > context.canvas.width ? -30 : 30;
        const offsetY = ann.y - 60 < 0 ? 35 : -30;
        context.beginPath();
        context.moveTo(ann.x, ann.y);
        context.lineTo(ann.x + offsetX, ann.y + offsetY);
        context.strokeStyle = "#e11d48";
        context.lineWidth = 3;
        context.stroke();

        // Kotak label teks
        const labelText = `${idx + 1}. ${ann.text}`;
        context.font = "bold 16px sans-serif";
        const textWidth = context.measureText(labelText).width;
        const boxWidth = textWidth + 24;
        const boxHeight = 34;

        let boxX = offsetX > 0 ? ann.x + offsetX : ann.x + offsetX - boxWidth;
        boxX = Math.max(
          8,
          Math.min(boxX, context.canvas.width - boxWidth - 8)
        );
        const boxY = Math.max(
          8,
          Math.min(
            ann.y + offsetY - 22,
            context.canvas.height - boxHeight - 8
          )
        );

        context.fillStyle = "rgba(225, 29, 72, 0.95)";
        context.beginPath();
        if (typeof context.roundRect === "function") {
          context.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
        } else {
          context.rect(boxX, boxY, boxWidth, boxHeight);
        }
        context.fill();

        context.fillStyle = "#ffffff";
        context.fillText(labelText, boxX + 12, boxY + 22);
      });

      // Preview titik yang sedang dipilih sebelum disimpan
      if (pendingAnnotation) {
        context.beginPath();
        context.arc(pendingAnnotation.x, pendingAnnotation.y, 10, 0, 2 * Math.PI);
        context.fillStyle = "#4f46e5";
        context.fill();
        context.lineWidth = 3;
        context.strokeStyle = "#ffffff";
        context.stroke();
      }
    };

    if (!imageRef.current) {
      const img = new Image();
      img.src = currentAttachment.preview;
      img.onload = () => {
        imageRef.current = img;
        canvas.width = img.width;
        canvas.height = img.height;
        renderAnnotations(ctx, img);
      };
    } else {
      renderAnnotations(ctx, imageRef.current);
    }
  }, [editingImageIndex, attachments, annotations, pendingAnnotation]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    setPendingAnnotation({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
    setAnnotationInput("");
  };

  const handleAddAnnotation = () => {
    if (pendingAnnotation && annotationInput.trim()) {
      setAnnotations((prev) => [
        ...prev,
        {
          x: pendingAnnotation.x,
          y: pendingAnnotation.y,
          text: annotationInput.trim(),
        },
      ]);
    }
    setPendingAnnotation(null);
    setAnnotationInput("");
  };

  const handleUndoAnnotation = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const saveEditedImage = () => {
    if (editingImageIndex === null || !canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const editedFile = new File(
          [blob],
          `annotated_evidence_${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );
        const editedPreview = URL.createObjectURL(editedFile);
        setAttachments((prev) => {
          const newAtt = [...prev];
          if (newAtt[editingImageIndex]) {
            URL.revokeObjectURL(newAtt[editingImageIndex].preview);
          }
          newAtt[editingImageIndex] = {
            file: editedFile,
            preview: editedPreview,
          };
          return newAtt;
        });
        closeImageEditor();
      },
      "image/jpeg",
      0.92
    );
  };

  const copyTicketToClipboard = async (ticket: string) => {
    try {
      await navigator.clipboard.writeText(ticket);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback jika clipboard API diblokir
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Simpan profil pelapor ke localStorage untuk kemudahan laporan berikutnya
      try {
        localStorage.setItem(
          REPORTER_STORAGE_KEY,
          JSON.stringify({
            name: reporterName.trim(),
            division: reporterDivision.trim(),
            contact: reporterContact.trim(),
            email: reporterEmail.trim(),
          })
        );
      } catch {
        // Abaikan jika gagal menyimpan ke localStorage
      }

      const rawFiles = attachments.map((a) => a.file);
      const ticketCode = await createMaintenanceReport(
        {
          type: reportType,
          reporter: {
            name: reporterName.trim(),
            division: reporterDivision.trim(),
            contact: reporterContact.trim(),
            email: reporterEmail.trim(),
          },
          appName,
          moduleName: moduleName.trim(),
          title: title.trim(),
          chronology: reportType === "bug" ? chronology.trim() : "",
          expectedResult: reportType === "bug" ? expectedResult.trim() : "",
          featureGoal: reportType === "feature" ? featureGoal.trim() : "",
          featureWorkflow:
            reportType === "feature" ? featureWorkflow.trim() : "",
          deviceMeta,
          userUrgency: urgency,
        },
        rawFiles
      );

      setSubmittedTicket(ticketCode);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      const detail =
        err instanceof Error && err.message
          ? ` (${err.message})`
          : "";
      setErrorMessage(
        `Gagal mengirim laporan. Periksa koneksi internet atau konfigurasi sistem${detail}.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    attachments.forEach((att) => URL.revokeObjectURL(att.preview));
    setTitle("");
    setChronology("");
    setExpectedResult("");
    setFeatureGoal("");
    setFeatureWorkflow("");
    setAttachments([]);
    setSubmittedTicket(null);
    setErrorMessage(null);
    setAppName("");
    setModuleName("");
    setUrgency("medium");
  };

  const handleTrackTicket = async (
    e?: React.FormEvent,
    customTicket?: string
  ) => {
    if (e) e.preventDefault();
    const targetTicket = (customTicket ?? searchTicketId)
      .replace("#", "")
      .trim()
      .toUpperCase();
    if (!targetTicket) return;

    setIsSearching(true);
    setTrackNotFound(false);
    setTrackedResult(null);

    try {
      const result = await getReportByTicketNumber(targetTicket);
      if (!result) {
        setTrackNotFound(true);
      } else {
        setTrackedResult(result);
      }
    } catch {
      setTrackNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Helper penentuan tahapan status tiket sesuai ReportStatus di report.ts
  const getStatusStage = (status: MaintenanceReport["status"]) => {
    switch (status) {
      case "submitted":
      case "analyzed":
      case "scheduled":
        return 1; 
      case "in_progress":
      case "qc_rejected":
        return 2; 
      case "waiting_qc":
      case "ready_to_release":
      case "releasing":
        return 3; 
      case "released":
        return 4; 
      default:
        return 1;
    }
  };

  // Membaca waktu laporan dari properti report.dates.createdAt
  const formatReportDate = (report: MaintenanceReport): string => {
    const rawDate = report.dates?.createdAt;
    if (!rawDate) return "Baru saja";
    const dateObj = new Date(rawDate);
    if (isNaN(dateObj.getTime())) return rawDate;
    return dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20 relative">
      <div className="max-w-lg mx-auto bg-white min-h-screen shadow-sm border-x border-slate-200 flex flex-col relative">
        {/* MODAL EDITOR ANOTASI GAMBAR */}
        {editingImageIndex !== null && (
          <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col max-w-lg mx-auto">
            <div className="p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 text-white">
              <div>
                <p className="font-bold text-sm">Editor Bukti Laporan</p>
                <p className="text-[11px] text-slate-400">
                  Ketuk area gambar untuk menandai letak kendala ({annotations.length} catatan)
                </p>
              </div>
              <div className="flex items-center gap-2">
                {annotations.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoAnnotation}
                    title="Batalkan catatan terakhir"
                    className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeImageEditor}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={saveEditedImage}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-4 h-4" />
                  Simpan
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center p-2 cursor-crosshair">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full max-h-full object-contain touch-none rounded-lg"
                style={{ width: "100%", height: "100%" }}
              />

              {pendingAnnotation && (
                <div className="absolute bottom-6 left-4 right-4 bg-white p-4 rounded-2xl shadow-2xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-rose-600" />
                    Tambahkan Keterangan di Titik Ini
                  </p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Cth: Tombol simpan tidak merespon"
                      value={annotationInput}
                      onChange={(e) => setAnnotationInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddAnnotation()
                      }
                      className="flex-1 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddAnnotation}
                      className="px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold active:scale-95"
                    >
                      Tandai
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAnnotation(null)}
                    className="w-full mt-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HEADER UTAMA */}
        <header className="bg-slate-900 text-white px-5 pt-6 pb-5 sticky top-0 z-20 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Helpdesk & Maintenance
              </span>
              <h1 className="text-xl font-bold mt-1.5 tracking-tight">
                Portal Laporan Sistem
              </h1>
            </div>
            <div className="h-11 w-11 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center p-1.5 overflow-hidden shadow-inner">
              <img
                src="/logo.png"
                alt="Logo Sistem"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 bg-slate-800 p-1 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "create"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Send className="w-3.5 h-3.5" /> Buat Laporan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("track")}
              className={`py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "track"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" /> Lacak Tiket
            </button>
          </div>
        </header>

        {/* KONTEN UTAMA */}
        <main className="flex-1 p-5">
          {activeTab === "create" ? (
            submittedTicket ? (
              <div className="py-8 text-center space-y-5">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Laporan Berhasil Masuk!
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 px-4">
                    Notifikasi tiket telah dikirim ke email{" "}
                    <strong className="text-slate-700">{reporterEmail}</strong>.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mx-2">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                    Nomor Tiket Laporan Anda
                  </p>
                  <div className="flex items-center justify-center gap-2.5 mt-2">
                    <span className="text-2xl font-mono font-bold text-indigo-600">
                      #{submittedTicket}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyTicketToClipboard(submittedTicket)}
                      className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 active:scale-95 transition"
                      title="Salin Nomor Tiket"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {copied && (
                    <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                      Nomor tiket berhasil disalin!
                    </p>
                  )}
                </div>

                <div className="pt-4 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTicketId(submittedTicket);
                      setActiveTab("track");
                      handleTrackTicket(undefined, submittedTicket);
                    }}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm active:scale-[0.99] transition"
                  >
                    Lacak Status Tiket Ini Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-4 h-4" /> Buat Laporan Lainnya
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* 1. JENIS LAPORAN */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                    1. Pilih Jenis Laporan
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReportType("bug")}
                      className={`p-3.5 rounded-2xl border-2 text-left flex flex-col gap-1 transition-all ${
                        reportType === "bug"
                          ? "border-rose-500 bg-rose-50/70 text-rose-950 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <Bug
                        className={`w-5 h-5 ${
                          reportType === "bug"
                            ? "text-rose-600"
                            : "text-slate-400"
                        }`}
                      />
                      <p className="font-bold text-sm mt-1">Lapor Kendala</p>
                      <p className="text-[11px] text-slate-500">
                        Error sistem, bug tampilan, atau gagal proses
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportType("feature")}
                      className={`p-3.5 rounded-2xl border-2 text-left flex flex-col gap-1 transition-all ${
                        reportType === "feature"
                          ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <Sparkles
                        className={`w-5 h-5 ${
                          reportType === "feature"
                            ? "text-indigo-600"
                            : "text-slate-400"
                        }`}
                      />
                      <p className="font-bold text-sm mt-1">Request Fitur</p>
                      <p className="text-[11px] text-slate-500">
                        Usulan menu baru atau peningkatan alur kerja
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. IDENTITAS PELAPOR */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Identitas & Kontak Notifikasi
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        required
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        placeholder="Cth: Andi Mulyana"
                        className="mt-1 w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Divisi / Cabang *
                      </label>
                      <select
                        required
                        value={reporterDivision}
                        onChange={(e) => setReporterDivision(e.target.value)}
                        disabled={isLoadingMaster}
                        className="mt-1 w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">
                          {isLoadingMaster
                            ? "Memuat cabang..."
                            : "-- Pilih Cabang --"}
                        </option>
                        {availableBranches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                      Email Aktif *
                    </label>
                    <input
                      type="email"
                      required
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                      placeholder="Cth: andi@mysehati.com"
                      className="mt-1 w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      No. WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={reporterContact}
                      onChange={(e) => setReporterContact(e.target.value)}
                      placeholder="Cth: 081234567890"
                      className="mt-1 w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 3. DETAIL LAPORAN */}
                <div className="space-y-3.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Detail Laporan
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Nama Aplikasi / Web *
                      </label>
                      <select
                        required
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        disabled={isLoadingMaster}
                        className="mt-1 w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">
                          {isLoadingMaster
                            ? "Memuat sistem..."
                            : "-- Pilih Sistem --"}
                        </option>
                        {availableApps.map((app) => (
                          <option key={app} value={app}>
                            {app}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Bagian / Halaman *
                      </label>
                      <input
                        type="text"
                        required
                        value={moduleName}
                        onChange={(e) => setModuleName(e.target.value)}
                        placeholder="Cth: Halaman Kasir Registrasi"
                        className="mt-1 w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Judul Singkat *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        reportType === "bug"
                          ? "Cth: Gagal simpan data transaksi"
                          : "Cth: Tambah opsi filter tanggal"
                      }
                      className="mt-1 w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {reportType === "bug" ? (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-700">
                          Kronologi Error *
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={chronology}
                          onChange={(e) => setChronology(e.target.value)}
                          placeholder="Cth: Saya membuka menu transaksi, memilih barang, tapi saat diklik tombol bayar muncul popup putih blank."
                          className="mt-1 w-full p-3.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">
                          Hasil yang Seharusnya
                        </label>
                        <input
                          type="text"
                          value={expectedResult}
                          onChange={(e) => setExpectedResult(e.target.value)}
                          placeholder="Cth: Muncul struk sukses dan saldo terpotong."
                          className="mt-1 w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-700">
                          Tujuan Fitur *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={featureGoal}
                          onChange={(e) => setFeatureGoal(e.target.value)}
                          placeholder="Cth: Supaya admin tidak perlu rekap manual pakai Excel setiap akhir bulan."
                          className="mt-1 w-full p-3.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">
                          Alur yang Diinginkan *
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={featureWorkflow}
                          onChange={(e) => setFeatureWorkflow(e.target.value)}
                          placeholder="Cth: Tambahkan tombol download CSV di atas tabel transaksi."
                          className="mt-1 w-full p-3.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* 4. TINGKAT URGENSI */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    4. Tingkat Urgensi
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        id: "low",
                        label: "Rendah",
                        color: "border-slate-400 bg-slate-100 text-slate-800",
                      },
                      {
                        id: "medium",
                        label: "Normal",
                        color: "border-blue-500 bg-blue-50 text-blue-700",
                      },
                      {
                        id: "high",
                        label: "Tinggi",
                        color: "border-amber-500 bg-amber-50 text-amber-800",
                      },
                      {
                        id: "critical",
                        label: "Darurat",
                        color: "border-rose-600 bg-rose-50 text-rose-700",
                      },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setUrgency(item.id as UrgencyLevel)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border-2 transition-all ${
                          urgency === item.id
                            ? item.color
                            : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. LAMPIRAN BUKTI FOTO / SCREENSHOT */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      5. Bukti Foto / Screenshot ({attachments.length}/10)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Bisa Ctrl+V (Paste)
                    </span>
                  </div>

                  {attachments.length < 10 && (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50/70 hover:bg-slate-100/80 cursor-pointer transition">
                      <Upload className="w-6 h-6 text-indigo-600 mb-1.5" />
                      <span className="text-xs font-semibold text-slate-700">
                        Ketuk untuk pilih foto atau tangkapan layar
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        Ketuk gambar setelah diunggah untuk memberi tanda panah
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) addFiles(e.target.files);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                  )}

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                      {attachments.map((att, index) => (
                        <div
                          key={att.preview}
                          className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-slate-100"
                        >
                          <img
                            src={att.preview}
                            alt={`Lampiran ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/80 via-slate-900/40 to-transparent p-2 flex items-end justify-center">
                            <button
                              type="button"
                              onClick={() => openImageEditor(index)}
                              className="w-full py-1.5 bg-indigo-600/95 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shadow"
                            >
                              <PenTool className="w-3 h-3" /> Beri Catatan
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-rose-600 text-white p-1 rounded-full transition"
                            title="Hapus foto"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* INFO PERANGKAT OTOMATIS */}
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    Perangkat Terdeteksi:
                  </span>
                  <span className="font-mono text-slate-600">
                    {deviceMeta.os} • {deviceMeta.browser} ({deviceMeta.screen})
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition"
                >
                  {isSubmitting ? (
                    "Mengirim Laporan..."
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Kirim Laporan Sekarang
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            /* TAB LACAK TIKET */
            <div className="space-y-5">
              <form
                onSubmit={(e) => handleTrackTicket(e)}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Cth: BUG-2026-4821"
                  value={searchTicketId}
                  onChange={(e) => setSearchTicketId(e.target.value)}
                  className="flex-1 px-4 py-3 text-sm font-mono uppercase bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isSearching ? "Mencari..." : "Cari"}
                </button>
              </form>

              {trackNotFound && (
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
                  <AlertTriangle className="w-7 h-7 text-rose-600 mx-auto" />
                  <p className="text-sm font-bold text-rose-900">
                    Tiket Tidak Ditemukan
                  </p>
                  <p className="text-xs text-rose-700">
                    Pastikan kode tiket yang Anda masukkan sudah benar (contoh:{" "}
                    <span className="font-mono font-bold">BUG-2026-XXXX</span>).
                  </p>
                </div>
              )}

              {trackedResult && (
                <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-5">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          #{trackedResult.ticketNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyTicketToClipboard(trackedResult.ticketNumber)
                          }
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg border border-slate-200"
                          title="Salin Nomor Tiket"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 mt-2">
                        {trackedResult.title}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase shrink-0 ${
                        trackedResult.type === "bug"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      }`}
                    >
                      {trackedResult.type === "bug" ? (
                        <Bug className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {trackedResult.type === "bug" ? "Kendala" : "Fitur"}
                    </span>
                  </div>

                  {/* TAHAPAN PROGRES TIKET */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Status Penanganan Saat Ini:{" "}
                      <span className="text-indigo-600">
                        {trackedResult.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { step: 1, label: "Antrean", icon: Clock },
                        { step: 2, label: "Tim Dev", icon: Wrench },
                        { step: 3, label: "Uji QC", icon: ShieldCheck },
                        { step: 4, label: "Selesai", icon: Rocket },
                      ].map((item) => {
                        const currentStage = getStatusStage(
                          trackedResult.status
                        );
                        const isPassed = currentStage >= item.step;
                        const IconComponent = item.icon;
                        return (
                          <div
                            key={item.step}
                            className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 ${
                              isPassed
                                ? "border-indigo-600 bg-indigo-50/80 text-indigo-900"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                          >
                            <IconComponent
                              className={`w-4 h-4 ${
                                isPassed ? "text-indigo-600" : "text-slate-400"
                              }`}
                            />
                            <span className="text-[11px] font-bold">
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* METADATA LAPORAN */}
                  <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        Sistem & Modul:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {trackedResult.appName} — {trackedResult.moduleName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Waktu Lapor:
                      </span>
                      <span className="font-medium text-slate-700">
                        {formatReportDate(trackedResult)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}