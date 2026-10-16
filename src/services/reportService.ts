import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  MaintenanceReport,
  ReportStatus,
  CreateReportPayload,
} from "@/types/report";

const COLLECTION_NAME = "maintenance_reports";

export interface EmailNotificationPayload {
  to: string;
  ticketNumber: string;
  title: string;
  status: ReportStatus;
  reporterName?: string;
  appName?: string;
  moduleName?: string;
  publicNote?: string;
  assignedDev?: string;
  qcTester?: string;
  rejectReason?: string;
  releaseVersion?: string;
  deliverableLink?: string;
  eventType?: "created" | "status_updated";
}

export async function triggerEmailNotification(
  payload: EmailNotificationPayload
): Promise<void> {
  if (!payload.to || !payload.to.trim()) return;
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    console.warn("[Email Notification] Gagal mengirim notifikasi email:", err);
  }
}

function getSafeFileExtension(file: File): string {
  const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
  const cleanExt = rawExt.replace(/[^a-z0-9]/g, "");
  return cleanExt || "jpg";
}

export async function uploadReportAttachments(
  ticketNumber: string,
  files: File[]
): Promise<string[]> {
  if (!files || files.length === 0) return [];

  const uploadPromises = files.map(async (file, index) => {
    const ext = getSafeFileExtension(file);
    const storageRef = ref(
      storage,
      `reports/${ticketNumber}/attachment_${index + 1}_${Date.now()}.${ext}`
    );
    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg",
    });
    return await getDownloadURL(storageRef);
  });

  return Promise.all(uploadPromises);
}

export async function uploadProgressAttachment(
  ticketNumber: string,
  file: File
): Promise<string> {
  const ext = getSafeFileExtension(file);
  const storageRef = ref(
    storage,
    `reports/${ticketNumber}/progress_${Date.now()}.${ext}`
  );
  await uploadBytes(storageRef, file, {
    contentType: file.type || "image/jpeg",
  });
  return await getDownloadURL(storageRef);
}

