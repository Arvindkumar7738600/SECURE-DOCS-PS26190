'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Copy,
  Cpu,
  Download,
  Edit3,
  FileText,
  Key,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PriorityBadge,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  StatCard,
  StatusBadge,
  Tabs,
  UserAvatar,
} from '@/components/enterprise-ui';

interface OcrPageData {
  pageNumber: number;
  text: string;
  confidence: number | null;
  method: string;
}

interface DocumentDetail {
  id: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  documentType: string;
  currentVersion: number;
  status: string;
  sha256: string;
  storageType: string;
  encryptionStatus: string;
  ocrStatus: string;
  classificationStatus: string;
  embeddingStatus: string;
  uploader: { fullName: string; email: string; department: string };
  createdAt: string;
  updatedAt: string;
  metadata?: DocumentMetadataInfo | null;
  latestJob?: { status: string; currentStep?: string | null; createdAt: string } | null;
  versionsCount?: number;
  ocrPagesCount?: number;
}

interface ClassificationInfo {
  classification: string;
  confidence: number;
  method: string;
  reason: string;
}

interface DocumentMetadataInfo {
  caseNumber: string | null;
  documentDate: string | null;
  policeStation: string | null;
  officer: string | null;
  persons: string[];
  locations: string[];
  organizations: string[];
  summary: string | null;
  rawMetadata?: Record<string, unknown>;
}

interface SignatureInfo {
  id: string;
  algorithm: string;
  signedHash: string;
  verificationStatus: string;
  createdAt: string;
  signer: { fullName: string; email: string; department: string };
  version?: { versionNumber: number; sha256: string };
}

interface ShareInfo {
  id: string;
  permission: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  recipient: { id: string; email: string; fullName: string; department: string };
  sharer: { fullName: string; email: string };
}

type DocumentTab = 'overview' | 'metadata' | 'ocr' | 'signatures' | 'sharing' | 'security';

