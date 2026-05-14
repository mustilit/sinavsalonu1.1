---
name: exam-domain
description: Sinav Salonu domain modeli — Test/ExamTest, ExamQuestion, Attempt, User (STUDENT/EDUCATOR/ADMIN), Purchase, TestPackage, AdminSettings, BackupLog, DiscountCode, AdPackage. Yeni özellik veya veri modeli üzerinde çalışırken referans alın.
---

# Sinav Salonu — Domain Modeli

## Amaç

Test/sınav pazar yeri. Educator (eğitici) sınav (test) oluşturur ve fiyatlandırır. Student (öğrenci) sınavı satın alır, çözer, skorunu görür. Admin yönetim ve moderasyon yapar.

## Temel Varlıklar

### User
Tüm kullanıcıların temel kaydı.

- `id, email, name, role (STUDENT | EDUCATOR | ADMIN), passwordHash, createdAt, updatedAt`
- **Önemli:** Bu projede AUTHOR terimi **kullanılmaz** — yazar/eğitici daima `EDUCATOR`.
- Worker permissions sistemi var (`apps/backend/src/nest/guards/WorkerPermissions`) — admin alt rolleri için.

### Test (ExamTest)
Satılabilir test paketi. Domain'de `Test`, koddaki tip `ExamTest` olarak görülebilir.

- `id, title, description, price, durationMinutes, educatorId, publishedAt (nullable), createdAt, updatedAt`
- `publishedAt = null` → taslak. Listelemede görünmez, satın alınamaz.
- `questions[]` ilişkisi: ExamQuestion[].
- Aktif satış varken silinemez (Purchase tablosundaki referanslar).

### TestPackage
Birden fazla Test'i bir araya getiren paket.

- `id, title, price, educatorId, tests[]`
- `maxTestsPerPackage` admin ayarı ile sınırlandırılır (`AdminSettings`).
- Paket satışı tekil testlerden ayrı bir Purchase modeline yazılabilir veya aynı Purchase tablosunda `packageId` ile ayrılabilir (uygulama detayına göre).

### ExamQuestion (Soru)
Bir teste ait çoktan seçmeli soru.

- `id, examTestId, content, choices (JSON), correctIndex, explanation, orderIndex, points`
- **Choices format:** `[{text: '...', isCorrect: bool}]` veya `[{text: '...'}]` + `correctIndex` ayrı.
- Öğrenciye dönerken `correctIndex` ve `explanation` **yalnızca submit sonrası** servis edilir.
- **Kopya soru tespiti:** Eğitici soru girerken (blur), aynı eğiticinin diğer sorularıyla Jaccard benzerliği ≥ %75 ise amber uyarı gösterilir. Kullanıcı israr ederek devam edebilir.

### Attempt
Bir kullanıcının bir testi çözme oturumu.

- `id, userId, examTestId, startedAt, submittedAt (nullable), score (nullable), status (IN_PROGRESS | SUBMITTED | EXPIRED)`
- Cevaplar: `Answer { attemptId, examQuestionId, selectedIndex, isCorrect, answeredAt }`.
- **Tek aktif attempt:** bir kullanıcı aynı testte aynı anda tek `IN_PROGRESS` sahibi olabilir.
- **Süre kuralı:** `startedAt + durationMinutes < now()` iken submit yoksa `EXPIRED`, skor `answers` üzerinden hesaplanır.

### Purchase
User-Test satın alma ilişkisi, ödeme kaydı.

- `userId, examTestId, paidAt, amount, paymentProvider, providerRef, status, refundedAt (nullable)`
- Composite PK `(userId, examTestId)` — aynı testi iki kez satın alamaz.

### AdminSettings
Admin panelinden yönetilen global ayarlar.

- Komisyon oranı, içerik limitleri (max questions per test, max tests per package), **yedekleme zamanlayıcısı** (saat ve hedef dizin).
- Tek satır mantığı: tablo'da bir kayıt, upsert pattern.

### BackupLog
Veritabanı yedekleme audit log.

- `id, scheduledAt, executedAt, durationMs, sizeBytes, status (SUCCESS | FAILED), targetPath, error (nullable)`
- `BackupSchedulerService` cron olarak çalışır, `pg_dump` → gzip yapar, son 2 gün saklanır.

### DiscountCode
Eğiticinin oluşturduğu indirim kodu.

- `code, educatorId, discountPercent, validFrom, validUntil, usageLimit, usageCount, examTestId (opsiyonel — belirli teste özel)`
- Doğrulama: aktif tarih aralığı + usage limit + (opsiyonel) test eşleşmesi.

### AdPackage / AdPurchase
Reklam paketi ve satın alma kaydı.

