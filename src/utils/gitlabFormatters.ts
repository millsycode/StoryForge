import { GitLabUserStory } from '../types';

export function formatStoryToGitLabMarkdown(
  story: GitLabUserStory,
  includeGitLabQuickActions = true
): string {
  const criteriaLines = story.acceptanceCriteria
    .map((ac) => {
      const box = ac.checked ? '[x]' : '[ ]';
      const confirmSuffix = ac.needsConfirmation ? ' **(confirm)**' : '';
      return `- ${box} ${ac.text}${confirmSuffix}`;
    })
    .join('\n');

  const quickActions = includeGitLabQuickActions
    ? `\n\n---\n**GitLab Metadata & Quick Actions**\n- **Issue Key**: \`${story.issueKey}\` · **Discipline**: \`${story.discipline}\` · **Priority**: \`${story.priority}\` · **Weight**: \`${story.storyPoints} pts\`\n- **Priority Rationale**: ${story.priorityRationale}\n- **API Contract / Dependencies**: ${story.apiContractNote}${story.dependencies.length > 0 ? ` (Depends on: ${story.dependencies.join(', ')})` : ''}\n\n\`\`\`text\n/label ${story.labels.map((l) => `~"${l}"`).join(' ')}\n/weight ${story.storyPoints}\n\`\`\``
    : '';

  return `## ${story.title}

**As a** ${story.persona}, **I want** ${story.iWant}, **so that** ${story.soThat}.

${criteriaLines}${quickActions}`;
}

export function formatAllStoriesToMarkdown(
  stories: GitLabUserStory[],
  includeQuickActions = true
): string {
  return stories
    .map((s) => formatStoryToGitLabMarkdown(s, includeQuickActions))
    .join('\n\n---\n\n');
}

export function exportStoriesToGitLabCsv(stories: GitLabUserStory[]): string {
  const headers = ['title', 'description', 'labels', 'weight', 'milestone'];
  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = stories.map((story) => {
    const description = formatStoryToGitLabMarkdown(story, false);
    const labels = story.labels.join(',');
    return [
      escapeCsv(`[${story.issueKey}] ${story.title}`),
      escapeCsv(description),
      escapeCsv(labels),
      String(story.storyPoints),
      escapeCsv(story.phase),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
