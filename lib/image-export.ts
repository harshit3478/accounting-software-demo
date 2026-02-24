import html2canvas from "html2canvas";

/**
 * Captures a DOM element as a PNG image and triggers download.
 */
export async function exportElementAsImage(
  element: HTMLElement,
  fileName: string = "export.png",
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
  title: string = "Payment Receipt",
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
 * Replace unsupported color functions directly on the cloned element.
 * We inspect the clone's computed styles (which may contain lab/oklch/lch/color())
 * and override them with safe fallbacks so html2canvas can render.
 */
function sanitizeElementColors(clone: HTMLElement): void {
  const computed = window.getComputedStyle(clone);
  // Core text/background colors
  if (isUnsupportedColor(computed.backgroundColor))
    clone.style.backgroundColor = "#ffffff";
  if (isUnsupportedColor(computed.color)) clone.style.color = "#1f2937";
  // Borders (all sides)
  if (isUnsupportedColor(computed.borderTopColor))
    clone.style.borderTopColor = "#e5e7eb";
  if (isUnsupportedColor(computed.borderRightColor))
    clone.style.borderRightColor = "#e5e7eb";
  if (isUnsupportedColor(computed.borderBottomColor))
    clone.style.borderBottomColor = "#e5e7eb";
  if (isUnsupportedColor(computed.borderLeftColor))
    clone.style.borderLeftColor = "#e5e7eb";
  // Outline & decorations
  if (isUnsupportedColor(computed.outlineColor))
    clone.style.outlineColor = "#e5e7eb";
  if (isUnsupportedColor(computed.textDecorationColor))
    clone.style.textDecorationColor = "#1f2937";
  // Shadows can contain color functions; clear them if unsupported
  if (
    computed.boxShadow &&
    (computed.boxShadow.includes("oklch(") ||
      computed.boxShadow.includes("lab(") ||
      computed.boxShadow.includes("lch(") ||
      computed.boxShadow.includes("color("))
  ) {
    clone.style.boxShadow = "none";
  }
  // Background images (gradients) may reference unsupported color spaces; remove them
  if (
    computed.backgroundImage &&
    (computed.backgroundImage.includes("gradient") ||
      computed.backgroundImage.includes("oklch(") ||
      computed.backgroundImage.includes("lab(") ||
      computed.backgroundImage.includes("lch(") ||
      computed.backgroundImage.includes("color("))
  ) {
    clone.style.backgroundImage = "none";
    // Ensure a safe background is present
    if (
      !clone.style.backgroundColor ||
      isUnsupportedColor(computed.backgroundColor)
    ) {
      clone.style.backgroundColor = "#ffffff";
    }
  }
}

/**
 * Sanitize SVG-specific color attributes and styles on the cloned subtree.
 * Ensures html2canvas won't parse unsupported color functions from SVG content.
 */
function sanitizeSVGColors(root: HTMLElement): void {
  const svgNodes = Array.from(root.querySelectorAll("svg, svg *")) as Element[];
  svgNodes.forEach((el) => {
    const style = (el as HTMLElement).style;
    const computed = window.getComputedStyle(el as Element as any);

    // Handle CSS style-derived fill/stroke
    if (computed.fill && isUnsupportedColor(computed.fill)) {
      if (style) style.fill = "#1f2937"; // gray-800
      (el as any).setAttribute?.("fill", "#1f2937");
    }
    if (computed.stroke && isUnsupportedColor(computed.stroke)) {
      if (style) style.stroke = "#1f2937";
      (el as any).setAttribute?.("stroke", "#1f2937");
    }

    // Handle attribute-based colors
    const attrFill = (el as any).getAttribute?.("fill");
    if (
      attrFill &&
      (isUnsupportedColor(attrFill) ||
        attrFill.startsWith("url(") ||
        attrFill.includes("gradient"))
    ) {
      (el as any).setAttribute("fill", "#ffffff");
    }
    const attrStroke = (el as any).getAttribute?.("stroke");
    if (
      attrStroke &&
      (isUnsupportedColor(attrStroke) ||
        attrStroke.startsWith("url(") ||
        attrStroke.includes("gradient"))
    ) {
      (el as any).setAttribute("stroke", "#1f2937");
    }

    // Gradient stop colors
    const stopColor = (el as any).getAttribute?.("stop-color");
    if (stopColor && isUnsupportedColor(stopColor)) {
      (el as any).setAttribute("stop-color", "#ffffff");
    }
    const floodColor = (el as any).getAttribute?.("flood-color");
    if (floodColor && isUnsupportedColor(floodColor)) {
      (el as any).setAttribute("flood-color", "#ffffff");
    }
    const lightingColor = (el as any).getAttribute?.("lighting-color");
    if (lightingColor && isUnsupportedColor(lightingColor)) {
      (el as any).setAttribute("lighting-color", "#ffffff");
    }
  });
}

export async function exportElementAsJPEG(
  element: HTMLElement,
  fileName: string = "export.jpg",
  quality: number = 0.95,
): Promise<void> {
  // First try html-to-image (uses browser's renderer via SVG foreignObject, avoiding html2canvas color parser)
  try {
    const { toJpeg } = await import("html-to-image");
    const dataUrl = await toJpeg(element, {
      quality,
      pixelRatio: 3,
      backgroundColor: "#ffffff",
    });

    const link = document.createElement("a");
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    return;
  } catch (e) {
    // Fall back to html2canvas with aggressive sanitization
    console.warn("html-to-image failed, falling back to html2canvas", e);
  }

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc, clonedElement) => {
      // Force safe backgrounds on cloned document root & body to avoid html2canvas parsing lab/oklch
      const docEl = clonedDoc.documentElement as HTMLElement | null;
      if (docEl) {
        docEl.style.backgroundColor = "#ffffff";
        docEl.style.backgroundImage = "none";
        docEl.style.background = "#ffffff";
      }
      if (clonedDoc.body) {
        clonedDoc.body.style.backgroundColor = "#ffffff";
        clonedDoc.body.style.backgroundImage = "none";
        clonedDoc.body.style.background = "#ffffff";
      }

      // Sanitize the cloned root element
      sanitizeElementColors(clonedElement as HTMLElement);

      // Sanitize all descendant cloned elements
      const clones = Array.from(
        clonedElement.querySelectorAll("*"),
      ) as HTMLElement[];
      clones.forEach((clone) => sanitizeElementColors(clone));

      // Sanitize SVG colors, gradients, and attributes
      sanitizeSVGColors(clonedElement as HTMLElement);
    },
  });

  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/jpeg", quality);
  link.click();
}
