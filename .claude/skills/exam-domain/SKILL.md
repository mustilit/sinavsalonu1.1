---
name: exam-domain
description: Sinav Salonu domain modeli — Test, ExamQuestion, Attempt, User, Purchase ve AdminSettings varlıkları, aralarındaki ilişkiler ve iş kuralları. Yeni özellik veya veri modeli üzerinde çalışırken referans alın.
---

# Sinav Salonu — Domain Modeli

## Amaç

Test/sınav pazar yeri. Educator (eğitici) sınav oluşturur ve fiyatlandırır. Student (öğrenci) sınavı satın alır, çözer, skorunu görür. Admin yönetim yapar.

> **Not:** Kod tabanında rol adı `EDUCATOR`'dır. `AUTHOR` terimi kullanılmaz.

## Varlıklar

### User
Tüm kullanıcıların temel kaydı.

- `id, email, name, role (STUDENT | EDUCATOR | ADMIN), passwordHash, createdAt, updatedAt`
- Educator hem sınav yazıp hem öğrenci olarak çözebilsin istenirse ikincil rol alanı veya izinler tablosu gerekir.

### ExamTest (Test)
Satılabilir sınav paketi.

- `id, title, description, price, durationMinutes, educatorId, status (DRAFT | PUBLISHED | UNPUBLISHED), createdAt, updatedAt`
- `status = DRAFT` → listelemede görünmez, satın alınamaz.
- `questions[]` ilişkisi — silinirken cascade değil, test aktif satıştaysa silinemez.

### TestPackage
Birden fazla Test'i bir araya getiren paket (bundle).

- `id, title, educatorId, tests[]`
- Her pakete eklenebilecek maksimum Test sayısı `AdminSettings.maxTestsPerPackage` ile sınırlandırılır (varsayılan: 10). Bu kontrol test-paket atama noktasında yapılır.

### ExamQuestion (Soru)
Bir teste ait soru.

- `id, testId, content, choices (JSON), correctIndex, explanation, orderIndex, points`
- `choices` JSON olarak saklanır: `[{text, isCorrect}]`.
- Öğrenciye dönerken `correctIndex` ve `explanation` **yalnızca submit sonrası** gönderilir.
- **Kopya soru tespiti:** Eğitici soru metnini girip alanı terk ettiğinde (`onBlur`), backend'e `POST /educators/me/questions/check-duplicate` çağrısı yapılır. Aynı eğiticinin tüm sorularıyla Jaccard benzerliği ≥ 0.75 ise amber uyarı gösterilir. Eğitici ısrar ederek devam edebilir.

### Attempt
Bir kullanıcının bir sınavı çözme oturumu.

- `id, userId, testId, startedAt, submittedAt (nullable), score (nullable), status (IN_PROGRESS | SUBMITTED | EXPIRED)`
- `answers` ilişkisi — her soru için `Answer { attemptId, questionId, selectedIndex, isCorrect, answeredAt }`.
- **Tek aktif attempt kuralı:** bir kullanıcı aynı sınavda aynı anda tek `IN_PROGRESS` sahibi olabilir.
- **Süre kuralı:** `startedAt + durationMinutes < now()` iken submit yoksa `EXPIRED`; skor `answers` üzerinden hesaplanır.

### Purchase
User-Test satın alma ilişkisi.

- `userId, testId, paidAt, amount, paymentProvider, providerRef`
- Composite PK `(userId, testId)` — aynı testi iki kez satın alamaz.

### DiscountCode
Eğiticinin oluşturduğu indirim kodu.

- `id, educatorId, code, percentOff, maxUses, usedCount, validFrom, validUntil, description`
- Yalnızca sahibi eğitici silebilir.

### AdPackage / AdPurchase
Eğiticinin test veya kendi profili için reklam satın alması.

- `AdPackage`: Admin tarafından tanımlanır (fiyat, gösterim sayısı).
- `AdPurchase`: `educatorId, adPackageId, testId (nullable), targetType (TEST | EDUCATOR), impressionsTotal, impressionsLeft`.

### AdminSettings
Admin panelinden yönetilen global ayarlar. Tek satır (id = 1).

| Alan | Tip | Açıklama |
|---|---|---|
| `commissionRate` | Decimal | Platform komisyon oranı |
| `maxTestsPerPackage` | Int (default: 10) | Bir pakete eklenebilecek maksimum Test sayısı |
| `maxQuestionsPerTest` | Int | Teste eklenebilecek maksimum soru sayısı |
| `backupEnabled` | Boolean | Otomatik yedekleme açık/kapalı |
| `backupTime` | String (HH:MM) | Yedekleme saati |
| `backupDir` | String | Yerel yedek dizini |

### BackupLog
Veritabanı yedekleme sonuçlarının audit log tablosu.

