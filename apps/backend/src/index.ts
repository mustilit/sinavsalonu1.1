// dotenv/config must be the FIRST import so DATABASE_URL is available
// when PrismaClient is instantiated in subsequent module imports.
// tsx (esbuild) hoists static imports, so require('dotenv').config()
// in synchronous code would run AFTER prisma.ts is evaluated — too late.
import 'dotenv/config';

// Entrypoint: bootstrap Nest application
import './nest/main';
