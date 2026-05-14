# Sinav Salonu

Test marketplace uygulaması. Eğiticiler (educators) sınav (test) oluşturur ve satar; öğrenciler satın alır, çözer, skorlarını takip eder.

## Stack

- **Frontend:** React 18 + Vite, JavaScript (JSX), Tailwind CSS, React Router DOM v6, TanStack Query
- **Backend:** NestJS (REST + DTO + Validation), Clean Architecture (Use Cases katmanı)
- **Veritabanı:** PostgreSQL + Prisma ORM
- **Test:** Vitest + Testing Library (frontend), Jest (NestJS), Playwright (e2e)
- **Paket yöneticisi:** npm (backend ve frontend ayrı `package.json`; kök `package.json` yalnızca Husky + lint-staged içerir)
- **Konteyner:** Docker Compose (geliştirme + üretim + yerel staging)

## Dizin Yapısı (gerçek)

```
apps/
  backend/               → NestJS backend
    src/
      application/
        use-cases/       → İş mantığı buradadır (UseCase sınıfları)
        services/        → Yardımcı servisler (ReviewAggregation vb.)
      domain/
        interfaces/      → Repository arayüzleri
        types.ts         → Domain tipleri (AdminSettings vb.)
      infrastructure/
        repositories/    → Prisma repository implementasyonları
        database/        → Prisma client singleton
      nest/
        controllers/     → HTTP katmanı (ince — iş mantığı YOK)
        controllers/dto/ → DTO sınıfları (class-validator)
        guards/          → JWT, Roles, WorkerPermissions
        decorators/      → @Public, @Roles, @WorkerPermissions
        modules/         → NestJS modülleri (cron, vb.)
        services/        → BackupSchedulerService vb. NestJS servisleri
    prisma/
      schema.prisma      → Tek şema dosyası
      migrations/        → Numbered migration SQL dosyaları
  frontend/              → React/Vite frontend
    src/
      pages/             → Sayfa bileşenleri (Her route bir dosya)
      components/        → Paylaşılan React bileşenleri
        layout/          → Sidebar, Header, Layout
        ui/              → Radix UI primitive'leri (shadcn tarzı)
        test/            → Test'e özgü bileşenler
      api/
        dalClient.js     → Tüm API çağrıları burada merkezi
      lib/               → Util fonksiyonları, hook'lar
      pages.config.js    → Sayfa-route eşlemesi
      lib/routeRoles.js  → Sayfa bazlı rol erişim kontrolü
infra/
  docker/
    docker-compose.yml            → Geliştirme ortamı
    docker-compose.prod.yml       → Üretim ortamı
    docker-compose.local-staging.yml → Yerel staging ortamı
    backend.Dockerfile
    frontend.Dockerfile           → Nginx tabanlı (CSP başlıkları dahil)
  nginx/
    default.conf         → CSP-Report-Only, SPA fallback, gzip, asset cache
scripts/
  staging.sh             → Yerel staging ortamı yönetim betiği
.github/
  dependabot.yml         → Otomatik bağımlılık güncelleme (haftalık, gruplu)
  workflows/             → CI/CD
.husky/
  pre-commit             → Backend tsc + frontend lint-staged
.lintstagedrc.cjs        → Staged JS/JSX dosyaları için ESLint
```

## Domain Sözlüğü

- **Test (ExamTest):** Satılabilir sınav paketi. Alanlar: `title`, `description`, `price`, `durationMinutes`, `questions[]`
- **TestPackage:** Birden fazla Test'i bir araya getiren paket. `maxTestsPerPackage` admin ayarı ile sınırlandırılır.
- **ExamQuestion (Soru):** Teste ait çoktan seçmeli soru. Alanlar: `content`, `choices[]`, `correctIndex`, `explanation`
- **Attempt (Deneme):** Kullanıcının bir sınavı çözme oturumu.
- **User:** Rol `STUDENT | EDUCATOR | ADMIN`. Educator sınav yazar ve satar. AUTHOR terimi kullanılmaz.
- **Purchase:** Kullanıcı-Test ilişkisi, ödeme kaydı.
- **AdminSettings:** Admin panelinden yönetilen global ayarlar (komisyon, içerik limitleri, **yedekleme zamanlayıcısı**).
- **BackupLog:** Veritabanı yedekleme sonuçlarının audit log kaydı.
- **DiscountCode:** Eğiticinin oluşturduğu indirim kodu.
- **AdPackage / AdPurchase:** Reklam paketi ve satın alma kaydı.

