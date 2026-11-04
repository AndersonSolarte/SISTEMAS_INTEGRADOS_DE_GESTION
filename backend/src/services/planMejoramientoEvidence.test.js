const { test } = require('node:test');
const assert = require('node:assert/strict');
const { google } = require('googleapis');
const { readActivityEvidence } = require('./planMejoramientoDriveService');
const { uploadActivityEvidence } = require('./planMejoramientoDriveService');
const { ensurePlanRepository } = require('./planMejoramientoDriveService');

test('missing improvement credentials reuse institutional Drive and its root', async () => {
  const Module = require('module');
  const originalLoad = Module._load;
  const keys = ['PLAN_IMPROVEMENT_GOOGLE_CLIENT_ID', 'PLAN_IMPROVEMENT_GOOGLE_CLIENT_SECRET', 'PLAN_IMPROVEMENT_GOOGLE_REFRESH_TOKEN',
    'PLAN_IMPROVEMENT_GOOGLE_SERVICE_ACCOUNT_JSON', 'PLAN_IMPROVEMENT_GOOGLE_SERVICE_ACCOUNT_FILE',
    'PLAN_IMPROVEMENT_GOOGLE_SERVICE_ACCOUNT_EMAIL', 'PLAN_IMPROVEMENT_GOOGLE_PRIVATE_KEY',
    'SIAC_PLAN_IMPROVEMENT_DRIVE_ROOT_ID', 'SIAC_ACTION_REPOSITORY_ROOT_ID'];
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key) => delete process.env[key]);
  process.env.SIAC_ACTION_REPOSITORY_ROOT_ID = 'institutional-root';
  const uploadedTo = [];
  const drive = { files: {
    get: async ({ fileId }) => { assert.equal(fileId, 'institutional-root'); return { data: { mimeType: 'application/vnd.google-apps.folder' } }; },
    list: async () => ({ data: { files: [{ id: 'improvement-folder' }] } }),
    update: async () => ({}),
    create: async ({ requestBody }) => { uploadedTo.push(requestBody.parents[0]); return { data: { id: 'uploaded-file' } }; }
  } };
  Module._load = function (request, parent, isMain) {
    if (request === './actionPlanRepositoryDriveService' && parent?.filename.endsWith('planMejoramientoDriveService.js')) {
      return { buildActionRepositoryDriveClient: () => drive };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const plan = { id: 1, contenido: { objetivos: [{ actividades: [{ uid: 'activity' }] }] } };
    const repository = await ensurePlanRepository(plan);
    assert.equal(repository.activities[0].folderId, 'improvement-folder');
    const result = await uploadActivityEvidence(plan, 'activity', { originalname: 'evidence.pdf', buffer: Buffer.from('test'), mimetype: 'application/pdf' });
    assert.equal(result.evidence.driveFileId, 'uploaded-file');
    assert.deepEqual(uploadedTo, ['improvement-folder']);
  } finally {
    Module._load = originalLoad;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});

test('server reads private evidence and rejects files outside the activity folder', async () => {
  const originalDrive = google.drive;
  const keys = ['PLAN_IMPROVEMENT_GOOGLE_CLIENT_ID', 'PLAN_IMPROVEMENT_GOOGLE_CLIENT_SECRET', 'PLAN_IMPROVEMENT_GOOGLE_REFRESH_TOKEN'];
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key, index) => { process.env[key] = index === 2 ? '1//test' : 'test'; });
  const calls = [];
  google.drive = () => ({ files: {
    list: async (params) => {
      calls.push(params);
      return { data: params.pageToken ? { files: [{ id: 'second' }] } : { files: [{ id: 'first' }], nextPageToken: 'page2' } };
    },
    get: async (params) => {
      if (params.alt) { calls.push(params); return { data: 'private-file-stream' }; }
      return { data: { mimeType: 'application/pdf', parents: [params.fileId === 'allowed' ? 'activity-folder' : 'other-folder'] } };
    }
  } });
  try {
    const activity = { evidenceFolderId: 'activity-folder' };
    assert.equal((await readActivityEvidence(activity)).length, 2);
    assert.match(calls[0].q, /'activity-folder' in parents/);
    assert.equal((await readActivityEvidence(activity, 'allowed')).stream, 'private-file-stream');
    const mediaReads = calls.filter((call) => call.alt).length;
    await assert.rejects(readActivityEvidence(activity, 'forbidden'), { statusCode: 404 });
    assert.equal(calls.filter((call) => call.alt).length, mediaReads);
    await assert.rejects(readActivityEvidence({}), { statusCode: 404 });
  } finally {
    google.drive = originalDrive;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});

test('linked upload waits for both Drive repositories and propagates mirror failures', async () => {
  const Module = require('module');
  const originalLoad = Module._load;
  const originalDrive = google.drive;
  const keys = ['PLAN_IMPROVEMENT_GOOGLE_CLIENT_ID', 'PLAN_IMPROVEMENT_GOOGLE_CLIENT_SECRET', 'PLAN_IMPROVEMENT_GOOGLE_REFRESH_TOKEN', 'SIAC_PLAN_IMPROVEMENT_DRIVE_ROOT_ID'];
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key, i) => { process.env[key] = i === 2 ? '1//test' : 'test'; });
  const destinations = [];
  let failMirror = false;
  google.drive = () => ({ files: {
    get: async () => ({ data: { mimeType: 'application/vnd.google-apps.folder' } }),
    list: async () => ({ data: { files: [{ id: 'pm-folder' }] } }),
    update: async () => ({}),
    create: async ({ requestBody }) => { destinations.push(requestBody.parents[0]); return { data: { id: 'pm-file' } }; }
  } });
  Module._load = function (request, parent, isMain) {
    if (parent?.filename.endsWith('planMejoramientoDriveService.js')) {
      if (request === '../models') return {
        StrategicActionPlan: {},
        StrategicActionItem: { findByPk: async () => ({ id: 10, actionPlan: { term_id: 2 } }) },
        StrategicMonitoringPeriod: { findOne: async ({ where }) => { assert.equal(where.position, 2); return { id: 20 }; } }
      };
      if (request === './strategicPlanningDriveService') return {
        getActivityDriveFolder: async (id, period) => { assert.equal(id, 10); assert.equal(period, 20); return { folderId: 'action-folder' }; },
        buildWritableDriveClient: () => ({ files: { create: async ({ requestBody }) => {
          if (failMirror) throw new Error('Drive unavailable');
          destinations.push(requestBody.parents[0]);
          return { data: { id: 'action-file' } };
        } } })
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const plan = { id: 1, contenido: { objetivos: [{ actividades: [{ uid: 'activity', linkedActionItemId: 10, fechaSeguimiento: '2026-10-09' }] }] } };
    const file = { originalname: 'evidence.pdf', mimetype: 'application/pdf', buffer: Buffer.from('test') };
    const result = await uploadActivityEvidence(plan, 'activity', file);
    assert.deepEqual(destinations, ['pm-folder', 'action-folder']);
    assert.equal(result.evidence.linkedEvidence.driveFileId, 'action-file');
    failMirror = true;
    await assert.rejects(uploadActivityEvidence(plan, 'activity', file), /Drive unavailable/);
  } finally {
    google.drive = originalDrive;
    Module._load = originalLoad;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});
