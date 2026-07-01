'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderPreviewHtml } = require('./preview');
const { validateJsonText } = require('./validators');

function activate(context) {
  const vscode = require('vscode');
  const diagnostics = vscode.languages.createDiagnosticCollection('pagenary');
  context.subscriptions.push(diagnostics);

  context.subscriptions.push(vscode.commands.registerCommand('pagenary.validateActiveFile', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor to validate.');
      return;
    }
    const count = validateDocument(vscode, diagnostics, editor.document);
    vscode.window.showInformationMessage(`Pagenary validation complete: ${count} issue(s).`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('pagenary.validateWorkspace', async () => {
    const result = await validateWorkspace(vscode, diagnostics);
    vscode.window.showInformationMessage(`Pagenary workspace validation complete: ${result.files} file(s), ${result.issues} issue(s).`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('pagenary.openPreview', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      vscode.window.showInformationMessage('Open a Markdown file to preview it with Pagenary.');
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'pagenaryPreview',
      `Pagenary Preview: ${path.basename(editor.document.fileName)}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );
    panel.webview.html = renderPreviewHtml(editor.document.getText(), {
      title: panel.title,
      nonce: crypto.randomBytes(16).toString('base64')
    });
  }));
}

function deactivate() {}

module.exports = { activate, deactivate };

function validateDocument(vscode, diagnostics, document) {
  const schema = loadTenantSchema();
  const findings = validateJsonText(document.getText(), document.fileName, schema);
  const mapped = findings.map((item) => toDiagnostic(vscode, document, item));
  diagnostics.set(document.uri, mapped);
  return mapped.length;
}

async function validateWorkspace(vscode, diagnostics) {
  const schema = loadTenantSchema();
  const pattern = '**/{tenants.json,*.tenants.json,config.json,manifest.json}';
  const exclude = '**/{node_modules,dist,site}/**';
  const uris = await vscode.workspace.findFiles(pattern, exclude, 200);
  let issues = 0;

  diagnostics.clear();
  for (const uri of uris) {
    const document = await vscode.workspace.openTextDocument(uri);
    const findings = validateJsonText(document.getText(), document.fileName, schema);
    const mapped = findings.map((item) => toDiagnostic(vscode, document, item));
    diagnostics.set(uri, mapped);
    issues += mapped.length;
  }

  return { files: uris.length, issues };
}

function toDiagnostic(vscode, document, finding) {
  const position = typeof finding.offset === 'number'
    ? document.positionAt(finding.offset)
    : new vscode.Position(0, 0);
  const range = new vscode.Range(position, position.translate(0, 1));
  const diagnostic = new vscode.Diagnostic(range, finding.message, vscode.DiagnosticSeverity.Error);
  diagnostic.source = 'pagenary';
  return diagnostic;
}

function loadTenantSchema() {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'publisher', 'tenants.schema.json'),
    path.resolve(__dirname, '..', 'schemas', 'tenants.schema.json')
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch {
      // Try the next location. The bundled schema is added during packaging.
    }
  }
  return {};
}

module.exports.validateDocument = validateDocument;
module.exports.validateWorkspace = validateWorkspace;
