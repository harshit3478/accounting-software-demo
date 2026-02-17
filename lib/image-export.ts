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

/**
 * Returns true if a CSS color value uses a function not supported by html2canvas
 * (e.g. oklch, lab, lch, color())
 */
function isUnsupportedColor(val: string): boolean {
  if (!val) return false;
  return (
    val.startsWith("oklch(") ||
    val.startsWith("lab(") ||
    val.startsWith("lch(") ||
    val.startsWith("color(") ||
    val.includes(" oklch(") ||
    val.includes(" lab(") ||
    val.includes(" lch(")
  );
}

/**
 * Captures a DOM element as a high-quality JPEG image and triggers download.
 * Uses onclone to replace unsupported CSS color functions (oklch, lab, lch)
 * with safe fallbacks so html2canvas can render them.
 */
/**
 * Replace unsupported color functions on a single element pair (original → clone).
 */
function sanitizeElementColors(orig: HTMLElement, clone: HTMLElement): void {
  const computed = window.getComputedStyle(orig);
  if (isUnsupportedColor(computed.backgroundColor)) clone.style.backgroundColor = "#ffffff";
  if (isUnsupportedColor(computed.color)) clone.style.color = "#1f2937";
  if (isUnsupportedColor(computed.borderColor)) clone.style.borderColor = "#e5e7eb";
  if (isUnsupportedColor(computed.outlineColor)) clone.style.outlineColor = "#e5e7eb";
  if (isUnsupportedColor(computed.textDecorationColor)) clone.style.textDecorationColor = "#1f2937";
}

export async function exportElementAsJPEG(
  element: HTMLElement,
  fileName: string = "export.jpg",
  quality: number = 0.95
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (_clonedDoc, clonedElement) => {
      // Sanitize the root element itself
      sanitizeElementColors(element, clonedElement);

      // Sanitize all descendant elements
      const originals = Array.from(element.querySelectorAll("*")) as HTMLElement[];
      const clones = Array.from(clonedElement.querySelectorAll("*")) as HTMLElement[];

      originals.forEach((orig, i) => {
        const clone = clones[i] as HTMLElement | undefined;
        if (!clone) return;
        sanitizeElementColors(orig, clone);
      });
    },
  });

  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/jpeg", quality);
  link.click();
}
