'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileUp, ShieldCheck, UploadCloud } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ErrorState, PageHeader, PrimaryButton, SectionCard } from '@/components/enterprise-ui';

interface CaseItem {
  id: string;
  caseNumber: string;
  title: string;
  department: string;
}

export default function UploadDocumentPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caseId, setCaseId] = useState('');
  const [documentType, setDocumentType] = useState('OTHER');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadCases = async () => {
      try {
        const res = await fetch('/api/v1/cases?limit=100&sortBy=updatedAt&sortOrder=desc');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load cases');
        setCases((data.cases || []).map((item: any) => ({ id: item.id, caseNumber: item.caseNumber, title: item.title, department: item.department })));
      } catch (err: any) {
        setError(err.message || 'Failed to load cases');
      } finally {
        setLoadingCases(false);
      }
    };

    loadCases();
  }, [router]);

  const selectedCase = useMemo(() => cases.find((item) => item.id === caseId), [cases, caseId]);

  const readFileAsBase64 = (value: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Unable to read selected file'));
      reader.readAsDataURL(value);
    });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!caseId || !file) {
      setError('Please choose a case and a file.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(10);

    try {
      const contentBase64 = await readFileAsBase64(file);
      setProgress(35);

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let resolvedMime = file.type || 'application/octet-stream';
      if (!file.type || file.type === 'application/octet-stream') {
        if (ext === 'pdf') resolvedMime = 'application/pdf';
        else if (ext === 'png') resolvedMime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') resolvedMime = 'image/jpeg';
        else if (ext === 'txt') resolvedMime = 'text/plain';
        else if (ext === 'docx') resolvedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === 'tif' || ext === 'tiff') resolvedMime = 'image/tiff';
      }

      const initResponse = await fetch(`/api/v1/cases/${caseId}/documents/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: resolvedMime,
          sizeInBytes: file.size,
          documentType,
        }),
      });

      const initData = await initResponse.json();
      if (!initResponse.ok) {
        throw new Error(initData.error || 'Failed to initialize upload');
      }

      setProgress(65);

      const completeResponse = await fetch(`/api/v1/cases/${caseId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: initData.documentId,
          storageKey: initData.storageKey,
          originalFilename: file.name,
          mimeType: resolvedMime,
          fileSize: file.size,
          contentBase64,
          documentType,
          title: title.trim() || file.name,
        }),
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) {
        throw new Error(completeData.error || 'Failed to upload document');
      }

      setProgress(100);
      router.push(`/documents/${completeData.document.id}`);
    } catch (err: any) {
      setError(err.message || 'Document upload failed');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Documents', href: '/documents' }, { label: 'Upload' }]}
      title="Upload Document"
      subtitle="Secure upload flow backed by the existing case-scoped document endpoints."
      actions={
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Repository
        </Link>
      }
    >
      <PageHeader
        eyebrow="Document Intake"
        title="Upload an encrypted document"
        description="Select a case, choose a file, and the backend will initialize the storage key before recording the encrypted document metadata."
      />

      {error ? <ErrorState title="Upload failed" description={error} /> : null}

      <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="File Selection" description="Choose the case and file to upload.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case *</span>
              <select
                value={caseId}
                onChange={(event) => setCaseId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                disabled={loadingCases}
              >
                <option value="">{loadingCases ? 'Loading cases...' : 'Select a case'}</option>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.caseNumber} · {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Document Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional title for the repository"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Document Type</span>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              >
                <option value="OTHER">OTHER</option>
                <option value="FIR">FIR</option>
                <option value="POLICE_REPORT">POLICE_REPORT</option>
                <option value="INVESTIGATION_REPORT">INVESTIGATION_REPORT</option>
                <option value="WITNESS_STATEMENT">WITNESS_STATEMENT</option>
                <option value="CHARGE_SHEET">CHARGE_SHEET</option>
                <option value="COURT_FILING">COURT_FILING</option>
                <option value="EVIDENCE_REPORT">EVIDENCE_REPORT</option>
                <option value="FORENSIC_REPORT">FORENSIC_REPORT</option>
                <option value="LEGAL_DOCUMENT">LEGAL_DOCUMENT</option>
                <option value="JUDGMENT">JUDGMENT</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">File *</span>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </label>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Upload Status" description="The progress indicator reflects each step of the backend workflow.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Workflow</p>
                <ol className="mt-2 space-y-2">
                  <li>1. Read selected file locally and encode as base64.</li>
                  <li>2. Initialize a case-scoped storage key through the backend.</li>
                  <li>3. Persist the encrypted document record and version metadata.</li>
                </ol>
              </div>
            </div>
          </SectionCard>

          {selectedCase ? (
            <SectionCard title="Selected Case" description="The document will be attached to this case.">
              <div className="space-y-1 text-sm text-slate-700">
                <p className="font-medium text-slate-900">{selectedCase.caseNumber}</p>
                <p>{selectedCase.title}</p>
                <p className="text-xs text-slate-500">{selectedCase.department}</p>
              </div>
            </SectionCard>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
            <PrimaryButton type="submit" disabled={loading || loadingCases}>
              <UploadCloud className="h-4 w-4" />
              {loading ? 'Uploading...' : 'Upload Document'}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
