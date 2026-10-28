// src/lib/network-risk.ts

/**
 * Detects if an IP is on a Nigerian telco (MTN, Glo, Airtel, 9Mobile).
 * Returns 0 for local/private IPs and Nigerian telcos, 1 for foreign/unknown.
 * Used by both /api/checkout (commit-time detection) and /api/telemetry (diagnostic).
 */
export async function getNetworkRiskScore(rawIp: string): Promise<number> {
  const ip = (rawIp || '').trim().toLowerCase();

  console.log('[NETWORK] Raw x-forwarded-for:', JSON.stringify(rawIp));
  console.log('[NETWORK] Normalized IP:', JSON.stringify(ip));

  const isLocalOrPrivate =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('::ffff:192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('::ffff:10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('::ffff:172.16.');

  if (isLocalOrPrivate) {
    console.log('[NETWORK] Local/private IP detected → ASN risk = 0 (SAFE)');
    return 0;
  }

  console.log('[NETWORK] External IP → querying ip-api.com for:', ip);

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,isp,query`);
    const data = await response.json();

    if (data.status !== "success") {
      console.log('[NETWORK] ip-api.com failed → defaulting to HIGH RISK (1)');
      return 1;
    }

    const ispName = (data.isp || '').toUpperCase();
    const telcos = ["MTN", "GLOBACOM", "AIRTEL", "9MOBILE", "ETISALAT"];
    const isLocalTelco = telcos.some(telco => ispName.includes(telco));

    const result = isLocalTelco ? 0 : 1;
    console.log('[NETWORK] ISP:', ispName, '→ ASN risk =', result, isLocalTelco ? '(local telco)' : '(foreign/unknown)');
    return result;
  } catch (e) {
    console.error("[NETWORK DETECTION ERROR]", e);
    return 1;
  }
}