import { createHash } from 'node:crypto';
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

const acceptIssue = read('skills/accept-issue/SKILL.md');
const acceptMilestone = read('skills/accept-milestone/SKILL.md');
const mergeIssue = read('skills/merge-issue/SKILL.md');
const insights = read('skills/insights/SKILL.md');
const insightsSchema = JSON.parse(read('skills/insights/references/insights.schema.json'));
const learningState = read('skills/insights/references/acceptance-learning-state.md');
const vbWiki = read('skills/vb-wiki/SKILL.md');
const vbWikiFrontmatter = vbWiki.split('---')[1] ?? '';
const knowledgeProtocol = read('skills/vb-wiki/references/knowledge-write-protocol.md');
const knowledgeEditor = read('skills/vb-wiki/references/knowledge-editor.md');
const knowledgeEditorGoldenCases = read('skills/vb-wiki/references/knowledge-editor-golden-cases.md');
const retrievalProtocol = read('skills/vb-wiki/references/retrieval-protocol.md');
const wikiLintProtocol = read('skills/vb-wiki/references/wiki-lint-protocol.md');
const promotionGate = read('skills/vb-wiki/references/skill-promotion-gate.md');
const operationJournal = read('skills/vb-wiki/references/operation-journal.md');
const projectIdentity = read('skills/vb-wiki/references/project-identity.md');
const wikiSchema = read('skills/vb-wiki/assets/schema-template.md');
const wikiIndexTemplate = read('skills/vb-wiki/assets/index-template.md');
const wikiLogTemplate = read('skills/vb-wiki/assets/log-template.md');
const wikiMetaTemplate = read('skills/vb-wiki/assets/meta-template.md');
const wikiSchemaV1Template = read('skills/vb-wiki/assets/schema-v1-template.md');
const retrievalProtocolLower = retrievalProtocol.toLowerCase();
const vbLearn = read('skills/vb-learn/SKILL.md');
const vbLearnFrontmatter = vbLearn.split('---')[1] ?? '';
const skillosLite = read('skills/skillos-lite/SKILL.md');
const builtInAgents = read('skills/built-in-agents/SKILL.md');
const vbInit = read('skills/vb-init/SKILL.md');
const vbLinear = read('skills/vb-linear/SKILL.md');
const readmeEn = read('README.md');
const readmeZh = read('README.zh-CN.md');
const manifest = JSON.parse(read('skills/built-in-agents/agents.manifest.json'));

const acceptIssueLearningIndex = acceptIssue.indexOf('**立即复盘**');
const acceptIssueWikiIndex = acceptIssue.indexOf('**立即入库**');
const acceptIssueDeliveryIndex = acceptIssue.indexOf('**后续交付路由**');
const acceptIssueRecoveryIndex = acceptIssue.indexOf('**恢复探测优先**');
const acceptIssueNewAcceptanceIndex = acceptIssue.indexOf('**仅新验收**');
check(acceptIssueLearningIndex >= 0, 'accept-issue must run insights immediately after acceptance');
check(acceptIssueWikiIndex > acceptIssueLearningIndex, 'accept-issue must run vb-wiki immediately after insights');
check(acceptIssueDeliveryIndex > acceptIssueLearningIndex, 'accept-issue learning must precede milestone/merge routing');
check(acceptIssue.includes('vb-wiki <issue-key>'), 'accept-issue must immediately persist accepted knowledge with vb-wiki');
check(acceptIssue.includes('promotion 为 `not_started` / `approved` / `applying` / `failed`'), 'accept-issue must resume promotion phases after the wiki commit');
check(acceptIssue.includes('`wiki: zero_atoms` 且 promotion 仍为 `not_started`'), 'accept-issue must finalize promotion after an interrupted zero-atom write');
check(acceptIssue.includes('defer_promotion_question: true'), 'accept-issue must not let a skill proposal interrupt pending delivery');
check(acceptIssue.includes('durable outbox'), 'accept-issue must not lose a deferred promotion at delivery handoff');
check(acceptIssue.includes('acceptance_event.id'), 'accept-issue must create a stable acceptance event');
check(acceptIssue.includes('active event'), 'accept-issue must reuse an existing acceptance event on resume');
check(acceptIssue.includes('首个未完成 phase'), 'accept-issue must resume only the first incomplete learning phase');
check(acceptIssueRecoveryIndex >= 0 && acceptIssueRecoveryIndex < acceptIssueNewAcceptanceIndex, 'accept-issue durable recovery must precede new acceptance review');
check(acceptIssue.includes('不得要求重复验收'), 'accept-issue must not request acceptance again for a proven recovery event');
check(acceptIssue.includes('`milestone_handoff`') && acceptIssue.includes('`no_merge_required`'), 'accept-issue must not require a direct PR target for milestone or non-code acceptance');
check(acceptIssue.includes('不得为它们虚构 main PR'), 'accept-issue must not fabricate PR metadata for a non-PR delivery');
check(acceptIssue.includes('non-code source') && acceptIssue.includes('不得虚构 commit'), 'accept-issue must accept a canonical non-code record without fabricating a commit');
check(acceptIssue.includes('canonical acceptance 评论真正写入前') && acceptIssue.includes('one structurally valid match 立即认领'), 'accept-issue must recheck the canonical acceptance record immediately before writing');
check(!acceptIssue.includes('learning_deferred:'), 'accept-issue must not defer learning to merge or milestone acceptance');