function formatDate(value: string | Date | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [ocrPages, setOcrPages] = useState<OcrPageData[]>([]);
  const [classificationInfo, setClassificationInfo] = useState<ClassificationInfo | null>(null);
  const [metadataInfo, setMetadataInfo] = useState<DocumentMetadataInfo | null>(null);
  const [signatures, setSignatures] = useState<SignatureInfo[]>([]);
  const [shares, setShares] = useState<ShareInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DocumentTab>('overview');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [sigVerificationResult, setSigVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [signing, setSigning] = useState(false);
  const [verifyingSignature, setVerifyingSignature] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [metadataForm, setMetadataForm] = useState<Partial<DocumentMetadataInfo>>({});
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [sharingModal, setSharingModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('VIEW');
  const [shareExpiresInDays, setShareExpiresInDays] = useState('');
  const [sharing, setSharing] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [ocrSearchQuery, setOcrSearchQuery] = useState('');
  const [copiedOcrText, setCopiedOcrText] = useState(false);
  const [editingPageNumber, setEditingPageNumber] = useState<number | null>(null);
  const [editedPageText, setEditedPageText] = useState('');
  const [savingOcrText, setSavingOcrText] = useState(false);
  const [reuploading, setReuploading] = useState(false);
  const reuploadInputRef = React.useRef<HTMLInputElement | null>(null);

  const canEditMetadata = userRoles.some((r) => ['ADMIN', 'INVESTIGATOR', 'OFFICER', 'LEGAL'].includes(r));
  const canSign = userRoles.some((r) => ['ADMIN', 'INVESTIGATOR'].includes(r));
  const canShare = userRoles.some((r) => ['ADMIN', 'INVESTIGATOR', 'LEGAL'].includes(r));

  const handleReuploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setProcessingOcr(true);
    setBannerError(null);
    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || '');
          const clean = res.includes(',') ? res.split(',')[1] : res;
          resolve(clean);
        };
        reader.onerror = () => reject(new Error('Failed to read selected file'));
        reader.readAsDataURL(selectedFile);
      });

      // Send with a 55-second timeout for Tesseract cold start
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const res = await fetch(`/api/v1/documents/${documentId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentBase64: base64 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Handle non-JSON responses (Vercel error pages)
      let data: any;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: `Server error (${res.status}): ${text.slice(0, 200)}` };
      }

      if (!res.ok) throw new Error(data.error || 'Failed to process re-uploaded evidence file');

      await fetchDocumentDetails();
      setActiveTab('ocr');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setBannerError('OCR processing timed out. The server may be cold-starting. Please try again in 30 seconds.');
      } else {
        setBannerError(err.message || 'Failed to extract text from evidence file');
      }
    } finally {
      setProcessingOcr(false);
      if (reuploadInputRef.current) reuploadInputRef.current.value = '';
    }
  };

  // Auto-polling when document is processing
  useEffect(() => {
    if (!document || document.status !== 'PROCESSING') return;
    const interval = setInterval(() => {
      fetchDocumentDetails();
    }, 2500);
    return () => clearInterval(interval);
  }, [document?.status, documentId]);

  const handleCopyOcrText = () => {
    const fullText = ocrPages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedOcrText(true);
    setTimeout(() => setCopiedOcrText(false), 2000);
  };

  const handleExportOcr = (format: 'txt' | 'json') => {
    let content = '';
    let mime = 'text/plain';
    const filename = `${document?.originalFilename || 'document'}_ocr.${format}`;

    if (format === 'json') {
      content = JSON.stringify({ documentId, totalPages: ocrPages.length, pages: ocrPages }, null, 2);
      mime = 'application/json';
    } else {
      content = ocrPages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveEditedOcrPage = async (pageNumber: number) => {
    setSavingOcrText(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/text`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber, text: editedPageText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update OCR text');
      setEditingPageNumber(null);
      await fetchOcrText();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to update OCR text');
    } finally {
      setSavingOcrText(false);
    }
  };

  const fetchDocumentDetails = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}`);
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load document');

      setDocument(data.document);
      setUserRoles(data.userRoles || []);
      setMetadataInfo(data.document.metadata || null);
      setMetadataForm(data.document.metadata || {});

      await Promise.all([fetchOcrText(), fetchClassification(), fetchMetadata(), fetchSignatures(), fetchShares()]);
    } catch (err: any) {
      setPageError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const fetchOcrText = async () => {
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/text`);
      if (res.ok) {
        const data = await res.json();
        setOcrPages(data.pages || []);
      }
    } catch {
      // keep existing state; no fake data
    }
  };

  const fetchClassification = async () => {
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/classification`);
      if (res.ok) {
        const data = await res.json();
        setClassificationInfo(data.classification);
      }
    } catch {
      // keep existing state
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/metadata`);
      if (res.ok) {
        const data = await res.json();
        setMetadataInfo(data.metadata);
        setMetadataForm(data.metadata || {});
      }
    } catch {
      // keep existing state
    }
  };

  const fetchSignatures = async () => {
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/signatures`);
      if (res.ok) {
        const data = await res.json();
        setSignatures(data.signatures || []);
      }
    } catch {
      // keep existing state
    }
  };

  const fetchShares = async () => {
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
      }
    } catch {
      // keep existing state
    }
  };

  useEffect(() => {
    if (documentId) fetchDocumentDetails();
  }, [documentId]);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/verify-integrity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Integrity verification failed');
      setVerificationResult(data);
      setActiveTab('security');
    } catch (err: any) {
      setBannerError(err.message || 'Integrity verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleProcessOcr = async () => {
    // The /process endpoint needs file bytes on disk, which Vercel doesn't persist.
    // Instead, trigger the file picker so user selects a file and we send it directly via /reprocess.
    if (reuploadInputRef.current) {
      reuploadInputRef.current.click();
    }
  };

  const handleClassify = async () => {
    setClassifying(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/classify`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Classification failed');
      setClassificationInfo(data.classification);
      await fetchDocumentDetails();
      setActiveTab('overview');
    } catch (err: any) {
      setBannerError(err.message || 'Classification failed');
    } finally {
      setClassifying(false);
    }
  };

  const handleSaveMetadata = async () => {
    setSavingMetadata(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadataForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update metadata');
      setMetadataInfo(data.metadata);
      setEditingMetadata(false);
      setActiveTab('metadata');
    } catch (err: any) {
      setBannerError(err.message || 'Failed to update metadata');
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleSignDocument = async () => {
    setSigning(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/sign`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sign document');
      await fetchSignatures();
      setActiveTab('signatures');
    } catch (err: any) {
      setBannerError(err.message || 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  const handleVerifySignature = async (signatureId?: string) => {
    setVerifyingSignature(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signature verification failed');
      setSigVerificationResult(data);
      await fetchSignatures();
      setActiveTab('security');
    } catch (err: any) {
      setBannerError(err.message || 'Signature verification failed');
    } finally {
      setVerifyingSignature(false);
    }
  };

  const handleCreateShare = async () => {
    if (!shareEmail.trim()) return;
    setSharing(true);
    setBannerError(null);
    try {
      let expiresAt: string | null = null;
      if (shareExpiresInDays && !Number.isNaN(Number(shareExpiresInDays))) {
        const d = new Date();
        d.setDate(d.getDate() + Number(shareExpiresInDays));
        expiresAt = d.toISOString();
      }

      const res = await fetch(`/api/v1/documents/${documentId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: shareEmail.trim(),
          permission: sharePermission,
          expiresAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to share document');
      setShareEmail('');
      setShareExpiresInDays('');
      setSharingModal(false);
      await fetchShares();
      setActiveTab('sharing');
    } catch (err: any) {
      setBannerError(err.message || 'Failed to share document');
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm('Revoke this shared access?')) return;
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/shares/${shareId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke share');
      await fetchShares();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to revoke share');
    }
  };

  const handleDownload = () => {
    window.location.href = `/api/v1/documents/${documentId}/download`;
  };

  const copyHash = async () => {
    if (!document?.sha256) return;
    await navigator.clipboard.writeText(document.sha256);
    setCopiedHash(true);
    window.setTimeout(() => setCopiedHash(false), 1500);
  };

  const activeShareCount = shares.filter((share) => {
    const expired = share.expiresAt ? new Date(share.expiresAt) < new Date() : false;
    return !share.revokedAt && !expired;
  }).length;

  const tabItems: Array<{ key: DocumentTab; label: string; count?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'metadata', label: 'Metadata' },
    { key: 'ocr', label: 'OCR', count: ocrPages.length },
    { key: 'signatures', label: 'Signatures', count: signatures.length },
    { key: 'sharing', label: 'Sharing', count: shares.length },
    { key: 'security', label: 'Security' },
  ];

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Documents', href: '/documents' }, { label: 'Document Details' }]} title="Document Details" subtitle="Loading document workspace...">
        <LoadingSkeleton rows={6} />
      </AppShell>
    );
  }

  if (pageError || !document) {
    return (
      <AppShell breadcrumbs={[{ label: 'Documents', href: '/documents' }, { label: 'Document Details' }]} title="Document Details" subtitle="Document access state">
        <ErrorState
          title="Document access denied"
          description={pageError || 'Document not found'}
          action={
            <Link href="/documents" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              Return to Repository
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </AppShell>
    );
  }

  const downloadButton = (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <Download className="h-4 w-4" />
      Download
    </button>
  );

  const headerDescription =
    document.metadata?.summary &&
    !document.metadata.summary.includes('cCfCj') &&
    !document.metadata.summary.includes('') &&
    !document.metadata.summary.includes('\uFFFD') &&
    !/[^\x20-\x7E\n\r\t]/.test(document.metadata.summary)
      ? document.metadata.summary
      : `Uploaded ${document.originalFilename}. Verified Evidence Record.`;

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Documents', href: '/documents' },
        { label: document.caseNumber, href: `/cases/${document.caseId}` },
        { label: document.originalFilename },
      ]}
      title={document.originalFilename}
      subtitle={document.caseNumber}
      actions={
        <>
          <Link
            href={`/cases/${document.caseId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Case
          </Link>
          {downloadButton}
        </>
      }
    >
      <PageHeader
        eyebrow="Document Workspace"
        title={document.title}
        description={headerDescription}
      />

      {/* Hidden file input — must be outside tab content so it's always in the DOM */}
      <input
        type="file"
        ref={reuploadInputRef}
        style={{ display: 'none' }}
        accept="image/*,application/pdf,text/plain"
        onChange={handleReuploadFile}
      />

      {bannerError ? <ErrorState title="Action failed" description={bannerError} /> : null}
      {verificationResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div className="space-y-1">
              <p className="font-medium">Integrity verification {String(verificationResult.status || '').replace(/_/g, ' ').toLowerCase()}</p>
              <p className="text-sm text-emerald-800">{verificationResult.message}</p>
            </div>
          </div>
        </div>
      ) : null}
      {sigVerificationResult ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-900">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-700" />
            <div className="space-y-1">
              <p className="font-medium">Signature verification {sigVerificationResult.verificationStatus}</p>
              <p className="text-sm text-slate-600">
                Hash match: {sigVerificationResult.isHashMatching ? 'Yes' : 'No'} · Crypto valid: {sigVerificationResult.isCryptoValid ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Integrity" value={document.sha256 ? 'Verified' : 'Pending'} change="Latest hash state" icon={<ShieldCheck className="h-5 w-5" />} tone={document.sha256 ? 'emerald' : 'amber'} />
        <StatCard title="OCR" value={document.ocrStatus.replace(/_/g, ' ')} change={`${ocrPages.length} pages extracted`} icon={<Cpu className="h-5 w-5" />} tone="blue" />
        <StatCard title="Classification" value={classificationInfo?.classification || document.documentType} change={classificationInfo?.method || 'Document type fallback'} icon={<Sparkles className="h-5 w-5" />} tone="amber" />
        <StatCard title="Sharing" value={String(activeShareCount)} change={`${shares.length} shares total`} icon={<Share2 className="h-5 w-5" />} tone="slate" />
      </section>

      <div className="flex flex-col gap-5">
        <Tabs items={tabItems} active={activeTab} onChange={(value) => setActiveTab(value as DocumentTab)} />

        {activeTab === 'overview' ? (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Document Snapshot"
              description="Core repository information from the live document record."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {canSign ? (
                    <PrimaryButton type="button" onClick={handleSignDocument} disabled={signing}>
                      <Key className="h-4 w-4" />
                      {signing ? 'Signing...' : 'Sign Document'}
                    </PrimaryButton>
                  ) : null}
                  {canShare ? (
                    <SecondaryButton type="button" onClick={() => setSharingModal(true)}>
                      <Share2 className="h-4 w-4" />
                      Share Access
                    </SecondaryButton>
                  ) : null}
                </div>
              }
            >
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={document.status} />
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    v{document.currentVersion}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    {document.documentType}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    {document.mimeType}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{document.caseNumber}</p>
                    <p className="text-sm text-slate-600">{document.caseTitle}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Uploaded By</p>
                    <div className="mt-2 flex items-start gap-3">
                      <UserAvatar name={document.uploader.fullName} email={document.uploader.email} />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{document.uploader.fullName}</p>
                        <p className="text-sm text-slate-600">{document.uploader.email}</p>
                        <p className="text-xs text-slate-500">{document.uploader.department}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Created</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(document.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Updated</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(document.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="space-y-5">
              <SectionCard title="Workflow Status" description="Backend-powered processing and verification state.">
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span>Storage</span>
                    <StatusBadge status={document.storageType} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span>Encryption</span>
                    <StatusBadge status={document.encryptionStatus} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span>OCR</span>
                    <StatusBadge status={document.ocrStatus} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span>Classification</span>
                    <StatusBadge status={document.classificationStatus} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span>Embedding</span>
                    <StatusBadge status={document.embeddingStatus} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Quick Actions" description="Run the supported backend workflows.">
                <div className="grid gap-3">
                  <SecondaryButton type="button" onClick={handleVerifyIntegrity} disabled={verifying}>
                    <ShieldCheck className="h-4 w-4" />
                    {verifying ? 'Verifying...' : 'Verify Integrity'}
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={handleClassify} disabled={classifying}>
                    <Sparkles className="h-4 w-4" />
                    {classifying ? 'Classifying...' : 'Classify Content'}
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={handleProcessOcr} disabled={processingOcr}>
                    <Cpu className="h-4 w-4" />
                    {processingOcr ? 'Processing OCR...' : 'Run OCR Pipeline'}
                  </SecondaryButton>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}

        {activeTab === 'metadata' ? (
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard
              title="Document Metadata"
              description="Edit the structured metadata that the backend persists."
              actions={
                canEditMetadata && !editingMetadata ? (
                  <SecondaryButton type="button" onClick={() => setEditingMetadata(true)}>
                    <Edit3 className="h-4 w-4" />
                    Edit Metadata
                  </SecondaryButton>
                ) : null
              }
            >
              {editingMetadata ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case Number</span>
                      <input
                        value={metadataForm.caseNumber || ''}
                        onChange={(event) => setMetadataForm({ ...metadataForm, caseNumber: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>
                    <label className="space-y-2 block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Document Date</span>
                      <input
                        value={metadataForm.documentDate || ''}
                        onChange={(event) => setMetadataForm({ ...metadataForm, documentDate: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>
                    <label className="space-y-2 block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Police Station</span>
                      <input
                        value={metadataForm.policeStation || ''}
                        onChange={(event) => setMetadataForm({ ...metadataForm, policeStation: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>
                    <label className="space-y-2 block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Officer</span>
                      <input
                        value={metadataForm.officer || ''}
                        onChange={(event) => setMetadataForm({ ...metadataForm, officer: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Summary</span>
                    <textarea
                      rows={5}
                      value={metadataForm.summary || ''}
                      onChange={(event) => setMetadataForm({ ...metadataForm, summary: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <PrimaryButton type="button" onClick={handleSaveMetadata} disabled={savingMetadata}>
                      <Save className="h-4 w-4" />
                      {savingMetadata ? 'Saving...' : 'Save Changes'}
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => setEditingMetadata(false)}>
                      <X className="h-4 w-4" />
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              ) : metadataInfo ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case Number</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{metadataInfo.caseNumber || 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Document Date</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{metadataInfo.documentDate || 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Police Station</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{metadataInfo.policeStation || 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Officer</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{metadataInfo.officer || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Summary</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{metadataInfo.summary || 'No metadata summary available.'}</p>
                  </div>
                </div>
              ) : (
                <EmptyState title="No metadata available" description="This document does not have structured metadata yet." />
              )}
            </SectionCard>

            <SectionCard title="Entities" description="Extracted lists from the metadata record.">
              <div className="space-y-4">
                {['persons', 'locations', 'organizations'].map((key) => {
                  const values = metadataInfo?.[key as keyof DocumentMetadataInfo] as string[] | undefined;
                  const title = key === 'persons' ? 'People' : key === 'locations' ? 'Locations' : 'Organizations';
                  return (
                    <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{title}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {values && values.length > 0 ? values.map((item) => (
                          <span key={item} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                            {item}
                          </span>
                        )) : (
                          <span className="text-sm text-slate-500">None recorded</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === 'ocr' ? (
          <SectionCard
            title="OCR & Text Extraction"
            description="Page-level OCR recognition and text extraction output."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {ocrPages.length > 0 ? (
                  <React.Fragment>
                    <SecondaryButton type="button" onClick={handleCopyOcrText}>
                      {copiedOcrText ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      {copiedOcrText ? 'Copied!' : 'Copy Text'}
                    </SecondaryButton>
                    <SecondaryButton type="button" onClick={() => handleExportOcr('txt')}>
                      <Download className="h-4 w-4" />
                      Export TXT
                    </SecondaryButton>
                    <SecondaryButton type="button" onClick={() => handleExportOcr('json')}>
                      <FileText className="h-4 w-4" />
                      Export JSON
                    </SecondaryButton>
                  </React.Fragment>
                ) : null}
                {canEditMetadata ? (
                  <SecondaryButton type="button" onClick={() => reuploadInputRef.current?.click()} disabled={processingOcr}>
                    <Upload className="h-4 w-4" />
                    {processingOcr ? 'Processing...' : 'Re-upload Evidence File'}
                  </SecondaryButton>
                ) : null}
                <PrimaryButton type="button" onClick={handleProcessOcr} disabled={processingOcr}>
                  <Cpu className="h-4 w-4" />
                  {processingOcr ? 'Processing...' : 'Run OCR Pipeline'}
                </PrimaryButton>
              </div>
            }
          >
            {ocrPages.length === 0 ? (
              <EmptyState
                title="No OCR pages extracted yet"
                description="Click 'Re-upload Evidence File' to attach your image or run the OCR recognition pipeline."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {canEditMetadata ? (
                      <SecondaryButton type="button" onClick={() => reuploadInputRef.current?.click()} disabled={reuploading}>
                        <Upload className="h-4 w-4" />
                        {reuploading ? 'Uploading...' : 'Re-upload Evidence File'}
                      </SecondaryButton>
                    ) : null}
                    <PrimaryButton type="button" onClick={handleProcessOcr} disabled={processingOcr}>
                      <Cpu className="h-4 w-4" />
                      {processingOcr ? 'Processing...' : 'Run OCR Pipeline'}
                    </PrimaryButton>
                  </div>
                }
              />
            ) : (
              <div className="space-y-4">
                {/* Search / Filter Bar */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={ocrSearchQuery}
                    onChange={(e) => setOcrSearchQuery(e.target.value)}
                    placeholder="Search keywords inside extracted OCR text..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  {ocrSearchQuery ? (
                    <button
                      onClick={() => setOcrSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {ocrPages
                  .filter(
                    (p) =>
                      !ocrSearchQuery.trim() ||
                      p.text.toLowerCase().includes(ocrSearchQuery.toLowerCase()) ||
                      String(p.pageNumber).includes(ocrSearchQuery)
                  )
                  .map((page) => {
                    const isEditing = editingPageNumber === page.pageNumber;
                    return (
                      <div key={page.pageNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 shadow-sm">
                              {page.pageNumber}
                            </span>
                            <p className="font-medium text-slate-900">Page {page.pageNumber}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              {page.method}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              {page.confidence !== null && page.confidence !== undefined
                                ? `${(page.confidence > 1 ? page.confidence : page.confidence * 100).toFixed(1)}% confidence`
                                : 'No score'}
                            </span>
                            {canEditMetadata && !isEditing ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPageNumber(page.pageNumber);
                                  setEditedPageText(page.text);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
                              >
                                <Edit3 className="h-3.5 w-3.5" /> Edit
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              rows={4}
                              value={editedPageText}
                              onChange={(e) => setEditedPageText(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <SecondaryButton type="button" onClick={() => setEditingPageNumber(null)}>
                                Cancel
                              </SecondaryButton>
                              <PrimaryButton
                                type="button"
                                onClick={() => handleSaveEditedOcrPage(page.pageNumber)}
                                disabled={savingOcrText}
                              >
                                <Save className="h-4 w-4" />
                                {savingOcrText ? 'Saving...' : 'Save OCR Text'}
                              </PrimaryButton>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{page.text || 'No text extracted.'}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </SectionCard>
        ) : null}

        {activeTab === 'signatures' ? (
          <SectionCard
            title="Digital Signatures"
            description="Cryptographic signatures generated and verified against this document version."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton type="button" onClick={() => handleVerifySignature()}>
                  <ShieldCheck className="h-4 w-4" />
                  Verify Signatures
                </SecondaryButton>
                {canSign ? (
                  <PrimaryButton type="button" onClick={handleSignDocument} disabled={signing}>
                    <Key className="h-4 w-4" />
                    {signing ? 'Signing...' : 'Sign Document'}
                  </PrimaryButton>
                ) : null}
              </div>
            }
          >
            {signatures.length === 0 ? (
              <EmptyState
                title="No signatures yet"
                description="Authorized signatories can apply a cryptographic signature to the current version."
              />
            ) : (
              <DataTable
                columns={[
                  { label: 'Signer' },
                  { label: 'Algorithm' },
                  { label: 'Version' },
                  { label: 'Status' },
                  { label: 'Signed' },
                  { label: 'Action' },
                ]}
              >
                {signatures.map((signature) => (
                  <tr key={signature.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{signature.signer.fullName}</p>
                        <p className="text-xs text-slate-500">{signature.signer.department}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{signature.algorithm}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">v{signature.version?.versionNumber || document.currentVersion}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={signature.verificationStatus} />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">{formatDate(signature.createdAt)}</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleVerifySignature(signature.id)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
                        disabled={verifyingSignature}
                      >
                        Verify
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>
        ) : null}

        {activeTab === 'sharing' ? (
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard
              title="Shared Access"
              description="Document shares currently active or previously revoked."
              actions={canShare ? <SecondaryButton type="button" onClick={() => setSharingModal(true)}><Plus className="h-4 w-4" />Grant Share</SecondaryButton> : null}
            >
              {shares.length === 0 ? (
                <EmptyState title="No shared users" description="This document has not been explicitly shared." />
              ) : (
                <div className="space-y-3">
                  {shares.map((share) => {
                    const isRevoked = Boolean(share.revokedAt);
                    const isExpired = share.expiresAt ? new Date(share.expiresAt) < new Date() : false;
                    const isActive = !isRevoked && !isExpired;
                    return (
                      <div key={share.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <UserAvatar name={share.recipient.fullName} email={share.recipient.email} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{share.recipient.fullName}</p>
                            <p className="text-sm text-slate-600">{share.recipient.email}</p>
                            <p className="text-xs text-slate-500">{share.recipient.department}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={isActive ? 'ACTIVE' : isRevoked ? 'REVOKED' : 'EXPIRED'} />
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                            {share.permission}
                          </span>
                          {isActive && canShare ? (
                            <SecondaryButton type="button" onClick={() => handleRevokeShare(share.id)}>
                              Revoke
                            </SecondaryButton>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Grant Share Access" description="Create a time-bound or indefinite access grant.">
              <div className="space-y-4">
                <label className="space-y-2 block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Recipient Email</span>
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(event) => setShareEmail(event.target.value)}
                    placeholder="investigator@agency.gov"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                  />
                </label>
                <label className="space-y-2 block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Permission</span>
                  <select
                    value={sharePermission}
                    onChange={(event) => setSharePermission(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="VIEW">VIEW</option>
                    <option value="DOWNLOAD">DOWNLOAD</option>
                  </select>
                </label>
                <label className="space-y-2 block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Expires In (Days)</span>
                  <input
                    type="number"
                    value={shareExpiresInDays}
                    onChange={(event) => setShareExpiresInDays(event.target.value)}
                    placeholder="Leave blank for indefinite"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <PrimaryButton type="button" onClick={handleCreateShare} disabled={sharing || !shareEmail.trim()}>
                    <Share2 className="h-4 w-4" />
                    {sharing ? 'Creating...' : 'Grant Share Access'}
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setSharingModal(false)}>
                    Cancel
                  </SecondaryButton>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === 'security' ? (
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard
              title="Integrity Verification"
              description="Hash and verification controls for the current document version."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <SecondaryButton type="button" onClick={copyHash} disabled={!document.sha256}>
                    <ClipboardCopy className="h-4 w-4" />
                    {copiedHash ? 'Copied' : 'Copy Hash'}
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={handleVerifyIntegrity} disabled={verifying}>
                    <ShieldCheck className="h-4 w-4" />
                    {verifying ? 'Verifying...' : 'Verify Integrity'}
                  </SecondaryButton>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">SHA-256</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">{document.sha256}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Storage Type</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{document.storageType}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Encryption</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{document.encryptionStatus}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Version</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">v{document.currentVersion}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">OCR/Classification</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {document.ocrStatus} / {document.classificationStatus}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Processing History" description="Recent processing job state from the backend.">
              {document.latestJob ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Latest Job</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{document.latestJob.status}</p>
                    <p className="text-sm text-slate-600">Step: {document.latestJob.currentStep || 'N/A'}</p>
                    <p className="text-sm text-slate-600">Created: {formatDate(document.latestJob.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Document integrity is verified against the current stored version. No fabricated history is shown here.
                  </div>
                </div>
              ) : (
                <EmptyState title="No processing job yet" description="The backend has not created a processing job for this document." />
              )}
            </SectionCard>
          </div>
        ) : null}
      </div>

      {sharingModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Sharing</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Grant document access</h3>
              </div>
              <button
                type="button"
                onClick={() => setSharingModal(false)}
                className="inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="space-y-2 block">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Recipient Email</span>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(event) => setShareEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Permission</span>
                <select
                  value={sharePermission}
                  onChange={(event) => setSharePermission(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="VIEW">VIEW</option>
                  <option value="DOWNLOAD">DOWNLOAD</option>
                </select>
              </label>
              <label className="space-y-2 block">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Expires In (Days)</span>
                <input
                  type="number"
                  value={shareExpiresInDays}
                  onChange={(event) => setShareExpiresInDays(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <SecondaryButton type="button" onClick={() => setSharingModal(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="button" onClick={handleCreateShare} disabled={sharing || !shareEmail.trim()}>
                <Share2 className="h-4 w-4" />
                {sharing ? 'Creating...' : 'Grant Share Access'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
