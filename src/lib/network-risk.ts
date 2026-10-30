// src/lib/network-risk.ts

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
    console.log('[NETWORK] Local/private IP detected → ASN risk = 0');
    return 0;
  }

  console.log('[NETWORK] External IP → querying ip-api.com for:', ip);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,isp,query`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      // NO FALLBACK — throw so checkout returns 503, no false signal written
      throw new Error(`ip-api.com returned status "${data.status}"${data.message ? ` (${data.message})` : ''}`);
    }

    const ispName = (data.isp || '').toUpperCase();
    const telcos = ["MTN", "GLOBACOM", "AIRTEL", "9MOBILE", "ETISALAT"];
    const isLocalTelco = telcos.some(telco => ispName.includes(telco));

    const result = isLocalTelco ? 0 : 1;
    console.log('[NETWORK] ISP:', ispName, '→ ASN risk =', result, isLocalTelco ? '(local telco)' : '(not in major Nigerian telco list)');
    return result;
  } catch (e: any) {
    clearTimeout(timeoutId);
    console.error('[NETWORK DETECTION FAILED]', e.message);
    throw new Error(`NETWORK_LOOKUP_UNAVAILABLE: ${e.message}`);
  }
}