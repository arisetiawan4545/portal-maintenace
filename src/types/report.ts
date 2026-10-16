export type ReportType = "bug" | "feature";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type DevPriority = "unset" | "low" | "medium" | "high" | "blocker";

export type ReportStatus =
  | "submitted"        // 1. Baru Masuk
  | "analyzed"         // 2. Diestimasi Dev (Tunggu Jadwal QC)
  | "scheduled"        // 3. Dijadwalkan QC (Siap Dikerjakan)
  | "in_progress"      // 4. Sedang Dikerjakan Dev
  | "waiting_qc"       // 5. Menunggu Cek QC
  | "qc_rejected"      // X. Revisi QC
  | "ready_to_release" // 6. Lolos QC (Siap Rilis)
  | "releasing"        // 7. Sedang Proses Deploy/Rilis (Oleh Dev)
  | "released";        // 8. Sudah Rilis

export interface ProgressLog {
  id: string;
  timestamp: string;
  note: string;
  attachmentUrl?: string | null;
}

export interface FinalDeliverable {
  link?: string;
  attachmentUrl?: string | null;
}

export interface ReporterInfo {
  name: string;
  division: string;
  contact: string;
  email: string;
}

export interface DeviceMeta {
  os: string;
  browser: string;
  screen: string;
}

export interface ReportWorkspace {
  assignedDev: string;
  qcTester: string;

  estimatedCause?: string;
  targetDays?: number;
  scheduledStartDate?: string;   
  scheduledDeadline?: string;    
  timerStartedAt?: string | null;

  progressLogs: ProgressLog[];
  finalDeliverable?: FinalDeliverable;

  estimatedFinishDate: string;
  releaseVersion: string;
  publicProgressNote: string;
  internalDevNote: string;
  qcInstructionNote: string;
  qcRejectReason: string;
  reopenCount: number;
}

export interface ReportDates {
  createdAt: string;
  analyzedAt: string | null;
  scheduledAt: string | null;
  devStartedAt: string | null;
  waitingQcAt: string | null;
  qcVerifiedAt: string | null;
  releasingAt: string | null;
  releasedAt: string | null;
  updatedAt: string;
}

export interface MaintenanceReport {
  id?: string;
  ticketNumber: string;
  type: ReportType;
  reporter: ReporterInfo;
  appName: string;
  moduleName: string;
  title: string;
  chronology?: string;
  expectedResult?: string;
  featureGoal?: string;
  featureWorkflow?: string;
  attachments: string[];
  deviceMeta: DeviceMeta;
  userUrgency: UrgencyLevel;
  devPriority: DevPriority;
  status: ReportStatus;
  workspace: ReportWorkspace;
  dates: ReportDates;
}

export interface CreateReportPayload {
  type: ReportType;
  reporter: ReporterInfo;
  appName: string;
  moduleName: string;
  title: string;
  chronology?: string;
  expectedResult?: string;
  featureGoal?: string;
  featureWorkflow?: string;
  deviceMeta: DeviceMeta;
  userUrgency: UrgencyLevel;
}