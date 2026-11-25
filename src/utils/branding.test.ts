import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARENA_COLORS,
  ARENA_PALETTE_SWATCHES,
  BRAND_LOGOS,
  getBrandLogoPath,
  getBrandSpec,
  resolveCustomEntityLogoUrl,
} from './branding';

test('Arena Group charte palette matches official HEX values', () => {
  assert.equal(ARENA_COLORS.bleuInstitutionnel, '#19283E');
  assert.equal(ARENA_COLORS.orPrincipal, '#C9A125');
  assert.equal(ARENA_COLORS.grisClair, '#E1E4EA');
  assert.equal(ARENA_COLORS.orFonce, '#AD7300');
  assert.equal(ARENA_COLORS.orClair, '#DBB361');
  assert.equal(ARENA_COLORS.rougeBordeaux, '#7A1F2B');
  assert.equal(ARENA_PALETTE_SWATCHES.length, 6);
});

test('All 10 official logo asset files exist in public/assets/aistudio', () => {
  const paths: string[] = [];
  for (const spec of Object.values(BRAND_LOGOS)) {
    paths.push(spec.lightPath, spec.darkPath);
    if (spec.darkMonoPath) paths.push(spec.darkMonoPath);
  }
  assert.equal(paths.length, 10);

  for (const relPath of paths) {
    const absPath = path.resolve(process.cwd(), 'public', relPath);
    assert.equal(fs.existsSync(absPath), true, `Missing logo file: ${absPath}`);
    const buf = fs.readFileSync(absPath);
    // Verify PNG magic signature (89 50 4E 47)
    assert.equal(buf[0], 0x89, `${relPath} is not a PNG`);
    assert.equal(buf[1], 0x50, `${relPath} is not a PNG`);
    assert.equal(buf[2], 0x4e, `${relPath} is not a PNG`);
    assert.equal(buf[3], 0x47, `${relPath} is not a PNG`);
  }
});

test('getBrandLogoPath resolves light and dark variants cleanly', () => {
  assert.equal(
    getBrandLogoPath('group', 'dark', '/'),
    '/assets/aistudio/Arena_Group_-_Fond_Sombre_9be7374e.png'
  );
  assert.equal(
    getBrandLogoPath('arena-business-center', 'light', './'),
    './assets/aistudio/Arena_Business_Center_-_Fond_Claire_b733f259.png'
  );
  assert.equal(
    getBrandLogoPath('arena-business-center', 'dark', './'),
    './assets/aistudio/Arena_Business_Center_-_Fond_Sombre_b9af2fa1.png'
  );
  assert.equal(
    getBrandLogoPath('improveo', 'dark', './'),
    './assets/aistudio/Improveo_-_Fond_Sombre_-_Logo_dd27f192.png'
  );
  assert.equal(
    getBrandLogoPath('arena-studio-comm', 'dark', './'),
    './assets/aistudio/Arena_Studio_comm_-_Fond_Sombre_782142da.png'
  );
  assert.equal(
    getBrandLogoPath('maison-artisanat', 'dark', './'),
    './assets/aistudio/Maison___Artisanat_-_Fond_Sombre_-_Logo_7f05a528'
  );
  assert.equal(getBrandSpec('unknown-entity').id, 'group');
});

test('resolveCustomEntityLogoUrl ignores legacy internal paths and never overrides dark logos of official entities', () => {
  assert.equal(
    resolveCustomEntityLogoUrl(
      'arena-business-center',
      './assets/aistudio/Arena_Business_Center_-_Fond_Claire_-_ed43eee7.png',
      'light'
    ),
    undefined
  );
  assert.equal(
    resolveCustomEntityLogoUrl(
      'improveo',
      '/assets/aistudio/Improveo_-_Fond_Claire_-_Logo_187e51f4.png',
      'dark'
    ),
    undefined
  );
  assert.equal(
    resolveCustomEntityLogoUrl('arena-business-center', 'https://cdn.example.com/custom.png', 'dark'),
    undefined
  );
  assert.equal(
    resolveCustomEntityLogoUrl('arena-business-center', ' https://cdn.example.com/custom.png ', 'light'),
    'https://cdn.example.com/custom.png'
  );
  assert.equal(
    resolveCustomEntityLogoUrl('custom-entity', 'https://cdn.example.com/custom.png', 'dark'),
    'https://cdn.example.com/custom.png'
  );
});