const milestoneLearningIndex = acceptMilestone.indexOf('立即复盘与知识沉淀');
const milestoneMergeIndex = acceptMilestone.indexOf('**PR 状态分流、写前意图与合并证明**');
const milestoneRecoveryIndex = acceptMilestone.indexOf('**恢复路由（先于状态门禁）**');
const milestoneNewGateIndex = acceptMilestone.indexOf('**新验收前置**');
check(milestoneLearningIndex >= 0, 'accept-milestone must run insights and vb-wiki immediately after acceptance');
check(milestoneMergeIndex > milestoneLearningIndex, 'accept-milestone learning must happen before separately authorized merge');
check(milestoneRecoveryIndex >= 0 && milestoneRecoveryIndex < milestoneNewGateIndex, 'milestone event recovery must precede the pending_acceptance gate');
const milestoneRecoveryBlock = acceptMilestone.slice(milestoneRecoveryIndex, milestoneNewGateIndex);
for (const eventName of ['acceptance_event', 'delivery_intent', 'delivery_event', 'aggregation_event'])
  check(milestoneRecoveryBlock.includes(eventName), `milestone recovery must inspect ${eventName} before status gating`);
check(acceptMilestone.includes('`status: accepted` 只允许 recovery-only'), 'accepted milestone must never enter fresh acceptance');
check(acceptMilestone.includes('`acceptance: recorded`') && acceptMilestone.includes('不得再次要求验收'), 'recorded milestone acceptance must remain durable across retries');
check(acceptMilestone.includes('vb-wiki <milestone-id>'), 'accept-milestone must persist accepted milestone knowledge with vb-wiki');
check(acceptMilestone.includes('`wiki: committed` 且 promotion 为 `not_started` / `approved` / `applying` / `failed`'), 'accept-milestone must resume promotion phases after the wiki commit');
check(acceptMilestone.includes('`wiki: zero_atoms` 且 promotion 仍为 `not_started`'), 'accept-milestone must finalize promotion after an interrupted zero-atom write');
check(acceptMilestone.includes('**本步骤不写 acceptance record**') && acceptMilestone.includes('Project Update 真正写入前'), 'accept-milestone must have exactly one guarded canonical acceptance write');
check(acceptMilestone.includes('defer_promotion_question: true'), 'accept-milestone must not let a skill proposal interrupt authorized delivery');
check(acceptMilestone.includes('当前 event 与 `prior_acceptance_events`'), 'accept-milestone must surface deferred issue and milestone candidates');
check(acceptMilestone.includes('reconcile_only: true'), 'accept-milestone merge finalization must reconcile without re-learning');
check(acceptMilestone.includes('aggregate_only: true'), 'requirement aggregation must suppress duplicate promotion');
check(acceptMilestone.includes('prior_acceptance_events'), 'milestone learning must emit only delta beyond prior issue acceptance events');
check(acceptMilestone.includes('aggregation_event.id'), 'requirement roll-up must use an aggregation event, not fabricate human acceptance');
check(acceptMilestone.includes('raw UTF-8 bytes'), 'requirement roll-up must use a canonical child-event digest');
check(acceptMilestone.includes('Milestone 没有评论 API'), 'milestone retrospectives must use a real Project Update host');
check(acceptMilestone.includes('delivery_event.id'), 'milestone reconciliation must use a delivery event');
check(mergeIssue.includes('reconcile_only: true'), 'merge-issue must only reconcile delivery provenance after merge');
check(mergeIssue.includes('accepted_commit'), 'merge-issue must compare delivered content with the accepted commit');
check(mergeIssue.includes('delivery_event.id'), 'merge-issue reconciliation must use a delivery event');
check(mergeIssue.includes('严格证明'), 'merge conflicts must require re-acceptance unless equivalence is strictly proven');
check(!mergeIssue.includes('先触发 `insights`'), 'merge-issue must not repeat the retrospective after merge');
check(mergeIssue.includes('learning_resume_pending'), 'merge-issue must route incomplete base learning back to accept-issue');
check(mergeIssue.includes('不得阻断用户另行授权的合并'), 'merge-issue must not make learning completion a merge authorization gate');
check(mergeIssue.includes('promotion_resume_pending'), 'merge-issue must not lose an already-approved promotion application');
check(mergeIssue.includes('`wiki: zero_atoms` 后 promotion 仍未写成 `not_applicable`'), 'merge-issue must return an incomplete zero-atom promotion phase to accept-issue');
check(mergeIssue.includes('本 skill 不补跑正常复盘'), 'merge-issue must remain reconciliation-only');
check(!mergeIssue.includes('仅恢复同一 event 的缺失 phase'), 'merge-issue must not resume normal learning itself');

