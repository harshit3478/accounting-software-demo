export interface ChequeOcrResult {
  chequeNumber: string | null;
  payorName: string | null;
  amount: number | null;
  chequeDate: string | null; // YYYY-MM-DD
  bankName: string | null;
  rawText: string;
  confidence: "high" | "low";
}

const EXTRACTION_PROMPT = `You are analyzing a cheque document (image or PDF scan). Extract the following fields and return ONLY a valid JSON object with no extra text or markdown.

Fields to extract:
- chequeNumber: The cheque/check number (usually printed in the bottom-right of the MICR line, or top-right corner)
- payorName: The name and address of the SENDER/PAYOR — the person or company who WROTE the cheque. This is typically printed in the TOP-LEFT corner of the cheque (e.g. "JOHN SMITH, 123 Main St, City, State"). Do NOT capture the "Pay to the order of" line (that is the payee/recipient, not the payor).
- amount: The numeric dollar amount (return as a number, not a string — use the numeric figure, not the written words)
- chequeDate: The date printed on the cheque. Return ONLY in YYYY-MM-DD format (e.g. 2026-06-11). Convert any other format to YYYY-MM-DD before returning.
- bankName: The issuing bank name (usually in the header/top of the cheque)
- rawText: A full text dump of everything you can read on the cheque

Return exactly this JSON structure:
{
  "chequeNumber": "string or null",
  "payorName": "string or null",
  "amount": number or null,
  "chequeDate": "YYYY-MM-DD or null",
  "bankName": "string or null",
  "rawText": "all readable text"
}`;

/** Route cheque OCR by file type (image or PDF). */
export async function extractChequeDataFromFile(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ChequeOcrResult> {
  if (mimeType === "application/pdf") {
    return extractChequeDataFromPdf(fileBuffer);
  }
  return extractChequeData(fileBuffer, mimeType);
}

async function extractChequeDataFromPdf(
  pdfBuffer: Buffer,
): Promise<ChequeOcrResult> {
  try {
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(pdfBuffer, { scale: 2 });

    let firstPage: Buffer | null = null;
    for await (const page of document) {
      firstPage = Buffer.from(page);
      break;
    }

    if (!firstPage) {
      console.error("[OCR] PDF has no renderable pages");
      return nullResult("low");
    }

    return extractChequeData(firstPage, "image/png");
  } catch (error) {
    console.error("[OCR] PDF to image conversion error:", error);
    return nullResult("low");
  }
}

export async function extractChequeData(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ChequeOcrResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const base64Image = imageBuffer.toString("base64");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OCR] OpenAI API error:", errorText);
      return nullResult("low");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[OCR] No content in OpenAI response");
      return nullResult("low");
    }

    // Strip markdown fences if present
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      chequeNumber: parsed.chequeNumber ?? null,
      payorName: parsed.payorName ?? null,
      amount:
        typeof parsed.amount === "number"
          ? parsed.amount
          : parsed.amount
            ? parseFloat(parsed.amount)
            : null,
      chequeDate: parsed.chequeDate ?? null,
      bankName: parsed.bankName ?? null,
      rawText: parsed.rawText ?? content,
      confidence: "high",
    };
  } catch (error) {
    console.error("[OCR] extractChequeData error:", error);
    return nullResult("low");
  }
}

function nullResult(confidence: "high" | "low"): ChequeOcrResult {
  return {
    chequeNumber: null,
    payorName: null,
    amount: null,
    chequeDate: null,
    bankName: null,
    rawText: "",
    confidence,
  };
}
