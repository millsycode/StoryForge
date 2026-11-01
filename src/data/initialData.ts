import {
  KnowledgeBaseDoc,
  PrdAnalysisResult,
  GitLabUserStory,
} from '../types';

export const DEFAULT_GEM_NAME = 'Calira / LabTrack Principal Architecture Gem';

export const DEFAULT_GEM_SYSTEM_INSTRUCTIONS = `You are the Calira & LabTrack Principal Systems Architect and Agile Backlog Lead.
When evaluating a PRD against the Calira Knowledge Base:
1. Verify Authentication, SSO (IdP direct routing, inherited org/department providers, MFA pass-through), RBAC roles (Lab Admin, Org Admin, Instructor, Researcher, Student, Guest), and Entitlement Gating (Core, Premium, Enterprise).
2. Identify every missing requirement, unaddressed edge case, and architectural conflict (such as AES-256 column-level encryption vs SQL WHERE/LIKE/comparison indexing, form versioning drift, or synchronous export timeouts).
3. Formulate targeted clarifying questions for Product & Engineering before locking story acceptance criteria.
4. Author User Stories split strictly into Frontend (FE) and Backend (BE) tracks. Adhere to the INVEST principle (Independent, Negotiable, Valuable, Estimable, Small, Testable) wherever it does not conflict with the FE/BE split, and document the API contract bridging FE and BE stories.
5. Format every story in clean GitLab Issue Markdown with "## Title", "**As a** ..., **I want** ..., **so that** ...", checkbox acceptance criteria "- [ ] ...", and mark items requiring product confirmation with "**(confirm)**".`;

export const INITIAL_KNOWLEDGE_BASE_DOCS: KnowledgeBaseDoc[] = [
  {
    id: 'kb-auth-sso',
    title: '01. Calira & LabTrack Authentication, SSO & MFA Infrastructure',
    category: 'Auth & SSO',
    lastUpdated: '2026-10-18',
    enabled: true,
    content: `### Calira / LabTrack Identity & Access Architecture
- **Identity Provider (IdP) & SSO Routing**: Labs may configure SAML 2.0 / OIDC SSO directly at the Lab level or inherit SSO configuration from their parent Department or Organisation.
- **Direct Organisation Sign-In (MFA Fatigue Mitigation)**: Clicking "Login via your organisation" on an SSO-linked lab routes the embedded auth window directly to the customer's IdP sign-in endpoint using the resolved tenant/inherited provider ID (no intermediate Calira login flash or tenant search). IdP-enforced MFA prompts remain strictly untouched.
- **Session & API Token Claims**: Authenticated sessions issue a short-lived JWT (15 min) + HTTP-only refresh cookie containing: \`sub\` (user_id), \`org_id\`, \`lab_id\`, \`role\` (\`org_admin\`, \`lab_admin\`, \`instructor\`, \`researcher\`, \`student\`, \`guest\`), \`entitlement_tier\` (\`core\`, \`premium\`, \`enterprise\`), and \`amr\` (authentication methods reference, including \`mfa\` when verified by IdP).
- **Sensitive Report & Export Step-Up Policy**: Any bulk data export (CSV/PDF) or cross-lab reporting endpoint in \`/api/v2/reports/*\` requires:
  1. Valid active session token with \`role IN ('org_admin', 'lab_admin')\` (Note: \`instructor\` role currently has read-only access ONLY to \`/api/v2/equipment/:managed_id/bookings\`, NOT the global \`/reports\` namespace).
  2. For labs with SSO + MFA enabled, bulk CSV downloads must validate the existing session cookie without triggering a redundant re-login popup (avoiding MFA fatigue), while logging an immutable audit event in \`security_audit_logs\`.`
  },
  {
    id: 'kb-rbac-entitlements',
    title: '02. RBAC Personas & Enterprise Entitlement Gating Pattern',
    category: 'Entitlements & RBAC',
    lastUpdated: '2026-09-30',
    enabled: true,
    content: `### Role-Based Access Control (RBAC) Matrix
| Role | Global Reports Tab | Equipment Bookings | Custom Form Submissions | Saved Searches |
| :--- | :--- | :--- | :--- | :--- |
| **Org Admin** | Full Access (All Labs in Org) | Full Access | Read / Export | Create / Edit / Delete |
| **Lab Admin** | Full Access (Assigned Lab) | Full Access | Read / Export | Create / Edit / Delete |
| **Instructor** | **No Access** to Global Reports tab today | Manage assigned equipment only | View single booking JSON via modal | None |
| **Researcher / Student / Guest** | No Access | Own bookings only | Create on booking | None |

### Enterprise Feature Gating Standard
- **Frontend Gating**: Tabs or features exclusive to \`enterprise\` tier must remain visible in the navigation for \`core\` and \`premium\` admins with a lock icon and render the shared \`<EnterpriseUpsellBanner feature="custom_form_reporting" />\` component when clicked.
- **Backend Enforcement**: All \`/api/v2/reports/custom-forms/*\` controllers must enforce \`require_enterprise_entitlement!\` middleware (returns \`403 Forbidden\` with code \`ENTITLEMENT_REQUIRED\` for Core/Premium tenants) in addition to \`authorize_report_admin!\`.`
  },
  {
    id: 'kb-db-jsonb-encryption',
    title: '03. PostgreSQL Custom Forms Schema, AES-256 Encryption & Sidekiq',
    category: 'Database & Security',
    lastUpdated: '2026-10-12',
    enabled: true,
    content: `### Current Custom Forms Storage & Encryption Architecture
- **PostgreSQL 16 Primary Store**: Custom form submissions are currently stored in \`custom_form_responses\` (\`id\`, \`booking_id\`, \`custom_form_id\`, \`form_version\`, \`encrypted_payload_jsonb\`, \`created_at\`).
- **AES-256 Encryption Constraint**: Under Calira's SOC2 & GxP compliance policy, \`encrypted_payload_jsonb\` is encrypted at rest using **AWS KMS / PostgreSQL disk-level AES-256 encryption** PLUS application-level Lockbox encryption on fields flagged \`is_pii: true\`.
  - **CRITICAL INFRASTRUCTURE RULE**: Standard PostgreSQL B-tree / trigram (\`pg_trgm\`) indexes (` + '`<`, `>`, `BETWEEN`, `ILIKE %contains%`' + `) CANNOT evaluate ciphertext if individual EAV columns (\`string_value\`, \`numeric_value\`, \`date_value\`) are randomized-ciphertext encrypted at the application layer!
  - Therefore, AES-256 at-rest encryption for the EAV table (\`custom_form_response_values\`) MUST rely on PostgreSQL Transparent Data Encryption / RDS AES-256 volume encryption (with deterministic blind indexing only if PII search is required), so SQL operators work natively with B-Tree and GIN \`pg_trgm\` indexes.
- **Form Versioning**: When an Admin edits a Custom Form, a new \`custom_form_version\` row is created. A field with the same \`field_name\` (e.g. "Sample Concentration") could be changed by an admin from \`Short Text\` in v1 to \`Value and Unit\` in v2.
- **Background Jobs**: Ruby on Rails 7.2 with **Sidekiq Enterprise** (\`Batches\` + \`Limiter.concurrent\`). Long-running data migrations must use \`ActiveRecord::Migration[7.2]\` post-deploy batched jobs with \`Sidekiq::Limiter\` throttling and cursor-based pagination (\`id > last_id\`) to keep replica lag under 500ms.`
  },
  {
    id: 'kb-fe-gitlab-standards',
    title: '04. Frontend Design System & GitLab INVEST Story Conventions',
    category: 'FE/BE Standards',
    lastUpdated: '2026-10-25',
    enabled: true,
    content: `### Frontend Architecture & Reusable Components
- **Equipment Overview Data Grid**: The existing \`<EquipmentOverviewTable />\` uses TanStack Table v8 with server-side pagination, column visibility toggles, multi-column sort, and quick filter inputs. New report preview tables should extend \`<BaseReportDataGrid />\` to maintain visual parity.
- **GitLab Issue & Story Splitting Rules**:
  - Every capability must be split into distinct **Frontend (FE)** and **Backend (BE)** stories so respective squad engineers can pick them up independently once the API contract is agreed.
  - Each story must follow the **INVEST** framework (Independent, Negotiable, Valuable, Estimable, Small, Testable).
  - Unresolved product or UX edge cases inside Acceptance Criteria must be suffixed with **\`**(confirm)**\`** just like our Authentication & MFA story template.`
  }
];