for (const [name, content] of [['merge-issue', mergeIssue], ['accept-milestone', acceptMilestone]]) {
  check(content.includes('provider_merge_commit_oid'), `${name} must use the provider merge OID`);
  check(content.includes('git merge-base --is-ancestor'), `${name} must prove the merge commit is on the exact target branch`);
  check(content.includes('delivery_event_conflict'), `${name} must fail closed on conflicting delivery adoption`);
  check(content.includes('不得使用目标分支当前 HEAD'), `${name} must not derive delivery identity from a moving branch tip`);
  check(content.includes('delivery_intent'), `${name} must persist a write-ahead merge intent`);
  check(content.includes('expected_head_oid'), `${name} must bind merge execution to the accepted PR head`);
  const markerIndex = content.indexOf('VibeRig-Record: delivery-intent:<intent-id>');
  const mergeCallIndex = content.indexOf('只调用一次 merge', markerIndex);
  check(markerIndex >= 0 && mergeCallIndex > markerIndex, `${name} must persist delivery_intent before its merge API call`);
}
check(mergeIssue.indexOf('**PR 状态分流（先于 open-PR mergeability）**') < mergeIssue.indexOf('检查 mergeability'), 'merge-issue must recover MERGED before open-PR mergeability logic');
check(acceptMilestone.includes('delivery-only resume'), 'accept-milestone must recover delivery after its status advances');

for (const [path, content] of [
  ['skills/accept-issue/SKILL.md', acceptIssue],
  ['skills/accept-milestone/SKILL.md', acceptMilestone],
  ['skills/merge-issue/SKILL.md', mergeIssue],
  ['README.md', readmeEn],
  ['README.zh-CN.md', readmeZh],
]) {
  check(!content.includes('insights → vb-learn'), `${path} still documents the legacy automatic skill-learning chain`);
  check(!content.includes('insights + vb-learn'), `${path} still documents the legacy automatic skill-learning chain`);
}

check(insights.includes('deferred: acceptance_missing'), 'insights must fail closed when human acceptance is missing');
check(!insights.includes('delivery_not_durable'), 'insights must not defer accepted work for merge');
check(insights.includes('Zero retrospective signals is a valid result'), 'insights must treat zero signals as success');
check(insights.includes('<!-- VibeRig-Record: retrospective:<event-id> -->'), 'insights records must carry a typed idempotency marker');
check(insights.includes('fail closed on duplicate/malformed retrospective-kind matches'), 'insights must adopt or reject an existing marked record safely');
check(insights.includes('ignoring acceptance/phase records'), 'insights must not confuse valid records of another kind with duplicates');
check(insights.includes('Issue → its comments; Milestone/requirement → registered Project Updates'), 'insights must map each scope to a real Linear host');
check(insightsSchema.properties?.acceptance_event, 'insights schema must define acceptance_event');
check(insightsSchema.properties?.aggregation_event, 'insights schema must define aggregation_event separately');
check(insightsSchema.properties?.event_kind?.enum?.includes('aggregation'), 'insights schema must support aggregation mode');
check(!insightsSchema.required?.includes('delivery_state'), 'aggregation mode must not inherit acceptance delivery-state requirements');
check(insightsSchema.properties?.delivery_state, 'insights schema must record delivery_state as provenance');
check(insightsSchema.properties?.delivery_state?.enum?.includes('accepted_unmerged'), 'insights schema must allow accepted_unmerged work');
check(insightsSchema.properties?.delivery_state?.enum?.includes('accepted_in_milestone'), 'insights schema must allow accepted milestone issue work');
check(insightsSchema.properties?.retrospective_signals, 'insights schema must define retrospective_signals');
check(insightsSchema.properties?.discarded_signals, 'insights schema must define discarded_signals');
check(!insightsSchema.properties?.durable_signals, 'insights schema must not retain the merge-gated durable_signals field');
check(!insightsSchema.properties?.gate?.properties?.delivery_durable, 'insights gate must not require delivery durability');
const discardReasons = insightsSchema.properties?.discarded_signals?.items?.properties?.reason?.enum ?? [];
check(!discardReasons.includes('unmerged'), 'unmerged must not be a discarded-signal reason after acceptance');
check(!insightsSchema.properties?.learning_candidates, 'insights schema must not define learning_candidates');
check(!insightsSchema.properties?.curation_proposals, 'insights schema must not define curation_proposals');
const schemaBranches = JSON.stringify(insightsSchema.allOf ?? []);
check(schemaBranches.includes('accepted_commit'), 'code-backed insight bundles must require git.accepted_commit');
check(schemaBranches.includes('accepted_record'), 'non-code insight bundles must require accepted_record');
check(schemaBranches.includes('aggregate_only'), 'aggregation schema branch must require aggregate_only');
check(schemaBranches.includes('"not"'), 'aggregation schema branch must forbid a fabricated acceptance gate');
check(insightsSchema.properties?.acceptance_event?.properties?.id?.pattern?.includes(':r'), 'acceptance event ids must include a revision');
check(insightsSchema.properties?.aggregation_event?.properties?.derived_from?.uniqueItems === true, 'aggregation child event ids must be unique');
check(insightsSchema.properties?.aggregation_event?.properties?.id?.pattern?.includes('[a-f0-9]{64}'), 'aggregation event ids must use a full lowercase SHA-256 digest');
check(insights.includes('`aggregation_event.derived_from`'), 'insights must use the nested aggregation child path');
check(!insights.includes('- `derived_from`:'), 'insights must not document derived_from as a top-level field');
const signalShape = insightsSchema.properties?.retrospective_signals?.items?.properties ?? {};
check(signalShape.evidence?.minItems === 1, 'retrospective signal evidence must be non-empty');
check(signalShape.invalidation_signals?.minItems === 1, 'retrospective signal invalidation guidance must be non-empty');

