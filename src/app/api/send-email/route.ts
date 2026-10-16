import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { ReportStatus } from "@/types/report";
import { EmailNotificationPayload } from "@/services/reportService";

interface ExtendedEmailPayload extends Partial<EmailNotificationPayload> {
  notificationType?: "created" | "progress" | "completed";
  statusLabel?: string;
  estimatedFinishDate?: string;
  publicProgressNote?: string;
}

interface StatusPresentation {
  label: string;
  badgeColor: string;
  headerTitle: string;
  subjectPrefix: string;
}

const STATUS_MAP: Record<ReportStatus, StatusPresentation> = {
  submitted: {
    label: "Baru Masuk (Antrean)",
    badgeColor: "#4f46e5", // Indigo
    headerTitle: "Laporan Berhasil Diterima",
    subjectPrefix: "Tiket Baru",
  },
  analyzed: {
    label: "Dianalisis Tim Dev",
    badgeColor: "#4f46e5", // Indigo
    headerTitle: "Laporan Telah Dianalisis Tim Teknis",
    subjectPrefix: "Update Analisis",
  },
  scheduled: {
    label: "Dijadwalkan",
    badgeColor: "#2563eb", // Blue
    headerTitle: "Jadwal Pengerjaan Telah Ditetapkan",
    subjectPrefix: "Jadwal Pengerjaan",
  },
  in_progress: {
    label: "Sedang Dikerjakan Dev",
    badgeColor: "#d97706", // Amber
    headerTitle: "Laporan Sedang Dalam Pengerjaan",
    subjectPrefix: "Update Progres",
  },
  waiting_qc: {
    label: "Menunggu Verifikasi QC",
    badgeColor: "#7c3aed", // Violet
    headerTitle: "Pengerjaan Selesai — Menunggu Uji QC",
    subjectPrefix: "Tahap Uji QC",
  },
  qc_rejected: {
    label: "Revisi QC (Perbaikan Ulang)",
    badgeColor: "#e11d48", // Rose
    headerTitle: "Tiket Dikembalikan untuk Penyempurnaan",
    subjectPrefix: "Revisi Internal QC",
  },
  ready_to_release: {
    label: "Lolos QC (Siap Rilis)",
    badgeColor: "#0d9488", // Teal
    headerTitle: "Lolos Verifikasi QC — Siap Dirilis",
    subjectPrefix: "Siap Rilis",
  },
  releasing: {
    label: "Proses Deploy / Rilis",
    badgeColor: "#0284c7", // Sky
    headerTitle: "Pembaruan Sedang Dipasang ke Server",
    subjectPrefix: "Proses Rilis",
  },
  released: {
    label: "Selesai & Sudah Rilis",
    badgeColor: "#059669", // Emerald
    headerTitle: "Laporan Selesai & Sudah Rilis!",
    subjectPrefix: "SELESAI",
  },
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtendedEmailPayload;

    const to = body.to?.trim() || "";
    if (!to) {
      return NextResponse.json(
        { success: false, message: "Alamat email tujuan kosong." },
        { status: 400 }
      );
    }

    const smtpEmail = process.env.SMTP_EMAIL;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpEmail || !smtpPassword) {
      console.warn(
        "[Email API] SMTP_EMAIL atau SMTP_PASSWORD belum diatur di Environment Variables."
      );
      return NextResponse.json({
        success: false,
        message: "Konfigurasi SMTP belum diatur di server.",
      });
    }

    const rawTicketNumber = body.ticketNumber?.trim() || "-";
    const rawTitle = body.title?.trim() || "Tanpa Judul";
    const rawReporterName = body.reporterName?.trim() || "Pelapor";
    const rawAppName = body.appName?.trim() || "Sistem";
    const rawModuleName = body.moduleName?.trim() || "-";
    const ticketNumber = escapeHtml(rawTicketNumber);
    const title = escapeHtml(rawTitle);
    const reporterName = escapeHtml(rawReporterName);
    const appName = escapeHtml(rawAppName);
    const moduleName = escapeHtml(rawModuleName);

    const assignedDev = body.assignedDev
      ? escapeHtml(body.assignedDev.trim())
      : "";
    const qcTester = body.qcTester ? escapeHtml(body.qcTester.trim()) : "";
    const estimatedFinishDate = body.estimatedFinishDate
      ? escapeHtml(body.estimatedFinishDate.trim())
      : "";
    const releaseVersion = body.releaseVersion
      ? escapeHtml(body.releaseVersion.trim())
      : "";
    const noteText = (body.publicNote ?? body.publicProgressNote ?? "").trim();
    const publicNote = noteText ? escapeHtml(noteText) : "";
    const rejectReason = body.rejectReason
      ? escapeHtml(body.rejectReason.trim())
      : "";
    const deliverableLink = body.deliverableLink?.trim() || "";

    const rawStatus: ReportStatus = body.status || "submitted";
    const statusMeta = STATUS_MAP[rawStatus] || STATUS_MAP.submitted;

    const isCreated =
      body.eventType === "created" ||
      body.notificationType === "created" ||
      rawStatus === "submitted";
    const isCompleted =
      rawStatus === "released" || body.notificationType === "completed";

    const rawStatusLabel = body.statusLabel
      ? body.statusLabel.trim()
      : statusMeta.label;
    const finalStatusLabel = escapeHtml(rawStatusLabel);

    const badgeColor = isCompleted
      ? "#059669"
      : isCreated
      ? "#4f46e5"
      : statusMeta.badgeColor;

    const headerTitle = isCompleted
      ? STATUS_MAP.released.headerTitle
      : isCreated
      ? STATUS_MAP.submitted.headerTitle
      : statusMeta.headerTitle;

    const subject = isCreated
      ? `[Tiket #${rawTicketNumber}] Laporan Anda Telah Kami Terima -${rawAppName}`
      : isCompleted
      ? `[SELESAI #${rawTicketNumber}] Laporan Anda Telah Selesai & Rilis -${rawAppName}`
      : `[${statusMeta.subjectPrefix} #${rawTicketNumber}] Status: ${rawStatusLabel} -${rawAppName}`;

    const introText = isCreated
      ? `Terima kasih <strong>${reporterName}</strong>, laporan Anda telah masuk ke sistem antrean tim teknis kami dan akan segera ditinjau.`
      : isCompleted
      ? `Halo <strong>${reporterName}</strong>, kabar baik! Laporan atau permintaan fitur yang Anda ajukan telah selesai dikerjakan, lolos verifikasi QC, dan telah dirilis ke sistem.`
      : `Halo <strong>${reporterName}</strong>, berikut adalah perkembangan terbaru mengenai laporan tiket Anda yang sedang ditangani oleh tim teknis:`;

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/$/, "");

    const logoPath = path.join(process.cwd(), "public", "logo.png");
    let hasLocalLogo = false;
    try {
      hasLocalLogo = fs.existsSync(logoPath);
    } catch {
      hasLocalLogo = false;
    }
    const logoSrc = hasLocalLogo ? "cid:portal-logo" : `${appUrl}/logo.png`;

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1e293b; background-color: #ffffff;">
        <!-- HEADER DENGAN LOGO -->
        <div style="background-color: #0f172a; padding: 24px; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top;">
                <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${finalStatusLabel}
                </span>
                <h2 style="margin: 12px 0 4px 0; font-size: 20px; color: #ffffff; line-height: 1.3;">
                  ${headerTitle}
                </h2>
                <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                  Nomor Tiket: <strong style="color: #818cf8; font-family: monospace; font-size: 14px;">#${ticketNumber}</strong>
                </p>
              </td>
              <td style="width: 56px; vertical-align: top; text-align: right;">
                <div style="width: 48px; height: 48px; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 6px; box-sizing: border-box; display: inline-block;">
                  <img src="${logoSrc}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- BODY EMAIL -->
        <div style="padding: 24px; background-color: #ffffff;">
          <p style="font-size: 14px; line-height: 1.6; margin-top: 0; color: #334155;">
            ${introText}
          </p>

          <!-- TABEL METADATA TIKET -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 145px; vertical-align: top;">Judul Laporan</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">: ${title}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Aplikasi &amp; Modul</td>
                <td style="padding: 6px 0; color: #0f172a;">: ${appName} (${moduleName})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Status Saat Ini</td>
                <td style="padding: 6px 0; font-weight: bold; color: ${badgeColor};">: ${finalStatusLabel}</td>
              </tr>
              ${
                assignedDev
                  ? `<tr>
                      <td style="padding: 6px 0; color: #64748b; vertical-align: top;">PIC Developer</td>
                      <td style="padding: 6px 0; color: #0f172a;">: ${assignedDev}</td>
                    </tr>`
                  : ""
              }
              ${
                qcTester
                  ? `<tr>
                      <td style="padding: 6px 0; color: #64748b; vertical-align: top;">PIC Verifikasi QC</td>
                      <td style="padding: 6px 0; color: #0f172a;">: ${qcTester}</td>
                    </tr>`
                  : ""
              }
              ${
                estimatedFinishDate
                  ? `<tr>
                      <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Estimasi Selesai</td>
                      <td style="padding: 6px 0; color: #0f172a;">: ${estimatedFinishDate}</td>
                    </tr>`
                  : ""
              }
              ${
                releaseVersion
                  ? `<tr>
                      <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Versi Rilis</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #059669;">: ${releaseVersion}</td>
                    </tr>`
                  : ""
              }
            </table>
          </div>

          ${
            publicNote
              ? `<div style="background-color: #eef2ff; border-left: 4px solid #4f46e5; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                  <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #3730a3;">
                    Catatan Progres dari Tim Teknis:
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #1e1b4b; line-height: 1.5;">
                    &ldquo;${publicNote}&rdquo;
                  </p>
                </div>`
              : ""
          }

          ${
            rawStatus === "qc_rejected" && rejectReason
              ? `<div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                  <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #9f1239;">
                    Catatan Verifikasi QC:
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #881337; line-height: 1.5;">
                    &ldquo;${rejectReason}&rdquo;
                  </p>
                </div>`
              : ""
          }

          ${
            deliverableLink && /^https?:\/\//i.test(deliverableLink)
              ? `<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
                  <strong style="color: #065f46;">Tautan Hasil / Rilis:</strong>
                  <a href="${escapeHtml(deliverableLink)}" style="color: #059669; word-break: break-all; margin-left: 4px;">
                    ${escapeHtml(deliverableLink)}
                  </a>
                </div>`
              : ""
          }

          <div style="text-align: center; margin-top: 24px;">
            <a href="${appUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: bold;">
              Lacak Tiket #${ticketNumber} di Portal
            </a>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="background-color: #f1f5f9; padding: 14px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Email ini dikirim secara otomatis oleh Sistem Portal Maintenance &amp; Helpdesk IT.
        </div>
      </div>
    `;

    const plainTextContent = [
      `${headerTitle} (#${rawTicketNumber})`,
      `Halo ${rawReporterName},`,
      ``,
      `Judul Laporan : ${rawTitle}`,
      `Aplikasi/Modul: ${rawAppName} (${rawModuleName})`,
      `Status        : ${rawStatusLabel}`,
      noteText ? `Catatan Tim   : "${noteText}"` : "",
      ``,
      `Lacak tiket Anda di: ${appUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"Portal Maintenance IT" <${smtpEmail}>`,
      to,
      subject,
      text: plainTextContent,
      html: htmlContent,
      attachments: hasLocalLogo
        ? [
            {
              filename: "logo.png",
              path: logoPath,
              cid: "portal-logo",
            },
          ]
        : [],
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[Email API] Gagal mengirim email notifikasi:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan internal saat mengirim email.";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}