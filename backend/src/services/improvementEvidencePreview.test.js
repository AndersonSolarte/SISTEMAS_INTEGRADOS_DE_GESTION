const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { previewEvidence } = require('./improvementEvidencePreview');

test('renders an actual DOCX as a private, script-free document preview', async () => {
  const zip = new (require('jszip'))();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Documento de evidencia</w:t></w:r></w:p></w:body></w:document>');
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const html = await previewEvidence({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', stream: Readable.from([bytes]) });
  assert.match(html, /Documento de evidencia/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /<script/);
});

test('leaves PDF and image streams untouched for the existing viewer', async () => {
  const stream = Readable.from(['original']);
  assert.equal(await previewEvidence({ mimeType: 'application/pdf', stream }), null);
  assert.equal(stream.readableEnded, false);
});