- `id, startedAt, finishedAt, status (RUNNING | SUCCESS | FAILED), filePath, fileSizeMb, errorMessage, durationSec`
- Her gece `BackupSchedulerService` (cron: saatte bir kontrol, `backupTime` saatinde tetiklenir) tarafından `RunDatabaseBackupUseCase` çalıştırılır.
- Yedek dosyaları: `backup_YYYYMMDD.sql.gz` — son 2 gün saklanır, eskiler silinir.

## İş Kuralları

**Yayımlama**
- Test yayımlanabilmesi için: en az 1 soru, `price ≥ 0`, title boş olmamalı.
- Yayımlanmış testin soruları/puanları **değiştirilemez**. Başlık/açıklama değişebilir.

**Satın alma**
- Kullanıcı kendi yazdığı testi satın alamaz.
- Aynı kullanıcı ikinci kez satın alamaz.
- Purchase + Payment kaydı **aynı transaction** içinde.

**Çözme**
- Satın almayan çözemez (`price = 0` senaryosu ayrı).
- Attempt başladıktan sonra soru listesi dondurulur.
- Submit'te: her cevabın `isCorrect` hesapla, `score = correct/total` veya puan toplamı.

**Kopya soru tespiti**
- Eğitici soru alanından ayrıldığında (blur), metin ≥ 15 karakter ise backend kontrol tetiklenir.
- `CheckDuplicateQuestionUseCase`: eğiticinin tüm testlerindeki (DRAFT dahil) tüm sorular karşılaştırılır.
- Algoritma: normalize (küçük harf, noktalama kaldır) → Jaccard benzerliği kelime setleri üzerinde.
- Eşik: ≥ 0.75 → uyarı. Eğitici ısrar edebilir; yalnızca advisory'dir.
- Düzenleme modunda `excludeQuestionId` ile kendisi hariç tutulur.

**Yedekleme**
- `BackupSchedulerService` saatte bir kontrol eder, `backupTime` saatine ulaşıldığında ve o gün henüz yedek alınmadıysa çalışır.
- Yedekler `backupDir`'e yazılır. Son 2 gün dışındaki `backup_*.sql.gz` dosyaları silinir.
- Sonuç `backup_logs` tablosuna yazılır. Admin panelinden log geçmişi ve manuel tetikleme mevcut.

**Rol izinleri**

| Aksiyon | STUDENT | EDUCATOR | ADMIN |
|---------|---------|----------|-------|
| Test listele | ✓ | ✓ | ✓ |
| Test oluştur | - | ✓ | ✓ |
| Kendi testini düzenle | - | ✓ | ✓ |
| Başkasının testini düzenle | - | - | ✓ |
| Test satın al | ✓ | - | - |
| Test çöz | ✓ (satın almışsa) | - | - |
| İndirim kodu oluştur | - | ✓ | - |
| Reklam satın al | - | ✓ | - |
| Admin ayarlarını değiştir | - | - | ✓ |
| Yedekleme yönet | - | - | ✓ |

## Kenar Durumlar

- **Süre dolduğunda client offline** → server-side `EXPIRED` transition. Cron veya lazy check (kullanıcı görüntülediğinde).
- **Ödeme iade** → Purchase silinmez, `refundedAt` eklenir. Attempt'lere dokunma (geçmiş sonuç kalır).
- **Educator silindi** → testler ortada kalmasın: `archived` durum veya `anonymous-educator` placeholder.
- **Soru sonradan yanlış bulundu** → yayımlanmışta değiştirme. Gelecek attempt'ler için yeniden yayımla. Geçmişe dokunma.
- **Yedekleme başarısız** → `BackupLog.status = FAILED`, `errorMessage` dolu. Sonraki gün yeniden denenir.

## Türkçe-İngilizce Haritası

Kod İngilizce, UI Türkçe. API yanıtları İngilizce alan adlı.

| TR | EN | Alan |
|----|----|----|
| Sınav / Test | ExamTest | `test` |
| Soru | ExamQuestion | `question` |
| Seçenek | Choice | `choice` |
| Deneme | Attempt | `attempt` |
| Skor | Score | `score` |
| Satın alma | Purchase | `purchase` |
| Eğitici | Educator | `educator` |
| Öğrenci | Student | `student` |
| Paket | TestPackage | `package` |
| İndirim kodu | DiscountCode | `discountCode` |
| Yedek | Backup | `backup` |

## Notlar

- Domain bilgisinin tek kaynağı burası — yeni varlık eklerken güncelle.
- Genel NestJS/Prisma pattern'leri ilgili skill'lerde (`nestjs-module`, `prisma-schema`).
- Gerçek Prisma şeması: `apps/backend/prisma/schema.prisma`.
