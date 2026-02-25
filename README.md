# Dal - Kod İnceleme ve Öneriler

Kod incelemesi ve otomatik öneri sunan, Clean Architecture prensiplerine uygun bir API projesi.

## Mimari

```
dal/
├── apps/
│   ├── backend/          # Express backend (TypeScript, Prisma)
│   └── frontend/         # Vite + React frontend
│
├── infra/
│   └── docker/           # Dockerfiles ve docker-compose
│       ├── backend.Dockerfile
│       ├── frontend.Dockerfile
│       └── docker-compose.yml
│
├── .env.example
└── README.md
```

## Kurulum

```bash
cd dal
npm install
```

## Çalıştırma

```bash
# Geliştirme (hot reload)
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/reviews` | Kod analizi yap |
| GET | `/api/reviews` | Tüm incelemeleri listele |
| GET | `/api/reviews/:id` | Tek inceleme getir |
| GET | `/health` | Sağlık kontrolü |

### Örnek İstek

```bash
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{"codeSnippet": "function test() { console.log(\"hello\"); }", "language": "javascript"}'
```

## Genişletme

- **Veritabanı**: `ICodeReviewRepository` implement ederek PostgreSQL/MongoDB ekleyebilirsiniz
- **AI Analiz**: `ICodeAnalyzer` implement ederek OpenAI/Claude API entegrasyonu yapabilirsiniz
- **Frontend**: React/Vue ile ayrı bir UI projesi eklenebilir

## Lisans

MIT
