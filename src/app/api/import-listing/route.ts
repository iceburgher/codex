import { NextResponse } from "next/server";
import { countExtracted, htmlToText, parseProspectText } from "@/lib/prospect";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Läser objektuppgifter ur ett uppladdat prospekt eller en annonslänk.
 *
 * Hämtningen sker på servern, dels för att webbläsaren inte får hämta andra
 * sidor, dels för att svaret aldrig ska tolkas som något annat än text.
 * Tolkningen returneras för granskning — rutten skriver aldrig i ett projekt.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Ingen fil skickades." }, { status: 400 });
      }
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "Filen är större än 15 MB. Ladda upp ett mindre prospekt." },
          { status: 413 },
        );
      }

      const text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
      if (text.trim().length === 0) {
        return NextResponse.json(
          {
            error:
              "Ingen text kunde läsas ur filen. Är prospektet inskannat som bild går det inte att tolka automatiskt.",
          },
          { status: 422 },
        );
      }

      const extract = parseProspectText(text);
      return NextResponse.json({
        source: file.name,
        kind: "pdf",
        found: countExtracted(extract),
        extract,
      });
    }

    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const target = safeUrl(url);

    if (!target) {
      return NextResponse.json(
        { error: "Länken måste vara en fullständig http- eller https-adress." },
        { status: 400 },
      );
    }

    const response = await fetchWithTimeout(target);
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Sidan svarade ${response.status}. Många annonssajter blockerar automatisk hämtning — ladda upp prospektet i stället.`,
        },
        { status: 422 },
      );
    }

    const html = await response.text();
    const extract = parseProspectText(htmlToText(html));

    return NextResponse.json({
      source: target.hostname,
      kind: "url",
      found: countExtracted(extract),
      extract,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel";
    return NextResponse.json({ error: `Kunde inte läsa in objektet: ${message}` }, { status: 500 });
  }
}

/**
 * Bara http och https, och inga adresser som pekar tillbaka in i vårt eget
 * nät — en användare ska inte kunna få servern att hämta interna tjänster.
 */
function safeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]";

  return blocked ? null : url;
}

async function fetchWithTimeout(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Utan en vanlig webbläsarsignatur svarar många annonssajter med 403.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "sv-SE,sv;q=0.9",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * pdf-parse laddas dynamiskt så att pdfjs inte dras in i bygget för de
 * anrop som bara hämtar en länk.
 */
async function extractPdfText(data: Uint8Array): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
