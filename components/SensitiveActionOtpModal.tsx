"use client";

import { useEffect, useState } from "react";

interface SensitiveActionOtpModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (otp: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function SensitiveActionOtpModal({
  isOpen,
  title,
  message,
  confirmText = "Verify & Continue",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
}: SensitiveActionOtpModalProps) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setOtp("");
      setError("");
      setCodeSent(false);
      return;
    }

    let cancelled = false;

    const sendCode = async () => {
      setSendingCode(true);
      setError("");
      try {
        const res = await fetch("/api/auth/send-sensitive-otp", {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to send verification code");
        }
        if (!cancelled) {
          setCodeSent(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to send verification code",
          );
        }
      } finally {
        if (!cancelled) {
          setSendingCode(false);
        }
      }
    };

    void sendCode();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleResend = async () => {
    setSendingCode(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-sensitive-otp", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend verification code");
      }
      setCodeSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resend verification code",
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6-digit verification code");
      return;
    }

    setError("");
    try {
      await onConfirm(otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isLoading && !sendingCode ? onCancel : undefined}
      />

      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="sensitive-action-otp" className="sr-only">
              Verification code
            </label>
            <input
              id="sensitive-action-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              placeholder="000000"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-[0.5em] font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading || sendingCode}
            />
          </div>

          {sendingCode && (
            <p className="text-sm text-gray-500 text-center">
              Sending verification code to your email...
            </p>
          )}
          {codeSent && !sendingCode && (
            <p className="text-sm text-green-700 text-center">
              Verification code sent to your email.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={isLoading || sendingCode}
              className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
            >
              Resend code
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading || sendingCode}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="submit"
                disabled={isLoading || sendingCode || otp.length !== 6}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : confirmText}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
