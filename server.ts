import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Endpoint 1: Deep Analysis of PRD against Linked Gemini Gem / Knowledge Base
  app.post('/api/analyze-prd', async (req, res) => {
    try {
      const {
        prdTitle,
        prdMarkdown,
        knowledgeBaseDocs,
        gemName,
        gemInstructions,
      } = req.body;

      if (!prdMarkdown || typeof prdMarkdown !== 'string') {
        return res.status(400).json({ error: 'PRD markdown content is required.' });
      }

      const ai = getGenAIClient();
      const activeKbContext = Array.isArray(knowledgeBaseDocs)
        ? knowledgeBaseDocs
            .filter((d: { enabled?: boolean }) => d.enabled !== false)
            .map(
              (d: { title: string; category: string; content: string }) =>
                `### [${d.category}] ${d.title}\n${d.content}`
            )
            .join('\n\n---\n\n')
        : '';

      const systemPrompt = `${gemInstructions || 'You are a Principal Systems Architect and Agile Product Analyst.'}

Active Gemini Gem / Knowledge Base (${gemName || 'Architecture Knowledge Base'}):
${activeKbContext}

Your task is to perform a rigorous Pro-depth architectural impact analysis of the provided PRD against the Knowledge Base BEFORE authoring user stories:
1. Evaluate how the PRD's authentication, SSO/MFA, RBAC roles, entitlement gating, database schema, encryption, and UI requirements align or conflict with the existing infrastructure documented in the Knowledge Base.
2. Identify all missing requirements, contradictions, and unaddressed edge cases in the PRD.
3. Formulate 4 to 6 high-impact clarifying questions with 3 concrete multiple-choice options each (putting the recommended option first) so the Product Manager / Engineering Lead can resolve gaps before finalizing GitLab stories.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze the following PRD ("${prdTitle || 'Submitted PRD'}") against our Knowledge Base and return a structured JSON analysis:\n\n${prdMarkdown}`,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveAlignmentSummary: {
                type: Type.STRING,
                description: 'Executive summary of how the PRD aligns with the existing infrastructure and knowledge base.',
              },
              authAlignmentVerdict: {
                type: Type.STRING,
                description: 'Specific assessment of how the PRD authentication, SSO/MFA, RBAC personas, and entitlement requirements align with existing infrastructure.',
              },
              infraChecks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    area: { type: Type.STRING },
                    layer: {
                      type: Type.STRING,
                      description: 'Must be one of: Auth / Security, Database, Backend, Frontend',
                    },
                    status: {
                      type: Type.STRING,
                      description: 'Must be one of: ALIGNED, CONFLICT, CLARIFICATION_NEEDED',
                    },
                    summary: { type: Type.STRING },
                    prdRequirement: { type: Type.STRING },
                    infrastructureReality: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'area',
                    'layer',
                    'status',
                    'summary',
                    'prdRequirement',
                    'infrastructureReality',
                    'recommendation',
                  ],
                },
              },
              missingRequirements: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    category: {
                      type: Type.STRING,
                      description: 'Must be one of: Authentication & RBAC, Data & Encryption, Query Logic & Edge Case, UX & Performance, API Contract',
                    },
                    severity: {
                      type: Type.STRING,
                      description: 'Must be one of: Critical, High, Medium',
                    },
                    description: { type: Type.STRING },
                    prdSection: { type: Type.STRING },
                  },
                  required: ['id', 'title', 'category', 'severity', 'description', 'prdSection'],
                },
              },
              clarifyingQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    context: { type: Type.STRING },
                    impactArea: {
                      type: Type.STRING,
                      description: 'Must be one of: Both FE & BE, Backend, Frontend, Security / Auth',
                    },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['id', 'question', 'context', 'impactArea', 'options'],
                },
              },
            },
            required: [
              'executiveAlignmentSummary',
              'authAlignmentVerdict',
              'infraChecks',
              'missingRequirements',
              'clarifyingQuestions',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const questionsWithSelection = (parsed.clarifyingQuestions || []).map(
        (q: { id: string; question: string; context: string; impactArea: string; options: string[] }, idx: number) => ({
          ...q,
          id: q.id || `q-${idx + 1}`,
          selectedAnswer: q.options?.[0] || '',
          isResolved: true,
        })
      );

      return res.json({
        analyzedAt: new Date().toISOString(),
        modelUsed: 'gemini-3.8-flash (ThinkingLevel.HIGH — Pro Reasoning)',
        reasoningMode: 'Deep Architectural & Infrastructure Alignment Audit',
        executiveAlignmentSummary: parsed.executiveAlignmentSummary || '',
        authAlignmentVerdict: parsed.authAlignmentVerdict || '',
        infraChecks: parsed.infraChecks || [],
        missingRequirements: parsed.missingRequirements || [],
        clarifyingQuestions: questionsWithSelection,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error analyzing PRD';
      console.error('Error in /api/analyze-prd:', errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  // Endpoint 2: Generate FE & BE Split GitLab User Stories with INVEST & Priority Assignment
  app.post('/api/generate-stories', async (req, res) => {
    try {
      const {
        prdTitle,
        prdMarkdown,
        knowledgeBaseDocs,
        gemName,
        gemInstructions,
        clarifyingQuestions,
        exampleStoryMarkdown,
      } = req.body;

      if (!prdMarkdown || typeof prdMarkdown !== 'string') {
        return res.status(400).json({ error: 'PRD markdown content is required.' });
      }

      const ai = getGenAIClient();
      const activeKbContext = Array.isArray(knowledgeBaseDocs)
        ? knowledgeBaseDocs
            .filter((d: { enabled?: boolean }) => d.enabled !== false)
            .map(
              (d: { title: string; category: string; content: string }) =>
                `### [${d.category}] ${d.title}\n${d.content}`
            )
            .join('\n\n---\n\n')
        : '';

      const resolvedAnswersText = Array.isArray(clarifyingQuestions)
        ? clarifyingQuestions
            .map(
              (q: { question: string; selectedAnswer: string; customNotes?: string }, i: number) =>
                `Q${i + 1}: ${q.question}\nResolved Decision: ${q.selectedAnswer}${q.customNotes ? ` (Notes: ${q.customNotes})` : ''}`
            )
            .join('\n\n')
        : 'No additional Q&A provided.';

      const systemPrompt = `${gemInstructions || 'You are a Principal Agile Architect generating GitLab User Stories.'}

Active Gemini Gem / Knowledge Base (${gemName || 'Architecture Knowledge Base'}):
${activeKbContext}

Reference GitLab User Story Format Example:
${exampleStoryMarkdown || ''}

CRITICAL AUTHORING RULES:
1. Split stories strictly into "Frontend" and "Backend" discipline tracks (never combine FE and BE into a single story, as the engineering team works in separate FE and BE tracks).
2. Every story MUST adhere to the INVEST principle (Independent, Negotiable, Valuable, Estimable, Small, Testable) wherever it does not conflict with the FE/BE split rule. Document the API contract bridging FE and BE stories in \`apiContractNote\`.
3. Incorporate all Resolved Clarifying Question Decisions into the stories and acceptance criteria.
4. For any acceptance criterion that still requires final verification with stakeholders or QA, set \`needsConfirmation: true\` so it renders with \`**(confirm)**\` in GitLab markdown.
5. Assign automated Priority (\`P0 - Critical\`, \`P1 - High\`, \`P2 - Medium\`, or \`P3 - Low\`), a clear \`priorityRationale\` based on user needs, story points (1, 2, 3, 5, 8), and scoped GitLab labels (e.g., \`team::backend\`, \`team::frontend\`, \`phase::1-mvp\`, \`tier::enterprise\`, \`security::rbac\`).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a comprehensive set of Frontend (FE) and Backend (BE) GitLab User Stories for the PRD "${prdTitle || 'Submitted PRD'}".

Resolved Clarifying Questions & Product Decisions:
${resolvedAnswersText}

Full PRD Content:
${prdMarkdown}`,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    issueKey: { type: Type.STRING, description: 'e.g. CAL-401' },
                    title: {
                      type: Type.STRING,
                      description: 'Prefixed with FE: or BE: followed by concise story title',
                    },
                    discipline: {
                      type: Type.STRING,
                      description: 'Must be strictly Frontend or Backend',
                    },
                    phase: {
                      type: Type.STRING,
                      description: 'Must be Phase 1 MVP or Phase 2 Extension',
                    },
                    persona: { type: Type.STRING },
                    iWant: { type: Type.STRING },
                    soThat: { type: Type.STRING },
                    priority: {
                      type: Type.STRING,
                      description: 'Must be one of: P0 - Critical, P1 - High, P2 - Medium, P3 - Low',
                    },
                    priorityRationale: { type: Type.STRING },
                    storyPoints: { type: Type.INTEGER },
                    labels: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    dependencies: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    apiContractNote: { type: Type.STRING },
                    architecturalNotes: { type: Type.STRING },
                    acceptanceCriteria: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          text: { type: Type.STRING },
                          needsConfirmation: { type: Type.BOOLEAN },
                        },
                        required: ['id', 'text', 'needsConfirmation'],
                      },
                    },
                    invest: {
                      type: Type.OBJECT,
                      properties: {
                        independent: { type: Type.BOOLEAN },
                        IndependentNote: { type: Type.STRING },
                        negotiable: { type: Type.BOOLEAN },
                        valuable: { type: Type.BOOLEAN },
                        estimable: { type: Type.BOOLEAN },
                        small: { type: Type.BOOLEAN },
                        testable: { type: Type.BOOLEAN },
                      },
                      required: [
                        'independent',
                        'IndependentNote',
                        'negotiable',
                        'valuable',
                        'estimable',
                        'small',
                        'testable',
                      ],
                    },
                  },
                  required: [
                    'id',
                    'issueKey',
                    'title',
                    'discipline',
                    'phase',
                    'persona',
                    'iWant',
                    'soThat',
                    'priority',
                    'priorityRationale',
                    'storyPoints',
                    'labels',
                    'dependencies',
                    'apiContractNote',
                    'architecturalNotes',
                    'acceptanceCriteria',
                    'invest',
                  ],
                },
              },
            },
            required: ['stories'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const stories = (parsed.stories || []).map((s: Record<string, unknown>, idx: number) => ({
        ...s,
        id: (s.id as string) || `story-gen-${idx + 1}`,
        issueKey: (s.issueKey as string) || `CAL-${401 + idx}`,
        acceptanceCriteria: Array.isArray(s.acceptanceCriteria)
          ? s.acceptanceCriteria.map((ac: Record<string, unknown>, acIdx: number) => ({
              id: (ac.id as string) || `ac-${idx}-${acIdx}`,
              text: (ac.text as string) || '',
              needsConfirmation: Boolean(ac.needsConfirmation),
              checked: false,
            }))
          : [],
      }));

      return res.json({ stories });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error generating stories';
      console.error('Error in /api/generate-stories:', errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  // Endpoint 3: Refine a Single Story via AI
  app.post('/api/refine-story', async (req, res) => {
    try {
      const { story, instruction, knowledgeBaseDocs } = req.body;
      if (!story || !instruction) {
        return res.status(400).json({ error: 'Story and refinement instruction are required.' });
      }

      const ai = getGenAIClient();
      const activeKbContext = Array.isArray(knowledgeBaseDocs)
        ? knowledgeBaseDocs
            .filter((d: { enabled?: boolean }) => d.enabled !== false)
            .map((d: { title: string; content: string }) => `### ${d.title}\n${d.content}`)
            .join('\n\n')
        : '';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Refine the following GitLab User Story according to this instruction: "${instruction}"

Current Story JSON:
${JSON.stringify(story, null, 2)}

Knowledge Base Context:
${activeKbContext}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              persona: { type: Type.STRING },
              iWant: { type: Type.STRING },
              soThat: { type: Type.STRING },
              priority: { type: Type.STRING },
              priorityRationale: { type: Type.STRING },
              storyPoints: { type: Type.INTEGER },
              labels: { type: Type.ARRAY, items: { type: Type.STRING } },
              apiContractNote: { type: Type.STRING },
              architecturalNotes: { type: Type.STRING },
              acceptanceCriteria: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    needsConfirmation: { type: Type.BOOLEAN },
                  },
                  required: ['id', 'text', 'needsConfirmation'],
                },
              },
            },
            required: [
              'title',
              'persona',
              'iWant',
              'soThat',
              'priority',
              'priorityRationale',
              'storyPoints',
              'labels',
              'apiContractNote',
              'architecturalNotes',
              'acceptanceCriteria',
            ],
          },
        },
      });

      const refined = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        story: {
          ...story,
          ...refined,
          acceptanceCriteria: (refined.acceptanceCriteria || []).map(
            (ac: { id?: string; text: string; needsConfirmation: boolean }, i: number) => ({
              id: ac.id || `ac-ref-${i}`,
              text: ac.text,
              needsConfirmation: Boolean(ac.needsConfirmation),
              checked: false,
            })
          ),
        },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error refining story';
      console.error('Error in /api/refine-story:', errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StoryForge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
