import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Link, Upload, ClipboardPaste, Plus, Trash2,
  Loader2, CheckCircle, AlertTriangle,
  XCircle, Clock, Brain, ExternalLink, BarChart2, RefreshCw,
  ShieldCheck, Zap, AlertCircle, Info, Lock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import type { Asset } from '../types';
import type { AssetDocument, AssetReview, GeneratedQuestion, DocType, SourceType, ReviewStatus } from '../types/assetReview';
import { DOC_TYPE_LABELS, SOURCE_TYPE_LABELS, REVIEW_STATUS_LABELS, REVIEW_FRAMEWORKS } from '../types/assetReview';
import { AssetDocumentService, AssetReviewService } from '../services/assetReviewService';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface AssetReviewPanelProps {
  asset: Asset;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const statusColors: Record<ReviewStatus, string> = {
  pending:                 'bg-gray-100 text-gray-600',
  reviewing:               'bg-blue-100 text-blue-700',
  questionnaire_pending:   'bg-yellow-100 text-yellow-700',
  questionnaire_assigned:  'bg-orange-100 text-orange-700',
  questionnaire_completed: 'bg-purple-100 text-purple-700',
  addressed:               'bg-green-100 text-green-700',
};

const fetchStatusIcon = (status: string) => {
  if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'failed')    return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'fetching')  return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
  return <Clock className="h-4 w-4 text-gray-400" />;
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  high:     'bg-orange-50 border-orange-200 text-orange-800',
  medium:   'bg-yellow-50 border-yellow-200 text-yellow-800',
  low:      'bg-blue-50 border-blue-200 text-blue-800',
};

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function guessSourceType(url: string): SourceType {
  if (!url) return 'url';
  if (url.includes('github.com'))      return 'github';
  if (url.includes('gitlab.com'))      return 'gitlab';
  if (url.includes('confluence'))      return 'confluence';
  if (url.includes('sharepoint.com'))  return 'sharepoint';
  if (url.includes('drive.google.com')) return 'google_drive';
  if (url.includes('docs.google.com')) return 'google_drive';
  return 'url';
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Document modal
// ─────────────────────────────────────────────────────────────────────────────
interface AddDocForm {
  mode: 'url' | 'paste' | 'file';
  title: string;
  doc_type: DocType;
  url: string;
  access_token: string;
  text: string;
  file: File | null;
}

const EMPTY_DOC_FORM: AddDocForm = {
  mode: 'url', title: '', doc_type: 'other', url: '', access_token: '', text: '', file: null,
};

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv';
const MAX_FILE_MB = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const AssetReviewPanel: React.FC<AssetReviewPanelProps> = ({ asset, onClose }) => {
  const { user, canEnrich } = useAuth();
  const { selectedOrg } = useSelectedOrg();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orgId: number = (() => {
    if (user?.role?.startsWith('admin') && selectedOrg) return selectedOrg.org_id;
    return user?.org_id ?? 0;
  })();
  const orgCode: string = (() => {
    if (user?.role?.startsWith('admin') && selectedOrg) return selectedOrg.org_code;
    return user?.orgCode ?? '';
  })();

  // ── State ──────────────────────────────────────────────────────────────────
  const [docs, setDocs]           = useState<AssetDocument[]>([]);
  const [review, setReview]       = useState<AssetReview | null>(null);
  const [loadingDocs, setLoadingDocs]   = useState(true);
  const [loadingReview, setLoadingReview] = useState(true);
  const [reviewRunning, setReviewRunning] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [showAddDoc, setShowAddDoc] = useState(false);
  const [addDocForm, setAddDocForm] = useState<AddDocForm>(EMPTY_DOC_FORM);
  const [savingDoc, setSavingDoc]   = useState(false);
  const [docError, setDocError]     = useState<string | null>(null);

  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [assigningQuestionnaire, setAssigningQuestionnaire] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [activeTab, setActiveTab]   = useState<'documents' | 'review'>('documents');

  // Inline questionnaire state (for questionnaire_assigned — architect answers on behalf of owner)
  const [showInlineQuestionnaire, setShowInlineQuestionnaire] = useState(false);
  const [inlineAnswers, setInlineAnswers] = useState<Record<string, string>>({});

  const framework = REVIEW_FRAMEWORKS[asset.type] ?? REVIEW_FRAMEWORKS.application;

  // ── Load data ──────────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        AssetDocumentService.getDocuments(asset.id),
        AssetReviewService.getReview(asset.id),
      ]);
      setDocs(d);
      setReview(r);
    } catch { /* silently ignore */ }
    setLoadingDocs(false);
    setLoadingReview(false);
  }, [asset.id]);

  useEffect(() => { reload(); }, [reload]);

  // ── Add document ───────────────────────────────────────────────────────────
  const handleAddDoc = async () => {
    setDocError(null);
    if (!addDocForm.title.trim()) { setDocError('Title is required'); return; }
    if (addDocForm.mode === 'url' && !addDocForm.url.trim()) { setDocError('URL is required'); return; }
    if (addDocForm.mode === 'paste' && !addDocForm.text.trim()) { setDocError('Text is required'); return; }
    if (addDocForm.mode === 'file' && !addDocForm.file) { setDocError('Please select a file'); return; }
    if (addDocForm.mode === 'file' && addDocForm.file && addDocForm.file.size > MAX_FILE_MB * 1024 * 1024) {
      setDocError(`File must be under ${MAX_FILE_MB} MB`); return;
    }

    setSavingDoc(true);
    try {
      if (addDocForm.mode === 'file' && addDocForm.file) {
        // File upload path — use Storage + ai-doc-fetch
        const doc = await AssetReviewService.uploadDocumentFile({
          file:        addDocForm.file,
          asset_id:    asset.id,
          org_id:      orgId,
          org_code:    orgCode,
          title:       addDocForm.title.trim(),
          doc_type:    addDocForm.doc_type,
          uploaded_by: user?.email,
        });
        setDocs(prev => [doc, ...prev]);
      } else {
        const sourceType: SourceType = addDocForm.mode === 'paste'
          ? 'paste_text'
          : guessSourceType(addDocForm.url);

        const doc = await AssetDocumentService.addDocument({
          asset_id:     asset.id,
          org_id:       orgId,
          title:        addDocForm.title.trim(),
          doc_type:     addDocForm.doc_type,
          source_type:  sourceType,
          source_url:   addDocForm.mode === 'url' ? addDocForm.url.trim() : undefined,
          access_token: addDocForm.access_token.trim() || undefined,
          content:      addDocForm.mode === 'paste' ? addDocForm.text.trim() : undefined,
          uploaded_by:  user?.email,
        });
        setDocs(prev => [doc, ...prev]);

        if (sourceType !== 'paste_text') {
          AssetDocumentService.fetchDocument(doc.id)
            .then(() => reload())
            .catch(console.error);
        }
      }

      setAddDocForm(EMPTY_DOC_FORM);
      setShowAddDoc(false);
      reload();
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'Failed to save document');
    } finally {
      setSavingDoc(false);
    }
  };

  // ── Delete document ────────────────────────────────────────────────────────
  const handleDeleteDoc = async (docId: string) => {
    try {
      await AssetDocumentService.deleteDocument(docId);
      setDocs(prev => prev.filter(d => d.id !== docId));
    } catch { /* silently */ }
  };

  // ── Run AI review ──────────────────────────────────────────────────────────
  const handleStartReview = async (
    override = false,
    questionnaireAnswers?: Array<{ question_id: string; question: string; answer: string }>
  ) => {
    setReviewRunning(true);
    setReviewError(null);
    setShowOverrideConfirm(false);
    setShowInlineQuestionnaire(false);
    try {
      const result = await AssetReviewService.startReview({
        asset_id:             asset.id,
        org_id:               orgId,
        org_code:             orgCode,
        override_incomplete:  override,
        questionnaire_answers: questionnaireAnswers,
      });

      await reload();
      if (result.action === 'review_completed') {
        setActiveTab('review');
      }
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setReviewRunning(false);
    }
  };

  // ── Submit inline questionnaire answers ────────────────────────────────────
  const handleSubmitInlineQuestionnaire = () => {
    const questions = review?.ai_generated_questions ?? [];
    const answers = questions.map((q: GeneratedQuestion) => ({
      question_id: q.id || String(questions.indexOf(q)),
      question:    q.question,
      answer:      inlineAnswers[q.id || String(questions.indexOf(q))] ?? 'Not answered',
    }));
    handleStartReview(true, answers);
  };

  // ── Assign questionnaire ───────────────────────────────────────────────────
  const openAssignForm = () => {
    if (!review?.ai_generated_questions?.length) {
      setReviewError('No questions available — re-run the AI review to regenerate them.');
      return;
    }
    // Pre-fill with asset owner email, fall back to current user
    setAssignEmail((asset as any).owner_email || user?.email || '');
    setShowAssignForm(true);
  };

  const handleAssignQuestionnaire = async () => {
    if (!review?.ai_generated_questions?.length) {
      setReviewError('No questions available — re-run the AI review to regenerate them.');
      return;
    }
    const email = assignEmail.trim();
    if (!email) { setReviewError('Enter an email address to assign the questionnaire to.'); return; }

    setAssigningQuestionnaire(true);
    setReviewError(null);
    try {
      await AssetReviewService.createAssessproQuestionnaire({
        asset_id:        asset.id,
        asset_name:      asset.name,
        org_id:          orgId,
        org_code:        orgCode,
        questions:       review.ai_generated_questions,
        assign_to_users: [{ id: email, email, name: email }],
      });
      setShowAssignForm(false);
      await reload();
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to assign questionnaire');
    } finally {
      setAssigningQuestionnaire(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────
  const reviewStatus: ReviewStatus = review?.review_status ?? 'pending';
  const completeness = review?.completeness_score ?? 0;
  const concerns = review?.architecture_concerns ?? [];
  const sortedConcerns = [...concerns].sort(
    (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  );

  const completenessBar = (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">Documentation completeness</span>
        <span className="font-semibold text-gray-700">{completeness.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${
            completeness >= 70 ? 'bg-green-500' : completeness >= 40 ? 'bg-yellow-500' : 'bg-red-400'
          }`}
          style={{ width: `${completeness}%` }}
        />
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
          <div>
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Asset Review</p>
            <h2 className="text-lg font-semibold text-gray-900 mt-0.5">{asset.name}</h2>
            <p className="text-sm text-gray-500 capitalize">{asset.type}{asset.category ? ` · ${asset.category}` : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[reviewStatus]}`}>
              {REVIEW_STATUS_LABELS[reviewStatus]}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['documents', 'review'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'documents' ? `Documents (${docs.length})` : 'AI Review'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ─── DOCUMENTS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'documents' && (
            <div className="p-5 space-y-4">

              {/* Completeness hint */}
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-indigo-700">
                    Attach architecture docs, design decisions, NFR specs, runbooks, or paste text
                    from Confluence / SharePoint / GitHub. The AI review engine scores completeness
                    against the <strong>{asset.type}</strong> review framework ({framework.length} domains)
                    and generates targeted questions for any gaps.
                  </p>
                </div>
              </div>

              {/* Add document button — architect/admin only */}
              {canEnrich ? (
                <button
                  onClick={() => setShowAddDoc(v => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
                >
                  <Plus className="h-4 w-4" />
                  Add Document / URL / File
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Lock className="h-3.5 w-3.5" />
                  Document upload requires Architect role
                </div>
              )}

              {/* Add document form */}
              {canEnrich && showAddDoc && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                  {/* Mode toggle */}
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { id: 'url',   icon: <Link className="h-3.5 w-3.5" />,          label: 'URL / Link' },
                      { id: 'file',  icon: <Upload className="h-3.5 w-3.5" />,        label: 'Upload File' },
                      { id: 'paste', icon: <ClipboardPaste className="h-3.5 w-3.5" />, label: 'Paste Text' },
                    ] as { id: 'url' | 'file' | 'paste'; icon: React.ReactNode; label: string }[]).map(m => (
                      <button
                        key={m.id}
                        onClick={() => setAddDocForm(f => ({ ...f, mode: m.id, file: null }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          addDocForm.mode === m.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {m.icon}
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Document title *"
                    value={addDocForm.title}
                    onChange={e => setAddDocForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />

                  <select
                    value={addDocForm.doc_type}
                    onChange={e => setAddDocForm(f => ({ ...f, doc_type: e.target.value as DocType }))}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>

                  {addDocForm.mode === 'url' && (
                    <>
                      <input
                        type="url"
                        placeholder="https://confluence.example.com/... or GitHub / GitLab URL *"
                        value={addDocForm.url}
                        onChange={e => setAddDocForm(f => ({ ...f, url: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <input
                        type="password"
                        placeholder="Personal access token (optional — for private repos/spaces)"
                        value={addDocForm.access_token}
                        onChange={e => setAddDocForm(f => ({ ...f, access_token: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </>
                  )}

                  {addDocForm.mode === 'file' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null;
                          setAddDocForm(prev => ({
                            ...prev, file: f,
                            title: prev.title || (f?.name.replace(/\.[^.]+$/, '') ?? ''),
                          }));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-6 flex flex-col items-center gap-2 hover:border-indigo-400 transition-colors cursor-pointer"
                      >
                        <Upload className="h-6 w-6 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {addDocForm.file ? addDocForm.file.name : 'Click to select a file'}
                        </span>
                        <span className="text-xs text-gray-400">PDF, DOCX, PPTX, TXT, MD — max 50 MB</span>
                      </button>
                      {addDocForm.file && (
                        <p className="text-xs text-gray-500 mt-1">
                          {(addDocForm.file.size / 1024 / 1024).toFixed(2)} MB · {addDocForm.file.type || 'unknown type'}
                        </p>
                      )}
                    </div>
                  )}

                  {addDocForm.mode === 'paste' && (
                    <textarea
                      rows={6}
                      placeholder="Paste document text here... *"
                      value={addDocForm.text}
                      onChange={e => setAddDocForm(f => ({ ...f, text: e.target.value }))}
                      className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                  )}

                  {docError && <p className="text-xs text-red-600">{docError}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddDoc}
                      disabled={savingDoc}
                      className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {savingDoc ? (addDocForm.mode === 'file' ? 'Uploading...' : 'Saving...') : 'Save'}
                    </button>
                    <button
                      onClick={() => { setShowAddDoc(false); setAddDocForm(EMPTY_DOC_FORM); setDocError(null); }}
                      className="px-4 py-2 rounded text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Document list */}
              {loadingDocs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : docs.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No documents attached yet</p>
                  <p className="text-xs mt-1">Add a URL or paste text to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-start gap-3 border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="mt-0.5">{fetchStatusIcon(doc.fetch_status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 truncate">{doc.title}</span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {DOC_TYPE_LABELS[doc.doc_type]}
                          </span>
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                            {SOURCE_TYPE_LABELS[doc.source_type]}
                          </span>
                        </div>
                        {doc.summary && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.summary}</p>
                        )}
                        {doc.fetch_error && (
                          <p className="text-xs text-red-500 mt-1">{doc.fetch_error}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {doc.word_count ? (
                            <span className="text-xs text-gray-400">{doc.word_count.toLocaleString()} words</span>
                          ) : null}
                          {doc.source_url && (
                            <a
                              href={doc.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-500 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open
                            </a>
                          )}
                          {doc.fetch_status === 'failed' && doc.source_url && (
                            <button
                              onClick={() => AssetDocumentService.fetchDocument(doc.id).then(reload).catch(console.error)}
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                      {canEnrich && (
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="text-gray-300 hover:text-red-400 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Framework coverage summary */}
              {docs.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Review Framework — {asset.type}</h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {framework.map(d => (
                      <div key={d.id} className="flex items-center gap-2 text-xs">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          review?.missing_domains?.includes(d.id) ? 'bg-orange-400' : 'bg-green-500'
                        }`} />
                        <span className="text-gray-600">{d.label}</span>
                        {review?.missing_domains?.includes(d.id) && (
                          <span className="text-orange-500 text-xs">(gap)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── REVIEW TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'review' && (
            <div className="p-5 space-y-5">

              {loadingReview ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {/* Status card */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Review Status</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[reviewStatus]}`}>
                        {REVIEW_STATUS_LABELS[reviewStatus]}
                      </span>
                    </div>

                    {review && completenessBar}

                    {reviewError && (
                      <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {reviewError}
                      </div>
                    )}

                    {/* CTA buttons — gated by canEnrich */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canEnrich ? (
                        <>
                          {/* Start review */}
                          {(reviewStatus === 'pending' || reviewStatus === 'addressed') && (
                            <button
                              onClick={() => handleStartReview(false)}
                              disabled={reviewRunning}
                              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {reviewRunning
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Brain className="h-3.5 w-3.5" />}
                              {reviewRunning ? 'Reviewing...' : (reviewStatus === 'addressed' ? 'Re-run Review' : 'Start AI Review')}
                            </button>
                          )}

                          {/* Questionnaire actions */}
                          {reviewStatus === 'questionnaire_pending' && (
                            <>
                              <button
                                onClick={openAssignForm}
                                disabled={assigningQuestionnaire}
                                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
                              >
                                {assigningQuestionnaire
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <ExternalLink className="h-3.5 w-3.5" />}
                                {assigningQuestionnaire ? 'Assigning...' : 'Assign in AssessPro'}
                              </button>
                              <button
                                onClick={() => setShowOverrideConfirm(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
                              >
                                <Zap className="h-3.5 w-3.5" />
                                Skip & Review Now
                              </button>
                            </>
                          )}

                          {reviewStatus === 'questionnaire_assigned' && (
                            <button
                              onClick={() => setShowInlineQuestionnaire(v => !v)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-orange-600 text-white hover:bg-orange-700"
                            >
                              <ClipboardPaste className="h-3.5 w-3.5" />
                              {showInlineQuestionnaire ? 'Hide Questionnaire' : 'Complete Questionnaire'}
                            </button>
                          )}

                          {reviewStatus === 'questionnaire_completed' && (
                            <button
                              onClick={() => handleStartReview(true)}
                              disabled={reviewRunning}
                              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                            >
                              {reviewRunning
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Brain className="h-3.5 w-3.5" />}
                              {reviewRunning ? 'Analysing answers...' : 'Run Full Review with Answers'}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Lock className="h-3.5 w-3.5" />
                          AI review actions require Architect role
                        </div>
                      )}
                    </div>

                    {/* Override confirm */}
                    {showOverrideConfirm && (
                      <div className="mt-3 p-3 rounded bg-orange-50 border border-orange-200">
                        <p className="text-xs text-orange-800 mb-2">
                          Running without questionnaire answers may reduce review quality.
                          This asset will be flagged as <strong>low-confidence</strong> in the rationalization output.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartReview(true)}
                            className="px-3 py-1.5 text-xs font-medium rounded bg-orange-600 text-white hover:bg-orange-700"
                          >
                            Proceed anyway
                          </button>
                          <button
                            onClick={() => setShowOverrideConfirm(false)}
                            className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assign email form */}
                  {showAssignForm && (
                    <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-yellow-800">Assign Questionnaire</h4>
                      <p className="text-xs text-yellow-700">
                        The assessment will be created in AssessPro and assigned to the email below.
                        {(asset as any).owner_email
                          ? ` Pre-filled from asset owner: ${(asset as any).owner_email}`
                          : ' No owner email on record — enter the assignee\'s email.'}
                      </p>
                      <input
                        type="email"
                        placeholder="assignee@company.com"
                        value={assignEmail}
                        onChange={e => setAssignEmail(e.target.value)}
                        className="w-full text-sm border border-yellow-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAssignQuestionnaire}
                          disabled={assigningQuestionnaire || !assignEmail.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
                        >
                          {assigningQuestionnaire ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                          {assigningQuestionnaire ? 'Assigning...' : 'Confirm & Assign'}
                        </button>
                        <button
                          onClick={() => setShowAssignForm(false)}
                          className="px-3 py-2 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline questionnaire (when questionnaire_assigned — architect completes on behalf of owner) */}
                  {reviewStatus === 'questionnaire_assigned' && showInlineQuestionnaire && (
                    <div className="border border-orange-200 rounded-lg bg-orange-50">
                      <div className="px-4 py-3 border-b border-orange-200">
                        <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                          <ClipboardPaste className="h-4 w-4" />
                          Complete Assessment ({review?.ai_generated_questions?.length ?? 0} questions)
                        </h4>
                        <p className="text-xs text-orange-700 mt-0.5">
                          You are completing this on behalf of the asset owner. Answers will be used for the AI architectural review.
                        </p>
                      </div>
                      <div className="divide-y divide-orange-200">
                        {(review?.ai_generated_questions ?? []).map((q: GeneratedQuestion, i: number) => {
                          const qId = q.id || String(i);
                          const selectedAnswer = inlineAnswers[qId];
                          const yesNoOptions = ['Yes', 'No', 'Partially / N/A'];
                          const options = q.type === 'yes_no' ? yesNoOptions : (q.options ?? []);
                          return (
                            <div key={qId} className="px-4 py-4">
                              <div className="flex items-start gap-2 mb-3">
                                <span className="text-xs font-bold text-orange-600 mt-0.5 flex-shrink-0 w-6">Q{i+1}</span>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-800 font-medium leading-snug">{q.question}</p>
                                  <p className="text-xs text-orange-600 mt-0.5">{q.domain_label}</p>
                                </div>
                              </div>
                              {options.length > 0 ? (
                                <div className="flex flex-wrap gap-2 ml-8">
                                  {options.map((opt, oi) => (
                                    <button
                                      key={oi}
                                      onClick={() => setInlineAnswers(prev => ({ ...prev, [qId]: opt }))}
                                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                        selectedAnswer === opt
                                          ? 'bg-orange-600 text-white border-orange-600'
                                          : 'bg-white border-orange-300 text-orange-700 hover:bg-orange-100'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <textarea
                                  rows={2}
                                  className="w-full ml-8 text-sm border border-orange-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                                  placeholder="Type your answer..."
                                  value={selectedAnswer ?? ''}
                                  onChange={e => setInlineAnswers(prev => ({ ...prev, [qId]: e.target.value }))}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-4 py-4 border-t border-orange-200 flex items-center justify-between">
                        <p className="text-xs text-orange-700">
                          {Object.keys(inlineAnswers).length} of {review?.ai_generated_questions?.length ?? 0} answered
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowInlineQuestionnaire(false)}
                            className="px-3 py-2 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSubmitInlineQuestionnaire}
                            disabled={reviewRunning}
                            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                          >
                            {reviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                            {reviewRunning ? 'Running review...' : 'Submit & Run AI Review'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generated questions (when questionnaire_pending) */}
                  {reviewStatus === 'questionnaire_pending' && (
                    review?.ai_generated_questions?.length ? (
                      <div className="border border-yellow-200 rounded-lg bg-yellow-50">
                        <div className="px-4 py-3 border-b border-yellow-200">
                          <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            AI-Generated Assessment Questions ({review.ai_generated_questions.length})
                          </h4>
                          <p className="text-xs text-yellow-700 mt-0.5">
                            These questions will be sent to AssessPro when you click "Assign in AssessPro"
                          </p>
                        </div>
                        <div className="divide-y divide-yellow-200">
                          {review.ai_generated_questions.map((q: GeneratedQuestion, i) => (
                            <div key={q.id || i} className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-bold text-yellow-600 mt-0.5 flex-shrink-0">Q{i + 1}</span>
                                <div>
                                  <p className="text-xs text-gray-800 font-medium">{q.question}</p>
                                  <p className="text-xs text-yellow-600 mt-0.5">{q.domain_label}</p>
                                  {q.options && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {q.options.map((opt, oi) => (
                                        <span key={oi} className="text-xs bg-white border border-yellow-300 rounded px-1.5 py-0.5 text-gray-600">
                                          {opt}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-amber-200 rounded-lg bg-amber-50 p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Questions not available</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              The AI failed to generate questions last time (likely an LLM error).
                              Re-running will attempt question generation again, or fall back to a direct review.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartReview(false)}
                          disabled={reviewRunning}
                          className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {reviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                          {reviewRunning ? 'Running...' : 'Re-run AI Review'}
                        </button>
                      </div>
                    )
                  )}

                  {/* Review summary (when addressed) */}
                  {review?.review_summary && (
                    <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                      <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-4 w-4" />
                        Architecture Review Summary
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{review.review_summary}</p>
                    </div>
                  )}

                  {/* Architecture domain scores */}
                  {review?.architecture_domains && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-indigo-500" />
                        Domain Scores
                      </h4>
                      <div className="space-y-2.5">
                        {framework.map(d => {
                          const result = review.architecture_domains?.[d.id];
                          const score = result?.score ?? 0;
                          return (
                            <div key={d.id}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-600 font-medium">{d.label}</span>
                                <span className={`font-semibold ${
                                  score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-500'
                                }`}>
                                  {result ? `${score}/100` : '—'}
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-400'
                                  }`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                              {result?.notes && (
                                <p className="text-xs text-gray-500 mt-0.5">{result.notes}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Architecture concerns */}
                  {sortedConcerns.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">Architecture Concerns</h4>
                      {sortedConcerns.map((c, i) => (
                        <div key={i} className={`border rounded-lg p-3 ${severityColors[c.severity]}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-xs font-semibold uppercase tracking-wide">{c.severity}</span>
                            <span className="text-xs opacity-75">· {c.domain_label}</span>
                          </div>
                          <p className="text-xs font-medium">{c.concern}</p>
                          <p className="text-xs mt-1 opacity-80">{c.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No review yet */}
                  {reviewStatus === 'pending' && !review && (
                    <div className="text-center py-10 text-gray-400">
                      <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No AI review yet</p>
                      <p className="text-xs mt-1">Add documents then click "Start AI Review"</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetReviewPanel;
