/**
 * useOnboarding - Kullanıcı onboarding tur durumunu yönetir.
 *
 * Tur anahtarları (user preferences JSON'a kaydedilir):
 *   ob_cand_welcome  - Aday karşılama turu
 *   ob_cand_test     - Aday test çözme turu
 *   ob_edu_welcome   - Eğitici karşılama turu
 *   ob_edu_create    - Eğitici test oluşturma turu
 */
import { useCallback } from 'react';
import api from '@/lib/api/apiClient';
import { useAuth } from '@/lib/AuthContext';

export const TOUR_KEYS = {
  CANDIDATE_WELCOME: 'ob_cand_welcome',
  CANDIDATE_TEST: 'ob_cand_test',
  EDUCATOR_WELCOME: 'ob_edu_welcome',
  EDUCATOR_CREATE: 'ob_edu_create',
};

/** sessionStorage anahtarı — mevcut oturumda tamamlananları tut */
const SESSION_KEY = 'dal_completed_tours';

function getSessionCompleted() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
  } catch {
    return {};
  }
}

function markSessionCompleted(tourKey) {
  try {
    const current = getSessionCompleted();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, [tourKey]: true }));
  } catch {}
}

/**
 * Verilen tur görünmeli mi?
 * - Kullanıcı giriş yapmamışsa false
 * - preferences'ta veya bu sessionda tamamlandıysa false
 */
export function useShouldShowTour(tourKey) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return false;
  // preferences merge edilmiş user nesnesinden oku
  if (user[tourKey]) return false;
  // Bu session'da tamamlandıysa da gösterme
  if (getSessionCompleted()[tourKey]) return false;
  return true;
}

/**
 * Bir turu tamamlandı olarak işaretler.
 * Session storage'a yazar (anlık) + backend preferences'a kaydeder (kalıcı).
 */
export function useCompleteTour() {
  const { user } = useAuth();

  return useCallback(async (tourKey) => {
    if (!user) return;
    // Hemen session'a işaretle (aynı session'da tekrar açılmasın)
    markSessionCompleted(tourKey);
    // Backend'e kaydet (fail-safe)
    try {
      await api.patch('/me/preferences', { [tourKey]: true });
    } catch {
      // Sessizce geç — bir sonraki girişte tekrar gösterilebilir
    }
  }, [user]);
}
