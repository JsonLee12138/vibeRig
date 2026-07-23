import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFileSync(join(root, path), 'utf8');
const failures = [];

function check(condition, message) {
  if (!condition)
    failures.push(message);
}

function requirePhrases(path, phrases) {
  const content = read(path);
  for (const phrase of phrases)
    check(content.includes(phrase), `${path} is missing: ${phrase}`);
  return content;
}

function validateReferences(path) {
  const content = read(path);
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || target.startsWith('http:') || target.startsWith('https:'))
      continue;
    check(existsSync(join(root, dirname(path), target)), `${path} references missing file: ${target}`);
  }
}

const acceptDeliver = requirePhrases('skills/accept-deliver/SKILL.md', [
  '自动化测试不能代替业务验收',
  '等待明确结论',
  '持久化 acceptance event',
  '验收与 merge/release 授权',
  'Delivery Intent',
  'Provider 已显示 `MERGED` 时不得再次调用 merge',
  'immutable PR identity',
  'accepted head',
  'provider merge commit',
  '返回同一 Goal Loop',
  '知识写入失败不应撤销已成立的验收',
]);

const acceptanceState = requirePhrases('skills/accept-deliver/references/acceptance-and-delivery.md', [
  'Acceptance Event',
  'Delivery Intent',
  'Delivery Event',
  'accepted source commit',
  'expected base/head',
  'provider immutable result',
  '不得用目标分支当前 HEAD 冒充 provider merge commit',
  'multiple、malformed 或 identity conflict：fail closed',
]);

check(
  acceptDeliver.indexOf('## 阶段 2：人工验收 Gate') < acceptDeliver.indexOf('## 阶段 3：交付授权'),
  'human acceptance must precede delivery authorization',
);
check(
  acceptanceState.indexOf('Delivery Intent') < acceptanceState.indexOf('Delivery Event'),
  'delivery intent must precede delivery event',
);

for (const [path, target] of [
  ['skills/accept-issue/SKILL.md', 'accept-deliver'],
  ['skills/accept-milestone/SKILL.md', 'accept-deliver'],
  ['skills/merge-issue/SKILL.md', 'accept-deliver'],
]) {
  const content = read(path);
  check(content.includes('兼容'), `${path} must be a compatibility surface`);
  check(content.includes(target), `${path} must route to ${target}`);
  check(!content.includes('立即执行 `insights → vb-wiki`'), `${path} must not force immediate wiki compilation`);
}

const insights = requirePhrases('skills/insights/SKILL.md', [
  'novelty',
  'zero-atoms',
  'batch_pending',
  'conflict',
  'accepted Evidence',
  '不调用 `vb-wiki` 写入',
  '不提出 Skill 名称',
  '因知识写入失败撤销已成立的验收',
]);

check(insights.includes('没有人工验收时返回 `deferred: acceptance_missing`'), 'insights must require human acceptance');
check(!insights.includes('每次验收无条件运行完整 Wiki transaction') || insights.includes('红线'), 'insights must novelty-gate wiki writes');

const insightsSchema = JSON.parse(read('skills/insights/references/insights.schema.json'));
check(insightsSchema.properties?.acceptance_event, 'insights schema must define acceptance_event');
check(insightsSchema.properties?.aggregation_event, 'insights schema must define aggregation_event');
check(insightsSchema.properties?.retrospective_signals, 'insights schema must define retrospective_signals');
check(insightsSchema.properties?.discarded_signals, 'insights schema must define discarded_signals');
check(insightsSchema.properties?.routing_observations, 'insights schema must define routing_observations');
check(insightsSchema.properties?.routing_analysis, 'insights schema must define routing_analysis');
check(!insightsSchema.properties?.learning_candidates, 'insights schema must not define learning candidates');

for (const path of [
  'skills/subagent-routing/assets/model-capability-prior.json',
  'skills/subagent-routing/assets/model-capability-prior.schema.json',
  'skills/subagent-routing/assets/route-observation.schema.json',
  'skills/update-team/assets/model-routing-profile.schema.json',
]) {
  JSON.parse(read(path));
}

const subagentRouting = requirePhrases('skills/subagent-routing/SKILL.md', [
  'capability before model',
  'provider-specific',
  'at most 10%',
  'protected Gate',
  'route observation',
]);
const modelRouting = requirePhrases('skills/subagent-routing/references/model-routing.md', [
  'Capability Before Model',
  'Cap exploration at 10%',
  'fewer than 5 comparable accepted observations',
  'Critical safety',
  'Credit Assignment',
]);
const updateTeam = requirePhrases('skills/update-team/SKILL.md', [
  '.vibeRig/model-routing.yaml',
  'provider-specific accepted evidence',
  'model: inherit',
  'model-routing-profile.schema.json',
]);
check(subagentRouting.includes('不让用户手动挑 Skill、Agent 或模型'), 'subagent routing must not expose manual model selection');
check(modelRouting.includes('Quality and safety are constraints'), 'model routing must constrain optimization by quality and safety');
check(updateTeam.includes('少于 5 个可比样本'), 'update-team must require comparable samples before changing defaults');

const evidenceSchema = JSON.parse(read('skills/execute/assets/evidence-packet.schema.json'));
check(evidenceSchema.properties?.routingObservations, 'Evidence Packet must retain routing observations');

const vbWiki = requirePhrases('skills/vb-wiki/SKILL.md', [
  'long-term-memory editor',
  'novelty-gated accepted evidence',
  'zero-atoms',
  'acceptance_event.id',
  'aggregation_event.id',
  'delivery_event.id',
  'Explicit yes',
]);

