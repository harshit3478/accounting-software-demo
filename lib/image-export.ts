import html2canvas from "html2canvas";

/**
 * Captures a DOM element as a PNG image and triggers download.
 */
export async function exportElementAsImage(
  element: HTMLElement,
  fileName: string = "export.png"
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2, // Retina quality
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/**
 * Captures a DOM element as a PNG blob (for sharing via Web Share API).
 * Falls back to download if Web Share is not available.
 */
export async function shareElementAsImage(
  element: HTMLElement,
  fileName: string = "receipt.png",
  title: string = "Payment Receipt"
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/png");
  });

  const file = new File([blob], fileName, { type: "image/png" });

  // Try Web Share API (works on mobile/WhatsApp)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title,
        files: [file],
      });
      return;
    } catch {
      // User cancelled or share failed, fall back to download
    }
  }

  // Fallback: download the image
  const link = document.createElement("a");
  link.download = fileName;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}
