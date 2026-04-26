/**
 * useAutoSave — Form verisini belirli aralıklarla localStorage'a otomatik yedekler.
 *
 * Kullanım:
 *   const { save, hasDraft, loadDraft, clearDraft } = useAutoSave(
 *     'create_test_user123',
 *     () => formData,
 *   );
 *
 * Mount'ta hasDraft() ile taslak var mı kontrol et.
 * loadDraft() ile veriyi al (savedAt zaman bilgisi ile birlikte).
 * clearDraft() ile başarılı kayıt sonrası taslağı sil.
 *
 * @param {string}       draftKey    - Benzersiz taslak anahtarı
 * @param {() => object} getFormData - Anlık form verisini döndüren fonksiyon
 * @param {object}       [options]
 * @param {boolean}      [options.enabled]          - Auto-save aktif mi (default: true)
 * @param {number}       [options.intervalMs]       - Kayıt aralığı ms (default: 30000)
 */
import { useEffect, useRef, useCallback } from 'react';

const DRAFT_PREFIX    = 'autosave_';
const DEFAULT_INTERVAL_MS = 30_000; // 30 saniye

export function useAutoSave(draftKey, getFormData, {
  enabled     = true,
  intervalMs  = DEFAULT_INTERVAL_MS,
} = {}) {
  // localStorage anahtarı
  const storageKey    = `${DRAFT_PREFIX}${draftKey}`;
  const intervalRef   = useRef(null);
  // getFormData her render'da yeniden oluşabilir; ref üzerinden tüket
  const getFormRef    = useRef(getFormData);
  useEffect(() => { getFormRef.current = getFormData; }, [getFormData]);

  // ─── Kaydet ─────────────────────────────────────────────────────────────

  const save = useCallback(() => {
    if (!enabled) return;
    try {
      const data = getFormRef.current?.();
      if (data == null) return;
      localStorage.setItem(storageKey, JSON.stringify({
        data,
        savedAt: new Date().toISOString(),
      }));
    } catch {
      // localStorage doluysa veya erişilemiyorsa sessizce geç
    }
  }, [storageKey, enabled]);

  // ─── Taslak sorgulama ────────────────────────────────────────────────────

  /**
   * localStorage'da bu anahtara ait taslak var mı?
   * @returns {boolean}
   */
  const hasDraft = useCallback(() => {
    try {
      return !!localStorage.getItem(storageKey);
    } catch {
      return false;
    }
  }, [storageKey]);

  /**
   * Taslağı yükle.
   * @returns {{ data: object, savedAt: string } | null}
   */
  const loadDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [storageKey]);

  /**
   * Taslağı sil (başarılı API kaydı sonrası çağırılır).
   */
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  // ─── Periyodik kayıt ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    intervalRef.current = setInterval(save, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [save, enabled, intervalMs]);

  // ─── Sayfa kapatılırken son kayıt ────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [save, enabled]);

  return { save, hasDraft, loadDraft, clearDraft };
}
