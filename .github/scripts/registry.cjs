// The registry workflow (README.md): issue labels are the request's status.
// The app learns each status from registry_set_status, a database function
// only the service role may call.

const ORG = 'THD-AI';
const LABELS = {
  'registry: waiting for proof': 'waiting_proof',
  'registry: in review': 'in_review',
  'registry: needs info': 'needs_info',
  'registry: approved': 'approved',
  'registry: declined': 'declined',
  'registry: revoked': 'revoked',
};
// Labels only a THD AI member who is not the applicant may set.
const DECISIONS = ['registry: approved', 'registry: needs info', 'registry: declined', 'registry: revoked'];
const MARK = '<!-- registry-checklist -->';

/** Issue forms render as "### Label\n\nvalue" blocks. */
function parseForm(body) {
  const out = {};
  for (const block of String(body ?? '').split(/^### /m).slice(1)) {
    const [label, ...rest] = block.split('\n');
    const value = rest.join('\n').trim();
    out[label.trim()] = value === '_No response_' ? '' : value;
  }
  return out;
}

function fields(issue) {
  const f = parseForm(issue.body);
  return {
    no: Number.parseInt(f['Request number'], 10),
    name: f['Group name'] ?? '',
    slug: (f['Short name'] ?? '').trim().toLowerCase(),
    website: f['Official website or account'] ?? '',
    role: f['Your role in the group'] ?? '',
    proof: f['Link to the proof'] ?? '',
  };
}

const validSlug = (s) => /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s);
const validUrl = (s) => /^https:\/\/\S+$/.test(s);

async function setStatus(no, status, issueNumber) {
  const base = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!base || !key) throw new Error('The registry has no database secrets yet (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  const res = await fetch(`${base}/rest/v1/rpc/registry_set_status`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_no: no, p_status: status, p_issue: issueNumber }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`The app did not take the status (${res.status}): ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const issue = context.payload.issue;
  const number = issue.number;
  const action = context.payload.action;
  const comment = (body) => github.rest.issues.createComment({ owner, repo, issue_number: number, body });
  const labels = issue.labels.map((l) => l.name);
  const f = fields(issue);

  const swapLabel = async (keep) => {
    for (const name of labels) {
      if (name !== keep && LABELS[name]) {
        await github.rest.issues.removeLabel({ owner, repo, issue_number: number, name }).catch(() => {});
      }
    }
    if (!labels.includes(keep)) await github.rest.issues.addLabels({ owner, repo, issue_number: number, labels: [keep] });
  };

  // ── New or edited request: check the form, then waiting or in review ──
  if (action === 'opened' || action === 'edited') {
    if (labels.some((l) => DECISIONS.includes(l) && l !== 'registry: needs info')) return;
    const problems = [];
    if (!Number.isInteger(f.no) || f.no < 1) problems.push('the request number from the app');
    if (!validSlug(f.slug)) problems.push('a short name of lower case letters, digits and dashes');
    if (!validUrl(f.website)) problems.push('the official website or account (https://…)');
    if (!f.role) problems.push('your role in the group');
    const proofGiven = validUrl(f.proof);
    if (!proofGiven) problems.push('a link to the proof (https://…)');
    const next = problems.length ? 'registry: waiting for proof' : 'registry: in review';
    await swapLabel(next);
    if (Number.isInteger(f.no) && f.no > 0) {
      try {
        await setStatus(f.no, LABELS[next], number);
      } catch (e) {
        core.warning(e.message);
      }
    }
    const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: number });
    if (!comments.some((c) => c.body?.includes(MARK))) {
      await comment(
        `${MARK}\nThanks for registering **${f.name || 'your group'}**. What happens next:\n\n` +
          `- [${problems.length ? ' ' : 'x'}] The form is complete${problems.length ? `: still missing ${problems.join(', ')}` : ''}.\n` +
          '- [ ] A THD AI member who is not you checks the proof.\n' +
          '- [ ] Approved: the group gets its file in `orgs/` and can host gatherings in the app.\n\n' +
          'The app shows the same status. Edit the issue to add anything missing.',
      );
    } else if (problems.length) {
      await comment(`Still missing: ${problems.join(', ')}.`);
    }
    return;
  }

  // ── A decision label ──
  const label = context.payload.label?.name;
  if (action !== 'labeled' || !DECISIONS.includes(label)) return;
  const actor = context.payload.sender.login;
  let member = false;
  try {
    // Private members are visible only to an org-readable token.
    // github-script's client class, signed in with the org-readable token.
    const orgReader = process.env.REGISTRY_TOKEN ? new github.constructor({ auth: process.env.REGISTRY_TOKEN }) : github;
    const res = await orgReader.rest.orgs.checkMembershipForUser({ org: ORG, username: actor });
    member = res.status === 204;
  } catch {
    member = false;
  }
  if (!member || actor === issue.user.login) {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: number, name: label }).catch(() => {});
    await comment(`@${actor} \`${label}\` can only be set by a THD AI member who is not the applicant, so it was taken off again.`);
    return;
  }
  if (!Number.isInteger(f.no) || f.no < 1) {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: number, name: label }).catch(() => {});
    await comment('This request has no request number from the app yet, so its status could not be set.');
    return;
  }

  let saved;
  try {
    saved = await setStatus(f.no, LABELS[label], number);
  } catch (e) {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: number, name: label }).catch(() => {});
    await comment(`The status could not reach the app: ${e.message}`);
    core.setFailed(e.message);
    return;
  }
  if (saved.slug !== f.slug) {
    core.warning(`The form says ${f.slug}; request ${f.no} is ${saved.slug}.`);
  }
  await swapLabel(label);

  const path = `orgs/${saved.slug}.json`;
  const today = new Date().toISOString().slice(0, 10);
  const writeFile = async (data, message) => {
    let sha;
    try {
      const { data: cur } = await github.rest.repos.getContent({ owner, repo, path });
      sha = cur.sha;
    } catch {
      sha = undefined;
    }
    await github.rest.repos.createOrUpdateFileContents({
      owner, repo, path, message, sha,
      content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString('base64'),
    });
  };

  if (label === 'registry: approved') {
    await writeFile(
      { slug: saved.slug, name: f.name, website: f.website, issue: number, verified: today, approved_by: actor },
      `Verify ${f.name} (#${number})`,
    );
    await comment(`Approved by @${actor}. **${f.name}** is verified and can host gatherings in THD Room Finder: https://thd-room-finder.vercel.app/o/${saved.slug}`);
    await github.rest.issues.update({ owner, repo, issue_number: number, state: 'closed', state_reason: 'completed' });
  } else if (label === 'registry: revoked') {
    await writeFile(
      { slug: saved.slug, name: f.name, website: f.website, issue: number, revoked: today, revoked_by: actor },
      `Revoke ${f.name} (#${number})`,
    );
    await comment(`Revoked by @${actor}. The group is no longer verified; its open gatherings take no more replies.`);
  } else if (label === 'registry: declined') {
    await comment(`Declined by @${actor}. The comment above says why.`);
    await github.rest.issues.update({ owner, repo, issue_number: number, state: 'closed', state_reason: 'not_planned' });
  } else {
    await comment(`@${issue.user.login} @${actor} asked for more information. Edit the issue to add it.`);
  }
};

module.exports.parseForm = parseForm;