export const ATTACHED_CUSTOM_FORM_PRD = `# Custom Form Reporting PRD: GUI Query Builder and Data Conversion Strategy

### Custom Form Reporting PRD

|  |  |
| --- | --- |
| **Product area** | **Reports / Custom Forms** |
| **Audience** | Management, Product, Engineering, QA, Customer-facing teams |
| **Document owner** | @Chris Mills |
| **Status** | Final |
| **Date** | 28 July 2026 |
| **Primary recommendation** | Deliver a GUI-based query builder in the Reports tab for structured Custom Form querying as the MVP, supported by a backend background job to convert JSONB data into a flattened relational structure. |

#### Executive summary

This PRD proposes a two-stage strategy to introduce structured reporting capabilities for Custom Forms. The first release (MVP) will deliver a GUI-based query builder in the "Reports" page, allowing users to execute structured "AND" queries based on form field data types (e.g., greater than, equals, contains). To support this, a slow-running background job (Ruby migration) will convert all historical and future JSONB form responses into a queryable name-value pair relational structure.

A later extension (Phase 2) will introduce support for "OR" logic operations, PDF exports, and dynamically generated materialized views (pivot tables) if querying performance using the name-value pair structure proves insufficient at scale. This feature will be gated exclusively for Enterprise customers and accessible only by users with administrator roles.

#### 1. Problem statement

Last year, Calira introduced Custom Forms to capture critical supporting information at the point of usage or maintenance bookings. While highly successful at data capture, storing this data in raw JSONB format within the PostgreSQL database severely limited querying opportunities. Users cannot ask structured questions based on data types (e.g., $<$, $>$, or \`BETWEEN\` for numbers and dates, \`CONTAINS\` for strings). Currently, the only method to query this data is via a REST web service that requires a \`booking_id\` and returns the entire raw JSON response. This limits the ability of lab managers to extract actionable, aggregated insights from their operational data without manual parsing.

#### 2. Product strategy and phasing

| **Phase** | **Release** | **Scope** | **Reason** |
| --- | --- | --- | --- |
| Phase 1 | MVP | GUI query builder with "AND" conditions, JSONB to relational data conversion via background job, and CSV export. | Fastest valuable release to unlock structured reporting for Enterprise admins, addressing immediate data visibility needs. |
| Phase 2 | Extension | "OR" condition support, PDF exports, and dynamic materialized views. | Enhances query flexibility and proactively addresses potential database performance bottlenecks at scale. |

#### 3. Goals and non-goals

**Goals**

- Convert all historical JSONB data from the inception of the Custom Forms feature at the point of deployment via a slow-running Ruby migration.
- Provide a native, GUI-based query builder and report column selector within the "Reports" page.
- Enable structured querying across text, numerical, and date fields.
- Support exporting the resulting report tables to CSV format in the MVP.

**Non-goals for Phase 1 MVP**

- No support for "OR" operations in the query builder.
- No PDF export functionality (reserved as a Phase 2 stretch goal).
- No natural language querying (NLQ) capabilities; interaction is strictly via the GUI.
- No dynamic generation of materialized views (pivot tables) unless base performance fails initial acceptance criteria.

#### 4. Target users and personas

| **Persona** | **Need** | **Phase** |
| --- | --- | --- |
| Lab Admin / Org Admin | Needs to build structured reports on custom form data to monitor compliance, track failed calibrations, and assess safety incidents across the lab. | Phase 1 |
| Instructor (not sure about this one) | Needs to run specific queries on equipment they manage (e.g., verifying training record forms or incident reports). | Phase 1 |

Note: This feature is restricted to users who currently possess access to the reporting feature, namely those with administrator roles. Researchers, Students, and Guests will not have access.

#### 5. Entitlement and availability

This feature will be heavily gated. Custom Form Reporting will **only be available to Enterprise labs**. Core and Premium clients should not be able to access this feature, and the UI should show it in a locked state according to our existing gating patterns to drive Enterprise upsells.

#### 6. Phase 1 MVP: User-level Custom Form Reporting

**6.1 User value**

As an Admin, I want to build structured queries against data captured in custom forms, so that I can instantly retrieve specific subsets of bookings and the values of the form data for them (e.g., all failed calibrations, or specific hazard samples) and export them as a CSV for compliance tracking.

**6.2 User flow**

1. Admin navigates to the new "Custom Forms" tab on the Reports page.
2. Selects the specific custom form to report on (ideally this interface is version agnostic e.g. we do a select distinct field_name field_type from custom_form_fields where form_name = 'thing') and this returns the superset of all fields that ever existed on the form.
3. Selects a custom form field to add as a query condition.
4. Selects the appropriate operator based on data type (e.g., equals, greater than, contains etc).
5. Inputs the value(s) for the condition.
6. Repeats steps 3–5 to add more conditions (all combined using "AND" logic).
7. Selects which booking properties (\`booking.id\`, \`booking.date\`, etc.) and form fields (\`form.concentration.value\`) should appear as columns in the final report.
8. Runs the report.
9. Views the query results in a sortable/filterable table and exports to CSV.
10. There should be an option to save the search filter criteria and report columns so you can revisit the search and run it again later.
11. There should be an option to view all the saved searches and re-run one or go to an edit page from there.
12. There should be an option to delete saved searches

**6.3 Functional requirements**

| **Area** | **Requirement** |
| --- | --- |
| **Data Transformation** | Execute a slow-running background Ruby migration to convert all historical JSONB data into the new Entity-Attribute-Value (EAV) table structure. |
| **Data Persistence** | Ongoing backend job to parse newly submitted custom form JSONB responses into the relational structure. |
| **Condition Logic** | Builder must support \`AND\` logic only. |
| **Operator Support** | See table below |
| **Table Output** | Resulting table must be sortable and filterable. |
| **Data Export** | Resulting table must be exportable to CSV. |
| **Data Security** | All relational data must remain encrypted (AES-256) at rest. |

**6.3 Operators to Support for Different Field Types**

| **Field Type (Control)** | **Data Type** | **Operators** |
| --- | --- | --- |
| Heading | String | None (no queries supported) |
| Paragraph | String | None (no queries supported) |
| Short Text | String | equals, starts with, ends with, contains (default contains) |
| Long Text | String | equals, starts with, ends with, contains (default contains) |
| Number | Float | equals, greater than, less than, between (default equals) |
| Value and Unit | Float | equals, greater than, less than, between (default equals) |
| Date and Time | Date | on, after, before, between (default on) |
| Radio Button | String | equals (default equals) |
| Drop Down | String | equals, starts with, ends with, contains (default contains) |
| Check Box | String | equals, in list (default equals) |
| Files | Binary | None (no queries supported) |

**6.4 Rough Database Structure**

The background job will map the JSONB data into a target relational table with a structure something like that shown below, allowing for typed queries to run regardless of the data type of the custom form field.

- \`booking.id\`
- \`custom_form.id\`
- \`custom_form_response.id\`
- \`custom_form.field_id\` (identifies field name and data type)
- \`field.numeric_value\`
- \`field.string_value\`
- \`field.date_value\`
- \`field.blob_value\`
- \`field.unit\`

Expected view structure for the form below

- Booking_id
- Booking.owner
- Booking.start
- Booking.end
- Custom_form.name
- Custom_form.version
- Field.notes
- Field.incident_type
- Field.date_and_time_of_incident
- Field.Actions_Taken (string_agg function)
- No column for file fields

**6.5 UI changes for MVP**

- Add a "Custom Forms" tab to the existing Reports page interface.
- Introduce a multi-step GUI query builder with dropdowns for Form Selection, Field Selection, Operator Selection, and Column Output Selection.
- Introduce a column selector for the report structure based on the properties of bookings and form responses.
- Introduce a query results preview screen with a table similar to the one used for the equipment overview table. This table should support further filtering and sorting. 
- Add a "Download CSV" button.

**6.6 MVP high level acceptance criteria**

- Only Admins in Enterprise labs can access the Custom Forms reporting tab.
- The query builder successfully executes queries matching the required business operations (e.g., finding failed Balance Calibrations in the last 3 months; finding Hazardous Sample Submissions with concentration > 100 mg/ml).
- All conditions applied in the builder execute using strict "AND" logic.
- The historical backfill Ruby migration processes all past JSONB responses without severe performance degradation to the production database.
- Resulting data tables can be exported to CSV with accurate column headers.
- All changes must be successfully tested in non-production environments prior to release.`;

