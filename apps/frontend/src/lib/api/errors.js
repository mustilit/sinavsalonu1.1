/**
 * Backend error contract parser.
 * Backend format: { error: { code, message, details }, path, timestamp }
 * @see apps/backend/src/nest/filters/http-exception.filter.ts
 */

/** @typedef {{ code?: string; message?: string | string[]; details?: unknown }} ErrorBody */
/** @typedef {{ error?: ErrorBody; path?: string; timestamp?: string }} BackendErrorResponse */

/** UI'da gösterilecek güvenli mesaj map'i - prod'da stack trace basılmaz */
export const SAFE_MESSAGE_MAP = {
  UNAUTHORIZED: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.',
  FORBIDDEN: 'Bu işlem için yetkiniz yok.',
  NOT_FOUND: 'İstenen kaynak bulunamadı.',
  BAD_REQUEST: 'Geçersiz istek.',
  INTERNAL_ERROR: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
  ERR_NETWORK: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.',
  TIMEOUT: 'İstek zaman aşımına uğradı.',
};

/**
 * Backend error response'u parse eder.
 * @param {unknown} data - response.data veya raw body
 * @returns {{ code: string; message: string; details?: unknown }}
 */
export function parseBackendError(data) {
  if (!data || typeof data !== 'object') {
    return { code: 'UNKNOWN', message: 'Beklenmeyen sunucu yanıtı' };
  }
  const body = /** @type {BackendErrorResponse} */ (data);
  const err = body?.error;
  const code = err?.code ?? 'UNKNOWN';
  let message = err?.message;
  if (Array.isArray(message)) message = message[0];
  if (typeof message !== 'string') message = String(message || (SAFE_MESSAGE_MAP.INTERNAL_ERROR ?? 'Bir hata oluştu.'));
  return { code, message, details: err?.details };
}

/**
 * Axios/fetch hata nesnesinden güvenli UI mesajı üretir.
 * Prod'da stack trace veya hassas detay gösterilmez.
 * @param {unknown} err - Hata nesnesi
 * @param {{ isProd?: boolean }} opts
 * @returns {string}
 */
export function toSafeMessage(err, opts = {}) {
  const isProd = opts.isProd ?? (import.meta.env?.PROD ?? false);
  if (err?.response?.data) {
    const { code, message } = parseBackendError(err.response.data);
    const safe = SAFE_MESSAGE_MAP[code];
    if (isProd && safe) return safe;
    return message || safe || SAFE_MESSAGE_MAP.INTERNAL_ERROR;
  }
  if (err?.code === 'ERR_NETWORK' || err?.message?.includes?.('Network') || err?.message?.includes?.('EMPTY_RESPONSE')) {
    return SAFE_MESSAGE_MAP.ERR_NETWORK;
  }
  if (err?.message?.includes?.('timeout') || err?.name === 'AbortError') {
    return SAFE_MESSAGE_MAP.TIMEOUT;
  }
  if (isProd) return SAFE_MESSAGE_MAP.INTERNAL_ERROR;
  return err?.message || SAFE_MESSAGE_MAP.INTERNAL_ERROR;
}
