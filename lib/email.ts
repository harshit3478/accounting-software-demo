import { Resend } from 'resend';
import { BUSINESS_CONFIG } from './business-config';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLoginOtp(email: string, otp: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'Your Login OTP code',
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
      console.error('Resend Error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error };
  }
}

export async function sendPaymentConfirmation(
  payment: { id: number; amount: number; paymentDate: Date | string },
  invoice: { invoiceNumber: string; amount: number; newRemaining: number },
  customer: { name: string; email: string },
) {
  const { name: businessName, tagline, website, email: bizEmail, phone, colors } = BUSINESS_CONFIG;
  const { gold, cream, charcoal } = colors;
  const paymentDate = new Date(payment.paymentDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const receiptRef = `PAY-${String(payment.id).padStart(5, '0')}`;
  const isPaidInFull = invoice.newRemaining <= 0.01;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: customer.email,
      subject: `Payment Confirmed – ${invoice.invoiceNumber}`,
      text: [
        `${businessName} — Payment Confirmation`,
        `Dear ${customer.name},`,
        `Your payment has been received for invoice ${invoice.invoiceNumber}.`,
        `Receipt: ${receiptRef}  |  Date: ${paymentDate}`,
        `Amount Paid: $${payment.amount.toFixed(2)}`,
        `Invoice Total: $${invoice.amount.toFixed(2)}`,
        `Remaining Balance: ${isPaidInFull ? 'PAID IN FULL' : `$${invoice.newRemaining.toFixed(2)}`}`,
        website ? `Visit us: ${website}` : '',
      ].filter(Boolean).join('\n'),
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
                <td style="padding:7px 0;text-align:right;font-weight:bold;color:${isPaidInFull ? '#16a34a' : charcoal};">
                  ${isPaidInFull ? 'PAID IN FULL' : `$${invoice.newRemaining.toFixed(2)}`}
                </td>
              </tr>
            </table>
            ${isPaidInFull ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px 14px;margin-top:16px;font-size:13px;color:#16a34a;">This invoice is now fully settled. Thank you!</div>` : ''}
          </div>
          <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${gold};font-weight:bold;">Thank you for choosing ${businessName}</p>
            ${website ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${website}</p>` : ''}
            ${bizEmail ? `<p style="margin:0 0 2px;font-size:11px;color:#9ca3af;">${bizEmail}</p>` : ''}
            ${phone ? `<p style="margin:0;font-size:11px;color:#9ca3af;">${phone}</p>` : ''}
          </div>
          <div style="background:${gold};height:2px;border-radius:0 0 2px 2px;"></div>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] sendPaymentConfirmation error:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error('[Email] sendPaymentConfirmation exception:', error);
    return { success: false, error };
  }
}