export const AUTH_MFA_EXAMPLE_STORY_MARKDOWN = `## Authentication and MFA fatigue

**As a** scientist at a lab with SSO, **I want** "Login via your organisation" to go straight to my organisation's sign-in, **so that** I don't have to find my organisation each time. 

- [ ] Click **Login via your organisation**. The embedded window goes to the customer's SSO page with no tenant or organisation search and no extra "Log in via your organisation" click.
- [ ] No page is briefly shown that then disappears or is clicked by itself (no flash of the Calira login page or provider search). **(confirm)**
- [ ] Complete the IdP sign-in and MFA: you are returned to LabTrack and logged in, and the booking is shown.
- [ ] The IdP's MFA prompt still appears. This change does not remove it.
- [ ] Repeat with a lab whose provider is inherited from its department or organisation: same result.
- [ ] **Cancel** in the sign-in window returns to the LabTrack login screen.
- [ ] On the install linked to a lab without SSO **Login via your organisation** shows the usual Calira sign-in or organisation search (today's behaviour). **(confirm exact page)**
- [ ] Email and password sign-in on the LabTrack screen still works and shows the booking.
- [ ] On a fresh install where the lab has not been set yet (initial setup), the lab admin can still sign in to complete setup.`;

export const INITIAL_PRD_ANALYSIS: PrdAnalysisResult = {
  analyzedAt: '2026-11-01T09:40:00Z',
  modelUsed: 'gemini-3.8-flash (ThinkingLevel.HIGH — Pro Reasoning)',
  reasoningMode: 'Deep Architectural & Infrastructure Alignment Audit',
  executiveAlignmentSummary:
    'Cross-referencing the Custom Form Reporting PRD against the Calira / LabTrack Architecture Knowledge Base reveals strong alignment on Enterprise entitlement gating and Sidekiq background migration patterns, but surfaces 2 critical infrastructure conflicts (Instructor RBAC ambiguity in Section 4 vs. Section 6.6, and AES-256 encryption vs. SQL operator indexing in Section 6.3) plus 6 missing edge-case specifications that should be resolved before locking final GitLab issues.',
  authAlignmentVerdict:
    'PARTIAL ALIGNMENT — The Authentication & MFA Fatigue SSO flow (direct IdP routing + inherited org/department SSO + JWT session claims) cleanly supports Admin RBAC and Enterprise entitlement checks without re-prompting MFA during CSV exports. However, the PRD contradicts itself on whether the "Instructor" persona has access (Section 4 lists Instructor as Phase 1 with "(not sure about this one)", while Section 4 Note & Section 6.6 restrict access strictly to Admin roles).',
  infraChecks: [
    {
      id: 'chk-1',
      area: 'RBAC Persona & Instructor Access Alignment',
      layer: 'Auth / Security',
      status: 'CONFLICT',
      summary: 'PRD Section 4 lists "Instructor (not sure about this one)" as a Phase 1 persona, but Section 6.6 states "Only Admins in Enterprise labs can access the Custom Forms reporting tab."',
      prdRequirement: 'Section 4 Table includes Instructor needing equipment-scoped queries; Section 6.6 restricts strictly to Admins in Enterprise labs.',
      infrastructureReality: 'In Calira RBAC (KB Doc 02), Instructors do NOT have access to the global /reports tab—only Lab Admins and Org Admins hold the reports:view permission.',
      recommendation: 'Exclude Instructor from Phase 1 MVP to avoid building equipment-level row-level security (RLS) inside global Reports, or explicitly grant Instructors scoped access.'
    },
    {
      id: 'chk-2',
      area: 'SSO Session & MFA Fatigue on Report Execution / CSV Export',
      layer: 'Auth / Security',
      status: 'ALIGNED',
      summary: 'Direct SSO sign-in & inherited org IdP sessions provide `role` and `entitlement_tier` claims directly in the LabTrack JWT.',
      prdRequirement: 'Gated to Enterprise Admins; supports running multi-condition queries and downloading CSV compliance reports.',
      infrastructureReality: 'Calira JWT sessions already carry `org_id`, `lab_id`, `role`, and `entitlement_tier`. CSV export endpoints must validate the existing session cookie rather than opening a re-auth window so admins do not experience MFA fatigue.',
      recommendation: 'Ensure BE CSV export endpoint uses standard session cookie auth + audit logging without step-up IdP redirects.'
    },
    {
      id: 'chk-3',
      area: 'AES-256 At-Rest Encryption vs. SQL Range & Substring Indexing',
      layer: 'Database',
      status: 'CONFLICT',
      summary: 'PRD requires AES-256 encryption at rest AND `>`, `<`, `BETWEEN`, `CONTAINS`, `STARTS WITH` queries on EAV columns.',
      prdRequirement: 'Section 6.3: "All relational data must remain encrypted (AES-256) at rest" while supporting float comparisons and string `contains` with B-Tree/GIN indexes.',
      infrastructureReality: 'Application-layer Lockbox randomized encryption breaks SQL `<`, `>`, `BETWEEN`, and `ILIKE %...%` indexes. Encryption at rest must be satisfied via AWS RDS / PostgreSQL volume-level AES-256 encryption (TDE), not column-level randomized ciphertext.',
      recommendation: 'Confirm in BE schema story that EAV columns use PostgreSQL disk-level AES-256 encryption at rest so `pg_trgm` and B-tree indexes on `string_value`, `numeric_value`, and `date_value` function at scale.'
    },
    {
      id: 'chk-4',
      area: 'Version-Agnostic Form Field Superset & Type Drift',
      layer: 'Backend',
      status: 'CLARIFICATION_NEEDED',
      summary: 'PRD Section 6.2 step 2 suggests `SELECT DISTINCT field_name, field_type` across form versions, which can return duplicate field names if an admin changed a field’s type across versions.',
      prdRequirement: 'Select distinct `field_name, field_type` from `custom_form_fields` where `form_name = X` to return the superset of all fields.',
      infrastructureReality: 'In Calira Custom Forms, each edit creates a new `custom_form_version`. If "Concentration" was `Short Text` in v1 and `Value and Unit` in v2, `SELECT DISTINCT field_name, field_type` returns two rows for the same field name.',
      recommendation: 'Display type badge next to field name in the Query Builder dropdown when a field has multiple historical data types, or group by `field_name + field_type`.'
    },
    {
      id: 'chk-5',
      area: 'Value & Unit Operator Normalization',
      layer: 'Backend',
      status: 'CLARIFICATION_NEEDED',
      summary: 'PRD Section 6.3 supports `equals, greater than, less than, between` on `Value and Unit` fields (`field.numeric_value` + `field.unit`), but does not specify unit filtering or conversion.',
      prdRequirement: 'Find Hazardous Sample Submissions with concentration > 100 mg/ml.',
      infrastructureReality: 'EAV stores `numeric_value` (Float) and `unit` (String) separately. Comparing `> 100` without matching or converting `unit` would match `150 ug/ml` alongside `150 mg/ml`.',
      recommendation: 'Require the Admin to select the target unit in the Query Builder condition (executing `numeric_value > X AND unit = Y`) for Phase 1 MVP.'
    },
    {
      id: 'chk-6',
      area: 'Enterprise Entitlement Upsell & Equipment Table Reuse',
      layer: 'Frontend',
      status: 'ALIGNED',
      summary: 'Locked tab state for Core/Premium tiers and reusing Equipment Overview table patterns match existing Calira UI conventions.',
      prdRequirement: 'Show locked state for Core/Premium clients to drive Enterprise upsells; reuse Equipment Overview table sorting/filtering.',
      infrastructureReality: 'Frontend design system provides `<EnterpriseUpsellBanner />` and `<BaseReportDataGrid />` (TanStack Table v8).',
      recommendation: 'Wire `<EnterpriseUpsellBanner />` for Core/Premium roles and extend `<BaseReportDataGrid />` for results preview.'
    }
  ],
  missingRequirements: [
    {
      id: 'gap-1',
      title: 'Instructor Role Access Contradiction',
      category: 'Authentication & RBAC',
      severity: 'Critical',
      description: 'Section 4 lists "Instructor (not sure about this one)" as Phase 1, whereas Section 6.6 states "Only Admins in Enterprise labs can access the Custom Forms reporting tab." If Instructors are included, backend queries must filter bookings by equipment managed by that Instructor.',
      prdSection: 'Section 4 & Section 6.6'
    },
    {
      id: 'gap-2',
      title: 'Saved Searches Visibility & Ownership Scope',
      category: 'Authentication & RBAC',
      severity: 'High',
      description: 'Section 6.2 steps 10–12 require saving, listing, editing, and deleting searches, but do not specify whether saved searches are private to the individual Admin who created them or shared across all Admins in the Lab/Organisation.',
      prdSection: 'Section 6.2 (Steps 10–12)'
    },
    {
      id: 'gap-3',
      title: 'Value and Unit Field Comparison Semantics',
      category: 'Query Logic & Edge Case',
      severity: 'High',
      description: 'For "Value and Unit" fields (e.g., concentration > 100 mg/ml), the PRD does not state whether the query builder requires selecting a specific unit (`unit = "mg/ml"`) or performs automatic SI unit conversion across `g/l`, `mg/ml`, `ug/ml`.',
      prdSection: 'Section 6.3 & Section 6.4'
    },
    {
      id: 'gap-4',
      title: 'AES-256 Encryption Layer vs. PostgreSQL Indexing',
      category: 'Data & Encryption',
      severity: 'Critical',
      description: 'Section 6.3 requires AES-256 encryption at rest while Section 10 requires indexing `field_id`, `string_value`, `numeric_value`, and `date_value`. Application-level non-deterministic encryption prevents PostgreSQL B-tree and trigram indexing.',
      prdSection: 'Section 6.3 & Section 10'
    },
    {
      id: 'gap-5',
      title: 'Check Box Multi-Select Storage & `string_agg` Behaviour',
      category: 'Query Logic & Edge Case',
      severity: 'Medium',
      description: 'Check Box supports `equals` and `in list` operators, and the view structure specifies `Field.Actions_Taken (string_agg function)`. It is unspecified whether multi-select checkbox selections are stored as multiple EAV rows per `custom_form_response_id` or a delimiter-separated string.',
      prdSection: 'Section 6.3 & Section 6.4'
    },
    {
      id: 'gap-6',
      title: 'Report Preview Pagination & CSV Export Row Limits',
      category: 'UX & Performance',
      severity: 'Medium',
      description: 'No maximum row limit, pagination page size, or synchronous vs. asynchronous streaming strategy is defined for the preview table or the CSV export when a lab has 100,000+ historical bookings.',
      prdSection: 'Section 6.2 (Step 9) & Section 6.5'
    }
  ],
  clarifyingQuestions: [
    {
      id: 'q-instructor-rbac',
      question: 'Should the "Instructor" role have access to the Custom Forms reporting tab in Phase 1 MVP, or is MVP strictly restricted to Lab Admins and Org Admins?',
      context: 'PRD Section 4 includes "Instructor (not sure about this one)" for equipment they manage, while Section 6.6 states "Only Admins in Enterprise labs can access the Custom Forms reporting tab."',
      impactArea: 'Security / Auth',
      options: [
        'Restrict Phase 1 MVP strictly to Lab Admin and Org Admin roles (exclude Instructor for MVP)',
        'Include Instructor role in MVP, scoped strictly to bookings on equipment they manage',
        'Allow Lab Admins to toggle Custom Form Reporting access per Instructor'
      ],
      selectedAnswer: 'Restrict Phase 1 MVP strictly to Lab Admin and Org Admin roles (exclude Instructor for MVP)',
      isResolved: true
    },
    {
      id: 'q-encryption-indexing',
      question: 'How should AES-256 encryption at rest be implemented on the new EAV table so PostgreSQL B-tree and substring indexes (`>`, `<`, `BETWEEN`, `CONTAINS`) remain performant?',
      context: 'Application-level Lockbox encryption prevents native SQL range and `ILIKE` indexing on `numeric_value`, `date_value`, and `string_value`.',
      impactArea: 'Backend',
      options: [
        'Rely on AWS RDS / PostgreSQL volume-level AES-256 Transparent Data Encryption (TDE) so SQL B-tree & pg_trgm indexes run natively',
        'Use deterministic encryption for exact match and decrypt in memory for range/substring queries',
        'Store plaintext in EAV for non-PII fields and disallow range/contains queries on PII-flagged fields'
      ],
      selectedAnswer: 'Rely on AWS RDS / PostgreSQL volume-level AES-256 Transparent Data Encryption (TDE) so SQL B-tree & pg_trgm indexes run natively',
      isResolved: true
    },
    {
      id: 'q-unit-handling',
      question: 'For "Value and Unit" fields (e.g., concentration > 100 mg/ml), how should the Query Builder handle units in Phase 1 MVP?',
      context: 'EAV stores `field.numeric_value` and `field.unit`. Comparing numbers across different units without normalization could yield false positives.',
      impactArea: 'Both FE & BE',
      options: [
        'Require selecting an exact Unit from a dropdown alongside the numeric value (queries `numeric_value OP val AND unit = selected_unit`)',
        'Implement automatic backend SI unit conversion across compatible units (e.g. mg/ml, g/l, ug/ml)',
        'Ignore unit during query filtering and only display `field.unit` in the output column'
      ],
      selectedAnswer: 'Require selecting an exact Unit from a dropdown alongside the numeric value (queries `numeric_value OP val AND unit = selected_unit`)',
      isResolved: true
    },
    {
      id: 'q-saved-searches-scope',
      question: 'Are Saved Searches private to the individual Admin who created them, or shared with all Admins within the same Enterprise Lab?',
      context: 'Section 6.2 steps 10–12 specify saving, viewing, editing, and deleting saved searches.',
      impactArea: 'Both FE & BE',
      options: [
        'Private to the creating Admin by default, with an optional "Share with Lab Admins" toggle',
        'Strictly private to the individual Admin user (`user_id` scoped)',
        'Shared across all Admins within the Lab (`lab_id` scoped) so anyone can run/edit/delete them'
      ],
      selectedAnswer: 'Strictly private to the individual Admin user (`user_id` scoped)',
      isResolved: true
    },
    {
      id: 'q-form-version-drift',
      question: 'When a Custom Form has multiple historical versions where a field changed data type, how should the version-agnostic Field Selector behave?',
      context: 'Section 6.2 step 2 proposes `SELECT DISTINCT field_name, field_type FROM custom_form_fields WHERE form_name = X`.',
      impactArea: 'Both FE & BE',
      options: [
        'List each distinct `field_name (field_type)` combination in the condition selector and aggregate matching `field_name` values in output columns',
        'Only allow querying against the latest active version of the Custom Form',
        'Force the Admin to pick a specific form version before building a query'
      ],
      selectedAnswer: 'List each distinct `field_name (field_type)` combination in the condition selector and aggregate matching `field_name` values in output columns',
      isResolved: true
    },
    {
      id: 'q-csv-pagination-limits',
      question: 'What pagination and export limits should apply to the Report Results table and CSV download in MVP?',
      context: 'Enterprise labs may have tens of thousands of historical bookings.',
      impactArea: 'Both FE & BE',
      options: [
        'Server-side paginated table (25/50/100 rows per page) and streaming CSV download capped at 50,000 rows',
        'Load all matching rows into browser memory for client-side sorting and export',
        'Asynchronous email delivery for all CSV exports'
      ],
      selectedAnswer: 'Server-side paginated table (25/50/100 rows per page) and streaming CSV download capped at 50,000 rows',
      isResolved: true
    }
  ]
};

