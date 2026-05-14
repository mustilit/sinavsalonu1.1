---
name: react-component
description: React 18 + Vite + JavaScript (JSX) component pattern'leri — component yapısı, React Router DOM v6 routing, TanStack Query data fetching, form, error/loading state. Yeni component, sayfa, form yazılırken referans alın. Stack: React + Vite, TypeScript YOK, Server Action YOK.
---

# React Component Pattern'leri (Vite + JS Stack)

Sinav Salonu stack'i: React 18, Vite, JavaScript (JSX), Tailwind, Radix UI primitives (`shadcn/ui` tarzı), React Router DOM v6, TanStack Query, dalClient.js.

**Önemli:** Bu proje **Next.js DEĞİL.** Server Component, Server Action, App Router yok. SPA — her şey client-side.

## Component Konvansiyonu

```jsx
// apps/frontend/src/components/exam/ExamCard.jsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function ExamCard({ exam, onPurchase }) {
  return (
    <article className="rounded border p-4 space-y-2">
      <h3 className="font-semibold">{exam.title}</h3>
      <p className="text-sm text-muted-foreground">{exam.description}</p>
      <div className="flex items-center justify-between">
        <span className="font-bold">{exam.price} ₺</span>
        <Link to={`/exams/${exam.id}`}>
          <Button variant="secondary">İncele</Button>
        </Link>
        <Button onClick={() => onPurchase(exam.id)}>Satın Al</Button>
      </div>
    </article>
  );
}
```

