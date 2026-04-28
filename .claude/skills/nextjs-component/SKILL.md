---
name: nextjs-component
description: Next.js 14 App Router bileşen pattern'leri — Server/Client ayrımı, Server Action, form, data fetching, error boundary, loading state. Yeni component/page/layout yazılırken referans alın.
---

# Next.js Component Pattern'leri

## Server mi, Client mi?

**Server Component (varsayılan)**
- Data fetching yapan sayfalar
- Static içerik
- Metadata dönen bileşenler
- Hassas veri işleyen kod (API key, DB erişimi)

**Client Component (`'use client'`)**
- `useState`, `useEffect`, `useReducer`
- Event handler (onClick, onChange, onSubmit — form action hariç)
- Browser API (localStorage, window, navigator)
- 3rd party hook'lar

**Karma strateji:** Server parent → Client child. Server component client'a props geçirebilir (serializable olmak şartıyla). Client component içinde Server Component `children` olarak alınabilir.

## Sayfa (Page)

```tsx
// apps/web/app/exam/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getExam } from '@/lib/exam';
import { ExamDetail } from '@/components/exam/ExamDetail';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props) {
  const exam = await getExam(params.id);
  return { title: exam?.title ?? 'Sınav bulunamadı' };
}

export default async function ExamPage({ params }: Props) {
  const exam = await getExam(params.id);
  if (!exam) notFound();
  return <ExamDetail exam={exam} />;
}
```

## Loading ve Error

```tsx
// apps/web/app/exam/[id]/loading.tsx
export default function Loading() {
  return <div role="status" aria-live="polite">Yükleniyor…</div>;
}

// apps/web/app/exam/[id]/error.tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <p>Bir şeyler ters gitti: {error.message}</p>
      <button onClick={reset}>Tekrar dene</button>
    </div>
  );
}
```

## Server Action + Form

```tsx
// apps/web/lib/actions/exam.ts
'use server';
import { revalidatePath } from 'next/cache';
import { createExamSchema } from '@/lib/schemas';

export async function createExam(prev: State, formData: FormData) {
  const parsed = createExamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  // DB call...
  revalidatePath('/exam');
  return { error: null };
}
```

```tsx
// apps/web/components/exam/ExamForm.tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { createExam } from '@/lib/actions/exam';

const initial = { error: null };

export function ExamForm() {
  const [state, action] = useFormState(createExam, initial);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm">Başlık</span>
        <input name="title" required className="border p-2 w-full" />
      </label>
      <SubmitButton />
      {state.error && <FieldErrors errors={state.error} />}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? 'Kaydediliyor…' : 'Kaydet'}</button>;
}
```

## Data Fetching

Server Component'te direkt `await`. Suspense ile parallel data:

```tsx
export default async function Page() {
  const [exam, stats] = await Promise.all([getExam(id), getStats(id)]);
  return <>…</>;
}
```

Client'ta gerekiyorsa **SWR** veya **TanStack Query** (proje hangisini kullanıyorsa; karıştırma).

## Dizin Konvansiyonu

```
components/
  ui/                    → primitive: Button, Input, Card, Dialog
  <domain>/              → domain component'leri: exam/, question/
  layout/                → Header, Footer, Sidebar
```

## Kaçın

- `'use client'`'i sayfanın en tepesine koymak (tüm ağaç client olur). Mümkün olduğunca aşağıya it.
- `useEffect` içinde fetch — Server Component'e taşı.
- `next/link` yerine `<a>` — client navigation bozulur.
- Tailwind'de dinamik class inşası (`bg-${color}-500`) — JIT tarayamaz. Map kullan.
