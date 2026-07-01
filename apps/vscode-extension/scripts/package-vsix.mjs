import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outDir = path.join(root, 'dist');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'pagenary-vsix-'));
const extensionDir = path.join(stage, 'extension');
const bundledSchemaDir = path.join(extensionDir, 'schemas');

fs.mkdirSync(extensionDir, { recursive: true });
fs.cpSync(path.join(root, 'src'), path.join(extensionDir, 'src'), { recursive: true });
fs.cpSync(path.join(root, 'docs'), path.join(extensionDir, 'docs'), { recursive: true });
fs.mkdirSync(bundledSchemaDir, { recursive: true });
fs.copyFileSync(path.resolve(root, '..', 'publisher', 'tenants.schema.json'), path.join(bundledSchemaDir, 'tenants.schema.json'));
fs.copyFileSync(path.join(root, 'README.md'), path.join(extensionDir, 'README.md'));
fs.copyFileSync(path.join(root, 'package.json'), path.join(extensionDir, 'package.json'));
fs.writeFileSync(path.join(stage, '[Content_Types].xml'), contentTypesXml(), 'utf8');
fs.writeFileSync(path.join(stage, 'extension.vsixmanifest'), vsixManifest(pkg), 'utf8');
fs.mkdirSync(outDir, { recursive: true });

const target = path.join(outDir, `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.vsix`);
fs.rmSync(target, { force: true });
const result = spawnSync('zip', ['-qr', target, '.'], { cwd: stage, encoding: 'utf8' });
fs.rmSync(stage, { recursive: true, force: true });

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'zip failed');
  process.exit(result.status || 1);
}

console.log(`Packaged ${path.relative(root, target)}`);

function contentTypesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
</Types>
`;
}

function vsixManifest(pkg) {
  return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="${escapeXml(pkg.name)}" Version="${escapeXml(pkg.version)}" Publisher="${escapeXml(pkg.publisher)}" />
    <DisplayName>${escapeXml(pkg.displayName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(pkg.description)}</Description>
    <Categories>${escapeXml((pkg.categories || []).join(','))}</Categories>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