- `AdPackage: id, title, durationDays, price, slot (homepage_top, sidebar, etc.)`
- `AdPurchase: id, packageId, educatorId, examTestId, startsAt, endsAt, paidAt, status`
- Yayında olan reklamları gösterirken `now() between startsAt and endsAt` filtresi.

## İş Kuralları

**Yayımlama**
- Sınav yayımlanabilsin diye: en az 1 soru, `price > 0`, title boş olmamalı.
- Yayımlanmış sınavın **soruları/puanları değiştirilemez** (cevap anahtarı değişimi koruması). Başlık/açıklama değişebilir.
- Yayımlanmış sınav unpublish edilebilir (yeni alımları engeller, mevcut purchase/attempt korunur).

**Satın alma**
- Educator kendi yazdığı testi satın alamaz.
- Aynı kullanıcı ikinci kez satın alamaz (DB unique constraint).
- Purchase + Payment kaydı **aynı transaction** içinde.
- Discount code kullanılıyorsa Purchase'a `discountCodeId` ve `discountAmount` yazılır.

**Çözme**
- Satın almayan çözemez (ücretsiz `price = 0` test ayrı senaryo).
- Attempt başladıktan sonra soru listesi dondurulur (sınav yayımdaysa zaten değiştirilemez).
- Submit'te: her cevabın `isCorrect` hesapla, toplam `score = correct/total` veya puan toplamı.
- Süre dolduğunda otomatik `EXPIRED`, skor son cevaplarla hesaplanır.

**Yedekleme**
- AdminSettings'te ayarlanan saatte cron tetiklenir.
- `pg_dump` → gzip → hedef dizin.
- BackupLog tablosuna sonuç + hata yazılır.
- Son 2 gün dışındakiler silinir.

**Rol izinleri**
| Aksiyon | STUDENT | EDUCATOR | ADMIN |
|---------|---------|----------|-------|
| Test listele | ✓ | ✓ | ✓ |
| Test oluştur | - | ✓ | ✓ |
| Kendi testini düzenle | - | ✓ | ✓ |
| Başkasının testini düzenle | - | - | ✓ |
| Test satın al | ✓ | - | - |
| Test çöz | ✓ (satın almışsa) | - | - |
| Discount code yarat | - | ✓ (kendi testleri için) | ✓ |
| Skor görüntüle | kendi | kendi yazdığı + kendi çözdüğü | tüm |
| AdminSettings | - | - | ✓ |
| BackupLog | - | - | ✓ |

## Kenar Durumlar

- **Süre dolduğunda client offline** → server-side `EXPIRED` transition (cron veya kullanıcı görüntülediğinde lazy check).
- **Ödeme iade** → Purchase silinmez, `refundedAt` eklenir. Attempt'lere dokunma — geçmiş skor kalır.
- **Educator silindi** → testleri ortada kalmasın: `archived` flag veya `anonymous-educator` placeholder.
- **Soru sonradan yanlış bulundu** → yayımlanmışta değiştirme. Düzeltme için yeni versiyon (yeni test) yarat. Geçmiş attempt'lere dokunma.
- **Discount code expired ama checkout açıkken kullanıcı submit etti** → backend doğrulamasında reddet, frontend'e taze hata göster.
- **AdPurchase zaman aşımı** → cron veya lazy check ile aktif kümeden çıkar.

## Türkçe-İngilizce Haritası

Kod İngilizce, UI Türkçe. API yanıtları İngilizce alan adlı, frontend'de çevrilir.

| TR | EN | Alan/Tip |
|----|----|--------|
| Sınav | Exam Test | `ExamTest` / `examTest` |
| Soru | Question | `examQuestion` |
| Seçenek | Choice | `choice` |
| Deneme/Çözme | Attempt | `attempt` |
| Skor | Score | `score` |
| Satın alma | Purchase | `purchase` |
| Eğitici | Educator | `educator` (AUTHOR DEĞİL) |
| Öğrenci | Student | `student` |
| Yönetici | Admin | `admin` |
| İndirim kodu | Discount code | `discountCode` |
| Reklam paketi | Ad package | `adPackage` |
| Yedek log | Backup log | `backupLog` |
| Yönetici ayarları | Admin settings | `adminSettings` |

## Notlar

- Yeni varlık eklerken bu dosyayı güncelle. Domain bilgisinin tek kaynağı burası.
- Schema değişimi düşünüyorsan `migration-planner` skill'ine bak.
- API ekleyeceksen `api-contract` skill'i + dalClient.js güncellemesi.
- Form yazıyorsan `form-mutation` skill'i.
- Hata yönetimi `error-handling` skill'i.
- Eski yapıyı bozmamak için `backward-compatibility` skill'i.