for (const phrase of [
  'resume its first incomplete phase',
  'Never infer promotion state from a page, log entry, or wiki commit',
  'delivery:<scope-id>:<accepted-source-fingerprint>:<delivered-commit>',
  'prior_acceptance_events',
  'An `aggregation_event`',
  'An explicitly requested manual note uses `insights: not_applicable`',
  '`approved`, `applying`, or `failed` must resume the same `vb-learn` application',
  '`wiki: zero_atoms` + `promotion: not_started`',
  'sort the exact child IDs by raw UTF-8 bytes',
  'RFC 8785/JCS',
  '`scope_identity` is never a free-form label',
  '`delivery_target.kind: pull_request`',
  '`milestone_handoff`',
  'search the local operation journal plus fixed-trailer history',
  'Workflow status gates only creation of a new acceptance event; it never gates recovery.',
  'A Milestone in `status: accepted` is recovery-only.',
  '`acceptance: recorded` is durable authority across retries and conversations',
  '`delivery_intent.id`',
  '`merge_authorization_record`',
  '`expected_base_oid`',
  '`expected_head_oid`',
  '`provider_merge_commit_oid`',
  '`git merge-base --is-ancestor <provider_merge_commit_oid> <remote/base-ref>`',
  '`blocked: delivery_commit_unproven`',
  '`blocked: delivery_event_conflict`',
  '`merge_origin: provider_observed`',
  'Never use the target branch\'s current `HEAD` as the merged commit',
]) {
  check(learningState.includes(phrase), `acceptance learning state is missing: ${phrase}`);
}

check(vbWiki.includes('default self-learning sink'), 'vb-wiki must be the default self-learning sink');
check(vbWiki.includes('An accepted-but-unmerged PR is valid input and must be written now.'), 'vb-wiki must write accepted-unmerged knowledge immediately');
check(vbWiki.includes('deferred: acceptance_missing'), 'vb-wiki must fail closed only when acceptance is missing');
check(!vbWiki.includes('delivery_not_durable'), 'vb-wiki must not defer accepted work for merge');
check(vbWiki.includes('acceptance_event.id'), 'vb-wiki must enforce acceptance-event idempotency');
check(vbWiki.includes('aggregation_event.id'), 'vb-wiki aggregate mode must use an aggregation event');
check(vbWiki.includes('delivery_event.id'), 'vb-wiki reconcile mode must use a delivery event');
check(vbWiki.includes('or proves `promotion` was evaluated'), 'vb-wiki must resume promotion independently from the wiki commit');
check(vbWiki.includes('persist `insights: not_applicable`'), 'vb-wiki manual notes must not fabricate a completed retrospective');
check(vbWiki.includes('resolve VB-42 through the Linear acceptance path'), 'vb-wiki must not route a named Linear scope through manual-note authority');
check(/replies to a pending vb-wiki\s+tool-promotion/.test(vbWikiFrontmatter), 'vb-wiki must route replies through the candidate state machine');
check(vbWiki.includes('blocked: promotion_candidate_ambiguous'), 'vb-wiki must not bind a bare reply to an ambiguous candidate');
check(vbWiki.includes('Page/log content alone never identifies a commit'), 'vb-wiki must not treat page presence as a completed write');
check(vbWiki.includes('VibeRig-Operation: <operation-id>'), 'vb-wiki must prove its wiki commit with a fixed operation trailer');
check(vbWiki.includes('Adopt only a unique fully proven commit'), 'vb-wiki must recover a commit only after complete journal proof');
check(vbWiki.includes('refresh_skipped_dirty_worktree'), 'vb-wiki must never index uncommitted wiki drafts');
check(vbWiki.includes('`approved` / `applying` / `failed`'), 'vb-wiki must resume interrupted promotion application');
check(vbWiki.includes('durable outbox'), 'vb-wiki must persist a proposal before final-response delivery');
check(vbWiki.includes('Only `wiki_only`, `declined`, `completed`, and `not_applicable`'), 'vb-wiki must not treat approval as terminal application');
check(vbWiki.includes('mutually exclusive operation modes'), 'vb-wiki must reject ambiguous operation-mode combinations');
check(vbWiki.includes('after the wiki commit'), 'vb-wiki must evaluate promotion only after the wiki commit');
check(vbWiki.includes('promotion: skipped_aggregate'), 'vb-wiki must skip promotion for aggregate replay');
check(vbWiki.includes('skipped_reconciliation'), 'vb-wiki must skip promotion for delivery reconciliation');
check(vbWiki.includes('skipped_skill_source'), 'vb-wiki must not promote a skill-to-note conversion back into a skill');
check(vbWiki.includes('knowledge admission') && vbWiki.includes('retrieval SEO'), 'vb-wiki must separate knowledge value from retrieval routing');
check(vbWiki.includes('Query and lint are read-only'), 'vb-wiki query and lint modes must remain read-only');
check(vbWiki.includes('write-capable modes only') && vbWiki.includes('wiki_not_initialized'), 'read-only query/lint must never bootstrap a missing wiki');
check(vbWiki.includes('current-state `index.md`'), 'vb-wiki must maintain a current-state retrieval catalog');
check(knowledgeEditor.includes('confidence: high | insufficient') && knowledgeEditor.includes('admission `pass` requires `confidence: high`'), 'knowledge admission must distinguish evidence confidence from value rejection');
check(knowledgeProtocol.includes('accepted_unmerged'), 'knowledge protocol must persist accepted-unmerged evidence without a provisional tier');
check(knowledgeProtocol.includes('reconcile_only: true'), 'knowledge protocol must define delivery reconciliation');
check(knowledgeProtocol.includes('not the sole semantic bottleneck'), 'the retrospective must not reduce vb-wiki to a second summarizer');
check(knowledgeEditor.includes('future_query') && knowledgeEditor.includes('belong to SEO after admission'), 'future queries must be compiled after knowledge admission');
check(knowledgeEditor.includes('phase: admission | resolution') && knowledgeEditor.includes('action: pending'), 'knowledge editing must use an executable admission then resolution sequence');
for (const fixture of ['Case 1', 'Case 2', 'Case 3', 'Case 4', 'Case 5', 'Case 6', 'resolution_discarded', 'SEO Compiler output'])
  check(knowledgeEditorGoldenCases.includes(fixture), `knowledge editor golden fixtures are missing: ${fixture}`);
