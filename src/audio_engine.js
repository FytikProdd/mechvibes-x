'use strict';

const originalAudioContext = window.AudioContext || window.webkitAudioContext;
if (originalAudioContext) {
  const CustomAudioContext = function(options) {
    const opt = options || {};
    opt.latencyHint = 'interactive';
    return new originalAudioContext(opt);
  };
  window.AudioContext = CustomAudioContext;
  window.webkitAudioContext = CustomAudioContext;
}

const Store = require('electron-store');
const { remote, ipcRenderer } = require('electron');
const store = new Store({ cwd: remote.getGlobal('user_dir'), name: 'config' });
const { Howl } = require('howler');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const { GetFileFromArchive } = require('./libs/soundpacks/file-manager');

const MV_PACK_LSID = remote.getGlobal("current_pack_store_id");
const MV_VOL_LSID = 'mechvibes-volume';
const CUSTOM_PACKS_DIR = remote.getGlobal('custom_dir');
const OFFICIAL_PACKS_DIR = path.join(__dirname, 'audio');

let active_volume = true;
let system_volume = 50;
let current_pack = null;
let random_pitch_enabled = false;
let spatial_audio_enabled = false;
let muted = false;
let volume_value = 50;
const packs = [];

const log = {
  info(msg) { ipcRenderer.send("electron-log", msg, "info"); },
  warn(msg) { ipcRenderer.send("electron-log", msg, "warn"); },
  error(msg) { ipcRenderer.send("electron-log", msg, "error"); }
};

function loadPack(packId = null) {
  if (packId === null) {
    Object.keys(packs).map((pid) => {
      const _pack = packs[pid];
      if (_pack.pack_id == current_pack.pack_id) {
        packId = pid;
      }
    });
  }

  log.info(`Loading pack ${packId}`);
  _loadPack(packId).then(() => {
    log.info("Pack loaded successfully");
  }).catch((e) => {
    log.error(`Failed to load pack: ${e}`);
  });
}

function _loadPack(packId) {
  return new Promise((resolve, reject) => {
    if (packs[packId] !== undefined) {
      unloadAllPacks();
      const pack = packs[packId];
      pack.LoadSounds().then(() => resolve(true)).catch((e) => reject(e));
    } else {
      reject(new Error("Pack ID doesn't exist"));
    }
  });
}

function unloadPack(packId) {
  if (packs[packId] !== undefined) {
    packs[packId].UnloadSounds();
  }
}

function unloadAllPacks() {
  Object.keys(packs).map((packId) => {
    if (packs[packId].audio !== undefined) {
      unloadPack(packId);
    }
  });
}

async function loadPacks() {
  const official_packs = await glob.sync(OFFICIAL_PACKS_DIR + '/*').filter((entry) => {
    try { return fs.statSync(entry).isDirectory(); } catch { return false; }
  });
  const custom_packs = await glob.sync(CUSTOM_PACKS_DIR + '/*');
  const folders = [...official_packs, ...custom_packs];

  folders.map((folder) => {
    try {
      const folder_name = path.basename(folder);
      const is_custom = (folder.substring(0, CUSTOM_PACKS_DIR.length) == CUSTOM_PACKS_DIR);
      const is_archive = path.extname(folder) == '.zip';

      if (path.extname(folder) == '.rar') return;

      let config_json = null;
      let soundpack_metadata = null;

      if (!is_archive) {
        const config_file = `${folder.replace(/\/$/, '')}/config.json`;
        if (fs.existsSync(config_file)) {
          config_json = JSON.parse(fs.readFileSync(config_file, 'utf8'));
          soundpack_metadata = {
            pack_id: `${is_custom ? 'custom' : 'default'}-${folder_name}`,
            group: is_custom ? 'Custom' : 'Default',
            abs_path: folder,
            folder_name,
            is_custom,
            is_archive,
          };
        }
      } else {
        const config_file = GetFileFromArchive(folder, "config.json");
        if (config_file !== null) {
          config_json = JSON.parse(config_file);
          soundpack_metadata = {
            pack_id: `${is_custom ? 'custom' : 'default'}-${folder_name}`,
            group: is_custom ? 'Custom' : 'Default',
            abs_path: folder,
            folder_name,
            is_custom,
            is_archive,
          };
        }
      }

      if (config_json && soundpack_metadata) {
        let soundpack_config = null;
        if (config_json.version === undefined) {
          const SoundpackConfig = require("./libs/soundpacks/config-v1");
          soundpack_config = new SoundpackConfig(config_json, soundpack_metadata);
        } else {
          const SoundpackConfig = require(`./libs/soundpacks/config-v${config_json.version}`);
          soundpack_config = new SoundpackConfig(config_json, soundpack_metadata);
        }
        if (soundpack_config) {
          packs.push(soundpack_config);
        }
      }
    } catch (err) {
      log.warn(`Skipping invalid soundpack: ${err.message}`);
    }
  });
}

function getPack(pack_id) {
  return packs.find((pack) => pack.pack_id == pack_id);
}

