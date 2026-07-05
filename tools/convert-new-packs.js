'use strict';

const fs = require('fs');
const path = require('path');

const PACKS_DIR = path.join(__dirname, '..', 'new packs');

const DOM_CODE_TO_KC = {
  Escape: 1,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67, F10: 68,
  F11: 87, F12: 88, F13: 91, F14: 92, F15: 93,
  Backquote: 41,
  Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11,
  Minus: 12, Equal: 13, Backspace: 14,
  Tab: 15,
  KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20, KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25,
  BracketLeft: 26, BracketRight: 27,
  CapsLock: 58,
  KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38,
  Semicolon: 39, Quote: 40,
  Backslash: 43,
  Enter: 28,
  ShiftLeft: 42, ShiftRight: 54,
  KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48, KeyN: 49, KeyM: 50,
  Comma: 51, Period: 52, Slash: 53,
  ControlLeft: 29,
  AltLeft: 56,
  Space: 57,
  MetaLeft: 3675, MetaRight: 3676, ContextMenu: 3677,
  PrintScreen: 3639, ScrollLock: 70, Pause: 3653,
  Insert: 3666, Delete: 3667, Home: 3655, End: 3663, PageUp: 3657, PageDown: 3665,
  ArrowUp: 57416, ArrowDown: 57424, ArrowLeft: 57419, ArrowRight: 57421,
  NumLock: 69,
  NumpadDivide: 3637, NumpadMultiply: 55, NumpadSubtract: 74, NumpadAdd: 78, NumpadEnter: 3612, NumpadEqual: 3597,
  NumpadDecimal: 83,
  Numpad0: 82, Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad4: 75, Numpad5: 76, Numpad6: 77, Numpad7: 71, Numpad8: 72, Numpad9: 73,
};

const AUDIO_EXT = new Set(['.wav', '.ogg', '.mp3']);
const KEEP_EXTRA = new Set(['license', 'readme.md']);

function isAudio(name) {
  return AUDIO_EXT.has(path.extname(name).toLowerCase());
}

function convertPack(packDir) {
  const cfgPath = path.join(packDir, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`no config.json in ${packDir}`);
  }
  const src = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

  if (src.definitions === undefined || src.audio_file === undefined) {
    return { skipped: true, name: path.basename(packDir) };
  }

  const defines = {};
  let defines_v = null;
  let missingCodes = [];
  let multiKeys = 0;

  for (const [domCode, def] of Object.entries(src.definitions)) {
    const kc = DOM_CODE_TO_KC[domCode];
    if (kc === undefined) {
      missingCodes.push(domCode);
      continue;
    }
    const segs = (def && Array.isArray(def.timing)) ? def.timing : [];
    if (segs.length === 0) continue;

    const [s0, e0] = segs[0];
    defines[kc] = [roundMs(s0), roundMs(e0 - s0)];

    if (segs.length > 1) {
      if (defines_v === null) defines_v = {};
      defines_v[kc] = segs.map(([s, e]) => [roundMs(s), roundMs(e - s)]);
      multiKeys++;
    }
  }

  const hasNumpad = Object.keys(defines).some((kc) => kc >= 71 && kc <= 83 || [3597, 3612, 3637].includes(Number(kc)));

  const out = {
    name: src.name || path.basename(packDir),
    key_define_type: 'single',
    includes_numpad: !!hasNumpad,
    sound: src.audio_file,
    defines,
  };
  if (defines_v !== null) {
    out.defines_v = defines_v;
  }

  fs.writeFileSync(cfgPath, JSON.stringify(out, null, 2));

  for (const fname of fs.readdirSync(packDir)) {
    const fpath = path.join(packDir, fname);
    const lower = fname.toLowerCase();
    if (lower.endsWith('.v1.backup')) {
      fs.unlinkSync(fpath);
      continue;
    }
    if (isAudio(fname) && fname !== src.audio_file) {
      fs.unlinkSync(fpath);
    }
  }

  return { skipped: false, name: out.name, keys: Object.keys(defines).length, multiKeys, missing: missingCodes };
}

function roundMs(n) {
  return Math.round(n);
}

function main() {
  if (!fs.existsSync(PACKS_DIR)) {
    console.error(`Packs directory not found: ${PACKS_DIR}`);
    process.exit(1);
  }

  const packs = fs.readdirSync(PACKS_DIR).filter((n) => fs.statSync(path.join(PACKS_DIR, n)).isDirectory());
  let totalKeys = 0;
  let totalMulti = 0;
  const warnings = [];

  console.log(`Converting ${packs.length} pack(s) in "${path.basename(PACKS_DIR)}"\n`);

  for (const name of packs) {
    const dir = path.join(PACKS_DIR, name);
    const r = convertPack(dir);
    if (r.skipped) {
      console.log(`  SKIP   ${name} (not new format)`);
      continue;
    }
    totalKeys += r.keys;
    totalMulti += r.multiKeys;
    console.log(`  OK     ${r.name} — ${r.keys} keys${r.multiKeys ? ` (${r.multiKeys} with random variants)` : ''}`);
    if (r.missing.length) {
      warnings.push(`${r.name}: unmapped codes ${r.missing.join(', ')}`);
    }
  }

  console.log(`\nDone. ${packs.length} packs, ${totalKeys} key definitions, ${totalMulti} keys with random variants.`);
  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

main();
