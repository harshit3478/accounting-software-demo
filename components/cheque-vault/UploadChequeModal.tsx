"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChequeVaultRecord } from "@/hooks/useChequeVault";
import {
  CHEQUE_VAULT_ACCEPT_ATTRIBUTE,
  CHEQUE_VAULT_FILE_TYPE_HINT,
  CHEQUE_VAULT_MAX_FILE_SIZE_BYTES,
  isAllowedChequeVaultMimeType,
  isChequeVaultPdfMimeType,
} from "@/lib/cheque-vault-upload";
import ChequeDocumentPreview from "./ChequeDocumentPreview";

interface OcrResult {
  chequeNumber: string | null;
  payorName: string | null;
  amount: number | null;
  chequeDate: string | null;
  bankName: string | null;
  confidence: "high" | "low";
}

interface UploadChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cheque: ChequeVaultRecord) => void;
}

const STEPS = ["Upload", "Analyzing", "Review & Submit"] as const;

export default function UploadChequeModal({
  isOpen,
  onClose,
  onSuccess,
}: UploadChequeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCheque, setUploadedCheque] =
    useState<ChequeVaultRecord | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [chequeNumber, setChequeNumber] = useState("");
  const [payorName, setPayorName] = useState("");
  const [amount, setAmount] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [foundCustomer, setFoundCustomer] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [emailLookupState, setEmailLookupState] = useState<
    "idle" | "loading" | "found" | "notfound"
  >("idle");

  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setIsUploading(false);
    setUploadedCheque(null);
    setOcrResult(null);
    setUploadError(null);
    setChequeNumber("");
    setPayorName("");
    setAmount("");
    setChequeDate("");
    setBankName("");
    setCustomerEmail("");
    setFoundCustomer(null);
    setEmailLookupState("idle");
    setDuplicateWarning(null);
    setIsSaving(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!isAllowedChequeVaultMimeType(selectedFile.type)) {
      setUploadError("Only JPEG, PNG, WebP images, or PDF are accepted.");
      return;
    }
    if (selectedFile.size > CHEQUE_VAULT_MAX_FILE_SIZE_BYTES) {
      setUploadError("File size must be under 10MB.");
      return;
    }
    setUploadError(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return isChequeVaultPdfMimeType(selectedFile.type)
        ? null
        : URL.createObjectURL(selectedFile);
    });
    setFile(selectedFile);
  }, []);

  const fileFromClipboardItem = (item: DataTransferItem): File | null => {
    if (item.kind !== "file") return null;
    const pasted = item.getAsFile();
    if (!pasted) return null;
    if (!isAllowedChequeVaultMimeType(pasted.type)) return null;
    if (pasted.name) return pasted;
    const ext = pasted.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
    return new File([pasted], `pasted-cheque.${ext}`, { type: pasted.type });
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent | React.ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      const items = e.clipboardData?.items;
      if (!items?.length) return;

      const pastedFiles = Array.from(items)
        .map(fileFromClipboardItem)
        .filter((f): f is File => f !== null);

      if (pastedFiles.length === 0) return;

      e.preventDefault();
      if (pastedFiles.length > 1) {
        setUploadError("Only one cheque file can be uploaded.");
        return;
      }
      handleFileSelect(pastedFiles[0]);
    },
    [handleFileSelect],
  );

  useEffect(() => {
    if (!isOpen || step !== 1) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isOpen, step, handlePaste]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 1) {
        setUploadError("Only one cheque file can be uploaded.");
        return;
      }
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFileSelect(dropped);
    },
    [handleFileSelect],
  );

  const handleUploadAndScan = async () => {
    if (!file) return;
    setIsUploading(true);
    setStep(2);
    const formData = new FormData();
    formData.append("file", file);
    if (customerEmail.trim()) {
      formData.append("customerEmail", customerEmail.trim());
    }
    try {
      const res = await fetch("/api/cheque-vault", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const cheque: ChequeVaultRecord = data.cheque;
      const ocr: OcrResult = data.ocrResult;
      setUploadedCheque(cheque);
      setOcrResult(ocr);
      setChequeNumber(ocr.chequeNumber || "");
      setPayorName(ocr.payorName || "");
      setAmount(ocr.amount != null ? String(ocr.amount) : "");
      setChequeDate(ocr.chequeDate || "");
      setBankName(ocr.bankName || "");
      setStep(3);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
      setStep(1);
    } finally {
      setIsUploading(false);
    }
  };

  const lookupCustomerEmail = async (email: string) => {
    if (!email.trim()) {
      setEmailLookupState("idle");
      setFoundCustomer(null);
      return;
    }
    setEmailLookupState("loading");
    try {
      const res = await fetch(
        `/api/customers/lookup?email=${encodeURIComponent(email.trim())}`,
      );
      const data = await res.json();
      if (data.customer) {
        setFoundCustomer(data.customer);
        setEmailLookupState("found");
      } else {
        setFoundCustomer(null);
        setEmailLookupState("notfound");
      }
    } catch {
      setEmailLookupState("idle");
    }
  };

  const checkDuplicate = async (num: string) => {
    if (!num.trim()) {
      setDuplicateWarning(null);
      return;
    }
    setIsDuplicateChecking(true);
    try {
      const res = await fetch(
        `/api/cheque-vault/check-duplicate?chequeNumber=${encodeURIComponent(num.trim())}`,
      );
      const data = await res.json();
      if (data.isDuplicate && data.existingCheques.length > 0) {
        const existing = data.existingCheques[0];
        const date = new Date(existing.createdAt).toLocaleDateString();
        setDuplicateWarning(
          `A cheque with number "${num}" was already uploaded on ${date} by ${existing.uploadedBy?.name || "another user"} (status: ${existing.status}).`,
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    } finally {
      setIsDuplicateChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!uploadedCheque || !chequeNumber.trim()) {
      setUploadError("Cheque number is required.");
      return;
    }
    setIsSaving(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/cheque-vault/${uploadedCheque.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chequeNumber: chequeNumber.trim(),
          payorName: payorName.trim(),
          amount: parseFloat(amount) || 0,
          chequeDate: chequeDate || new Date().toISOString().split("T")[0],
          bankName: bankName.trim() || null,
          customerEmail: customerEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onSuccess(data.cheque);
      handleClose();
    } catch (err: any) {
      setUploadError(err.message || "Failed to submit");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Submit Cheque Request
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Step {step} of 3 — {STEPS[step - 1]}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {STEPS.map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step > idx + 1
                      ? "bg-green-500 text-white"
                      : step === idx + 1
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step > idx + 1 ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-xs ${step === idx + 1 ? "text-blue-600 font-medium" : "text-gray-400"}`}
                >
                  {label}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className="w-6 h-px bg-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {uploadError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Upload the cheque image and confirm the details. An approver
                will link invoices before the payment is recorded.
              </p>
              <div
                tabIndex={0}
                role="button"
                aria-label="Upload cheque image by drag and drop, paste, or browse"
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={CHEQUE_VAULT_ACCEPT_ATTRIBUTE}
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    if (files.length > 1) {
                      setUploadError("Only one cheque file can be uploaded.");
                      return;
                    }
                    handleFileSelect(files[0]);
                  }}
                />
                {file && isChequeVaultPdfMimeType(file.type) ? (
                  <div className="mb-3 text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF — first page will be scanned for fields
                    </p>
                  </div>
                ) : preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg object-contain mb-3"
                  />
                ) : (
                  <div className="text-gray-400 mb-3">
                    <svg
                      className="w-12 h-12 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                )}
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : "Drag & drop, paste, or click to browse"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {CHEQUE_VAULT_FILE_TYPE_HINT} — or paste from clipboard
                </p>
              </div>

              <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Customer Email{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    onBlur={(e) => lookupCustomerEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {emailLookupState === "loading" && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    </div>
                  )}
                </div>
                {emailLookupState === "found" && foundCustomer && (
                  <p className="text-xs text-green-700 mt-1">
                    ✓ Matched:{" "}
                    <span className="font-medium">{foundCustomer.name}</span>
                  </p>
                )}
              </div>

              {file && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleUploadAndScan}
                    disabled={isUploading}
                    className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Upload & Scan with AI
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {preview && (
                <img
                  src={preview}
                  alt="Cheque"
                  className="max-h-40 rounded-lg object-contain opacity-60"
                />
              )}
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-600 font-medium">
                Analyzing cheque with AI...
              </p>
            </div>
          )}

          {step === 3 && uploadedCheque && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Cheque Image
                </p>
                <ChequeDocumentPreview
                  imageUrl={uploadedCheque.imageUrl}
                  imageFileName={uploadedCheque.imageFileName}
                  chequeNumber={chequeNumber}
                />
                {ocrResult?.confidence === "low" && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                    OCR could not extract all fields — please fill in manually.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Cheque Number *
                  </label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    onBlur={(e) => checkDuplicate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {isDuplicateChecking && (
                    <p className="text-xs text-gray-400 mt-1">
                      Checking for duplicates...
                    </p>
                  )}
                  {duplicateWarning && (
                    <div className="mt-1 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
                      ⚠️ {duplicateWarning}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Customer / Payor Name
                  </label>
                  <input
                    type="text"
                    value={payorName}
                    onChange={(e) => setPayorName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    onBlur={(e) => lookupCustomerEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Cheque Date
                  </label>
                  <input
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {step === 3 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Start over
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || !chequeNumber.trim()}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? "Submitting..." : "Submit Cheque Request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
