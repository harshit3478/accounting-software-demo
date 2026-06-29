import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { BUSINESS_CONFIG } from "./business-config";
import prisma from "./prisma";
import { buildSingleInvoicePdfBuffer } from "./pdf-export";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLoginOtp(email: string, otp: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: email,
      subject: "Your Login OTP code",
      text: `Your login code is: ${otp}\n\nThis code will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Login Verification</h2>
          <p>You requested a login code for your account.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, you can ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, error };
  }
}

export async function sendSensitiveActionOtpEmail(email: string, otp: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: email,
      subject: "Verification code for sensitive action",
      text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nUse it to confirm a QuickBooks or user management change.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Action Verification Required</h2>
          <p>You requested to perform a sensitive action (QuickBooks configuration or user management).</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this, contact your administrator immediately.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending sensitive action OTP email:", error);
    return { success: false, error };
  }
}

export async function sendPaymentConfirmation(
  payment: { id: number; amount: number; paymentDate: Date | string },
  invoice: { invoiceNumber: string; amount: number; newRemaining: number },
  customer: { name: string; email: string },
) {
  const {
    name: businessName,
    tagline,
    website,
    email: emailNew,
    phone,
    colors,
  } = BUSINESS_CONFIG;
  const { gold, cream, charcoal } = colors;
  const paymentDate = new Date(payment.paymentDate).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
  const receiptRef = `PAY-${String(payment.id).padStart(5, "0")}`;
  const isPaidInFull = invoice.newRemaining <= 0.01;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: customer.email,
      subject: `Payment Confirmed – ${invoice.invoiceNumber}`,
      text: [
        `${businessName} — Payment Confirmation`,
        `Dear ${customer.name},`,
        `Your payment has been received and recorded for invoice ${invoice.invoiceNumber}.`,
        `Invoice Number: ${invoice.invoiceNumber}`,
        `Receipt: ${receiptRef}  |  Date: ${paymentDate}`,
        `Amount Paid: $${payment.amount.toFixed(2)}`,
        `Invoice Total: $${invoice.amount.toFixed(2)}`,
        `Remaining Balance: ${isPaidInFull ? "PAID IN FULL" : `$${invoice.newRemaining.toFixed(2)}`}`,
        website ? `Visit us: ${website}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:${charcoal};">
          <div style="background:${gold};height:4px;border-radius:2px 2px 0 0;"></div>
          <div style="background:#fff;padding:28px 32px 16px;">
            <h1 style="margin:0;font-size:22px;color:${gold};letter-spacing:1px;">${businessName}</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${tagline}</p>
          </div>
          <div style="background:#fff;padding:0 32px 28px;">
            <h2 style="font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;">Payment Confirmation</h2>
            <p style="font-size:14px;color:#374151;">Dear <strong>${customer.name}</strong>,<br>
              Your payment has been received and applied to invoice <strong>${invoice.invoiceNumber}</strong>.</p>
            <div style="background:${cream};border:1.5px solid ${gold};border-radius:8px;text-align:center;padding:16px 12px;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:11px;color:${gold};text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Amount Paid</p>
              <p style="margin:0;font-size:28px;font-weight:bold;">$${payment.amount.toFixed(2)}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Invoice Number</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:bold;">${invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Receipt #</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:bold;">${receiptRef}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Date</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${paymentDate}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Invoice</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Invoice Total</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">$${invoice.amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#6b7280;font-weight:bold;">Remaining Balance</td>
                <td style="padding:7px 0;text-align:right;font-weight:bold;color:${isPaidInFull ? "#16a34a" : charcoal};">
                  ${isPaidInFull ? "PAID IN FULL" : `$${invoice.newRemaining.toFixed(2)}`}
                </td>
              </tr>
            </table>
            ${isPaidInFull ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px 14px;margin-top:16px;font-size:13px;color:#16a34a;">This invoice is now fully settled. Thank you!</div>` : ""}
          </div>
          <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${gold};font-weight:bold;">Thank you for choosing ${businessName}</p>
            ${website ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${website}</p>` : ""}
            ${emailNew ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${emailNew}</p>` : ""}
          </div>
          <div style="background:${gold};height:2px;border-radius:0 0 2px 2px;"></div>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] sendPaymentConfirmation error:", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error("[Email] sendPaymentConfirmation exception:", error);
    return { success: false, error };
  }
}