## Komutlar

```bash
# Backend
cd apps/backend
npm run dev           # tsx watch ile geliştirme
npm test              # Jest unit testleri
npm run db:migrate    # prisma migrate dev

# Frontend
cd apps/frontend
npm run dev           # Vite dev server
npm test              # Vitest
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit (jsconfig.json)

# Yerel Staging (repo kökünden)
./scripts/staging.sh up          # Derle ve başlat
./scripts/staging.sh down        # Durdur
./scripts/staging.sh reset       # DB sıfırla
./scripts/staging.sh logs        # Canlı log
```

## Kodlama Kuralları

**Backend**
- Controller ince — yalnızca HTTP ↔ UseCase köprüsü. İş mantığı Use Case'te.
- Her endpoint için `Use Case` sınıfı (`apps/backend/src/application/use-cases/`).
- DTO'lar `class-validator` ile, her endpoint için ayrı. `apps/backend/src/nest/controllers/dto/`.
- Prisma query'leri yalnızca Repository veya Use Case içinde — controller'da direkt Prisma yasak.
- Birden fazla tablo değişiyorsa `prisma.$transaction`.
- Async fonksiyonlar `try/catch` yerine NestJS exception filter'a güvensin.

**Frontend**
- Fonksiyonel component, named export. Varsayılan export yok.
- API çağrıları yalnızca `dalClient.js` üzerinden — component'te direkt `fetch`/`axios` yasak.
- Sayfalar `apps/frontend/src/pages/` altında; her route bir `.jsx` dosyası.
- Rol kontrolü `apps/frontend/src/lib/routeRoles.js` ile merkezi yapılır.
- Tailwind utility-first. Dinamik class ismi üretme (`bg-${color}-500`) yasak.

**Genel**
- Türkçe/İngilizce: kod İngilizce, UI Türkçe, yorumlar Türkçe olabilir.
- Pre-commit hook otomatik çalışır: backend `tsc --noEmit` + frontend ESLint (staged dosyalar).

## Yeni Özellikler (son eklenenler)

- **Yedekleme zamanlayıcısı:** Admin panelinden saat ve dizin seçilerek otomatik `pg_dump` → gzip yedekleme. Son 2 gün saklanır. `BackupLog` tablosuna sonuç yazılır.
- **Kopya soru tespiti:** Eğitici soru girerken (blur), aynı eğiticinin diğer sorularıyla Jaccard benzerliği ≥ %75 ise amber uyarı gösterilir. Israr ederek devam edilebilir.
- **Nginx (CSP):** Frontend `Content-Security-Policy-Report-Only` başlığıyla sunulur. `infra/nginx/default.conf`.
- **Yerel staging:** `docker-compose.local-staging.yml` + `scripts/staging.sh` ile izole lokal test ortamı.

## Delege Rehberi

| Task tipi | Agent |
|---|---|
| Kod inceleme / PR review | `code-reviewer` |
| Unit/integration test | `test-writer` |
| Playwright e2e test | `e2e-writer` |
| Yeni sayfa, form, UI bileşeni | `ui-builder` |
| Yeni endpoint, şema, Use Case | `backend-architect` |
| Duplikasyon temizliği, isim refaktörü | `refactor-specialist` |
| Mimari karar, kütüphane seçimi | `advisor` |

## Slash Komutlar

- `/ship "<commit-mesajı>"` — typecheck + lint + test + commit + push zinciri

## İmportlar

@.claude/skills/exam-domain/SKILL.md  <!-- domain modeli detayları -->
