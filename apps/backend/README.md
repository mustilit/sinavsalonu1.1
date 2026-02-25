# Dal — Backend (apps/backend)

Kısa açıklama
- Node.js + TypeScript ile yazılmış NestJS tabanlı backend servisidir. Prisma ORM, Redis/BullMQ kuyrukları ve JWT tabanlı auth kullanır. Swagger/OpenAPI dokümantasyonu mevcuttur.

Hızlı başlangıç (local)
1. Gereksinimler
   - Node.js (16+ veya 18+)
   - npm veya yarn
   - PostgreSQL (veya proje konfigürasyonunda kullanılan DB)
   - Redis (kuyruklar için, geliştirme/worker)

2. Kurulum
   cd apps/backend
   npm install

3. Ortam değişkenleri
   Bir .env dosyası oluşturun (ör. `.env.local` veya `.env`) ve aşağıdaki değişkenleri sağlayın:

   DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
   JWT_SECRET=verysecret
   CLIENT_URL=http://localhost:3000
   PORT=3000
   NODE_ENV=development
   REDIS_URL=redis://localhost:6379

   Not: PowerShell kullanıyorsanız script'leri çalıştırmadan önce `$env:JWT_SECRET = "..."` biçiminde environment set edebilirsiniz.

4. Veritabanı (Prisma)
   - Prisma client oluşturma:
     npx prisma generate
   - Migration / seed (DB hazırsa):
     npx prisma migrate dev

Çalıştırma
- Hızlı (ts-node ile)
  - PowerShell:
    $env:NODE_ENV = 'development'
    npx ts-node src/nest/main.ts

- Derlenmiş / production benzeri
  npm run build
  npm start

Not: CI / prod için build -> dist/ altında çalıştırma şekli tercih edilir.

Testler
- Unit / integration:
  npm run test

API dokümantasyonu (Swagger / OpenAPI)
- Swagger UI (development): /docs (main.ts içinde yalnızca NODE_ENV !== 'production' için aktif)
- OpenAPI JSON export (kodgen / mobil/web için):
  npm run openapi:export
  Çıktı: `apps/backend/openapi.json`
  (Windows PowerShell kullanıyorsanız `$env:NODE_ENV='development'; npx ts-node src/nest/swagger/export-openapi.ts` ile de çalıştırabilirsiniz)

Ana mimari ve klasörler
- `src/nest/` — Nest bootstrap, controller'lar, swagger yardımcıları
  - `main.ts` — app bootstrap, global pipes/guards/filters, Swagger setup
  - `swagger/` — `error-envelope.ts` (hata şeması), `decorators.ts` (ApiErrorResponses helper), `export-openapi.ts`
  - `controllers/` — HTTP entrypoint controller'lar (home, reviews, educators, notifications, follows, ...)
  - `modules/` — domain-specific module'lar (marketplace, attempts, refunds, purchases, ...)
- `application/` — use-case sınıfları (iş mantığı)
- `infrastructure/` — repository implementasyonları (Prisma), queue, servisler (JwtService vb.)
- `tests/` — jest testleri

Swagger / Hata Formatı
- Projede ortak hata şeması `ErrorEnvelopeSchema` ile tanımlıdır. Yeni controller'larda `ApiErrorResponses()` helper kullanılarak tüm yaygın hata durumları (400/401/403/404/409) aynı schema ile dokümante edilir.
- Başarılı yanıtlar için controller metodlarında `@ApiOkResponse({ type: XxxResponseDto })` kullanımı tercih edilir. Response DTO'ları minimal tutulur (sadece shape).

Geliştirme rehberi / iyi uygulamalar
- Yeni endpoint eklerken:
  - Controller üstüne `@ApiTags('…')`
  - Metod üzerine `@ApiOkResponse({ type: XxxResponseDto })`
  - Hata yanıtları için `@ApiErrorResponses()`
  - Eğer auth gerekiyorsa `@ApiBearerAuth('bearer')` ve uygun `@Roles(...)`
- DTO'lar: `controllers/.../dto/*.response.dto.ts` içinde minimal olarak tanımlayın.
- Exception handling: use-case'lerin hata fırlatıp global `HttpExceptionFilter`'ın standarize etmesine izin verin.
- Dependency Injection: Mevcut kodda bazı controller'lar manuel `new` ile repo/uc örnekliyor. Büyük refactor'larda Nest module DI'ya geçirilmeli.

CI önerileri
- Testlerin çalıştığı job sonunda `npm run openapi:export` çalıştırıp `apps/backend/openapi.json`'i artifact olarak upload edin — mobil/web ekipleri için kodgen hazır JSON sağlar.
- Lint adımı yoksa eklenebilir; `npm run build` + `npm run test` temel gereksinim olarak yeterli.

Handover checklist (yeni geliştirici için hızlandırılmış)
1. Repo klonla, `cd apps/backend`, `npm install`
2. .env oluştur/sağla (DB, JWT_SECRET, REDIS)
3. `npx prisma generate` ve gerekirse `npx prisma migrate dev`
4. `npx ts-node src/nest/main.ts` ile servisi ayağa kaldır
5. `/docs`'u açarak Swagger üzerinden endpointleri gözden geçir
6. `npm run openapi:export` ile openapi.json üret

İletişim / notlar
- Kod kalıbı ve stil: TypeScript + NestJS konvansiyonlarına uyun; mümkünse PR'larda küçük, odaklı değişiklikler gönderin.
- Teknik borç: manuel wiring, eksik module DI, ve bazı karmaşık use-case'ler refactor için öncelikli konular.

İsterseniz bu README'ye:
- .env.example dosyası,
- geliştirme için PowerShell script'leri (dev-run.ps1),
- veya CONTRIBUTING.md ekleyebilirim. Hangi eklemeleri istersiniz?

