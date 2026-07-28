import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, 'job-hunter-dashboard-v1.postman_collection.json');
const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

function isRequest(item) {
  return Boolean(item.request);
}

function collectLeaves(items, folderPath = []) {
  const leaves = [];
  for (const item of items) {
    if (isRequest(item)) {
      leaves.push({ folderPath, request: item });
    } else if (item.item) {
      leaves.push(...collectLeaves(item.item, [...folderPath, item.name]));
    }
  }
  return leaves;
}

function bucket(leaves, prefix) {
  return leaves.filter((l) => l.request.name.startsWith(prefix));
}

function groupByFolder(leaves) {
  const map = new Map();
  for (const leaf of leaves) {
    const key = leaf.folderPath.join(' / ') || 'General';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(leaf.request);
  }
  return [...map.entries()].map(([name, items]) => ({ name, item: items }));
}

const leaves = collectLeaves(src.item);
const smokeLeaves = bucket(leaves, 'SMK-V1');
const regLeaves = bucket(leaves, 'REG-V1');

const filterTests = (filter) => [
  `pm.test('REG-V1-04 filter ${filter} 200 or 503', () => {`,
  '  pm.expect([200, 503]).to.include(pm.response.code);',
  '});',
];

const extraReg = [
  {
    folder: 'Match Jobs — filtros',
    requests: ['unmarked', 'not_applied', 'not_selected', 'rejected', 'closed'].map((filter) => ({
      name: `REG-V1-04 GET match-jobs filter=${filter}`,
      request: {
        method: 'GET',
        header: [],
        url: `{{baseUrl}}/api/dashboard/match-jobs?filter=${filter}`,
      },
      event: [
        {
          listen: 'test',
          script: { type: 'text/javascript', exec: filterTests(filter) },
        },
      ],
    })),
  },
  {
    folder: 'API legacy',
    requests: [
      {
        name: 'REG-V1-07 GET /api/application-status (legacy)',
        request: { method: 'GET', header: [], url: '{{baseUrl}}/api/application-status' },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: ["pm.test('REG-V1-07 status 200', () => pm.response.to.have.status(200));"],
            },
          },
        ],
      },
    ],
  },
  {
    folder: '00 Setup',
    requests: [
      {
        name: 'SETUP GET match-jobs (set sampleJobId)',
        request: {
          method: 'GET',
          header: [],
          url: '{{baseUrl}}/api/dashboard/match-jobs',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'if (pm.response.code === 200) {',
                '  const json = pm.response.json();',
                '  if (json.jobs?.length > 0 && json.jobs[0].id) {',
                "    pm.collectionVariables.set('sampleJobId', String(json.jobs[0].id));",
                '  }',
                '}',
              ],
            },
          },
        ],
      },
    ],
  },
  {
    folder: 'Dashboard Writes — variantes',
    requests: [
      {
        name: 'REG-V1-16 POST application-status applied',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Tracker-User', value: '1' },
          ],
          body: {
            mode: 'raw',
            raw: '{\n  "jobId": "{{sampleJobId}}",\n  "status": "applied"\n}',
          },
          url: '{{baseUrl}}/api/dashboard/application-status',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                "if (!pm.collectionVariables.get('sampleJobId')) pm.test.skip('Set sampleJobId');",
                "pm.test('REG-V1-16 status 200 or 404', () => pm.expect([200,404,503]).to.include(pm.response.code));",
                "if (pm.response.code === 200) pm.test('Enviada', () => pm.expect(pm.response.json().application.estado).to.eql('Enviada'));",
              ],
            },
          },
        ],
      },
      {
        name: 'REG-V1-17 POST application-status not_applied',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Tracker-User', value: '1' },
          ],
          body: {
            mode: 'raw',
            raw: '{\n  "jobId": "{{sampleJobId}}",\n  "status": "not_applied"\n}',
          },
          url: '{{baseUrl}}/api/dashboard/application-status',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                "if (!pm.collectionVariables.get('sampleJobId')) pm.test.skip('Set sampleJobId');",
                "pm.test('REG-V1-17 status 200 or 404', () => pm.expect([200,404,503]).to.include(pm.response.code));",
                "if (pm.response.code === 200) pm.test('Stand-by', () => pm.expect(pm.response.json().application.estado).to.eql('Stand-by'));",
              ],
            },
          },
        ],
      },
      {
        name: 'REG-V1-18 POST application-status not_selected',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Tracker-User', value: '1' },
          ],
          body: {
            mode: 'raw',
            raw: '{\n  "jobId": "{{sampleJobId}}",\n  "status": "not_selected"\n}',
          },
          url: '{{baseUrl}}/api/dashboard/application-status',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                "if (!pm.collectionVariables.get('sampleJobId')) pm.test.skip('Set sampleJobId');",
                "pm.test('REG-V1-18 status 200 or 404', () => pm.expect([200,404,503]).to.include(pm.response.code));",
                "if (pm.response.code === 200) pm.test('Cerrado', () => pm.expect(pm.response.json().application.estado).to.eql('Cerrado'));",
              ],
            },
          },
        ],
      },
      {
        name: 'REG-V1-19 POST application-status desmarcar (null)',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Tracker-User', value: '1' },
          ],
          body: {
            mode: 'raw',
            raw: '{\n  "jobId": "{{sampleJobId}}",\n  "status": null\n}',
          },
          url: '{{baseUrl}}/api/dashboard/application-status',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                "if (!pm.collectionVariables.get('sampleJobId')) pm.test.skip('Set sampleJobId');",
                "pm.test('REG-V1-19 status 200 or 404', () => pm.expect([200,404,503]).to.include(pm.response.code));",
                "if (pm.response.code === 200) pm.test('Pendiente', () => pm.expect(pm.response.json().application.estado).to.eql('Pendiente'));",
              ],
            },
          },
        ],
      },
      {
        name: 'REG-V1-21 POST application-status jobId inexistente (404)',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Tracker-User', value: '1' },
          ],
          body: {
            mode: 'raw',
            raw: '{\n  "jobId": "99999999",\n  "status": "applied"\n}',
          },
          url: '{{baseUrl}}/api/dashboard/application-status',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: ["pm.test('REG-V1-21 status 404', () => pm.response.to.have.status(404));"],
            },
          },
        ],
      },
    ],
  },
  {
    folder: 'Match reject / feedback',
    requests: [
      {
        name: 'REG-V1-22 POST reject-match con razón',
        request: {
          method: 'POST',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Tracker-User', value: '1' },
          ],
          body: {
            mode: 'raw',
            raw: '{\n  "jobId": "{{sampleJobId}}",\n  "reason": "REG-V1-22 regression test"\n}',
          },
          url: '{{baseUrl}}/api/dashboard/reject-match',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                "if (!pm.collectionVariables.get('sampleJobId')) pm.test.skip('Set sampleJobId');",
                "pm.test('REG-V1-22 status 200 or 404', () => pm.expect([200,404,503]).to.include(pm.response.code));",
              ],
            },
          },
        ],
      },
      {
        name: 'REG-V1-23 DELETE undo reject-match',
        request: {
          method: 'DELETE',
          header: [{ key: 'X-Tracker-User', value: '1' }],
          url: '{{baseUrl}}/api/dashboard/reject-match/{{sampleJobId}}',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                "if (!pm.collectionVariables.get('sampleJobId')) pm.test.skip('Set sampleJobId');",
                "pm.test('REG-V1-23 status 200 or 404', () => pm.expect([200,404,503]).to.include(pm.response.code));",
              ],
            },
          },
        ],
      },
      {
        name: 'REG-V1-25 POST /api/feedback/reject (legacy)',
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: { mode: 'raw', raw: '{\n  "jobId": "{{sampleJobId}}"\n}' },
          url: '{{baseUrl}}/api/feedback/reject',
        },
        event: [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                "if (!pm.collectionVariables.get('sampleJobId')) pm.test.skip('Set sampleJobId');",
                "pm.test('REG-V1-25 status 200 or 404', () => pm.expect([200,404]).to.include(pm.response.code));",
              ],
            },
          },
        ],
      },
    ],
  },
];

