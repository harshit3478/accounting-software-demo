export interface MemoOcrResult {
  chequeNumber: string | null;
  payorName: string | null;
  amount: number | null;
  chequeDate: string | null; // YYYY-MM-DD
  bankName: string | null;
  memoText: string | null;
  rawText: string;
  confidence: "high" | "low";
}

const EXTRACTION_PROMPT = `You are analyzing a payment memo document — typically a bill-pay check, online bill payment draft, or remittance advice issued by a bank or payment processor (e.g. Chase Online Bill Payment, iPay Solutions, FIS Payments, PrimeWay FCU, Truist, Mt. McKinley Bank, Payment Processing Center).

These documents look like checks but the MEMO / description field is the most important business data. Extract the following fields and return ONLY a valid JSON object with no extra text or markdown.

Fields to extract:
- chequeNumber: The check/check number (top-right corner or MICR line at bottom)
- payorName: The CUSTOMER/PAYOR name ONLY — the person who initiated the payment. Usually in the TOP-LEFT area (e.g. "MARIA ECHANO", "Hyacinth P Abella"). Return ONLY the name — no address, city, state, or zip. Do NOT use the "Pay to the order of" payee line (that is the recipient, e.g. Cooper Creek LLC).
- amount: The numeric dollar amount as a number (use the boxed numeric figure, not written words)
- chequeDate: The date on the document in YYYY-MM-DD format
- bankName: The issuing/payable-through bank or payment processor name (e.g. "Truist", "JPMorgan Chase Bank", "PrimeWay Federal Credit Union", "iPay Solutions", "FIS Payments LLC")
- memoText: The MEMO or payment description text — this is critical. Look for lines labeled "Memo:", "MEMO:", or free-text payment descriptions. Examples: "DP June 25 Invoice 19039", "LAY AWAY PAYMENT", "Layaway HKDL 6/11(44.33) and HKDL 6/16(49.27)", "7/15 of LA 4/22", "full payment for the month of July". Include the full memo content; if multiple memo-like lines exist, combine them with " | ". Also include "Apply to account" or "FOR CREDIT TO" reference numbers if present in the memo area.
- rawText: Full text dump of everything readable on the document

Return exactly this JSON structure:
{
  "chequeNumber": "string or null",
  "payorName": "string or null",
  "amount": number or null,
  "chequeDate": "YYYY-MM-DD or null",
  "bankName": "string or null",
  "memoText": "string or null",
  "rawText": "all readable text"
}`;

/** Route memo OCR by file type (image or PDF). */
export async function extractMemoDataFromFile(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<MemoOcrResult> {
  if (mimeType === "application/pdf") {
    return extractMemoDataFromPdf(fileBuffer);
  }
  return extractMemoData(fileBuffer, mimeType);
}

async function extractMemoDataFromPdf(
  pdfBuffer: Buffer,
): Promise<MemoOcrResult> {
  try {
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(pdfBuffer, { scale: 2 });

    let firstPage: Buffer | null = null;
    for await (const page of document) {
      firstPage = Buffer.from(page);
      break;
    }

    if (!firstPage) {
      console.error("[Memo OCR] PDF has no renderable pages");
      return nullResult("low");
    }

    return extractMemoData(firstPage, "image/png");
  } catch (error) {
    console.error("[Memo OCR] PDF to image conversion error:", error);
    return nullResult("low");
  }
}

export async function extractMemoData(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<MemoOcrResult> {
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
        max_tokens: 600,
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
      console.error("[Memo OCR] OpenAI API error:", errorText);
      return nullResult("low");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[Memo OCR] No content in OpenAI response");
      return nullResult("low");
    }

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
      memoText: parsed.memoText ?? null,
      rawText: parsed.rawText ?? content,
      confidence: "high",
    };
  } catch (error) {
    console.error("[Memo OCR] extractMemoData error:", error);
    return nullResult("low");
  }
}

export function emptyMemoOcrResult(): MemoOcrResult {
  return nullResult("low");
}

function nullResult(confidence: "high" | "low"): MemoOcrResult {
  return {
    chequeNumber: null,
    payorName: null,
    amount: null,
    chequeDate: null,
    bankName: null,
    memoText: null,
    rawText: "",
    confidence,
  };
}
