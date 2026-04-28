---
name: ship
description: Commit öncesi tam kalite kontrol zinciri — typecheck, lint, test, sonra git add/commit/push. Bir özelliği bitirdiğinde tek komutla gönderir.
argument-hint: "<commit-message>"
---

Bu slash komutu Sinav Salonu'nda bir değişikliği güvenli ve profesyonel şekilde göndermek için bir kontrol zincirini yürütür. Kullanıcı `/ship "commit mesajı"` çağırdı.

Aşağıdaki adımları **sırayla** uygula. Herhangi biri fail ederse durma kararı ver, kullanıcıya raporla — fail'i görmezden gelme.

## Akış

### 1. Git durumu kontrol et
```bash
git status --short
git diff --stat
```
Değişen dosya yoksa "değişiklik yok, ship gerekmez" de ve çık.

### 2. Typecheck (workspace geneli)
```bash
pnpm typecheck
```
Hata varsa: hataları göster, **commit yapma**. Kullanıcıya "önce typecheck hatalarını düzelt" de.

### 3. Lint
```bash
pnpm lint
```
Sadece **error** varsa dur. Warning'ler bilgi notu — devam.

### 4. Unit test
```bash
pnpm test
```
Bir test bile fail ise: fail eden test isimlerini göster, **commit yapma**.

### 5. E2e test (opsiyonel, büyük değişikliklerde)
Değişen dosyalar backend veya kritik UI ise:
```bash
pnpm test:e2e
```
Sadece frontend stil değişikliğiyse bu adımı atla — kullanıcıya bildir.

### 6. Commit mesajı doğrulama
$ARGUMENTS içeriği commit mesajı olarak kullanılacak. Kuralları kontrol et:
- Boş değilse (boşsa kullanıcıya sor).
- Conventional commit formatı tercih: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Başlık 72 karakteri geçmesin.

Uymuyorsa kullanıcıya düzeltme öner ama zorla dayatma.

### 7. Commit
```bash
git add -A
git commit -m "$ARGUMENTS"
```

### 8. Push
```bash
git push
```
Upstream yoksa `git push -u origin <branch>`.

### 9. Özet
Son olarak kullanıcıya şunu raporla:
- Geçen her adımın süresi
- Commit SHA (kısa)
- Push edilen branch adı
- PR açılması gerekiyorsa (feature branch'teysen) link veya komut öner

## Kısa yol

Kullanıcı acele ediyorsa ve "sadece commit at" dediyse e2e adımını atla — ama typecheck ve unit test'i **atlama**, onlar hızlı ve yanlış commit'i engeller.

## Başarısızlık durumu

Herhangi bir adımda fail varsa:
1. Adımı kim kırdı (hangi dosya, hangi satır) net söyle.
2. Öneri ver: `@refactor-specialist bu hatayı düzelt` veya `@test-writer bu testi tamir et`.
3. **Commit ve push atma.**

## Notlar

- Bu komut sadece commit/push yapar. Kod değişikliği yazma yetkisi yok — başarısızlıkta kullanıcıya yönlendir.
- Windows CMD'de push sırasında kimlik bilgisi sorulabilir; GitHub CLI (`gh`) veya credential helper kurulu olmalı.
