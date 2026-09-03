# Secure Digital Case & Evidence Management System
# 🔐 Secure Digital Case & Evidence Management System

> **Smart India Hackathon 2026 — Problem Statement 190**

An **AI-powered, secure, and centralized digital platform** for managing law-enforcement and legal case documents, evidence, metadata, audit trails, and secure document workflows.

The system is designed to replace fragmented and manual document handling with a **secure, searchable, role-based digital case repository**.

---

## 🔐 Judge Demo Access

> **For SIH 2026 evaluation only**

| Field | Details |
|---|---|
| **Role** | ADMIN |
| **Email** | `infokisansevaplus14@gmail.com` |
| **Password** | `@12345678` |

**Demo URL:** `https://smart-india-hackathon-2026-ps190.vercel.app/`

> ⚠️ These credentials are intended only for prototype evaluation.  
> Please do not use them for production purposes.

## 🚀 Project Overview

The **Secure Digital Case & Evidence Management System** provides a centralized platform where authorized users can securely manage digital case records and evidence.

The platform supports the complete document lifecycle:

**Authentication → Case Management → Document Upload → File Validation → Hashing → OCR → AI Classification → Metadata Extraction → Embeddings → Secure Storage → Semantic Search → Access Control → Audit Logging → Integrity Verification → Version History → Secure Sharing → Digital Signatures**

### 🎯 Primary Objectives

- 🔐 **Secure document and evidence management**
- 📁 **Centralized case-document repository**
- 🤖 **AI-assisted document processing**
- 🔎 **Intelligent semantic and keyword search**
- 👥 **Role-Based Access Control (RBAC)**
- 🧾 **Tamper-evident audit trails**
- 🔏 **Document integrity verification**
- ✍️ **Cryptographic digital signatures**
- 📜 **Document version history**
- 🔗 **Secure document sharing**
---

# ✨ Key Features

## 🔑 Authentication & Access Control

The system provides secure authentication and authorization mechanisms.

- **User registration and login**
- **Secure password hashing**
- **JWT-based authentication**
- **Session management**
- **TOTP-based Multi-Factor Authentication (MFA)**
- **Role-Based Access Control (RBAC)**
- **User and role management**
- **Permission-based case/document access**

### 👤 User Roles

The platform supports different levels of access:

| Role | Access |
|------|--------|
| **Admin** | Full system administration and user management |
| **Investigator / Officer** | Case and document management |
| **Viewer** | Read-only access to authorized information |

> The dashboard structure remains consistent across users, while available actions and features are controlled according to the user's permissions.

---

# 📁 Case Management

Authorized users can:

- **Create new cases**
- **View case details**
- **Update case information**
- **Manage case members**
- **Assign users to cases**
- **Control case-level permissions**
- **View documents associated with a case**

---

# 📄 Secure Document Management

The platform provides a complete document lifecycle:

```text
Upload
   ↓
File Validation
   ↓
SHA-256 Hash
   ↓
Secure Storage
   ↓
OCR / Text Extraction
   ↓
AI Classification
   ↓
Metadata Extraction
   ↓
Text Chunking
   ↓
Vector Embeddings
   ↓
Semantic Search Index
   ↓
Authorized Access
   ↓
Integrity Verification
   ↓
Version History
```


## Technology Stack

- **Frontend / Backend**: Next.js App Router (TypeScript, Node.js Runtime)
- **Styling**: Tailwind CSS + Lucide Icons
- **Database**: PostgreSQL with `pgvector` extension + Prisma ORM
- **Storage**: Vercel Blob / Private Object Storage abstraction
- **Security**: SHA-256 Hashing, AES-256-GCM Encryption, TOTP MFA, Cryptographic Digital Signatures, Tamper-Evident Audit Hash-Chain
- **AI & Processing**: Tesseract.js / PDF.js OCR, Sentence Transformer Vector Embeddings, Hybrid Semantic Search, Document Classification

## System Architecture

                    ┌─────────────────────────┐
                    │        FRONTEND         │
                    │ Next.js + TypeScript    │
                    │ Tailwind CSS            │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │        API LAYER        │
                    │ Next.js App Router      │
                    │ REST API Routes         │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
       ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
       │ AUTH & RBAC  │   │ AI PIPELINE  │   │   SECURITY   │
       │ JWT + MFA    │   │ OCR + AI     │   │ Hash + Sign  │
       └──────────────┘   └──────────────┘   └──────────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       PRISMA ORM        │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       POSTGRESQL        │
                    │        + pgvector       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
             ┌──────────────┐         ┌──────────────┐
             │   DOCUMENT   │         │    VECTOR    │
             │   STORAGE    │         │    STORAGE   │
             └──────────────┘         └──────────────┘
                                             │
                                             ▼
                                      Semantic Search

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
