"use client";

import { useEffect, useState } from "react";
import {
  getChequeVaultFileUrl,
  isChequeVaultPdfFile,
} from "@/lib/cheque-vault-upload";

interface ChequeDocumentPreviewProps {
  imageUrl: string;
  chequeId?: number;
  imageFileName?: string | null;
  chequeNumber?: string;
  documentTypeLabel?: string;
  className?: string;
  maxHeight?: string;
}

export default function ChequeDocumentPreview({
  imageUrl,
  chequeId,
  imageFileName,
  chequeNumber,
  documentTypeLabel = "Cheque Without Memo",
  className = "",
  maxHeight = "max-h-80",
}: ChequeDocumentPreviewProps) {
  const src = chequeId ? getChequeVaultFileUrl(chequeId) : imageUrl;
  const isPdf = isChequeVaultPdfFile(imageFileName || imageUrl);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  if (isPdf) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 rounded-lg border border-gray-200 ${className}`}
      >
        <svg
          className="w-14 h-14 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-700">{documentTypeLabel} PDF</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Open PDF{chequeNumber ? ` (#${chequeNumber})` : ""}
        </a>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 p-8 text-center ${className}`}
      >
        <p className="text-sm font-medium text-gray-700">
          Unable to load document
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={
        chequeNumber
          ? `${documentTypeLabel} #${chequeNumber}`
          : documentTypeLabel
      }
      className={`w-full object-contain ${maxHeight} ${className}`}
      onError={() => setLoadFailed(true)}
    />
  );
}