function getSavedPack() {
  if (store.has(MV_PACK_LSID)) {
    const pack_id = store.get(MV_PACK_LSID);
    const pack = getPack(pack_id);
    return pack || packs[0];
  }
  return packs[0];
}

function updateConfig() {
  muted = store.get("mechvibes-muted") || false;
  active_volume = store.get("mechvibes-active-volume") !== false;
  random_pitch_enabled = store.get("mechvibes-random-pitch") || false;
  spatial_audio_enabled = store.get("mechvibes-spatial-audio") || false;
  volume_value = store.get(MV_VOL_LSID) !== undefined ? store.get(MV_VOL_LSID) : 50;

  const next_pack = getSavedPack();
  if (next_pack && (!current_pack || current_pack.pack_id !== next_pack.pack_id)) {
    current_pack = next_pack;
    loadPack();
  }
}

const keycodeToPan = {
  1: -1.0, 41: -1.0, 15: -1.0, 58: -1.0, 42: -1.0, 29: -1.0,
  2: -0.8, 16: -0.8, 30: -0.8, 44: -0.8, 3675: -0.8,
  3: -0.6, 17: -0.6, 31: -0.6, 45: -0.6, 56: -0.6,
  4: -0.4, 18: -0.4, 32: -0.4, 46: -0.4,
  5: -0.2, 19: -0.2, 33: -0.2, 47: -0.2,
  6: -0.1, 20: -0.1, 34: -0.1, 48: -0.1,
  7: 0.1, 21: 0.1, 35: 0.1, 49: 0.1, 57: 0.0,
  8: 0.3, 22: 0.3, 36: 0.3, 50: 0.3,
  9: 0.5, 23: 0.5, 37: 0.5, 51: 0.5,
  10: 0.7, 24: 0.7, 38: 0.7, 52: 0.7, 3640: 0.7,
  11: 0.85, 25: 0.85, 39: 0.85, 53: 0.85, 3676: 0.85,
  12: 1.0, 13: 1.0, 14: 1.0, 26: 1.0, 27: 1.0, 43: 1.0, 40: 1.0, 28: 1.0, 54: 1.0, 3613: 1.0,
  3666: 1.0, 3667: 1.0, 3655: 1.0, 3663: 1.0, 3657: 1.0, 3665: 1.0,
  57416: 1.0, 57419: 1.0, 57421: 1.0, 57424: 1.0,
  69: 1.0, 3637: 1.0, 55: 1.0, 74: 1.0, 3597: 1.0, 78: 1.0, 3612: 1.0, 83: 1.0,
  79: 1.0, 80: 1.0, 81: 1.0, 75: 1.0, 76: 1.0, 77: 1.0, 71: 1.0, 72: 1.0, 73: 1.0, 82: 1.0
};

function playSound(sound_id) {
  if (muted || !current_pack || current_pack.audio === undefined) {
    return;
  }
  const play_type = current_pack.key_define_type ? current_pack.key_define_type : 'single';
  const sound = play_type == 'single' ? current_pack.audio : current_pack.audio[sound_id];
  if (!sound) {
    return;
  }

  if (active_volume) {
    const adjustedVolume = volume_value * (100 / system_volume);
    sound.volume(1);
    Howler.masterGain.gain.setValueAtTime(Number(adjustedVolume / 100), Howler.ctx.currentTime);
  } else {
    sound.volume(1);
    Howler.masterGain.gain.setValueAtTime(Number(volume_value / 100), Howler.ctx.currentTime);
  }

  let soundId;
  if (play_type == 'single') {
    const variants = current_pack.audio_variants && current_pack.audio_variants[sound_id];
    soundId = sound.play(variants ? variants[Math.floor(Math.random() * variants.length)] : sound_id);
  } else {
    soundId = sound.play();
  }

  if (soundId) {
    if (random_pitch_enabled) {
      const randomRate = 1 + (Math.random() - 0.5) * 0.08;
      sound.rate(randomRate, soundId);
      const randomVolume = 1 + (Math.random() - 0.5) * 0.15;
      sound.volume(Math.max(0.1, Math.min(1.0, randomVolume)), soundId);
    }
    if (spatial_audio_enabled) {
      const match = sound_id.match(/keycode-(\d+)/);
      const keycode = match ? parseInt(match[1]) : null;
      if (keycode !== null) {
        const panValue = keycodeToPan[keycode] !== undefined ? keycodeToPan[keycode] : 0.0;
        sound.stereo(panValue, soundId);
      }
    }
  }
}

loadPacks().then(() => {
  updateConfig();
});

ipcRenderer.on("settings-changed", () => {
  updateConfig();
});

ipcRenderer.on("system-volume-update", (_event, vol) => {
  system_volume = vol;
});

ipcRenderer.on("keydown", (_, { keycode }) => {
  const sound_id = `keycode-${keycode}`;
  playSound(sound_id);
});

ipcRenderer.on("keyup", (_, { keycode }) => {
  const sound_id = `keycode-${keycode}-up`;
  playSound(sound_id);
});