const vbWikiFrontmatter = vbWiki.split('---')[1] ?? '';
check(vbWikiFrontmatter.includes('insights handoffs marked novel/conflict'), 'vb-wiki trigger must require a novel/conflict handoff');
check(vbWiki.includes('Only for `novel` or `conflict` results'), 'vb-wiki write routing must be novelty-gated');

const operationJournal = requirePhrases('skills/vb-wiki/references/operation-journal.md', [
  'wiki-writer.lock',
  'blocked: wiki_writer_busy',
  'git write-tree',
  'operation_commit_unreachable',
  'Read-only query and lint modes create no journal',
  'blocked: zero_result_conflict',
]);

const knowledgeProtocol = requirePhrases('skills/vb-wiki/references/knowledge-write-protocol.md', [
  'no_change',
  'update',
  'create',
  'conflict',
  'current retrieval catalog, not history',
  'Aggregate Accepted Child Events',
]);

const promotionGate = requirePhrases('skills/vb-wiki/references/skill-promotion-gate.md', [
  'Action-oriented',
  'Independently invocable',
  'Stable contract',
  'Reusable mechanism',
  'Verifiable and safe',
  'Wiki insufficient',
  'Value evidence',
  'Explicit yes',
  'approval_record',
]);

check(operationJournal.includes('promotion_decision_sha256'), 'promotion evaluation must use a stable decision identity');
check(knowledgeProtocol.includes('aggregation_event.derived_from'), 'aggregate writes must bind exact child events');
check(promotionGate.includes('decision: wiki_only | propose_skill'), 'promotion must fail closed to wiki_only');

const vbLearn = requirePhrases('skills/vb-learn/SKILL.md', [
  'exactly one approved skill package',
  'redirect: vb-wiki',
  'VibeRig-Candidate: <candidate_id>',
  'return `already_applied`',
  'blocked: candidate_history_ambiguous',
  'blocked: candidate_worktree_conflict',
  'tool_staged_tree',
  'blocked: target_reauthorization_required',
]);

const vbLearnFrontmatter = vbLearn.split('---')[1] ?? '';
check(vbLearnFrontmatter.includes('user-approved tool skill'), 'vb-learn trigger must require explicit approval');
check(!vbLearnFrontmatter.includes('学习 VB-42'), 'vb-learn must not capture generic learning requests');

const skillosLite = read('skills/skillos-lite/SKILL.md');
check(!skillosLite.split('---')[1]?.includes('Use from insights'), 'skillos-lite must not trigger from insights');

const builtInAgents = read('skills/built-in-agents/SKILL.md');
const manifest = JSON.parse(read('skills/built-in-agents/agents.manifest.json'));
const deprecatedSelfLearner = manifest.deprecated.find(item => item.name === 'self_learner');
check(deprecatedSelfLearner?.replacement === 'insights + vb-wiki', 'self_learner replacement must remain insights + vb-wiki');
check(deprecatedSelfLearner?.reason?.includes('novelty'), 'self_learner replacement reason must describe novelty-gated learning');
check(builtInAgents.includes('novelty'), 'built-in agent guidance must describe novelty-gated learning');

const readmeEn = read('README.md');
const readmeZh = read('README.zh-CN.md');
for (const [path, content] of [['README.md', readmeEn], ['README.zh-CN.md', readmeZh]]) {
  check(content.includes('accept-deliver'), `${path} must document unified acceptance`);
  check(content.includes('novelty'), `${path} must document novelty-gated learning`);
  check(!content.includes('immediate `insights → vb-wiki`'), `${path} must not advertise unconditional learning`);
  check(!content.includes('立即执行 `insights → vb-wiki`'), `${path} must not advertise unconditional learning`);
}

for (const path of [
  'skills/accept-deliver/SKILL.md',
  'skills/accept-deliver/references/acceptance-and-delivery.md',
  'skills/accept-issue/SKILL.md',
  'skills/accept-milestone/SKILL.md',
  'skills/merge-issue/SKILL.md',
  'skills/insights/SKILL.md',
  'skills/vb-wiki/SKILL.md',
  'skills/vb-learn/SKILL.md',
  'skills/skillos-lite/SKILL.md',
  'skills/vb-wiki/references/knowledge-editor.md',
  'skills/vb-wiki/references/knowledge-editor-golden-cases.md',
  'skills/vb-wiki/references/retrieval-protocol.md',
  'skills/vb-wiki/references/wiki-lint-protocol.md',
  'skills/vb-wiki/references/knowledge-write-protocol.md',
  'skills/vb-wiki/references/operation-journal.md',
]) {
  validateReferences(path);
}

for (const path of [
  'skills/accept-deliver/SKILL.md',
  'skills/accept-issue/SKILL.md',
  'skills/accept-milestone/SKILL.md',
  'skills/merge-issue/SKILL.md',
  'skills/insights/SKILL.md',
  'skills/vb-wiki/SKILL.md',
  'skills/vb-learn/SKILL.md',
]) {
  const frontmatter = read(path).split('---')[1] ?? '';
  check(frontmatter.includes(`name: ${basename(dirname(path))}`), `${path} frontmatter name must match its directory`);
}

check(!existsSync(join(root, 'skills/vb-learn/assets/content-summary-template.md')), 'obsolete content-summary template must remain removed');

if (failures.length > 0) {
  console.error('Learning-flow validation failed:');
  for (const failure of failures)
    console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Learning-flow validation passed.');
