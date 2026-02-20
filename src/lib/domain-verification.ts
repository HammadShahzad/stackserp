/**
 * Domain Verification
 * Supports DNS TXT record and HTML meta tag verification methods.
 */
import crypto from "crypto";
import dns from "dns/promises";

const VERIFICATION_PREFIX = "stackserp-verify";

/**
 * Deterministic verification token derived from websiteId.
 * Stable so the user always sees the same token for their site.
 */
export function generateVerificationToken(websiteId: string): string {
  return crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET || "stackserp-salt")
    .update(websiteId)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Check for a TXT record `stackserp-verify=<token>` on the domain.
 */
export async function verifyDnsTxt(domain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(domain);
    const expected = `${VERIFICATION_PREFIX}=${token}`;
    return records.some((parts) => parts.join("") === expected);
  } catch {
    return false;
  }
}

/**
 * Fetch the domain homepage and look for
 * <meta name="stackserp-verify" content="<token>">
 */
export async function verifyMetaTag(domain: string, token: string): Promise<boolean> {
  try {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "StackSerp-Verifier/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return false;

    const html = await res.text();
    const pattern = new RegExp(
      `<meta\\s+name=["']${VERIFICATION_PREFIX}["']\\s+content=["']${token}["']`,
      "i"
    );
    const patternReversed = new RegExp(
      `<meta\\s+content=["']${token}["']\\s+name=["']${VERIFICATION_PREFIX}["']`,
      "i"
    );
    return pattern.test(html) || patternReversed.test(html);
  } catch {
    return false;
  }
}

/**
 * Try both verification methods and return the first that succeeds.
 */
export async function verifyDomain(
  domain: string,
  websiteId: string
): Promise<{ verified: boolean; method?: "dns" | "meta" }> {
  const token = generateVerificationToken(websiteId);

  const [dnsOk, metaOk] = await Promise.all([
    verifyDnsTxt(domain, token),
    verifyMetaTag(domain, token),
  ]);

  if (dnsOk) return { verified: true, method: "dns" };
  if (metaOk) return { verified: true, method: "meta" };
  return { verified: false };
}