async function generateUniqueTicketNumber(
  type: MaintenanceReport["type"]
): Promise<string> {
  const prefix = type === "bug" ? "BUG" : "REQ";
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}-${year}-${randomNum}`;
    const existing = await getReportByTicketNumber(candidate);
    if (!existing) return candidate;
  }

  const fallbackNum = String(Date.now()).slice(-4);
  return `${prefix}-${year}-${fallbackNum}`;
}

export async function createMaintenanceReport(
  data: CreateReportPayload,
  files: File[]
): Promise<string> {
  const ticketNumber = await generateUniqueTicketNumber(data.type);
  const now = new Date().toISOString();
  const attachmentUrls = await uploadReportAttachments(ticketNumber, files);

  const newReport: Omit<MaintenanceReport, "id"> = {
    type: data.type,
    reporter: {
      name: data.reporter.name.trim(),
      division: data.reporter.division.trim(),
      contact: data.reporter.contact.trim(),
      email: data.reporter.email.trim(),
    },
    appName: data.appName,
    moduleName: data.moduleName.trim(),
    title: data.title.trim(),
    chronology: data.chronology ?? "",
    expectedResult: data.expectedResult ?? "",
    featureGoal: data.featureGoal ?? "",
    featureWorkflow: data.featureWorkflow ?? "",
    deviceMeta: data.deviceMeta,
    userUrgency: data.userUrgency,
    ticketNumber,
    attachments: attachmentUrls,
    devPriority: "unset",
    status: "submitted",
    workspace: {
      assignedDev: "",
      qcTester: "",
      estimatedCause: "",
      targetDays: 0,
      scheduledStartDate: "",
      scheduledDeadline: "",
      timerStartedAt: null,
      progressLogs: [],
      finalDeliverable: {
        link: "",
        attachmentUrl: null,
      },
      estimatedFinishDate: "",
      releaseVersion: "",
      publicProgressNote: "Laporan telah diterima dan masuk dalam antrean.",
      internalDevNote: "",
      qcInstructionNote: "",
      qcRejectReason: "",
      reopenCount: 0,
    },
    dates: {
      createdAt: now,
      analyzedAt: null,
      scheduledAt: null,
      devStartedAt: null,
      waitingQcAt: null,
      qcVerifiedAt: null,
      releasingAt: null,
      releasedAt: null,
      updatedAt: now,
    },
  };

  await addDoc(collection(db, COLLECTION_NAME), newReport);
  if (newReport.reporter.email) {
    await triggerEmailNotification({
      to: newReport.reporter.email,
      ticketNumber,
      title: newReport.title,
      status: "submitted",
      reporterName: newReport.reporter.name,
      appName: newReport.appName,
      moduleName: newReport.moduleName,
      publicNote: newReport.workspace.publicProgressNote,
      eventType: "created",
    });
  }

  return ticketNumber;
}

export async function getReportByTicketNumber(
  ticketNumber: string
): Promise<MaintenanceReport | null> {
  const normalizedTicket = ticketNumber.replace("#", "").trim().toUpperCase();
  if (!normalizedTicket) return null;

  const q = query(
    collection(db, COLLECTION_NAME),
    where("ticketNumber", "==", normalizedTicket)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docData = snapshot.docs[0];
  return {
    id: docData.id,
    ...(docData.data() as Omit<MaintenanceReport, "id">),
  };
}

export async function getAllReports(): Promise<MaintenanceReport[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("dates.createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<MaintenanceReport, "id">),
  }));
}

export async function updateReportWorkspace(
  report: MaintenanceReport,
  updates: {
    status: ReportStatus;
    devPriority: MaintenanceReport["devPriority"];
    workspace: MaintenanceReport["workspace"];
  },
  sendEmail: boolean = true
): Promise<void> {
  if (!report.id) {
    throw new Error("ID dokumen laporan tidak ditemukan.");
  }

  const now = new Date().toISOString();
  const updatedDates: MaintenanceReport["dates"] = {
    ...report.dates,
    updatedAt: now,
  };
  let reopenCount = report.workspace.reopenCount || 0;

  if (updates.status === "analyzed" && !updatedDates.analyzedAt) {
    updatedDates.analyzedAt = now;
  }
  if (updates.status === "scheduled" && !updatedDates.scheduledAt) {
    updatedDates.scheduledAt = now;
  }
  if (updates.status === "in_progress" && !updatedDates.devStartedAt) {
    updatedDates.devStartedAt = now;
  }
  if (updates.status === "waiting_qc") {
    updatedDates.waitingQcAt = now;
  }
  if (
    updates.status === "qc_rejected" &&
    report.status !== "qc_rejected"
  ) {
    reopenCount += 1;
  }
  if (updates.status === "ready_to_release") {
    updatedDates.qcVerifiedAt = now;
  }
  if (updates.status === "releasing" && !updatedDates.releasingAt) {
    updatedDates.releasingAt = now;
  }
  if (updates.status === "released") {
    updatedDates.releasedAt = now;
  }

  const mergedWorkspace: MaintenanceReport["workspace"] = {
    ...updates.workspace,
    reopenCount,
  };

  const docRef = doc(db, COLLECTION_NAME, report.id);
  await updateDoc(docRef, {
    status: updates.status,
    devPriority: updates.devPriority,
    workspace: mergedWorkspace,
    dates: updatedDates,
  });

  if (sendEmail && report.reporter?.email) {
    await triggerEmailNotification({
      to: report.reporter.email,
      ticketNumber: report.ticketNumber,
      title: report.title,
      status: updates.status,
      reporterName: report.reporter.name,
      appName: report.appName,
      moduleName: report.moduleName,
      publicNote: mergedWorkspace.publicProgressNote,
      assignedDev: mergedWorkspace.assignedDev,
      qcTester: mergedWorkspace.qcTester,
      rejectReason: mergedWorkspace.qcRejectReason,
      releaseVersion: mergedWorkspace.releaseVersion,
      deliverableLink: mergedWorkspace.finalDeliverable?.link,
      eventType: "status_updated",
    });
  }
}