export const INITIAL_GITLAB_STORIES: GitLabUserStory[] = [
  {
    id: 'story-be-1',
    issueKey: 'CAL-401',
    title: 'BE: EAV Relational Schema, Indexes & Real-Time Dual-Write Persistence for Custom Form Responses',
    discipline: 'Backend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin (supported by Backend Platform)',
    iWant: 'newly submitted and updated Custom Form JSONB responses to be parsed and persisted into a typed Entity-Attribute-Value (EAV) relational table with B-tree and trigram indexes',
    soThat: 'structured queries across string, numeric, date, and unit values execute with low latency while maintaining AES-256 encryption at rest',
    priority: 'P0 - Critical',
    priorityRationale: 'Foundational data model blocker for all query execution, historical migration, and reporting UI features.',
    storyPoints: 5,
    labels: ['team::backend', 'phase::1-mvp', 'area::custom-forms', 'db::schema', 'security::aes-256', 'priority::p0'],
    dependencies: [],
    apiContractNote: 'Provides the underlying `custom_form_response_values` EAV table and active-record models consumed by the Query Engine (`CAL-403`) and Backfill Migration (`CAL-402`).',
    acceptanceCriteria: [
      {
        id: 'ac-be1-1',
        text: 'Create PostgreSQL table `custom_form_response_values` with columns: `id`, `booking_id`, `custom_form_id`, `custom_form_response_id`, `custom_form_field_id`, `field_name`, `field_type`, `numeric_value` (double precision), `string_value` (text), `date_value` (timestamptz), `blob_value` (bytea), `unit` (varchar), and timestamps.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be1-2',
        text: 'Create composite B-tree indexes on `(custom_form_id, field_name, numeric_value)`, `(custom_form_id, field_name, date_value)`, `(custom_form_id, field_name, string_value)` and a GIN `pg_trgm` index on `string_value` to accelerate `CONTAINS`, `STARTS WITH`, and `ENDS WITH` queries.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be1-3',
        text: 'When a new `CustomFormResponse` is created or updated on a booking, an asynchronous Sidekiq hook (`CustomFormEavSyncJob`) parses the JSONB payload and writes typed rows into `custom_form_response_values`.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be1-4',
        text: 'Multi-select Check Box values are persisted as individual EAV rows per selected option so `equals`, `in list`, and `string_agg` column aggregation work consistently.',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-be1-5',
        text: 'Heading, Paragraph, and Binary File fields are excluded from searchable condition indexing (`blob_value` is not exposed as a report column).',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be1-6',
        text: 'Verify table resides on the AES-256 encrypted PostgreSQL tablespace so compliance at rest is preserved without breaking SQL range/substring operators.',
        needsConfirmation: true,
        checked: false
      }
    ],
    invest: {
      independent: true,
      IndependentNote: 'Zero dependency on Frontend or other Backend stories; can be merged and deployed first.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Uses PostgreSQL volume-level AES-256 encryption at rest rather than application-layer non-deterministic Lockbox ciphertext on EAV value columns so B-tree and `pg_trgm` indexes remain functional.'
  },
  {
    id: 'story-be-2',
    issueKey: 'CAL-402',
    title: 'BE: Throttled Background Ruby Migration to Backfill Historical JSONB Form Responses',
    discipline: 'Backend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'all historical Custom Form JSONB responses since feature inception converted into the new EAV relational structure without degrading production database performance',
    soThat: 'my compliance and calibration reports include complete historical booking data from day one',
    priority: 'P0 - Critical',
    priorityRationale: 'Required by MVP Goal #1 to ensure historical parity without impacting active lab bookings.',
    storyPoints: 5,
    labels: ['team::backend', 'phase::1-mvp', 'area::custom-forms', 'db::migration', 'sidekiq', 'priority::p0'],
    dependencies: ['CAL-401'],
    apiContractNote: 'Populates historical records into `custom_form_response_values`. No direct FE API change, but exposes Prometheus/Sidekiq progress metrics for release monitoring.',
    acceptanceCriteria: [
      {
        id: 'ac-be2-1',
        text: 'Implement idempotent Ruby background migration worker (`BackfillCustomFormEavJob`) using cursor-based batching (`custom_form_responses.id > last_cursor`, batch size = 500) to avoid long-running table locks.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be2-2',
        text: 'Enforce throttling via `Sidekiq::Limiter` and database replica lag health checks (auto-pauses batch execution for 30s if PostgreSQL replica lag exceeds 500ms or DB CPU exceeds 70%).',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-be2-3',
        text: 'Re-running the migration on already-converted `custom_form_response_id` rows performs an upsert (`ON CONFLICT DO UPDATE`) without creating duplicate EAV records.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be2-4',
        text: 'Malformed or orphaned historical JSONB records are logged to a dead-letter audit table (`custom_form_migration_errors`) with `booking_id` and error reason without halting the batch job.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be2-5',
        text: 'Execute and benchmark migration against staging dataset (minimum 250k historical JSONB responses) verifying zero p95 latency regression on live booking endpoints.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: false,
      IndependentNote: 'Depends on EAV table creation in CAL-401, completely independent of Frontend stories.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Schedule main backfill wave during off-peak window via Sidekiq cron/batch queue with dynamic sleep interval.'
  },
  {
    id: 'story-be-3',
    issueKey: 'CAL-403',
    title: 'BE: Enterprise Entitlement & Admin RBAC Middleware + Version-Agnostic Form Metadata API',
    discipline: 'Backend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin / Org Admin',
    iWant: 'secure API endpoints that enforce Enterprise tier and Admin role permissions and return the version-agnostic superset of fields for any selected Custom Form',
    soThat: 'unauthorized roles or non-Enterprise labs cannot access sensitive form data, and Admins can build queries across all versions of a form',
    priority: 'P0 - Critical',
    priorityRationale: 'Enforces critical data privacy (Section 10 Risk) and provides the schema discovery contract needed by the FE Query Builder.',
    storyPoints: 3,
    labels: ['team::backend', 'phase::1-mvp', 'security::rbac', 'tier::enterprise', 'api::contract', 'priority::p0'],
    dependencies: ['CAL-401'],
    apiContractNote: 'Defines `GET /api/v2/reports/custom-forms` and `GET /api/v2/reports/custom-forms/:form_name/fields` returning distinct `(field_name, field_type, allowed_operators, available_units, options)`.',
    acceptanceCriteria: [
      {
        id: 'ac-be3-1',
        text: 'All `/api/v2/reports/custom-forms/*` endpoints verify active JWT session and enforce `role IN ("lab_admin", "org_admin")`; requests from `instructor`, `researcher`, `student`, or `guest` return `403 Forbidden`.',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-be3-2',
        text: 'Requests from `core` or `premium` tier labs return `403 Forbidden` with error payload `{ code: "ENTITLEMENT_REQUIRED", required_tier: "enterprise" }`.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be3-3',
        text: '`GET /api/v2/reports/custom-forms/:form_name/fields` executes a version-agnostic query (`SELECT DISTINCT field_name, field_type FROM custom_form_fields WHERE form_name = :name AND lab_id = :lab_id`) returning the superset of all fields that ever existed on that form.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be3-4',
        text: 'Heading, Paragraph, and Binary File fields are marked `queryable: false, selectable_as_column: false` in the metadata response (`Files` never appear as a report column).',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be3-5',
        text: 'Lab Admins only see Custom Forms and bookings belonging to their assigned `lab_id`; Org Admins can query across labs within their `org_id`.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: true,
      IndependentNote: 'Can be developed in parallel with CAL-402 using the schema from CAL-401.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Aligns directly with Calira SSO JWT claims (`role`, `entitlement_tier`, `lab_id`, `org_id`).'
  },
  {
    id: 'story-be-4',
    issueKey: 'CAL-404',
    title: 'BE: Dynamic "AND" Query Execution Engine & Pivoted Report Preview API',
    discipline: 'Backend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'to execute multi-condition "AND" queries across String, Float, Value+Unit, Date, Radio, Dropdown, and Checkbox fields and retrieve pivoted booking + form columns',
    soThat: 'I can accurately filter compliance records (e.g., failed calibrations or hazardous samples > 100 mg/ml) with sorting and pagination',
    priority: 'P0 - Critical',
    priorityRationale: 'Core backend engine powering the Custom Form Reporting MVP value proposition.',
    storyPoints: 8,
    labels: ['team::backend', 'phase::1-mvp', 'area::query-engine', 'area::custom-forms', 'priority::p0'],
    dependencies: ['CAL-401', 'CAL-403'],
    apiContractNote: 'Exposes `POST /api/v2/reports/custom-forms/query` accepting `{ form_name, conditions: [{ field_name, field_type, operator, value, secondary_value, unit }], selected_columns, sort_by, sort_dir, page, per_page }`.',
    acceptanceCriteria: [
      {
        id: 'ac-be4-1',
        text: 'Support all String operators (`equals`, `starts_with`, `ends_with`, `contains`) on Short Text, Long Text, and Drop Down fields using parameterized SQL to prevent SQL injection.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be4-2',
        text: 'Support Float operators (`equals`, `greater_than`, `less_than`, `between`) on Number and Value & Unit fields; for Value & Unit fields, filter by both `numeric_value` and `unit = :selected_unit`.',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-be4-3',
        text: 'Support Date operators (`on`, `after`, `before`, `between`) on Date and Time fields normalizing timestamps to the Lab’s configured timezone.',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-be4-4',
        text: 'Support `equals` on Radio Button fields and `equals` / `in_list` on Check Box fields.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be4-5',
        text: 'Combine all user-supplied conditions using strict `AND` intersection across `custom_form_response_id` records.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be4-6',
        text: 'Return only the requested booking properties (`booking.id`, `booking.owner`, `booking.start`, `booking.end`, `custom_form.name`, `custom_form.version`) and selected form fields, using `string_agg(string_value, \', \')` for multi-value Check Box columns (e.g. `Field.Actions_Taken`).',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: false,
      IndependentNote: 'Depends on EAV schema (`CAL-401`); mocked fixture response allows FE (`CAL-408`) to develop concurrently.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Uses relational division / `GROUP BY custom_form_response_id HAVING COUNT(DISTINCT condition_idx) = :total_conditions` or CTE intersections for fast indexed `AND` evaluation.'
  },
  {
    id: 'story-fe-1',
    issueKey: 'CAL-405',
    title: 'FE: "Custom Forms" Reports Tab Navigation, Admin RBAC Guard & Enterprise Upsell Locked State',
    discipline: 'Frontend',
    phase: 'Phase 1 MVP',
    persona: 'Lab Admin / Org Admin',
    iWant: 'to see the "Custom Forms" tab inside the Reports page—unlocked for Enterprise Admins and shown in a locked upsell state for Core and Premium Admins',
    soThat: 'Enterprise Admins can access the query builder while Core/Premium Admins understand the value of upgrading to Enterprise',
    priority: 'P1 - High',
    priorityRationale: 'Entry point for the feature and required revenue/upsell gating mechanism (Section 5 & 6.5).',
    storyPoints: 3,
    labels: ['team::frontend', 'phase::1-mvp', 'tier::enterprise', 'security::rbac', 'ui::reports', 'priority::p1'],
    dependencies: ['CAL-403'],
    apiContractNote: 'Reads `user.role` and `user.entitlement_tier` from session context and consumes `GET /api/v2/reports/custom-forms`.',
    acceptanceCriteria: [
      {
        id: 'ac-fe1-1',
        text: 'Add a "Custom Forms" tab to the Reports page header alongside existing report tabs for users with `lab_admin` or `org_admin` roles.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe1-2',
        text: 'Non-admin roles (`researcher`, `student`, `guest`, and `instructor`) cannot see or navigate to `/reports/custom-forms` (redirected to `/dashboard` with permission toast if accessed via direct URL).',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-fe1-3',
        text: 'For Admins on `core` or `premium` plans, display a lock icon on the "Custom Forms" tab; clicking it renders the standard Calira Enterprise Upsell locked view explaining structured Custom Form reporting and CTA to contact sales.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe1-4',
        text: 'For Admins on `enterprise` plans, clicking "Custom Forms" loads the Custom Form Reporting workspace without additional SSO/MFA prompts.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: true,
      IndependentNote: 'Independent FE shell story; can be built immediately against session auth claims.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Reuses `<EnterpriseUpsellBanner />` pattern established in Calira Analytics.'
  },
  {
    id: 'story-fe-2',
    issueKey: 'CAL-406',
    title: 'FE: Multi-Step GUI Query Builder with Dynamic Type-Aware Operators & "AND" Condition Rows',
    discipline: 'Frontend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'a GUI query builder where I select a Custom Form, add one or more "AND" filter conditions with type-specific operators and default operators, and choose output columns',
    soThat: 'I can construct structured compliance queries without writing SQL or manually parsing JSON',
    priority: 'P0 - Critical',
    priorityRationale: 'Primary user interaction surface defined in Section 6.2 Steps 2–7 and Section 6.3 operator matrix.',
    storyPoints: 8,
    labels: ['team::frontend', 'phase::1-mvp', 'area::query-builder', 'ui::reports', 'priority::p0'],
    dependencies: ['CAL-403', 'CAL-405'],
    apiContractNote: 'Consumes `GET /api/v2/reports/custom-forms/:form_name/fields` and dispatches query payload to `POST /api/v2/reports/custom-forms/query`.',
    acceptanceCriteria: [
      {
        id: 'ac-fe2-1',
        text: 'Form Selection dropdown lists all Custom Forms in the Lab; changing the form resets active conditions and fetches the version-agnostic superset of queryable fields.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe2-2',
        text: 'Selecting a Short Text, Long Text, or Drop Down field populates operators `[equals, starts with, ends with, contains]` with `contains` pre-selected by default.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe2-3',
        text: 'Selecting a Number or Value and Unit field populates operators `[equals, greater than, less than, between]` with `equals` pre-selected by default; `between` renders two numeric inputs (`Min` and `Max`), and Value & Unit renders a Unit selector.',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-fe2-4',
        text: 'Selecting a Date and Time field populates operators `[on, after, before, between]` with `on` pre-selected by default and renders date/time picker input(s).',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe2-5',
        text: 'Selecting Radio Button defaults to `equals`; selecting Check Box offers `[equals, in list]` with `equals` as default; Heading, Paragraph, and Files fields cannot be selected as query conditions.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe2-6',
        text: 'Admins can add multiple condition rows joined strictly by a read-only `AND` badge and remove individual condition rows.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe2-7',
        text: 'Column Output Selector allows picking booking properties (`Booking_id`, `Booking.owner`, `Booking.start`, `Booking.end`, `Custom_form.name`, `Custom_form.version`) and form fields (excluding `Files`).',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: true,
      IndependentNote: 'Independent of Backend Query Engine execution if developed against the agreed JSON schema from CAL-403.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'State managed via structured query reducer so Saved Searches (`CAL-410`) can serialize/deserialize the exact builder state.'
  },
  {
    id: 'story-fe-3',
    issueKey: 'CAL-407',
    title: 'FE: Interactive Report Results Preview Table with Sorting, Quick Filtering & Column Management',
    discipline: 'Frontend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'to view query results in a sortable, filterable preview table matching the Equipment Overview table experience',
    soThat: 'I can inspect, sort, and verify the matching bookings and custom form responses before exporting',
    priority: 'P1 - High',
    priorityRationale: 'Required by Section 6.2 Step 9 and Section 6.5 UI changes for MVP.',
    storyPoints: 5,
    labels: ['team::frontend', 'phase::1-mvp', 'ui::data-grid', 'area::custom-forms', 'priority::p1'],
    dependencies: ['CAL-404', 'CAL-406'],
    apiContractNote: 'Renders rows and column headers returned by `POST /api/v2/reports/custom-forms/query`.',
    acceptanceCriteria: [
      {
        id: 'ac-fe3-1',
        text: 'Render results using the shared `<BaseReportDataGrid />` (Equipment Overview table component) displaying all columns selected in the Column Output Selector.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe3-2',
        text: 'Support clicking any booking or custom form column header to toggle ascending/descending sort, plus an inline search/filter bar to refine displayed results.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe3-3',
        text: 'Multi-select Check Box columns (e.g. `Field.Actions_Taken`) render aggregated comma-separated values cleanly; Value & Unit columns render both numeric value and unit.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe3-4',
        text: 'Display clear Empty State when 0 bookings match the `AND` conditions, Loading skeleton during query execution, and tabular numerals (`tabular-nums`) on all numeric/date cells.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: false,
      IndependentNote: 'Pairs with FE Query Builder (`CAL-406`) and BE Query Engine (`CAL-404`).',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Reuses TanStack Table configuration from Equipment Overview to guarantee consistent UX.'
  },
  {
    id: 'story-be-5',
    issueKey: 'CAL-408',
    title: 'BE: Streaming CSV Export Endpoint for Custom Form Report Results',
    discipline: 'Backend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'a backend endpoint that streams the filtered, column-selected Custom Form query results as a RFC-4180 compliant CSV file with formula-injection sanitization',
    soThat: 'I can download compliance reports for external audit and spreadsheet analysis',
    priority: 'P1 - High',
    priorityRationale: 'Core MVP goal (Section 3 & Section 6.6) split into Backend streaming generation vs Frontend trigger.',
    storyPoints: 3,
    labels: ['team::backend', 'phase::1-mvp', 'area::csv-export', 'security::audit', 'priority::p1'],
    dependencies: ['CAL-404'],
    apiContractNote: 'Exposes `POST /api/v2/reports/custom-forms/export-csv` returning `Content-Type: text/csv; charset=utf-8` with `Content-Disposition: attachment` stream.',
    acceptanceCriteria: [
      {
        id: 'ac-be5-1',
        text: 'Execute the active `AND` query conditions and selected columns, streaming CSV rows in chunks using PostgreSQL cursor streaming so memory usage stays flat.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be5-2',
        text: 'CSV header row matches the exact selected booking properties and custom form field names (e.g. `Booking_id,Booking.owner,Booking.start,Booking.end,Custom_form.name,Custom_form.version,Field.notes...`).',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be5-3',
        text: 'Sanitize string cells starting with `=`, `+`, `-`, or `@` to prevent CSV formula injection when opened in Excel.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be5-4',
        text: 'Record an audit log entry (`custom_form_report_csv_exported`) with `user_id`, `lab_id`, `form_name`, and row count.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: true,
      IndependentNote: 'Reuses query builder service object from `CAL-404`.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Uses existing session cookie authentication so SSO users do not face an IdP popup during file download.'
  },
  {
    id: 'story-fe-4',
    issueKey: 'CAL-409',
    title: 'FE: "Download CSV" Action Button, Progress Feedback & Error Handling',
    discipline: 'Frontend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'a "Download CSV" button on the query results screen that downloads the current report with accurate column headers and sort order',
    soThat: 'I can export the filtered dataset in one click for offline compliance tracking',
    priority: 'P1 - High',
    priorityRationale: 'Frontend counterpart to `CAL-408` completing the MVP CSV export requirement.',
    storyPoints: 2,
    labels: ['team::frontend', 'phase::1-mvp', 'area::csv-export', 'ui::reports', 'priority::p1'],
    dependencies: ['CAL-407', 'CAL-408'],
    apiContractNote: 'Calls `POST /api/v2/reports/custom-forms/export-csv` with current filter state, selected columns, and active table sort.',
    acceptanceCriteria: [
      {
        id: 'ac-fe4-1',
        text: 'Display a primary "Download CSV" button in the results preview toolbar; disable the button when the result set has 0 rows or a query is currently loading.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe4-2',
        text: 'Clicking "Download CSV" shows a loading spinner on the button, streams the response blob from `/api/v2/reports/custom-forms/export-csv`, and triggers browser download named `<form-slug>-report-<YYYY-MM-DD>.csv`.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe4-3',
        text: 'If the export fails or times out, display an inline actionable error banner with a "Retry Export" action.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: false,
      IndependentNote: 'Depends on `CAL-408` export endpoint.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Uses `fetch` with `credentials: "include"` + `URL.createObjectURL(blob)` to avoid popup blockers or iframe navigation issues.'
  },
  {
    id: 'story-be-6',
    issueKey: 'CAL-410',
    title: 'BE: CRUD REST Endpoints & Persistence for Saved Custom Form Searches',
    discipline: 'Backend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'backend persistence and CRUD endpoints to save, list, update, and delete my custom form search criteria and selected report columns',
    soThat: 'recurring compliance queries (like monthly balance calibration checks) do not need to be rebuilt from scratch each time',
    priority: 'P2 - Medium',
    priorityRationale: 'Directly fulfills Section 6.2 Steps 10–12 (Saved Searches).',
    storyPoints: 3,
    labels: ['team::backend', 'phase::1-mvp', 'area::saved-searches', 'api::contract', 'priority::p2'],
    dependencies: ['CAL-403'],
    apiContractNote: 'Provides `GET / POST / PUT / DELETE /api/v2/reports/custom-forms/saved-searches` storing `{ name, form_name, conditions_json, selected_columns_json }`.',
    acceptanceCriteria: [
      {
        id: 'ac-be6-1',
        text: 'Create `custom_form_saved_searches` table with `id`, `user_id`, `lab_id`, `name`, `form_name`, `conditions_jsonb`, `selected_columns_jsonb`, and timestamps.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-be6-2',
        text: 'Implement `POST`, `GET` (list all for current admin/lab), `PUT` (update criteria/columns/name), and `DELETE` endpoints scoped to the authenticated Enterprise Admin.',
        needsConfirmation: true,
        checked: false
      },
      {
        id: 'ac-be6-3',
        text: 'Validate that `name` is non-empty and unique per user + lab, returning `422 Unprocessable Entity` with validation message on conflict.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: true,
      IndependentNote: 'Completely independent of query execution internals; stores JSON configuration.',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Stores query definition JSON cleanly so schema evolves gracefully into Phase 2 OR conditions.'
  },
  {
    id: 'story-fe-5',
    issueKey: 'CAL-411',
    title: 'FE: Saved Searches Management Drawer — Save, Re-Run, Edit & Delete Saved Queries',
    discipline: 'Frontend',
    phase: 'Phase 1 MVP',
    persona: 'Enterprise Lab Admin',
    iWant: 'to save my current search filter criteria and report columns, view all saved searches, and re-run, edit, or delete any saved search',
    soThat: 'I can quickly execute routine safety and calibration audits in seconds',
    priority: 'P2 - Medium',
    priorityRationale: 'Frontend counterpart to `CAL-410` fulfilling Section 6.2 Steps 10, 11, and 12.',
    storyPoints: 5,
    labels: ['team::frontend', 'phase::1-mvp', 'area::saved-searches', 'ui::reports', 'priority::p2'],
    dependencies: ['CAL-406', 'CAL-410'],
    apiContractNote: 'Consumes `/api/v2/reports/custom-forms/saved-searches` endpoints.',
    acceptanceCriteria: [
      {
        id: 'ac-fe5-1',
        text: 'Add a "Save Search" button in the Query Builder header that opens a modal/inline input to name and save the active form, `AND` conditions, and selected output columns.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe5-2',
        text: 'Provide a "Saved Searches" view/drawer listing all saved searches with their target Custom Form, condition count, last updated date, and actions: **Run Now**, **Edit Criteria**, and **Delete**.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe5-3',
        text: 'Clicking **Run Now** hydrates the Query Builder state and immediately executes the report preview; clicking **Edit Criteria** loads the conditions into the builder for modification and saving.',
        needsConfirmation: false,
        checked: false
      },
      {
        id: 'ac-fe5-4',
        text: 'Clicking **Delete** prompts for confirmation and removes the saved search from the list.',
        needsConfirmation: false,
        checked: false
      }
    ],
    invest: {
      independent: false,
      IndependentNote: 'Depends on FE Query Builder (`CAL-406`) and BE Saved Searches API (`CAL-410`).',
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true
    },
    architecturalNotes: 'Handles deleted or archived form fields gracefully by highlighting any stale field condition when a historical saved search is loaded.'
  }
];
