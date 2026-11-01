export type AlignmentStatus = 'ALIGNED' | 'CONFLICT' | 'CLARIFICATION_NEEDED';

export interface InfraAlignmentCheck {
  id: string;
  area: string;
  layer: 'Auth / Security' | 'Database' | 'Backend' | 'Frontend';
  status: AlignmentStatus;
  summary: string;
  prdRequirement: string;
  infrastructureReality: string;
  recommendation: string;
}

export interface MissingRequirement {
  id: string;
  title: string;
  category: 'Authentication & RBAC' | 'Data & Encryption' | 'Query Logic & Edge Case' | 'UX & Performance' | 'API Contract';
  severity: 'Critical' | 'High' | 'Medium';
  description: string;
  prdSection: string;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  context: string;
  impactArea: 'Both FE & BE' | 'Backend' | 'Frontend' | 'Security / Auth';
  options: string[];
  selectedAnswer: string;
  customNotes?: string;
  isResolved: boolean;
}

export interface InvestCheck {
  independent: boolean;
  IndependentNote: string;
  negotiable: boolean;
  valuable: boolean;
  estimable: boolean;
  small: boolean;
  testable: boolean;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  needsConfirmation: boolean;
  checked: boolean;
}

export type StoryPriority = 'P0 - Critical' | 'P1 - High' | 'P2 - Medium' | 'P3 - Low';

export interface GitLabUserStory {
  id: string;
  issueKey: string;
  title: string;
  discipline: 'Frontend' | 'Backend';
  phase: 'Phase 1 MVP' | 'Phase 2 Extension';
  persona: string;
  iWant: string;
  soThat: string;
  priority: StoryPriority;
  priorityRationale: string;
  storyPoints: number;
  labels: string[];
  dependencies: string[];
  apiContractNote: string;
  acceptanceCriteria: AcceptanceCriterion[];
  invest: InvestCheck;
  architecturalNotes: string;
}

export interface KnowledgeBaseDoc {
  id: string;
  title: string;
  category: 'Auth & SSO' | 'Database & Security' | 'Entitlements & RBAC' | 'FE/BE Standards';
  lastUpdated: string;
  content: string;
  enabled: boolean;
}

export interface PrdAnalysisResult {
  analyzedAt: string;
  modelUsed: string;
  reasoningMode: string;
  executiveAlignmentSummary: string;
  authAlignmentVerdict: string;
  infraChecks: InfraAlignmentCheck[];
  missingRequirements: MissingRequirement[];
  clarifyingQuestions: ClarifyingQuestion[];
}
