import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  Database,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  GitBranch,
  Copy,
  Check,
  Download,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Search,
  SlidersHorizontal,
  ArrowRight,
  RefreshCw,
  Code2,
  Eye,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ATTACHED_CUSTOM_FORM_PRD,
  AUTH_MFA_EXAMPLE_STORY_MARKDOWN,
  DEFAULT_GEM_NAME,
  DEFAULT_GEM_SYSTEM_INSTRUCTIONS,
  INITIAL_GITLAB_STORIES,
  INITIAL_KNOWLEDGE_BASE_DOCS,
  INITIAL_PRD_ANALYSIS,
} from './data/initialData';
import {
  ClarifyingQuestion,
  GitLabUserStory,
  KnowledgeBaseDoc,
  PrdAnalysisResult,
  StoryPriority,
} from './types';
import {
  exportStoriesToGitLabCsv,
  formatAllStoriesToMarkdown,
  formatStoryToGitLabMarkdown,
} from './utils/gitlabFormatters';

type ActiveSection = 'workspace' | 'audit' | 'questions' | 'stories';

export default function App() {
  // Navigation state
  const [activeSection, setActiveSection] = useState<ActiveSection>('audit');

  // PRD & Gem Knowledge Base State
  const [prdTitle, setPrdTitle] = useState<string>(
    'Custom Form Reporting PRD: GUI Query Builder and Data Conversion Strategy'
  );
  const [prdMarkdown, setPrdMarkdown] = useState<string>(ATTACHED_CUSTOM_FORM_PRD);
  const [gemName, setGemName] = useState<string>(DEFAULT_GEM_NAME);
  const [gemInstructions, setGemInstructions] = useState<string>(
    DEFAULT_GEM_SYSTEM_INSTRUCTIONS
  );
  const [knowledgeBaseDocs, setKnowledgeBaseDocs] = useState<KnowledgeBaseDoc[]>(
    INITIAL_KNOWLEDGE_BASE_DOCS
  );
  const [exampleStoryMarkdown, setExampleStoryMarkdown] = useState<string>(
    AUTH_MFA_EXAMPLE_STORY_MARKDOWN
  );
  const [selectedKbDocId, setSelectedKbDocId] = useState<string>(
    INITIAL_KNOWLEDGE_BASE_DOCS[0].id
  );
  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbCategory, setNewKbCategory] =
    useState<KnowledgeBaseDoc['category']>('Auth & SSO');
  const [showAddKbModal, setShowAddKbModal] = useState(false);

  // Analysis & Q&A State
  const [analysisResult, setAnalysisResult] =
    useState<PrdAnalysisResult>(INITIAL_PRD_ANALYSIS);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>(
    INITIAL_PRD_ANALYSIS.clarifyingQuestions
  );
  const [auditFilter, setAuditFilter] = useState<
    'ALL' | 'CONFLICT' | 'CLARIFICATION_NEEDED' | 'ALIGNED'
  >('ALL');

  // GitLab Stories State
  const [stories, setStories] = useState<GitLabUserStory[]>(INITIAL_GITLAB_STORIES);
  const [disciplineFilter, setDisciplineFilter] = useState<
    'ALL' | 'Frontend' | 'Backend'
  >('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [storySearchQuery, setStorySearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'structured' | 'markdown'>('structured');
  const [includeQuickActions, setIncludeQuickActions] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Story Refinement & Inline Edit State
  const [refiningStoryId, setRefiningStoryId] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState<string>('');
  const [expandedInvestId, setExpandedInvestId] = useState<string | null>(null);
  const [newAcTextByStory, setNewAcTextByStory] = useState<Record<string, string>>({});

  // API Loading & Error State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGeneratingStories, setIsGeneratingStories] = useState<boolean>(false);
  const [isRefiningSingle, setIsRefiningSingle] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Derived metrics
  const unresolvedQuestionsCount = useMemo(
    () => clarifyingQuestions.filter((q) => !q.selectedAnswer.trim()).length,
    [clarifyingQuestions]
  );

  const filteredInfraChecks = useMemo(() => {
    if (auditFilter === 'ALL') return analysisResult.infraChecks;
    return analysisResult.infraChecks.filter((c) => c.status === auditFilter);
  }, [analysisResult.infraChecks, auditFilter]);

  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      if (disciplineFilter !== 'ALL' && story.discipline !== disciplineFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && story.priority !== priorityFilter) {
        return false;
      }
      if (storySearchQuery.trim()) {
        const q = storySearchQuery.toLowerCase();
        const matchTitle = story.title.toLowerCase().includes(q);
        const matchKey = story.issueKey.toLowerCase().includes(q);
        const matchBody =
          story.iWant.toLowerCase().includes(q) ||
          story.soThat.toLowerCase().includes(q) ||
          story.labels.some((l) => l.toLowerCase().includes(q));
        return matchTitle || matchKey || matchBody;
      }
      return true;
    });
  }, [stories, disciplineFilter, priorityFilter, storySearchQuery]);

  const storyStats = useMemo(() => {
    const feCount = stories.filter((s) => s.discipline === 'Frontend').length;
    const beCount = stories.filter((s) => s.discipline === 'Backend').length;
    const totalPoints = stories.reduce((acc, s) => acc + (s.storyPoints || 0), 0);
    const confirmItemsCount = stories.reduce(
      (acc, s) =>
        acc + s.acceptanceCriteria.filter((ac) => ac.needsConfirmation).length,
      0
    );
    return { feCount, beCount, totalPoints, confirmItemsCount };
  }, [stories]);

  const activeKbDoc = useMemo(
    () =>
      knowledgeBaseDocs.find((d) => d.id === selectedKbDocId) ||
      knowledgeBaseDocs[0],
    [knowledgeBaseDocs, selectedKbDocId]
  );

  // Handlers
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownloadCsv = () => {
    const csvContent = exportStoriesToGitLabCsv(filteredStories);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitlab-issues-${prdTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 35)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdownBundle = () => {
    const mdContent = formatAllStoriesToMarkdown(
      filteredStories,
      includeQuickActions
    );
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitlab-user-stories-${prdTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 35)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setPrdTitle(file.name.replace(/\.(md|txt|markdown)$/i, ''));
        setPrdMarkdown(content);
        setStatusBanner(`Loaded PRD file "${file.name}". Ready to run Deep Analysis against Gem.`);
      }
    };
    reader.readAsText(file);
  };

  const handleRunPrdAnalysis = async () => {
    setIsAnalyzing(true);
    setApiError(null);
    setStatusBanner(null);
    try {
      const response = await fetch('/api/analyze-prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prdTitle,
          prdMarkdown,
          knowledgeBaseDocs,
          gemName,
          gemInstructions,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze PRD against Knowledge Base.');
      }
      setAnalysisResult(data);
      setClarifyingQuestions(data.clarifyingQuestions || []);
      setActiveSection('audit');
      setStatusBanner(
        'Completed Pro-depth PRD analysis against the linked Gemini Gem Knowledge Base. Review the findings and clarifying questions below.'
      );
    } catch (err: unknown) {
      setApiError(
        err instanceof Error ? err.message : 'Unexpected error during PRD analysis.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateGitLabStories = async () => {
    setIsGeneratingStories(true);
    setApiError(null);
    setStatusBanner(null);
    try {
      const response = await fetch('/api/generate-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prdTitle,
          prdMarkdown,
          knowledgeBaseDocs,
          gemName,
          gemInstructions,
          clarifyingQuestions,
          exampleStoryMarkdown,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate GitLab user stories.');
      }
      if (Array.isArray(data.stories) && data.stories.length > 0) {
        setStories(data.stories);
        setActiveSection('stories');
        setStatusBanner(
          `Authored ${data.stories.length} INVEST-compliant Frontend & Backend GitLab user stories incorporating your resolved Q&A decisions.`
        );
      }
    } catch (err: unknown) {
      setApiError(
        err instanceof Error ? err.message : 'Unexpected error generating stories.'
      );
    } finally {
      setIsGeneratingStories(false);
    }
  };

  const handleRefineSingleStory = async (story: GitLabUserStory) => {
    if (!refineInstruction.trim()) return;
    setIsRefiningSingle(true);
    setApiError(null);
    try {
      const response = await fetch('/api/refine-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story,
          instruction: refineInstruction,
          knowledgeBaseDocs,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine story.');
      }
      setStories((prev) =>
        prev.map((s) => (s.id === story.id ? data.story : s))
      );
      setRefiningStoryId(null);
      setRefineInstruction('');
      setStatusBanner(`Refined story ${story.issueKey} with Gemini.`);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error ? err.message : 'Failed to refine story.'
      );
    } finally {
      setIsRefiningSingle(false);
    }
  };

  const handleToggleAcCheck = (storyId: string, acId: string) => {
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId
          ? {
              ...s,
              acceptanceCriteria: s.acceptanceCriteria.map((ac) =>
                ac.id === acId ? { ...ac, checked: !ac.checked } : ac
              ),
            }
          : s
      )
    );
  };

  const handleToggleAcConfirmFlag = (storyId: string, acId: string) => {
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId
          ? {
              ...s,
              acceptanceCriteria: s.acceptanceCriteria.map((ac) =>
                ac.id === acId
                  ? { ...ac, needsConfirmation: !ac.needsConfirmation }
                  : ac
              ),
            }
          : s
      )
    );
  };

  const handleAddAcceptanceCriterion = (storyId: string) => {
    const text = (newAcTextByStory[storyId] || '').trim();
    if (!text) return;
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId
          ? {
              ...s,
              acceptanceCriteria: [
                ...s.acceptanceCriteria,
                {
                  id: `ac-custom-${Date.now()}`,
                  text,
                  needsConfirmation: text.toLowerCase().includes('confirm'),
                  checked: false,
                },
              ],
            }
          : s
      )
    );
    setNewAcTextByStory((prev) => ({ ...prev, [storyId]: '' }));
  };

  const handleUpdateStoryPriority = (
    storyId: string,
    newPriority: StoryPriority
  ) => {
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, priority: newPriority } : s))
    );
  };

  const handleAddKbDoc = () => {
    if (!newKbTitle.trim()) return;
    const newDoc: KnowledgeBaseDoc = {
      id: `kb-custom-${Date.now()}`,
      title: newKbTitle.trim(),
      category: newKbCategory,
      lastUpdated: new Date().toISOString().slice(0, 10),
      enabled: true,
      content: `### ${newKbTitle.trim()}\nAdd architectural constraints, database schemas, or authentication contracts here...`,
    };
    setKnowledgeBaseDocs((prev) => [...prev, newDoc]);
    setSelectedKbDocId(newDoc.id);
    setNewKbTitle('');
    setShowAddKbModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('audit');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          StoryForge
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('workspace')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'workspace'
                ? 'border-indigo-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            1. PRD & Gem Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('audit')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'audit'
                ? 'border-indigo-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            2. Impact & Auth Audit
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('questions')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'questions'
                ? 'border-indigo-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            3. Clarifying Q&A ({clarifyingQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('stories')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'stories'
                ? 'border-indigo-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            4. GitLab Stories ({stories.length})
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleRunPrdAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing PRD vs Gem...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze PRD with Gem</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Sub-header Context Strip */}
      <div className="bg-slate-900 text-slate-200 px-6 py-3 border-b border-slate-800">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-300">
            <span className="font-semibold text-white">Active Document:</span>
            <span className="text-slate-200 font-medium">{prdTitle}</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>Linked Gem: {gemName}</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="font-mono text-indigo-300">
              Engine: gemini-3.8-flash (ThinkingLevel.HIGH)
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-300 font-mono tabular-nums">
            <span>{storyStats.beCount} BE Stories</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>{storyStats.feCount} FE Stories</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>{storyStats.totalPoints} Total Story Pts</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-amber-300">
              {storyStats.confirmItemsCount} **(confirm)** Flags
            </span>
          </div>
        </div>
      </div>

      {/* Notifications / Error Banner */}
      {(apiError || statusBanner) && (
        <div className="max-w-[1400px] w-full mx-auto px-6 pt-4">
          {apiError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Analysis / Generation Error</p>
                  <p className="text-xs text-red-700 mt-0.5">{apiError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-xs font-medium text-red-700 hover:underline whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          {statusBanner && !apiError && (
            <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-medium">{statusBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        {/* =========================================================
            TAB 1: PRD & GEMINI GEM KNOWLEDGE BASE SETUP
        ========================================================= */}
        {activeSection === 'workspace' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">
                  01. PRD Input & Gemini Gem Knowledge Base Link
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                  Configure the target Product Requirements Document alongside your linked
                  Calira / LabTrack Gemini Gem Knowledge Base so the reasoning engine can
                  validate authentication, RBAC, database encryption, and edge cases before
                  authoring FE/BE GitLab stories.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.markdown"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload PRD (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrdTitle(
                      'Custom Form Reporting PRD: GUI Query Builder and Data Conversion Strategy'
                    );
                    setPrdMarkdown(ATTACHED_CUSTOM_FORM_PRD);
                    setStatusBanner(
                      'Restored attached Custom Form Reporting PRD.'
                    );
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load Attached Custom Form PRD
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 6 cols: PRD Markdown Editor */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
                <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-slate-900">
                      Source PRD Document (Markdown)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {prdMarkdown.split(/\s+/).filter(Boolean).length} words ·{' '}
                    {prdMarkdown.split('\n').length} lines
                  </span>
                </div>

                <label className="block text-xs font-medium text-slate-700 mb-1">
                  PRD Document Title
                </label>
                <input
                  type="text"
                  value={prdTitle}
                  onChange={(e) => setPrdTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <label className="block text-xs font-medium text-slate-700 mb-1">
                  PRD Markdown Content
                </label>
                <textarea
                  value={prdMarkdown}
                  onChange={(e) => setPrdMarkdown(e.target.value)}
                  rows={22}
                  className="w-full flex-1 font-mono text-xs leading-relaxed p-3.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Right 6 cols: Linked Gemini Gem & Architecture Knowledge Base */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
                <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-slate-900">
                      Linked Gemini Gem & Architecture Knowledge Base
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddKbModal(!showAddKbModal)}
                    className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add KB Doc</span>
                  </button>
                </div>

                {showAddKbModal && (
                  <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <p className="text-xs font-semibold text-slate-800">
                      Add New Architecture / Gem Reference Document
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="e.g. 05. GraphQL / Webhook Specs"
                        value={newKbTitle}
                        onChange={(e) => setNewKbTitle(e.target.value)}
                        className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                      />
                      <select
                        value={newKbCategory}
                        onChange={(e) =>
                          setNewKbCategory(
                            e.target.value as KnowledgeBaseDoc['category']
                          )
                        }
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                      >
                        <option value="Auth & SSO">Auth & SSO</option>
                        <option value="Database & Security">
                          Database & Security
                        </option>
                        <option value="Entitlements & RBAC">
                          Entitlements & RBAC
                        </option>
                        <option value="FE/BE Standards">FE/BE Standards</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddKbModal(false)}
                        className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddKbDoc}
                        className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                      >
                        Create Document
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Connected Gemini Gem Name
                    </label>
                    <input
                      type="text"
                      value={gemName}
                      onChange={(e) => setGemName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Active Knowledge Modules
                    </label>
                    <div className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono tabular-nums">
                      {knowledgeBaseDocs.filter((d) => d.enabled).length} of{' '}
                      {knowledgeBaseDocs.length} modules active in context
                    </div>
                  </div>
                </div>

                {/* Knowledge Base Document Selector Tabs */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {knowledgeBaseDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedKbDocId(doc.id)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                        selectedKbDocId === doc.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={doc.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          setKnowledgeBaseDocs((prev) =>
                            prev.map((d) =>
                              d.id === doc.id ? { ...d, enabled: !d.enabled } : d
                            )
                          );
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="truncate max-w-[180px]">{doc.title}</span>
                    </button>
                  ))}
                </div>

                {activeKbDoc && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span>
                        Category: <strong className="text-slate-800">{activeKbDoc.category}</strong> · Updated{' '}
                        {activeKbDoc.lastUpdated}
                      </span>
                      {knowledgeBaseDocs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const remaining = knowledgeBaseDocs.filter(
                              (d) => d.id !== activeKbDoc.id
                            );
                            setKnowledgeBaseDocs(remaining);
                            setSelectedKbDocId(remaining[0].id);
                          }}
                          className="text-red-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      value={activeKbDoc.content}
                      onChange={(e) => {
                        const val = e.target.value;
                        setKnowledgeBaseDocs((prev) =>
                          prev.map((d) =>
                            d.id === activeKbDoc.id ? { ...d, content: val } : d
                          )
                        );
                      }}
                      rows={11}
                      className="w-full font-mono text-xs leading-relaxed p-3 bg-slate-50 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gem System Instructions & Reference GitLab Story Format (SSO / MFA Fatigue Template)
                </label>
                <textarea
                  value={exampleStoryMarkdown}
                  onChange={(e) => setExampleStoryMarkdown(e.target.value)}
                  rows={6}
                  className="w-full font-mono text-xs leading-relaxed p-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: IMPACT & AUTH INFRASTRUCTURE ALIGNMENT AUDIT
        ========================================================= */}
        {activeSection === 'audit' && (
          <div className="space-y-8">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">
                  02. Infrastructure Alignment & Missing Requirements Audit
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                  Deep reasoning impact assessment comparing the{' '}
                  <strong className="text-slate-900">{prdTitle}</strong> against the{' '}
                  <strong className="text-slate-900">{gemName}</strong> (Authentication &
                  MFA SSO Flow, RBAC Matrix, Enterprise Gating, and PostgreSQL AES-256
                  Storage).
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSection('questions')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Resolve Clarifying Questions ({clarifyingQuestions.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Executive Summary & Authentication Alignment Verdict */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-900">
                      Executive Architectural Impact Summary
                    </span>
                    <span className="font-mono">{analysisResult.modelUsed}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {analysisResult.executiveAlignmentSummary}
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono tabular-nums">
                  <span>
                    Conflicts Detected:{' '}
                    <strong className="text-red-600">
                      {
                        analysisResult.infraChecks.filter(
                          (c) => c.status === 'CONFLICT'
                        ).length
                      }
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Clarifications Needed:{' '}
                    <strong className="text-amber-600">
                      {
                        analysisResult.infraChecks.filter(
                          (c) => c.status === 'CLARIFICATION_NEEDED'
                        ).length
                      }
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Aligned Areas:{' '}
                    <strong className="text-emerald-600">
                      {
                        analysisResult.infraChecks.filter(
                          (c) => c.status === 'ALIGNED'
                        ).length
                      }
                    </strong>
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span>
                        Authentication, SSO/MFA & RBAC Infrastructure Alignment Verdict
                      </span>
                    </span>
                    <span className="text-amber-700 font-semibold">
                      Action Required on Instructor Role
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {analysisResult.authAlignmentVerdict}
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Verified against: <strong>KB 01 (SSO & MFA Fatigue)</strong> &{' '}
                    <strong>KB 02 (RBAC Matrix)</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('workspace')}
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    Inspect Gem Docs →
                  </button>
                </div>
              </div>
            </div>

            {/* Infrastructure Alignment Checks Matrix */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-display">
                    Infrastructure & Authentication Alignment Matrix
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Component-by-component verification of the PRD against existing Calira &
                    LabTrack architecture.
                  </p>
                </div>

                {/* Interactive Filter Controls */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                  {(
                    [
                      ['ALL', 'All Checks'],
                      ['CONFLICT', 'Conflicts'],
                      ['CLARIFICATION_NEEDED', 'Needs Clarification'],
                      ['ALIGNED', 'Aligned'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAuditFilter(key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        auditFilter === key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredInfraChecks.map((check) => (
                  <div key={check.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {check.status === 'CONFLICT' && (
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        {check.status === 'CLARIFICATION_NEEDED' && (
                          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        {check.status === 'ALIGNED' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <h3 className="text-sm font-bold text-slate-900">
                          {check.area}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span>Layer: {check.layer}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            check.status === 'CONFLICT'
                              ? 'text-red-700 font-semibold'
                              : check.status === 'CLARIFICATION_NEEDED'
                              ? 'text-amber-700 font-semibold'
                              : 'text-emerald-700 font-semibold'
                          }
                        >
                          Status: {check.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-800 mb-3">{check.summary}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200/80 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 mb-1">
                          PRD Requirement
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                          {check.prdRequirement}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 mb-1">
                          Existing Infrastructure Reality (Gem KB)
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                          {check.infrastructureReality}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-950 mb-1">
                          Architectural Recommendation
                        </p>
                        <p className="text-indigo-900 leading-relaxed">
                          {check.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing Requirements & Edge Cases Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="pb-4 mb-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-display">
                    Missing Requirements & Unaddressed Edge Cases
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gaps identified in the PRD before authoring Front-End and Back-End
                    GitLab stories.
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {analysisResult.missingRequirements.length} gaps detected
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 pr-4">Gap / Edge Case</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">PRD Section</th>
                      <th className="py-3 pl-4">Architectural Impact Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {analysisResult.missingRequirements.map((gap) => (
                      <tr key={gap.id} className="hover:bg-slate-50/80 align-top">
                        <td className="py-3.5 pr-4 font-semibold text-slate-900 whitespace-nowrap">
                          {gap.title}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {gap.category}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          <span
                            className={
                              gap.severity === 'Critical'
                                ? 'text-red-700 font-semibold'
                                : gap.severity === 'High'
                                ? 'text-amber-700 font-semibold'
                                : 'text-slate-700 font-medium'
                            }
                          >
                            {gap.severity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono whitespace-nowrap">
                          {gap.prdSection}
                        </td>
                        <td className="py-3.5 pl-4 text-slate-700 leading-relaxed max-w-xl">
                          {gap.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: CLARIFYING Q&A GATE (FILL GAPS BEFORE FINALIZING)
        ========================================================= */}
        {activeSection === 'questions' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">
                  03. Pre-Authoring Clarifying Questions & Edge-Case Decisions
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                  Review and confirm product/architecture decisions for the missing
                  requirements detected in the PRD. Clicking{' '}
                  <strong className="text-slate-900">
                    Regenerate GitLab Stories with Decisions
                  </strong>{' '}
                  updates both Frontend and Backend acceptance criteria.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerateGitLabStories}
                  disabled={isGeneratingStories}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isGeneratingStories ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Authoring FE/BE Stories...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Regenerate GitLab Stories with Decisions</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {clarifyingQuestions.map((q, index) => (
                <div
                  key={q.id}
                  className="bg-white border border-slate-200 rounded-xl p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-semibold text-indigo-700">
                      Question 0{index + 1} · Impact: {q.impactArea}
                    </span>
                    <span className="text-xs text-slate-500">
                      {q.selectedAnswer ? 'Decision Selected' : 'Needs Input'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1.5">
                    {q.question}
                  </h3>
                  <p className="text-xs text-slate-600 mb-4">{q.context}</p>

                  <div className="space-y-2 mb-4">
                    {q.options.map((option, optIdx) => {
                      const isSelected = q.selectedAnswer === option;
                      return (
                        <label
                          key={optIdx}
                          className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-600 text-slate-900 font-medium'
                              : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            checked={isSelected}
                            onChange={() => {
                              setClarifyingQuestions((prev) =>
                                prev.map((item) =>
                                  item.id === q.id
                                    ? {
                                        ...item,
                                        selectedAnswer: option,
                                        isResolved: true,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <span>{option}</span>
                            {optIdx === 0 && (
                              <span className="ml-2 text-indigo-700 font-mono text-[11px]">
                                (Recommended by Gem)
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Custom Override or Additional Engineering Context (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Add specific constraint or override the selected answer..."
                      value={q.customNotes || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setClarifyingQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ? { ...item, customNotes: val } : item
                          )
                        );
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: GITLAB USER STORIES (FE/BE SPLIT + INVEST + EXPORT)
        ========================================================= */}
        {activeSection === 'stories' && (
          <div className="space-y-6">
            {/* Header & Export Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">
                  04. GitLab User Stories Backlog (FE / BE Split & INVEST Validated)
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                  Stories are strictly separated into{' '}
                  <strong className="text-slate-900">Frontend (FE)</strong> and{' '}
                  <strong className="text-slate-900">Backend (BE)</strong> issues,
                  prioritized and tagged based on user needs, and formatted in native
                  GitLab Issue Markdown with <code className="font-mono">**(confirm)**</code>{' '}
                  checkpoints.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      formatAllStoriesToMarkdown(
                        filteredStories,
                        includeQuickActions
                      ),
                      'copy-all-md'
                    )
                  }
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedId === 'copy-all-md' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied All Markdown</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All GitLab Markdown</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMarkdownBundle}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export .md</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download GitLab CSV Import</span>
                </button>
              </div>
            </div>

            {/* Filter & View Mode Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Discipline Segmented Filter */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['ALL', 'Backend', 'Frontend'] as const).map((disc) => (
                    <button
                      key={disc}
                      type="button"
                      onClick={() => setDisciplineFilter(disc)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        disciplineFilter === disc
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {disc === 'ALL'
                        ? `All Tracks (${stories.length})`
                        : disc === 'Backend'
                        ? `Backend (${storyStats.beCount})`
                        : `Frontend (${storyStats.feCount})`}
                    </button>
                  ))}
                </div>

                {/* Priority Filter Dropdown */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="P0 - Critical">P0 - Critical</option>
                  <option value="P1 - High">P1 - High</option>
                  <option value="P2 - Medium">P2 - Medium</option>
                  <option value="P3 - Low">P3 - Low</option>
                </select>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter by title, label, or keyword..."
                    value={storySearchQuery}
                    onChange={(e) => setStorySearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg w-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeQuickActions}
                    onChange={(e) => setIncludeQuickActions(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Include GitLab `/label` & `/weight` actions</span>
                </label>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('structured')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                      viewMode === 'structured'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Interactive Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('markdown')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                      viewMode === 'markdown'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>GitLab Markdown</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stories List */}
            {filteredStories.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No GitLab user stories match your current filter criteria.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDisciplineFilter('ALL');
                    setPriorityFilter('ALL');
                    setStorySearchQuery('');
                  }}
                  className="mt-3 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredStories.map((story) => {
                  const rawMarkdown = formatStoryToGitLabMarkdown(
                    story,
                    includeQuickActions
                  );
                  const isInvestOpen = expandedInvestId === story.id;
                  const isRefiningThis = refiningStoryId === story.id;

                  return (
                    <article
                      key={story.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 transition-shadow hover:shadow-xs"
                    >
                      {/* Story Top Metadata Row (Zero-Pill Unboxed Text Discipline) */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                          <span className="font-bold text-indigo-700">
                            {story.issueKey}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span
                            className={
                              story.discipline === 'Backend'
                                ? 'font-semibold text-slate-900'
                                : 'font-semibold text-indigo-900'
                            }
                          >
                            {story.discipline} Track
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <select
                            value={story.priority}
                            onChange={(e) =>
                              handleUpdateStoryPriority(
                                story.id,
                                e.target.value as StoryPriority
                              )
                            }
                            className={`text-xs font-semibold bg-transparent border-none p-0 focus:ring-0 cursor-pointer ${
                              story.priority.startsWith('P0')
                                ? 'text-red-700'
                                : story.priority.startsWith('P1')
                                ? 'text-amber-700'
                                : 'text-slate-700'
                            }`}
                          >
                            <option value="P0 - Critical">P0 - Critical</option>
                            <option value="P1 - High">P1 - High</option>
                            <option value="P2 - Medium">P2 - Medium</option>
                            <option value="P3 - Low">P3 - Low</option>
                          </select>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-600 tabular-nums">
                            Weight: {story.storyPoints} pts
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-500">{story.phase}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setRefiningStoryId(
                                isRefiningThis ? null : story.id
                              )
                            }
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>Refine with AI</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(rawMarkdown, `copy-${story.id}`)
                            }
                            className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {copiedId === `copy-${story.id}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied Issue</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy GitLab MD</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Optional AI Refinement Bar */}
                      {isRefiningThis && (
                        <div className="mb-4 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            placeholder="e.g., Add edge case for SSO token expiry or split into smaller tasks..."
                            value={refineInstruction}
                            onChange={(e) => setRefineInstruction(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            disabled={isRefiningSingle}
                            onClick={() => handleRefineSingleStory(story)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isRefiningSingle ? 'Updating...' : 'Apply Refinement'}
                          </button>
                        </div>
                      )}

                      {viewMode === 'markdown' ? (
                        <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">
                          {rawMarkdown}
                        </pre>
                      ) : (
                        <div>
                          {/* Title */}
                          <h2 className="text-lg font-bold text-slate-900 font-display mb-3">
                            ## {story.title}
                          </h2>

                          {/* Standard User Story Prose */}
                          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg text-sm text-slate-800 leading-relaxed mb-4">
                            <strong>As a</strong> {story.persona},{' '}
                            <strong>I want</strong> {story.iWant},{' '}
                            <strong>so that</strong> {story.soThat}.
                          </div>

                          {/* Acceptance Criteria Checklist */}
                          <div className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-semibold text-slate-700">
                                Acceptance Criteria (GitLab Task List)
                              </h3>
                              <span className="text-[11px] text-slate-500">
                                Click <strong>(confirm)</strong> toggle to mark items
                                needing stakeholder verification
                              </span>
                            </div>

                            <ul className="space-y-2">
                              {story.acceptanceCriteria.map((ac) => (
                                <li
                                  key={ac.id}
                                  className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60 text-xs"
                                >
                                  <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                                    <input
                                      type="checkbox"
                                      checked={ac.checked}
                                      onChange={() =>
                                        handleToggleAcCheck(story.id, ac.id)
                                      }
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600"
                                    />
                                    <span
                                      className={`leading-relaxed ${
                                        ac.checked
                                          ? 'line-through text-slate-400'
                                          : 'text-slate-800'
                                      }`}
                                    >
                                      {ac.text}{' '}
                                      {ac.needsConfirmation && (
                                        <strong className="text-amber-700 font-mono">
                                          **(confirm)**
                                        </strong>
                                      )}
                                    </span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleAcConfirmFlag(story.id, ac.id)
                                    }
                                    className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                      ac.needsConfirmation
                                        ? 'bg-amber-100 text-amber-900 font-semibold'
                                        : 'text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {ac.needsConfirmation
                                      ? '**(confirm)** on'
                                      : '+ confirm'}
                                  </button>
                                </li>
                              ))}
                            </ul>

                            {/* Add custom AC input */}
                            <div className="mt-2.5 flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Add another acceptance criterion checkbox..."
                                value={newAcTextByStory[story.id] || ''}
                                onChange={(e) =>
                                  setNewAcTextByStory((prev) => ({
                                    ...prev,
                                    [story.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddAcceptanceCriterion(story.id);
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddAcceptanceCriterion(story.id)
                                }
                                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                + Add Criterion
                              </button>
                            </div>
                          </div>

                          {/* Priority Rationale, API Contract & Labels Footer */}
                          <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <span className="font-semibold text-slate-900">
                                  Automated Priority Rationale:{' '}
                                </span>
                                <span className="text-slate-600">
                                  {story.priorityRationale}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900">
                                  FE/BE API Contract & Dependencies:{' '}
                                </span>
                                <span className="text-slate-600">
                                  {story.apiContractNote}
                                  {story.dependencies.length > 0 &&
                                    ` (Depends on: ${story.dependencies.join(', ')})`}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                              <div className="text-slate-500 font-mono text-[11px]">
                                <span className="font-semibold text-slate-700">
                                  GitLab Labels:{' '}
                                </span>
                                {story.labels.join(' · ')}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedInvestId(
                                    isInvestOpen ? null : story.id
                                  )
                                }
                                className="text-indigo-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>
                                  INVEST Compliance & Architecture Notes
                                </span>
                                {isInvestOpen ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {isInvestOpen && (
                              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-slate-700">
                                  <span>
                                    [I] Independent:{' '}
                                    <strong>
                                      {story.invest.independent
                                        ? 'Yes'
                                        : 'Coupled via API Contract'}
                                    </strong>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    [N] Negotiable:{' '}
                                    <strong>
                                      {story.invest.negotiable ? 'Pass' : 'Review'}
                                    </strong>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    [V] Valuable:{' '}
                                    <strong>
                                      {story.invest.valuable ? 'Pass' : 'Review'}
                                    </strong>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    [E] Estimable:{' '}
                                    <strong>
                                      {story.invest.estimable
                                        ? `Pass (${story.storyPoints} pts)`
                                        : 'Review'}
                                    </strong>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    [S] Small:{' '}
                                    <strong>
                                      {story.invest.small ? 'Pass' : 'Review'}
                                    </strong>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    [T] Testable:{' '}
                                    <strong>
                                      {story.invest.testable ? 'Pass' : 'Review'}
                                    </strong>
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600">
                                  <strong>Independence / Split Note:</strong>{' '}
                                  {story.invest.IndependentNote}
                                </p>
                                <p className="text-xs text-slate-600">
                                  <strong>Architectural Implementation Note:</strong>{' '}
                                  {story.architecturalNotes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 mt-12">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            StoryForge — Calira & LabTrack PRD-to-GitLab Issue Architect
          </span>
          <span>
            FE/BE Split · INVEST Validated · Native GitLab Markdown & CSV Import
          </span>
        </div>
      </footer>
    </div>
  );
}
