/**
 * vpn-detect.js — shared frontend VPN heuristics (no data sent to server)
 */
(function () {
  'use strict';

  const COPY = Object.freeze({
    title: 'اتصال VPN شناسایی شد',
    supportMessage:
      'برای استفاده از پشتیبانی آنلاین، لطفاً VPN خود را خاموش کنید و دوباره تلاش نمایید.',
    marketMessage:
      'برای مشاهده نمای بازار، لطفاً VPN خود را خاموش کنید و دوباره تلاش نمایید.',
    checking: 'در حال بررسی اتصال...',
  });

  function isVpnOrg(org) {
    if (!org) return false;
    const o = String(org).toLowerCase();
    const vpnKeywords = [
      'mullvad', 'nordvpn', 'expressvpn', 'surfshark', 'protonvpn',
      'privateinternetaccess', 'ipvanish', 'cyberghost', 'tunnelbear',
      'hotspot shield', 'windscribe', 'hide.me', 'vpn', 'proxy',
      'datacenter', 'hosting', 'digital ocean', 'linode', 'vultr',
      'amazon', 'aws', 'google cloud', 'microsoft azure', 'cloudflare',
      'hetzner', 'ovh', 'leaseweb',
    ];
    return vpnKeywords.some((k) => o.includes(k));
  }

  function fetchWithTimeout(url, opts = {}, timeoutMs = 4000) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return fetch(url, Object.assign({}, opts, { signal: AbortSignal.timeout(timeoutMs) }));
    }
    const c = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    if (c) timer = setTimeout(() => c.abort(), timeoutMs);
    return fetch(url, Object.assign({}, opts, c ? { signal: c.signal } : {}))
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  async function getLocalIPs() {
    if (typeof RTCPeerConnection === 'undefined') return [];
    return new Promise((resolve) => {
      const ips = [];
      let settled = false;
      const finish = (pc) => {
        if (settled) return;
        settled = true;
        try { pc && pc.close(); } catch (_) {}
        resolve(ips);
      };
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch(() => finish(pc));
        pc.onicecandidate = (e) => {
          if (!e || !e.candidate) {
            finish(pc);
            return;
          }
          const cand = String(e.candidate.candidate || '');
          const match = cand.match(/(\d{1,3}(?:\.\d{1,3}){3}|[a-f0-9]{1,4}(?::[a-f0-9]{0,4}){2,7})/i);
          if (match && match[1] && !ips.includes(match[1])) ips.push(match[1]);
        };
        setTimeout(() => finish(pc), 1500);
      } catch (_) {
        resolve([]);
      }
    });
  }

  async function checkLatencyToIranianServer() {
    const start = Date.now();
    try {
      await fetchWithTimeout('https://www.irna.ir/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
      }, 4000);
      return Date.now() - start;
    } catch (_) {
      return 9999;
    }
  }

  async function checkPublicIP() {
    try {
      const res = await fetchWithTimeout('https://ipapi.co/json/', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }, 4000);
      if (!res || !res.ok) return null;
      const data = await res.json();
      return {
        ip: data.ip || '',
        country: data.country_code || '',
        org: data.org || '',
        is_vpn_asn: isVpnOrg(data.org || ''),
      };
    } catch (_) {
      return null;
    }
  }

  function analyzeTunnelIPs(localIPs) {
    const ips = Array.isArray(localIPs) ? localIPs : [];
    const has192 = ips.some((ip) => /^192\.168\./.test(ip));
    const hasTunnelIP = ips.some((ip) =>
      /^10\./.test(ip) &&
      !/^10\.0\.0\./.test(ip) &&
      !/^10\.1\./.test(ip) &&
      !/^10\.10\./.test(ip)
    );
    return { hasTunnelIP, hasMixedTunnelAndHome: hasTunnelIP && has192 };
  }

  async function detect() {
    const [localIPs, latency, ipInfo] = await Promise.all([
      getLocalIPs(),
      checkLatencyToIranianServer(),
      checkPublicIP(),
    ]);

    let vpnScore = 0;
    const signals = [];
    const ipSignals = analyzeTunnelIPs(localIPs);

    if (ipSignals.hasTunnelIP) {
      vpnScore += 3;
      signals.push('tunnel_ip');
    }
    if (ipSignals.hasMixedTunnelAndHome) {
      vpnScore += 1;
      signals.push('mixed_ips');
    }
    if (latency > 2500) {
      vpnScore += 2;
      signals.push('high_latency');
    }
    if (ipInfo && ipInfo.country && ipInfo.country !== 'IR') {
      vpnScore += 4;
      signals.push('foreign_ip');
    }
    if (ipInfo && ipInfo.is_vpn_asn) {
      vpnScore += 3;
      signals.push('vpn_org');
    }

    return {
      isVPN: vpnScore >= 3,
      score: vpnScore,
      signals,
      localIPs,
      latency,
      ipCountry: ipInfo ? ipInfo.country : null,
    };
  }

  /**
   * Run VPN check with optional loading modal.
   * @param {{ message?: string, failOpen?: boolean }} opts
   * @returns {Promise<boolean>} true if OK to proceed, false if VPN detected
   */
  async function ensureAllowed(opts = {}) {
    const message = opts.message || COPY.marketMessage;
    let loadingToken = null;
    try {
      if (window.DakhlyarModal && typeof window.DakhlyarModal.loading === 'function') {
        loadingToken = window.DakhlyarModal.loading({ message: COPY.checking });
      }
      const result = await detect();
      if (loadingToken && window.DakhlyarModal?.closeLoading) {
        window.DakhlyarModal.closeLoading(loadingToken);
        loadingToken = null;
      }
      if (result && result.isVPN) {
        if (window.DakhlyarModal?.alert) {
          window.DakhlyarModal.alert({
            title: COPY.title,
            message,
            subType: 'error',
            confirmText: 'متوجه شدم',
          });
        }
        return false;
      }
      return true;
    } catch (_) {
      if (loadingToken && window.DakhlyarModal?.closeLoading) {
        window.DakhlyarModal.closeLoading(loadingToken);
      }
      return opts.failOpen !== false;
    }
  }

  window.DakhlyarVpnDetect = {
    detect,
    ensureAllowed,
    COPY,
  };
})();