check(knowledgeEditorGoldenCases.includes('issue recap') || knowledgeEditorGoldenCases.includes('Issue recap'), 'golden fixtures must reject task-summary output');
check(knowledgeEditorGoldenCases.includes('SEO demand') || knowledgeEditorGoldenCases.includes('SEO Demand'), 'golden fixtures must prove SEO cannot reverse admission');
check(knowledgeEditorGoldenCases.includes('resolution_assessment') && knowledgeEditorGoldenCases.includes('disposition: discard'), 'golden fixtures must model resolution discard without rewriting admission');
check([...knowledgeEditorGoldenCases.matchAll(/^## Case \d+ —/gm)].length === 6, 'knowledge editor regression suite must contain exactly six numbered cases');
for (const caseNumber of [2, 3]) {
  const start = knowledgeEditorGoldenCases.indexOf(`## Case ${caseNumber} —`);
  const end = knowledgeEditorGoldenCases.indexOf(`## Case ${caseNumber + 1} —`, start);
  const section = knowledgeEditorGoldenCases.slice(start, end);
  const expectedStart = section.indexOf('**Expected admission**');
  const forbiddenStart = section.indexOf('**Forbidden bad outputs**', expectedStart);
  const expectedBlock = section.slice(expectedStart, forbiddenStart);
  check(!expectedBlock.includes('cognitive_delta:'), `golden Case ${caseNumber} early discard must not fabricate cognitive_delta`);
  check(!expectedBlock.includes('\n    knowledge:'), `golden Case ${caseNumber} early discard must not fabricate knowledge fields`);
}
const goldenLines = knowledgeEditorGoldenCases.split('\n');
const bodyStart = goldenLines.findIndex(line => line === '    body: |');
const bodyEnd = goldenLines.findIndex((line, index) => index > bodyStart && line === '    claim_source_map:');
const goldenBody = `${goldenLines.slice(bodyStart + 1, bodyEnd).map(line => line.startsWith('      ') ? line.slice(6) : line).join('\n')}\n`;
const declaredFingerprint = knowledgeEditorGoldenCases.match(/content_fingerprint: sha256:([a-f0-9]{64})/)?.[1];
check(bodyStart >= 0 && bodyEnd > bodyStart && createHash('sha256').update(goldenBody.normalize('NFC')).digest('hex') === declaredFingerprint, 'golden positive page body must match its declared SEO fingerprint');
check(!knowledgeProtocol.includes('knowledge_decisions:'), 'the write protocol must consume the editor ledger instead of defining a second decision model');
check(![vbWiki, knowledgeProtocol, knowledgeEditor, retrievalProtocol, wikiSchema].some(content => content.includes('applies_when')), 'vb-wiki must use the schema field applies_to consistently');
const semanticFrontmatterLine = knowledgeEditor.split('\n').find(line => line.includes('semantic_frontmatter:')) ?? '';
check(!semanticFrontmatterLine.includes('tags:'), 'tags must not be generated by the semantic editor');
check(retrievalProtocol.includes('| `tags` |') && retrievalProtocol.includes('SEO Compiler generates only'), 'tags must be owned by the post-admission SEO compiler');
check(knowledgeProtocol.includes('no_change') && knowledgeProtocol.includes('update') && knowledgeProtocol.includes('create') && knowledgeProtocol.includes('conflict'), 'write-time entity resolution must produce explicit semantic dispositions');
check(knowledgeProtocol.includes('current retrieval catalog, not history'), 'index.md must represent current knowledge rather than event history');
check(knowledgeProtocol.includes('Append exactly one operation entry to `log.md`'), 'log.md must be the append-only operation history');
check(knowledgeProtocol.includes('Aggregate Accepted Child Events'), 'knowledge protocol must define aggregate-only behavior');
check(knowledgeProtocol.includes('<exact operation-id>'), 'wiki log additions must carry the exact operation id');
check(knowledgeProtocol.includes('aggregation_event.derived_from'), 'wiki aggregation must use the nested child-event path');
for (const phrase of [
  'long-term memory editor',
  'Truth is necessary but not sufficient',
  'future_query',
  'candidate ledger',
  'does_not_apply_when',
  'no_change',
  'Issue summary',
  'zero',
]) {
  check(knowledgeEditor.includes(phrase), `knowledge editor is missing: ${phrase}`);
}
for (const phrase of [
  'seo',
  'never prove',
  'write-time',
  'read-time',
  'current-state',
  'content_fingerprint',
  'index.md',
  'log.md',
  'qmd',
]) {
  check(retrievalProtocolLower.includes(phrase), `retrieval protocol is missing: ${phrase}`);
}
for (const phrase of [
  'lint_only',
  'contradiction',
  'possibly_stale',
  'orphan_page',
  'broken_link',
  'exact_duplicate',
  'content_fingerprint_drift',
  'knowledge_gap',
  'scope_misuse',
  'zero writes',
]) {
  check(wikiLintProtocol.includes(phrase), `wiki lint protocol is missing: ${phrase}`);
}
check(operationJournal.includes('blocked: wiki_worktree_conflict'), 'wiki writes must not absorb unrelated worktree changes');
check(operationJournal.includes('wiki-writer.lock') && operationJournal.includes('blocked: wiki_writer_busy'), 'wiki writes must have store-wide atomic ownership');
check(operationJournal.includes('promotion-locks') && operationJournal.includes('promotion_decision_sha256'), 'promotion evaluation must have event-scoped CAS ownership');
check(operationJournal.includes('unique sibling temporary') && operationJournal.includes('no ownerless window'), 'lock acquisition must install owner metadata atomically');
check(operationJournal.includes('operation_result') && operationJournal.includes('maintenance_no_change'), 'non-acceptance modes must persist exact local terminal results');
check(operationJournal.includes('`skill_to_note`') && operationJournal.includes('reject every other spelling'), 'journal mode enums must be canonical and operation-ID bound');
check(knowledgeProtocol.includes('never identifies a commit from page/diff context alone'), 'wiki recovery must use commit metadata instead of stale page context');
check(operationJournal.includes('~/.vb-wiki/.git/viberig/operations/'), 'non-Linear wiki operations must have a local journal');
check(operationJournal.includes('git write-tree'), 'wiki recovery must persist a staged tree identity');
check(operationJournal.includes('operation_commit_unreachable'), 'wiki recovery must reject unreachable commits');
check(operationJournal.includes('VibeRig-Operation: bootstrap:v1'), 'wiki bootstrap must be crash-recoverable');
check(operationJournal.includes('Read-only query and lint modes create no journal'), 'query and lint must not create machine journal state');
check(operationJournal.includes('wiki_schema_upgrade_required'), 'legacy append-only indexes must require an explicit safe migration');
check(projectIdentity.includes('project_identity_ambiguous'), 'project routing must fail closed when multiple wiki projects share one identity');
check(projectIdentity.includes('project_key_unsafe') && projectIdentity.includes('repo_root_fingerprint'), 'project routing must validate containment and distinguish identity-less repositories');
check(wikiMetaTemplate.includes('repo_root_fingerprint'), 'project meta must persist the fallback stable identity');
check(learningState.includes('wiki_result_reason') && operationJournal.includes('wiki_result_reason'), 'zero-result reasons must survive both Linear and journal recovery');
check(learningState.includes('repo_root_fingerprint'), 'manual project scope identity must support the identity-less repository fallback');
check(learningState.includes('phase_transition_conflict'), 'Linear phase overlays must reject terminal-state regression');
check(
  learningState.includes('wiki_editor_revision')
  && learningState.includes('wiki_editor_input_sha256')
  && learningState.includes('wiki_editor_result_sha256'),
  'Linear phase overlays must mirror the editor revision and exact input/result hashes',
);
check(learningState.includes('resolution_discarded') && operationJournal.includes('resolution_discarded'), 'all-discarded resolution must have a terminal zero-result reason');
check(operationJournal.includes('blocked: zero_result_conflict'), 'Linear-backed zero results must have a durable no-commit boundary');
check(knowledgeProtocol.includes('never zero results') && knowledgeProtocol.includes('wiki_resume_from: resolution | entity_resolution'), 'blocked conflicts must remain resumable failures rather than zero atoms');
check(
  operationJournal.includes('editor_input_sha256')
  && operationJournal.includes('editor_attempts')
  && operationJournal.includes('candidate page blob OID or route availability')
  && operationJournal.includes('editor_revision_conflict'),
  'failed editor drafts may be superseded only after a proved canonical input change',
);
check(
  knowledgeEditor.includes('editor_contract_version: 1')
  && operationJournal.includes('literal `editor_contract_version: 1`'),
  'all runners must hash one stable knowledge-editor contract version',
);
check(
  operationJournal.includes('r<editor_revision>.json')
  && operationJournal.includes('one journal\ncompare-and-swap')
  && operationJournal.includes('unreferenced `r<N+1>.json`'),
  'editor recovery must use immutable revision-scoped payloads and one journal CAS',
);
check(
  knowledgeProtocol.includes('proved-input-change transition')
  && knowledgeProtocol.includes('model nondeterminism'),
  'write recovery must distinguish changed canonical inputs from nondeterministic output',
);
check(operationJournal.includes('total bijection') && operationJournal.includes('matching commit tree and parent diff'), 'commit adoption must prove complete catalog and log durability');
check(wikiSchema.includes('Every page-changing distillation'), 'wiki schema must not require a commit for zero atoms');
check(wikiSchema.includes('only when a real relationship exists'), 'same-event wiki pages must not fabricate links');
check(wikiSchema.includes('<exact operation/event ID>'), 'wiki schema log lines must carry the exact operation id');
check(wikiSchema.includes('never absorb'), 'wiki schema must preserve user-owned worktree changes');
check(wikiSchema.includes('VibeRig-Operation: <operation-id>'), 'wiki schema must require a stable operation trailer');
check(!wikiSchema.includes('are absorbed into the next page-changing commit'), 'wiki schema must not absorb pre-existing changes');
check(wikiSchema.includes('VibeRig-Wiki-Schema: 2'), 'wiki schema must declare the current contract version');
check(wikiSchema.includes('current-state catalog') && wikiSchema.includes('exactly once'), 'wiki schema must define a one-entry-per-page current catalog');
check(wikiSchema.includes('answerable_queries') && wikiSchema.includes('exact_terms'), 'wiki schema must expose post-retention retrieval fields');
check(wikiSchema.includes('content_fingerprint'), 'wiki schema must bind retrieval metadata to canonical body bytes');
check(wikiSchema.includes('provenance:') && knowledgeEditor.includes('provenance: []'), 'canonical pages must keep delivery/source provenance outside the explanatory narrative');
check(!wikiIndexTemplate.includes('Append-only flat index'), 'index template must not duplicate event history');
check(wikiIndexTemplate.includes('Current-state retrieval catalog'), 'index template must describe current canonical state');
check(wikiIndexTemplate.includes('[[relative/path-without-.md]] — one-line summary'), 'index must remain a compact path plus summary catalog');
check(wikiLogTemplate.includes('Append-only human-readable operation timeline'), 'log template must own append-only human history');
check(wikiLogTemplate.includes('[[relative/path]]'), 'log entries must identify pages by unambiguous relative path');
check(/excluded from\s+default knowledge retrieval/.test(wikiLogTemplate), 'log history must not pollute default knowledge answers');
check(promotionGate.includes('does not rescue a discarded/zero-atom candidate'), 'tool promotion must not bypass knowledge admission');
check(promotionGate.includes('Search metadata') && promotionGate.includes('not substitutes for the canonical page'), 'tool promotion must ignore SEO snippets as knowledge');
for (const gate of [
  'Action-oriented',
  'Independently invocable',
  'Stable contract',
  'Reusable mechanism',
  'Verifiable and safe',
  'Wiki insufficient',
  'Value evidence',
]) {
  check(promotionGate.includes(gate), `skill-promotion gate is missing: ${gate}`);
}
check(promotionGate.includes('decision: wiki_only | propose_skill'), 'promotion gate must have a structured fail-closed decision');
check(promotionGate.includes('Explicit yes'), 'promotion gate must require explicit user confirmation');
check(promotionGate.includes('promotion:<source-event-fingerprint>'), 'promotion candidates must have a stable id');
check(promotionGate.includes('approval_record'), 'promotion approval must be persisted separately from acceptance');
check(promotionGate.includes('Bind The Exact Tool Target'), 'promotion must bind create/refine and target before asking');
check(promotionGate.includes('target_skill: <exact-kebab-case-package-name>'), 'promotion packets must name the exact approved package');
check(promotionGate.includes('packet_sha256'), 'promotion identity must change when its approved packet changes');
check(promotionGate.includes('Staleness Guard') && promotionGate.includes('candidate_stale'), 'promotion must reject candidates whose knowledge basis changed');
check(promotionGate.includes('status: current') && promotionGate.includes('needs_revalidation'), 'unresolved knowledge must not become a tool candidate');
check(knowledgeProtocol.includes('legacy_page_unmigratable') && knowledgeProtocol.includes('page:legacy:'), 'legacy schema migration must be deterministic and fail closed');
check(createHash('sha256').update(wikiSchemaV1Template).digest('hex') === 'f253605a2378d2a3868bbe3f22df68188e92e2d9019cb7a0793fc47107b79cce', 'legacy schema migration fixture must match its pinned v1 digest');
check(knowledgeProtocol.includes('wiki_resume_from: seo_compile') && operationJournal.includes('editor_result_sha256'), 'SEO compile recovery must bind the exact editor payload');

check(vbLearnFrontmatter.includes('exactly one user-approved tool skill'), 'vb-learn trigger must be explicit and single-candidate');
check(!vbLearnFrontmatter.includes('学习 VB-42'), 'vb-learn frontmatter must not capture generic learning requests');
check(!vbLearnFrontmatter.includes('记录这个 pattern'), 'vb-learn frontmatter must not capture generic note requests');
check(vbLearn.includes('redirect: vb-wiki'), 'vb-learn must redirect generic learning to vb-wiki');
check(vbLearn.includes('VibeRig-Candidate: <candidate_id>'), 'vb-learn commits must carry a stable candidate marker');
check(vbLearn.includes('return `already_applied`'), 'vb-learn must recover a committed candidate idempotently');
check(vbLearn.includes('blocked: candidate_commit_invalid'), 'vb-learn must not reapply an invalid historical candidate commit');
check(vbLearn.includes('blocked: candidate_history_ambiguous'), 'vb-learn must fail closed on duplicate candidate commits');
check(vbLearn.includes('blocked: candidate_worktree_conflict'), 'vb-learn must not infer dirty target paths belong to a candidate');
check(vbLearn.includes('tool_staged_tree'), 'vb-learn must persist the exact staged tree before commit');
check(vbLearn.includes('blocked: candidate_store_advanced'), 'vb-learn must reject a changed tool-store base');
check(vbLearn.includes('do not run git add again'), 'vb-learn must not mutate the index after persisting its staged tree');
check(vbLearn.includes('blocked: target_reauthorization_required'), 'vb-learn must not silently retarget an approved candidate');
check(!existsSync(join(root, 'skills/vb-learn/assets/content-summary-template.md')), 'obsolete lossless content-summary template must be removed');
check(!skillosLite.split('---')[1]?.includes('Use from insights'), 'skillos-lite must not trigger from insights');

for (const path of [
  'skills/accept-issue/SKILL.md',
  'skills/accept-milestone/SKILL.md',
  'skills/merge-issue/SKILL.md',
  'skills/insights/SKILL.md',
  'skills/vb-wiki/SKILL.md',
  'skills/vb-learn/SKILL.md',
  'skills/skillos-lite/SKILL.md',
  'skills/built-in-agents/SKILL.md',
  'skills/vb-init/SKILL.md',
]) {
  const content = read(path);
  const frontmatter = content.split('---')[1] ?? '';
  const expectedName = basename(dirname(path));
  check(frontmatter.includes(`name: ${expectedName}`), `${path} frontmatter name must match its directory`);

  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || target.startsWith('http:') || target.startsWith('https:'))
      continue;
    check(existsSync(join(root, dirname(path), target)), `${path} references missing file: ${target}`);
  }
}

for (const path of [
  'skills/vb-wiki/references/knowledge-editor.md',
  'skills/vb-wiki/references/knowledge-editor-golden-cases.md',
  'skills/vb-wiki/references/retrieval-protocol.md',
  'skills/vb-wiki/references/wiki-lint-protocol.md',
  'skills/vb-wiki/references/knowledge-write-protocol.md',
  'skills/vb-wiki/references/operation-journal.md',
]) {
  const content = read(path);
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || target.startsWith('http:') || target.startsWith('https:'))
      continue;
    check(existsSync(join(root, dirname(path), target)), `${path} references missing file: ${target}`);
  }
}