Kurallar:
- **Named export.** Varsayılan export yasak.
- **JSX uzantısı:** `.jsx` (component) veya `.js` (util/hook).
- **Props destructure:** fonksiyon imzasında.
- **Konum:** `apps/frontend/src/components/<domain>/<ComponentName>.jsx` — domain = exam, question, attempt, user, payment, layout, ui.
- **Tailwind utility-first.** Dinamik class ismi yasak (`bg-${color}-500` JIT'i kırar).

## Sayfa (Page)

Sayfa = route hedefi. `apps/frontend/src/pages/` altında, `pages.config.js` ile route'a bağlanır.

```jsx
// apps/frontend/src/pages/ExamDetailPage.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dalClient } from '@/api/dalClient';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { ExamDetail } from '@/components/exam/ExamDetail';

export function ExamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ['exams', id],
    queryFn: () => dalClient.exams.get(id),
    enabled: Boolean(id),
  });

  if (isLoading) return <Spinner />;
  if (error?.status === 404) return <ErrorState title="Sınav bulunamadı" />;
  if (error) return <ErrorState title="Bir hata oluştu" message={error.message} />;

  return <ExamDetail exam={exam} onBack={() => navigate(-1)} />;
}
```

Sayfa component'i:
- Route param'larını okur (`useParams`)
- Data'yı TanStack Query ile çeker
- Loading + error UI verir
- Asıl render'ı bir alt component'e delege eder (test edilebilirlik)

## Routing (React Router v6)

Sinav Salonu'nda routing iki yerde tanımlı:
- `apps/frontend/src/pages.config.js` — sayfa-route eşlemesi
- `apps/frontend/src/lib/routeRoles.js` — rol bazlı erişim

```js
// pages.config.js (sözleşme örneği)
import { ExamListPage } from './pages/ExamListPage';
import { ExamDetailPage } from './pages/ExamDetailPage';
import { ExamCreatePage } from './pages/ExamCreatePage';

export const pages = [
  { path: '/exams', element: <ExamListPage />, roles: ['STUDENT', 'EDUCATOR', 'ADMIN'] },
  { path: '/exams/:id', element: <ExamDetailPage />, roles: ['STUDENT', 'EDUCATOR', 'ADMIN'] },
  { path: '/exams/create', element: <ExamCreatePage />, roles: ['EDUCATOR', 'ADMIN'] },
];
```

Yeni sayfa eklerken:
1. `pages/<Name>Page.jsx` oluştur
2. `pages.config.js`'e ekle
3. `routeRoles.js`'de erişim kuralı varsa belirle

## Data Fetching — TanStack Query

```jsx
import { useQuery } from '@tanstack/react-query';
import { dalClient } from '@/api/dalClient';

// Liste
const { data: exams = [], isLoading } = useQuery({
  queryKey: ['exams', { status: 'PUBLISHED' }],
  queryFn: () => dalClient.exams.list({ status: 'PUBLISHED' }),
  staleTime: 60_000,  // 1 dakika fresh kalır
});

// Tekil
const { data: exam } = useQuery({
  queryKey: ['exams', id],
  queryFn: () => dalClient.exams.get(id),
  enabled: Boolean(id),  // id yoksa fetch etme
});

// Bağımlı query (önceki sonuç sonrakine girdi)
const { data: questions } = useQuery({
  queryKey: ['questions', exam?.id],
  queryFn: () => dalClient.questions.list(exam.id),
  enabled: Boolean(exam),
});
```

**Query Key Hiyerarşisi (proje sözleşmesi):**
- `['exams']` → tüm exam listeleri (en üst)
- `['exams', { status: 'PUBLISHED' }]` → filtre
- `['exams', 'mine']` → kullanıcının kendi
- `['exams', id]` → tekil
- `['questions', examId]` → ilişkili
- `['attempts', userId, examId]` → derin filtre

Mutation sonrası `invalidateQueries({ queryKey: ['exams'] })` tüm prefix'leri invalidate eder.

## Form (Mutation)

Form pattern detayları için **`form-mutation`** skill'ine bak. Özet:

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { z } from 'zod';
import { dalClient } from '@/api/dalClient';

export function CreateExamForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState({});

  const createExam = useMutation({
    mutationFn: (data) => dalClient.exams.create(data),
    onSuccess: (exam) => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      navigate(`/exams/${exam.id}`);
    },
    onError: (err) => {
      if (err.fieldErrors) setErrors(err.fieldErrors);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = ExamSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    createExam.mutate(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* fields */}
      <button type="submit" disabled={createExam.isPending}>
        {createExam.isPending ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  );
}
```

## Error Boundary

Render-time hatalar için global boundary:

```jsx
// apps/frontend/src/components/ErrorBoundary.jsx
import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info);
    // Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-8 text-center">
          <h2>Bir şeyler ters gitti</h2>
          <button onClick={() => this.setState({ hasError: false })}>Tekrar dene</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Layout'un en dışına sar, route'lar için ayrı boundary kullanabilirsin.

## Loading State

**Spinner:** kısa loading (<1s) için.
**Skeleton:** liste veya kart layout'u korumak için (>1s, kullanıcı yapı bekliyor).

```jsx
// Skeleton örneği
function ExamCardSkeleton() {
  return (
    <div className="rounded border p-4 animate-pulse space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

// Kullanım
{isLoading
  ? Array.from({ length: 6 }).map((_, i) => <ExamCardSkeleton key={i} />)
  : exams.map((e) => <ExamCard key={e.id} exam={e} />)
}
```

## Accessibility

- `getByRole` ile bulunabilen semantic HTML kullan: `<button>` `<form>` `<input>` `<nav>` `<main>` `<article>`.
- Form input'larında `<label htmlFor>` veya `aria-label`.
- Hata mesajları `role="alert"`.
- Modal/Dialog için Radix UI primitives — focus trap dahil hazır.
- Renk kontrastı: Tailwind text/bg pair'ları AA için yeterli, eski custom renklerde axe-core kontrol et.

## Yapmayacakların

- Component içinde direkt `fetch`/`axios` — `dalClient` kullan.
- `useEffect` içinde fetch — TanStack Query kullan.
- `<a href>` SPA içi navigation için — `<Link to>` kullan.
- Button olmayan element'e onClick — accessibility kırar.
- `style` inline — Tailwind kullan.
- Tailwind dinamik class (`bg-${color}-500`) — JIT taramaz.
- Default export.
- Server Component / Server Action öner — bu proje SPA.

## Hızlı Tanı — "Component Render Olmuyor"

| Belirti | Sebep |
|---------|-------|
| Boş ekran | Error throw etmiş, ErrorBoundary yutmuş veya yok |
| Sürekli yükleniyor | Query başarılı ama isLoading false dönmüyor — `enabled` kontrolü |
| Veri eski kalıyor | invalidateQueries yanlış key veya çağrılmamış |
| 404 sayfası açılıyor | Route tanımlı değil veya path yanlış |
| Component import error | Default export beklendiği yerde named (veya tersi) |
| Tailwind class çalışmıyor | Dinamik class oluşturmuş, JIT göremiyor |
| Click çalışmıyor | onClick yanlış element'te (parent veya wrapper'da) |

## Checklist (her component için)

- [ ] Named export mu?
- [ ] Props destructure ediliyor mu?
- [ ] Loading + error state'leri var mı?
- [ ] Semantic HTML + aria attribute'ları yerli yerinde mi?
- [ ] Tailwind dinamik class yok, sabit utility'ler mi?
- [ ] Component testi var mı (Vitest + Testing Library)?
- [ ] Mutation varsa form-mutation skill checklist'i çalıştırıldı mı?

Skill'ler: `form-mutation` form akışı için, `error-handling` hata yönetimi için, `api-contract` endpoint sözleşmesi için.
