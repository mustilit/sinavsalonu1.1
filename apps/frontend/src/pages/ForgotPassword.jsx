import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import api from '@/api/dalClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * ForgotPassword (Şifremi Unuttum) sayfası — e-posta adresiyle
 * şifre sıfırlama bağlantısı talep etmeyi sağlar.
 * Gönderim başarılıysa kullanıcıya onay ekranı gösterilir.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  // Form gönderim yüklenme durumu
  const [loading, setLoading] = useState(false);
  // API isteği başarıyla tamamlandığında true — onay ekranına geçiş sağlar
  const [submitted, setSubmitted] = useState(false);

  // Şifre sıfırlama e-postası gönderir; hata varsa kullanıcıya gösterir
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setLoading(false);
      const message = err?.response?.data?.message || err?.message || 'İstek gönderilemedi.';
      setError(message);
    }
  };

  {/* E-posta gönderildikten sonra gösterilen onay ekranı */}
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="forgot-password-success">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Şifremi Unuttum</h1>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <p className="text-slate-600 mb-4">
                E-postanızı kontrol edin. Şifre sıfırlama bağlantısı gönderildi.
              </p>
              <p className="text-sm text-slate-500 mb-6">
                Bağlantı 24 saat için geçerlidir.
              </p>
            </div>
            <Link to={createPageUrl('Login')} className="block w-full">
              <Button type="button" className="w-full bg-indigo-600 hover:bg-indigo-700">
                Giriş Yap
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Şifremi Unuttum</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              required
              className="w-full"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? 'Gönderiliyor...' : 'Şifre Sıfırla'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Hatırladınız mı?{' '}
          <Link to={createPageUrl('Login')} className="text-indigo-600 hover:underline">
            Giriş Yap
          </Link>
        </p>
        <p className="mt-2 text-center">
          <Link to={createPageUrl('Home')} className="text-sm text-slate-500 hover:text-slate-700">
            ← Ana sayfaya dön
          </Link>
        </p>
      </div>
    </div>
  );
}
