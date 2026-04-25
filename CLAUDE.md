# Sınav Salonu — Claude Code Proje Kuralları

Bu dosya, Claude Code'un bu projede çalışırken uyması gereken proje standartlarını tanımlar.
Her oturumda otomatik olarak okunur.

---

## 🌐 Dil: Türkçe Yorum Zorunluluğu

**Her yeni veya değiştirilen kod parçasına Türkçe açıklama yorumu eklemek zorunludur.**

Bu kural aşağıdaki tüm kod elementleri için geçerlidir:

### Backend (TypeScript)

```typescript
// ─── Doğru yorum stili ───────────────────────────────────────────────────

/**
 * Kullanıcının satın aldığı test paketlerini listeler.
 * Eğitici sahipliğine göre filtreleme yapılabilir.
 */
export class ListMyPurchasesUseCase { ... }

// Sayfa boyutu: varsayılan 20, maksimum 100
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE ?? '20', 10);

// Kullanıcı rollerini normalize et — backend bazen küçük harf döndürür
function normalizeRole(role: string) { ... }
```

### Frontend (JSX / JavaScript)

```jsx
// Sınav türü ID'lerini virgülle birleştir; API query parametresi olarak kullanılır
const examTypeIdsParam = examTypeIds.join(',');

/**
 * Onboarding turunu tamamlandı olarak işaretler.
 * Backend'e kaydeder + session storage'a yazar (aynı oturumda tekrar açılmasın).
 */
export function useCompleteTour() { ... }

{/* Bakım modu aktifken satın alma butonu yerine uyarı bandı göster */}
{!purchasesEnabled && (
  <MaintenanceBanner />
)}
```

### Kural Detayları

| Element | Yorum Tipi | Zorunluluk |
|---------|------------|------------|
| Class / UseCase | JSDoc `/** */` | ✅ Zorunlu |
| Fonksiyon / Hook | JSDoc veya `//` | ✅ Zorunlu |
| Sabit (const/let, önemsiz olmayan) | `//` satır yorumu | ✅ Zorunlu |
| Interface / Type | JSDoc `/** */` | ✅ Zorunlu |
| React component | JSDoc veya satır yorumu | ✅ Zorunlu |
| JSX blokları (koşullu render vb.) | `{/* */}` | ✅ Önemli bloklara |
| shadcn/ui wrapper (accordion, badge…) | — | ❌ Gerekmez |
| Prisma migration SQL | `--` SQL yorumu | ✅ Zorunlu |

### Neyi Yorumlamak Gerekir?

- **Niçin** yapıldığı açık değilse (iş kuralı, edge case, workaround)
- Parametre **ne anlama geliyor** (özellikle boolean flag'ler)
- **Hata yönetimi** mantığı (neden bu hata fırlatılıyor?)
- **Performans kararları** (neden bu indeks, neden bu cache süresi?)
- **Sıralama / limit** gibi magic number'lar
- Karmaşık SQL / Prisma sorguları

### Neyi Yorumlamak Gerekmez?

- Kendini açıklayan basit atamalar (`const name = user.name`)
- Standart React hook kullanımları (`useState`, `useEffect` gibi)
- Import satırları (açık olmadıkça)
- shadcn/ui bileşen implementasyonları

---

## 🏗️ Mimari

```
dal/
├── apps/
│   ├── backend/          # NestJS + Prisma + Clean Architecture
│   │   ├── src/
│   │   │   ├── application/   # Use-case'ler, servisler, policy'ler
│   │   │   ├── domain/        # Entity'ler, interface'ler, tip tanımları
│   │   │   ├── infrastructure/# Prisma repository implementasyonları
│   │   │   ├── nest/          # Controller'lar, DTO'lar, Guard'lar, Module
│   │   │   └── config/        # Ortam değişkenleri, DB URL, Redis
│   │   └── prisma/            # Schema ve migration'lar
│   └── frontend/         # Vite + React + TailwindCSS
│       └── src/
│           ├── api/       # Backend API istemcileri
│           ├── components/# Paylaşılan bileşenler
│           ├── lib/       # Hook'lar, context, yardımcı fonksiyonlar
│           └── pages/     # Sayfa bileşenleri (route başına 1 dosya)
├── infra/                # Docker, nginx
└── docs/                 # Geliştirici belgeleri
```

---

## 🔑 Temel Kurallar

### Backend

- **Clean Architecture**: Use-case'ler domain'e bağımlı, controller'lar use-case'e bağımlı
- **AppError**: İş kuralı hataları `AppError` ile fırlatılır, HTTP koduna controller'da dönüşür
- **Prisma singleton**: Constructor injection yoksa `import { prisma } from '../../infrastructure/database/prisma'` kullan
- **Kill-switch pattern**: Admin ayarları `adminSettings.purchasesEnabled` gibi boolean flag'ler; `=== false` kontrol et (fail-open)
- **Migrations**: Her şema değişikliği için `apps/backend/prisma/migrations/` altına SQL migration ekle

### Frontend

- **useServiceStatus()**: Kill-switch flag'lerini `staleTime: 60s`, `placeholderData: DEFAULTS` (fail-open) ile çek
- **useOnboarding**: Tur durumu `user[tourKey]` + sessionStorage; tamamlama `PATCH /me/preferences`
- **api client**: Tüm backend istekleri `@/lib/api/apiClient` üzerinden; doğrudan `fetch` kullanma
- **routeRoles.js**: Her yeni sayfa `PAGE_ROLES` nesnesine eklenmeli
- **pages.config.js**: Her yeni sayfa bu dosyaya import + PAGES nesnesine eklenmeli

---

## 📋 Yorum Şablonları

### UseCase

```typescript
/**
 * [İşlem adı] — [kısaca ne yapar]
 *
 * Ön koşullar:
 *   - [gerekli durum / permission]
 *
 * Hata senaryoları:
 *   - [AppError kodu]: [ne zaman fırlatılır]
 */
export class XyzUseCase {
  async execute(...) { ... }
}
```

### React Hook

```js
/**
 * [Hook adı] — [ne döndürür / ne yapar]
 *
 * @param {string} tourKey - TOUR_KEYS sabitlerinden biri
 * @returns {boolean} - tur gösterilmeli mi
 */
export function useXyz(param) { ... }
```

### React Component

```jsx
/**
 * [Bileşen adı] — [ne gösterir / hangi sayfada kullanılır]
 *
 * Props:
 *   steps    : adım tanımları dizisi
 *   onComplete: son adımda tetiklenir
 */
export default function XyzComponent({ steps, onComplete }) { ... }
```