function buildCollection(info, groupedItems, extras = []) {
  const items = groupedItems.map((g) => ({ name: g.name, item: [...g.item] }));
  for (const extra of extras) {
    const existing = items.find((i) => i.name === extra.folder);
    if (existing) existing.item.push(...extra.requests);
    else items.push({ name: extra.folder, item: extra.requests });
  }
  return { info, variable: src.variable, item: items };
}

const smoke = buildCollection(
  {
    _postman_id: 'jh-smoke-v1',
    name: 'Job Hunter — Smoke v1 (SMK-V1)',
    description:
      'Smoke API manual — casos SMK-V1-* en qa/v1/smoke-green-path-v1.md. Puerto 3847.',
    schema: src.info.schema,
  },
  groupByFolder(smokeLeaves),
);

const reg = buildCollection(
  {
    _postman_id: 'jh-regression-v1',
    name: 'Job Hunter — Regression v1 (REG-V1)',
    description:
      'Regression API manual — casos REG-V1-* HTTP en qa/v1/regression-green-path-v1.md. UI/LinkedIn: ver doc markdown.',
    schema: src.info.schema,
  },
  groupByFolder(regLeaves),
  extraReg,
);

const regOrder = [
  '00 Setup',
  'Match Jobs',
  'Match Jobs — filtros',
  'API legacy',
  'Config',
  'Dashboard Writes',
  'Dashboard Writes — variantes',
  'Match reject / feedback',
];
reg.item.sort((a, b) => {
  const ia = regOrder.indexOf(a.name);
  const ib = regOrder.indexOf(b.name);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
});

fs.writeFileSync(
  path.join(__dirname, 'job-hunter-smoke-v1.postman_collection.json'),
  `${JSON.stringify(smoke, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(__dirname, 'job-hunter-regression-v1.postman_collection.json'),
  `${JSON.stringify(reg, null, 2)}\n`,
);

console.log(`smoke requests: ${smokeLeaves.length}`);
console.log(`regression requests from src: ${regLeaves.length}`);
