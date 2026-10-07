import QRCode from "qrcode";

/** Only Belur Math media links may become a QR — never an arbitrary URL. */
export function isBelurMathUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "belurmath.org" || u.hostname.endsWith(".belurmath.org"));
  } catch {
    return false;
  }
}

/** Base64 PNG data-URI, error-correction H so it still scans after video compression. */
export async function generateBelurQr(sourceUrl: string): Promise<string> {
  if (!isBelurMathUrl(sourceUrl)) throw new Error("QR codes are only generated for belurmath.org links.");
  return QRCode.toDataURL(sourceUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 480,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
