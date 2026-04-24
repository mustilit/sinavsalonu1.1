import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import api from '@/api/dalClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="reset-password-invalid">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Şifre Sıfırla</h1>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-red-600 text-center mb-6">
              Geçersiz bağlantı. Lütfen şifre sıfırlama işlemini baştan başlayın.
            </p>
            <Link to={createPageUrl('ForgotPassword')} className="block w-full">
              <Button type="button" className="w-full bg-indigo-600 hover:bg-indigo-700">
                Şifremi Unuttum
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSubmitted(true);
    } catch (err) {
      setLoading(false);
      const message = err?.response?.data?.message || err?.message || 'Şifre sıfırlanamadı.';
      setError(message);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="reset-password-success">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Şifre Sıfırla</h1>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <p className="text-slate-600 mb-4">
                Şifreniz başarıyla sıfırlanmıştır.
              </p>
              <p className="text-sm text-slate-500 mb-6">
                Artık yeni şifrenizle giriş yapabilirsiniz.
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="reset-password-page">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Şifre Sıfırla</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Şifre Tekrarı</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? 'Sıfırlanıyor...' : 'Şifre Sıfırla'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Bir sorun mu yaşıyorsunuz?{' '}
          <Link to={createPageUrl('Support')} className="text-indigo-600 hover:underline">
            Destek Talep Et
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