const deprecatedSelfLearner = manifest.deprecated.find(item => item.name === 'self_learner');
check(manifest.version >= 3, 'built-in agent manifest version must advance with the replacement contract');
check(deprecatedSelfLearner?.replacement === 'insights + vb-wiki', 'self_learner replacement must be insights + vb-wiki');
check(deprecatedSelfLearner?.reason?.includes('Explicit acceptance immediately triggers'), 'self_learner replacement reason must use acceptance, not merge, as the learning boundary');
check(builtInAgents.includes('显式验收通过后立即执行'), 'built-in agent guidance must describe immediate post-acceptance learning');
check(vbInit.includes('first explicitly accepted write'), 'vb-init must bootstrap vb-wiki on the first accepted write');
check(vbLinear.includes('Milestones do not have a comment capability'), 'vb-linear must route milestone records through Project Updates');
check(vbLinear.includes('`delivery-intent` for the pre-merge write-ahead record'), 'vb-linear must recognize delivery-intent as a typed record kind');
check(vbLinear.includes('zero exact typed-marker matches permits one write') && vbLinear.includes('multiple/malformed/conflicting matches fail closed'), 'vb-linear must define canonical record adoption cardinality');

for (const [path, content] of [
  ['README.md', readmeEn],
  ['README.zh-CN.md', readmeZh],
]) {
  check(content.includes('insights → vb-wiki'), `${path} must document the default acceptance-learning chain`);
  check(!content.includes('wait until `merge-issue`'), `${path} must not defer learning until merge-issue`);
  check(!content.includes('延迟到 `merge-issue`'), `${path} must not defer learning until merge-issue`);
}

if (failures.length > 0) {
  console.error('Learning-flow validation failed:');
  for (const failure of failures)
    console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Learning-flow validation passed.');
