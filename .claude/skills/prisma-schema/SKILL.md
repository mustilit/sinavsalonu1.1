---
name: prisma-schema
description: Prisma şema yazım kuralları, migration akışı, indeks stratejisi, seed pattern'i. Şemaya model eklenirken veya migration üretilirken referans alın.
---

# Prisma Şema ve Migration

## Model Yazım Kuralları

```prisma
model Exam {
  id              String      @id @default(cuid())
  title           String
  description     String?
  price           Decimal     @db.Decimal(10, 2)
  durationMinutes Int
  authorId        String
  author          User        @relation("AuthoredExams", fields: [authorId], references: [id])
  questions       Question[]
  purchases       Purchase[]
  attempts        Attempt[]
  publishedAt     DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([authorId])
  @@index([publishedAt])
}
```

Kurallar:
- **PK:** `String @id @default(cuid())`. UUID istiyorsan `uuid()`.
- **Timestamps:** `createdAt @default(now())` ve `updatedAt @updatedAt` her modelde.
- **Relation:** `@relation` adı, ilişkinin rolü belirsizse (bir user'ın hem yazdığı hem çözdüğü sınavlar gibi).
- **Money:** `Decimal @db.Decimal(10, 2)`. Float kullanma.
- **Enum:** `Role`, `ExamStatus` gibi — stringler yerine.
- **Index:** WHERE'de sık geçen ve büyük tabloların kolonlarına `@@index`.
- **Cascade:** Child'ı silme davranışı düşün: `onDelete: Cascade` ödeme gibi kritik yerlerde kullanma.

## Enum

```prisma
enum Role {
  STUDENT
  AUTHOR
  ADMIN
}

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  EXPIRED
}
```

## Migration

```bash
# geliştirme
pnpm prisma migrate dev --name <short_imperative_name>

# CI / prod
pnpm prisma migrate deploy
```

Migration adı kuralı: `add_exam_price`, `rename_user_role`, `split_question_choices`. Geçmiş zaman değil, imperatif.

**Tehlikeli değişiklik kontrol listesi (migration yazmadan önce):**
- NOT NULL kolon ekleniyor → default veya önce nullable sonra backfill sonra not null.
- Tür değişimi → veri kaybı riski, backup al.
- İsim değişimi → iki adımlı: yeni kolon ekle, veri kopyala, eski sil.
- Index kaldırma → performans regresyonu, production'da monitor et.

## Seed

```ts
// prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sinavsalonu.local' },
    update: {},
    create: { email: 'admin@sinavsalonu.local', role: Role.ADMIN, name: 'Admin' },
  });
  // ...
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

`package.json`:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

Çalıştır: `pnpm prisma db seed`.

## Query Kuralları

- **Select / Include açıkça belirt.** Tüm alanları çekme.
  ```ts
  prisma.exam.findMany({ select: { id: true, title: true, price: true } });
  ```
- **Büyük listeler**: `take` + cursor pagination.
- **N+1 tehlikesi**: loop içinde `findUnique` yerine `findMany({ where: { id: { in: [...] } } })`.
- **Transaction**: birden fazla yazma varsa `prisma.$transaction(async tx => ...)`.
- **Raw SQL**: Prisma ifade edemiyorsa `prisma.$queryRaw` — parametreli, SQL injection riski bilinçli.

## Relation Pattern'leri

**One-to-many:** User → Exam (author)
```prisma
model User {
  authoredExams Exam[] @relation("AuthoredExams")
}
model Exam {
  authorId String
  author   User @relation("AuthoredExams", fields: [authorId], references: [id])
}
```

**Many-to-many (explicit):** User ↔ Exam üzerinden Purchase
```prisma
model Purchase {
  userId String
  examId String
  user   User @relation(fields: [userId], references: [id])
  exam   Exam @relation(fields: [examId], references: [id])
  paidAt DateTime
  @@id([userId, examId])
}
```

## Soft Delete

Gerçekten gerekiyorsa: `deletedAt DateTime?` kolonu + middleware ile `WHERE deletedAt IS NULL` otomatik ekle. Ama çoğu zaman gerek olmaz — düşün.
