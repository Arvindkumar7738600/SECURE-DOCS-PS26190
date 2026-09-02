# Secure Digital Case & Evidence Management System

Smart India Hackathon 2026 Prototype — AI-powered secure digital repository for law-enforcement and legal case documents.

## Technology Stack
- **Frontend / Backend**: Next.js App Router (TypeScript, Node.js Runtime)
- **Styling**: Tailwind CSS + Lucide Icons
- **Database**: PostgreSQL with `pgvector` extension + Prisma ORM
- **Storage**: Vercel Blob / Private Object Storage abstraction
- **Security**: SHA-256 Hashing, AES-256-GCM Encryption, TOTP MFA, Cryptographic Digital Signatures, Tamper-Evident Audit Hash-Chain
- **AI & Processing**: Tesseract.js / PDF.js OCR, Sentence Transformer Vector Embeddings, Hybrid Semantic Search, Document Classification

## Setup & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build production bundle:
   ```bash
   npm run build
   ```