export async function sendChequeStatusNotification(params: {
  recipientEmail: string;
  recipientName: string;
  chequeNumber: string;
  amount: number;
  status: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION";
  reason?: string;
  paymentRef?: string;
}): Promise<{ success: boolean; error?: any }> {
  const {
    name: businessName,
    tagline,
    website,
    email: bizEmail,
    phone,
    colors,
  } = BUSINESS_CONFIG;
  const { gold, cream, charcoal } = colors;

  const {
    recipientEmail,
    recipientName,
    chequeNumber,
    amount,
    status,
    reason,
    paymentRef,
  } = params;

  const statusConfig = {
    APPROVED: {
      subject: `Cheque #${chequeNumber} Approved`,
      title: "Cheque Approved",
      color: "#16a34a",
      bgColor: "#f0fdf4",
      borderColor: "#86efac",
      message: `Your cheque #${chequeNumber} for $${amount.toFixed(2)} has been approved and the payment has been recorded.`,
      extra: paymentRef
        ? `Payment Reference: <strong>${paymentRef}</strong>`
        : "",
    },
    REJECTED: {
      subject: `Cheque #${chequeNumber} Rejected`,
      title: "Cheque Rejected",
      color: "#dc2626",
      bgColor: "#fef2f2",
      borderColor: "#fca5a5",
      message: `Your cheque #${chequeNumber} for $${amount.toFixed(2)} has been rejected.`,
      extra: reason ? `Reason: <strong>${reason}</strong>` : "",
    },
    NEEDS_CORRECTION: {
      subject: `Correction Required for Cheque #${chequeNumber}`,
      title: "Correction Required",
      color: "#d97706",
      bgColor: "#fffbeb",
      borderColor: "#fcd34d",
      message: `Your cheque #${chequeNumber} for $${amount.toFixed(2)} requires correction before it can be approved.`,
      extra: reason ? `Note from reviewer: <strong>${reason}</strong>` : "",
    },
  };

  const cfg = statusConfig[status];

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: recipientEmail,
      subject: cfg.subject,
      text: [
        `${businessName} — ${cfg.title}`,
        `Dear ${recipientName},`,
        cfg.message,
        cfg.extra ? cfg.extra.replace(/<[^>]+>/g, "") : "",
        website ? `Visit us: ${website}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:${charcoal};">
          <div style="background:${gold};height:4px;border-radius:2px 2px 0 0;"></div>
          <div style="background:#fff;padding:28px 32px 16px;">
            <h1 style="margin:0;font-size:22px;color:${gold};letter-spacing:1px;">${businessName}</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${tagline}</p>
          </div>
          <div style="background:#fff;padding:0 32px 28px;">
            <h2 style="font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;">${cfg.title}</h2>
            <p style="font-size:14px;color:#374151;">Dear <strong>${recipientName}</strong>,</p>
            <div style="background:${cfg.bgColor};border:1.5px solid ${cfg.borderColor};border-radius:8px;padding:14px 16px;margin-bottom:20px;">
              <p style="margin:0;font-size:14px;color:${cfg.color};">${cfg.message}</p>
              ${cfg.extra ? `<p style="margin:8px 0 0;font-size:13px;color:#374151;">${cfg.extra}</p>` : ""}
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Cheque Number</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:bold;">${chequeNumber}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Amount</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">$${amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#6b7280;">Status</td>
                <td style="padding:7px 0;text-align:right;font-weight:bold;color:${cfg.color};">${status.replace("_", " ")}</td>
              </tr>
            </table>
          </div>
          <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${gold};font-weight:bold;">Thank you for choosing ${businessName}</p>
            ${website ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${website}</p>` : ""}
            ${bizEmail ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${bizEmail}</p>` : ""}
            ${phone ? `<p style="margin:0;font-size:11px;color:#9ca3af;">${phone}</p>` : ""}
          </div>
          <div style="background:${gold};height:2px;border-radius:0 0 2px 2px;"></div>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] sendChequeStatusNotification error:", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error("[Email] sendChequeStatusNotification exception:", error);
    return { success: false, error };
  }
}

export async function sendInvoiceEmail(invoice: {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  dueDate: string | Date;
  isLayaway: boolean;
  termsSnapshot?: string[] | null;
  customer?: { email?: string | null; name?: string | null } | null;
  description?: string | null;
  items?: Array<{ name: string; quantity: number; price: number }> | null;
  subtotal?: number;
  tax?: number;
  discount?: number;
  shippingFee?: number;
  insuranceAmount?: number;
  payments?: Array<{
    amount: number;
    paymentDate: string | Date;
    method?: { name: string } | null;
  }> | null;
}) {
  const {
    name: businessName,
    tagline,
    website,
    email: bizEmail,
    phone,
    colors,
    websiteAdress,
    footerText,
  } = BUSINESS_CONFIG;
  const { gold, cream, charcoal } = colors;
  const customerEmail = invoice.customer?.email;

  if (!customerEmail) {
    throw new Error("Customer email is required to send invoice");
  }

  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const remaining = Math.max(
    Number(invoice.amount || 0) - Number(invoice.paidAmount || 0),
    0,
  );
  const terms = Array.isArray(invoice.termsSnapshot)
    ? invoice.termsSnapshot
    : [];
  const [logoBuffer, defaultTerms] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "goldLogo.jpg.jpeg")).catch(
      () => null,
    ),
    (async () => {
      const termModel = (prisma as any)?.term;
      if (!termModel) return [] as string[];
      const defaultTerm = await termModel.findFirst({
        where: { isDefault: true },
        select: { lines: true },
      });
      return Array.isArray(defaultTerm?.lines)
        ? (defaultTerm.lines as string[])
        : [];
    })(),
  ]);

  const invoicePdf = buildSingleInvoicePdfBuffer(invoice as any, {
    logoBase64: logoBuffer
      ? `data:image/jpeg;base64,${logoBuffer.toString("base64")}`
      : null,
    defaultTermLines: defaultTerms,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: customerEmail,
      subject: `Invoice ${invoice.invoiceNumber} from ${businessName}`,
      text: [
        `${businessName} — Invoice ${invoice.invoiceNumber}`,
        `Dear ${invoice.customer?.name || invoice.clientName},`,
        `Please find your invoice attached as a PDF for easy review and recordkeeping.`,
        `Your invoice is ready for review.`,
        `Invoice Total: $${Number(invoice.amount || 0).toFixed(2)}`,
        `Already Paid: $${Number(invoice.paidAmount || 0).toFixed(2)}`,
        `Remaining Balance: $${remaining.toFixed(2)}`,
        `Due Date: ${dueDate}`,
        invoice.isLayaway
          ? "This is a layaway invoice."
          : "This is a cash invoice.",
        terms.length ? `Terms:\n- ${terms.join("\n- ")}` : "",
        website ? `Visit us: ${website}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:${charcoal};background:#fff;">
          <div style="background:${gold};height:4px;border-radius:2px 2px 0 0;"></div>
          <div style="padding:28px 32px 18px;background:#fff;">
            <h1 style="margin:0;font-size:22px;color:${gold};">${businessName}</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${tagline}</p>
          </div>
          <div style="padding:0 32px 28px;background:#fff;">
            <h2 style="font-size:18px;margin:0 0 12px;">Invoice ${invoice.invoiceNumber}</h2>
            <p style="margin:0 0 12px;font-size:14px;color:#374151;">Dear <strong>${invoice.customer?.name || invoice.clientName}</strong>,</p>
            <p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.6;">Please find your invoice attached as a PDF for easy review and recordkeeping. The summary below shows the current amount due and invoice type.</p>
            <div style="background:${cream};border:1px solid ${gold};border-radius:10px;padding:16px 18px;margin-bottom:18px;">
              <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;">
                <span>Total</span><strong>$${Number(invoice.amount || 0).toFixed(2)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;margin-top:8px;">
                <span>Paid</span><strong>$${Number(invoice.paidAmount || 0).toFixed(2)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;margin-top:8px;">
                <span>Remaining</span><strong>${remaining <= 0 ? "PAID IN FULL" : `$${remaining.toFixed(2)}`}</strong>
              </div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><td style="padding:6px 0;color:#6b7280;">Due date</td><td style="padding:6px 0;text-align:right;">${dueDate}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Invoice type</td><td style="padding:6px 0;text-align:right;">${invoice.isLayaway ? "Layaway" : "Cash"}</td></tr>
            </table>
            ${terms.length ? `<div style="margin-top:18px;"><p style="margin:0 0 8px;font-weight:bold;">Terms &amp; Conditions</p><ol style="margin:0;padding-left:18px;color:#374151;">${terms.map((line) => `<li style="margin-bottom:4px;">${line}</li>`).join("")}</ol></div>` : ""}
          </div>
          <div style="padding:18px 32px 26px;border-top:1px solid #e5e7eb;background:#f9fafb;text-align:center;font-size:11px;color:#9ca3af;">
            ${websiteAdress ? `<div>${websiteAdress}</div>` : ""}
            ${footerText ? `<div>${footerText}</div>` : ""}
        </div>
      `,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: invoicePdf,
        },
      ],
    });

    if (error) {
      console.error("[Email] sendInvoiceEmail error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[Email] sendInvoiceEmail exception:", error);
    return { success: false, error };
  }
}

export async function sendDuePaymentReminderEmail(params: {
  reminderNumber: 1 | 2 | 3;
  customer: { name: string; email: string };
  invoice: {
    invoiceNumber: string;
    amount: number;
    paidAmount: number;
    remaining: number;
    dueDate: Date | string;
    isLayaway: boolean;
  };
  restockingNotice?: string | null;
}) {
  const {
    name: businessName,
    tagline,
    website,
    email: bizEmail,
    phone,
    colors,
  } = BUSINESS_CONFIG;
  const { gold, cream, charcoal } = colors;

  const dueDate = new Date(params.invoice.dueDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const reminderTitles: Record<1 | 2 | 3, string> = {
    1: "Payment Reminder",
    2: "Second Payment Reminder",
    3: "Final Payment Reminder",
  };

  const reminderSubjects: Record<1 | 2 | 3, string> = {
    1: `Payment Reminder – ${params.invoice.invoiceNumber}`,
    2: `Second Payment Reminder – ${params.invoice.invoiceNumber}`,
    3: `Final Payment Reminder & Restocking Notice – ${params.invoice.invoiceNumber}`,
  };

  const introLines: Record<1 | 2 | 3, string> = {
    1: "This is a friendly reminder that your invoice payment is now due.",
    2: "This is your second reminder that your invoice payment remains outstanding.",
    3: "This is your final payment reminder. Immediate action is required to avoid restocking fees and order cancellation.",
  };

  const restockingBlock = params.restockingNotice
    ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin-top:18px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#b91c1c;">Restocking Notice</p>
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.5;">${params.restockingNotice}</p>
      </div>
    `
    : "";

  const restockingText = params.restockingNotice
    ? `\n\nRestocking Notice:\n${params.restockingNotice}`
    : "";

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: params.customer.email,
      subject: reminderSubjects[params.reminderNumber],
      text: [
        `${businessName} — ${reminderTitles[params.reminderNumber]}`,
        `Dear ${params.customer.name},`,
        introLines[params.reminderNumber],
        `Invoice Number: ${params.invoice.invoiceNumber}`,
        `Invoice Total: $${params.invoice.amount.toFixed(2)}`,
        `Amount Paid: $${params.invoice.paidAmount.toFixed(2)}`,
        `Amount Due: $${params.invoice.remaining.toFixed(2)}`,
        `Due Date: ${dueDate}`,
        params.invoice.isLayaway
          ? "This is a layaway invoice."
          : "This is a cash invoice.",
        restockingText,
        website ? `Visit us: ${website}` : "",
        bizEmail ? `Contact: ${bizEmail}` : "",
        phone ? `Phone: ${phone}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:${charcoal};">
          <div style="background:${gold};height:4px;border-radius:2px 2px 0 0;"></div>
          <div style="background:#fff;padding:28px 32px 16px;">
            <h1 style="margin:0;font-size:22px;color:${gold};letter-spacing:1px;">${businessName}</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${tagline}</p>
          </div>
          <div style="background:#fff;padding:0 32px 28px;">
            <h2 style="font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;">${reminderTitles[params.reminderNumber]}</h2>
            <p style="font-size:14px;color:#374151;line-height:1.6;">Dear <strong>${params.customer.name}</strong>,<br>${introLines[params.reminderNumber]}</p>
            <div style="background:${cream};border:1.5px solid ${gold};border-radius:8px;text-align:center;padding:16px 12px;margin:20px 0;">
              <p style="margin:0 0 4px;font-size:11px;color:${gold};text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Amount Due</p>
              <p style="margin:0;font-size:28px;font-weight:bold;">$${params.invoice.remaining.toFixed(2)}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Invoice Number</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:bold;">${params.invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Due Date</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${dueDate}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Invoice Total</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">$${params.invoice.amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">Amount Paid</td>
                <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">$${params.invoice.paidAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#6b7280;font-weight:bold;">Balance Remaining</td>
                <td style="padding:7px 0;text-align:right;font-weight:bold;color:#b45309;">$${params.invoice.remaining.toFixed(2)}</td>
              </tr>
            </table>
            ${restockingBlock}
            <p style="font-size:13px;color:#374151;margin-top:18px;">Please contact us if you have already submitted payment or need assistance with your account.</p>
          </div>
          <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${gold};font-weight:bold;">${businessName}</p>
            ${website ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${website}</p>` : ""}
            ${bizEmail ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${bizEmail}</p>` : ""}
            ${phone ? `<p style="margin:0;font-size:11px;color:#9ca3af;">${phone}</p>` : ""}
          </div>
          <div style="background:${gold};height:2px;border-radius:0 0 2px 2px;"></div>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] sendDuePaymentReminderEmail error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[Email] sendDuePaymentReminderEmail exception:", error);
    return { success: false, error };
  }
}
