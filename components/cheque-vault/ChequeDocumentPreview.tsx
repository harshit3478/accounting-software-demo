"use client";

import { isChequeVaultPdfFile } from "@/lib/cheque-vault-upload";

interface ChequeDocumentPreviewProps {
  imageUrl: string;
  imageFileName?: string | null;
  chequeNumber?: string;
  className?: string;
  maxHeight?: string;
}

export default function ChequeDocumentPreview({
  imageUrl,
  imageFileName,
  chequeNumber,
  className = "",
  maxHeight = "max-h-80",
}: ChequeDocumentPreviewProps) {
  const isPdf = isChequeVaultPdfFile(imageFileName || imageUrl);

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
        <p className="text-sm font-medium text-gray-700">Cheque PDF</p>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Open PDF{chequeNumber ? ` (#${chequeNumber})` : ""}
        </a>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={chequeNumber ? `Cheque #${chequeNumber}` : "Cheque"}
      className={`w-full object-contain ${maxHeight} ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
