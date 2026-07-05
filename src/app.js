'use strict';

const Store = require('electron-store');
const { shell, remote, ipcRenderer } = require('electron');
const store = new Store({ cwd: remote.getGlobal('user_dir'), name: 'config' });
const { Howl } = require('howler');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const { platform } = process;
const { GetFileFromArchive } = require('./libs/soundpacks/file-manager');

const MV_PACK_LSID = remote.getGlobal("current_pack_store_id");
const MV_VOL_LSID = 'mechvibes-volume';
const MV_TRAY_LSID = 'mechvibes-hidden';

const CUSTOM_PACKS_DIR = remote.getGlobal('custom_dir');
const OFFICIAL_PACKS_DIR = path.join(__dirname, 'audio');
const APP_VERSION = remote.getGlobal('app_version');

let active_volume = true;
let system_volume = 50;
let current_pack = null;
let current_key_down = null;
let random_pitch_enabled = false;
const packs = [];
const all_sound_files = {};

const log = {
  silly(message){
    raise_log_message("silly", message);
  },
  debug(message){
    raise_log_message("debug", message);
  },
  verbose(message){
    raise_log_message("verbose", message);
  },
  info(message){
    raise_log_message("info", message);
  },
  warn(message){
    raise_log_message("warn", message);
  },
  error(message){
    raise_log_message("error", message);
  }
}
function raise_log_message(level, message){
  ipcRenderer.send("electron-log", message, level);
}

function loadPack(packId = null){
  if(packId === null){
    Object.keys(packs).map((pid) => {
      const _pack = packs[pid];
      if(_pack.pack_id == current_pack.pack_id){
        packId = pid;
      }
    })
  }

  const app_logo = document.getElementById('logo');
  const app_body = document.getElementById('app-body');

  log.info(`Loading ${packId}`)
  app_logo.innerHTML = 'Loading...';
  app_body.classList.add('loading');
  _loadPack(packId).then(() => {
    log.info("loaded");
    app_logo.innerHTML = 'Mechvibes';
    app_body.classList.remove('loading');
  }).catch((e) => {
    app_logo.innerHTML = 'Failed';
    console.warn(e);
    log.warn(`Failed to load pack: ${e}`);
  });
}

function _loadPack(packId){
  return new Promise((resolve, reject) => {
    if(packs[packId] !== undefined){
      unloadAllPacks();
      const pack = packs[packId];

      const LOAD_TIMEOUT_MS = 30000;
      const timeout = setTimeout(() => {
        reject(new Error(`Load timed out after ${LOAD_TIMEOUT_MS / 1000}s for pack: ${pack.name}`));
      }, LOAD_TIMEOUT_MS);

      const settle = (err, result) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(result);
      };

      pack.LoadSounds()
        .then(() => settle(null, true))
        .catch((e) => {
          console.warn("Failed to load pack", e);
          settle(e);
        });
    }else{
      reject(new Error("That packID doesn't exist"));
    }
  })
}

function unloadPack(packId){
  if(packs[packId] !== undefined){
    packs[packId].UnloadSounds();
    return [true];
  }else{
    return [false, "pack doesn't exist"];
  }
}

function unloadAllPacks(){
  Object.keys(packs).map((packId) => {
    if(packs[packId].sound !== undefined){
      unloadPack(packId);
    }
  })
}

async function loadPacks() {
  const official_packs = await glob.sync(OFFICIAL_PACKS_DIR + '/*').filter((entry) => {
    try {
      return fs.statSync(entry).isDirectory();
    } catch {
      return false;
    }
  });
  const custom_packs = await glob.sync(CUSTOM_PACKS_DIR + '/*');
  const folders = [...official_packs, ...custom_packs];

  log.info(`Loading ${folders.length} packs`);
  log.debug(OFFICIAL_PACKS_DIR);
  log.debug(CUSTOM_PACKS_DIR);

  folders.map((folder) => {
    try{
      const folder_name = path.basename(folder);
      const is_custom = (folder.substring(0, CUSTOM_PACKS_DIR.length) == CUSTOM_PACKS_DIR) ? true : false;
      const is_archive = path.extname(folder) == '.zip';
      
      if(path.extname(folder) == '.rar'){
        log.warn(`Skipping .rar file (not supported): ${folder_name}`);
        return;
      }

      let config_json = null;
      let soundpack_metadata = null;

      if(!is_archive){
        const config_file = `${folder.replace(/\/$/, '')}/config.json`;

        if(fs.existsSync(config_file)){
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
      }else{
        const config_file = GetFileFromArchive(folder, "config.json");
        if(config_file === null){
          console.warn(`Failed to load config.json from archive: ${folder_name}`);
          return;
        }
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

      if(config_json === null || soundpack_metadata === null){
        console.warn(`Failed to load config.json: ${folder_name}`);
        return;
      }

      let soundpack_config = null;
      if(config_json.version === undefined){
        const SoundpackConfig = require("./libs/soundpacks/config-v1");
        soundpack_config = new SoundpackConfig(config_json, soundpack_metadata);
      }else{
        try{
          const SoundpackConfig = require(`./libs/soundpacks/config-v${config_json.version}`);
          soundpack_config = new SoundpackConfig(config_json, soundpack_metadata);
        }catch{
          log.warn(`Unsupported config version (${config_json.version}): ${folder_name}`);
        }
      }

      if(soundpack_config === null){
        console.warn(`Failed to load soundpack config: ${folder_name}`);
        return;
      }
      packs.push(soundpack_config);
    }catch(err){
      log.warn(`Skipping invalid soundpack "${path.basename(folder)}": ${err.message}`);
    }
  });

  return;
}

function getPack(pack_id){
  return packs.find((pack) => pack.pack_id == pack_id);
}

function getSavedPack() {
  if (store.has(MV_PACK_LSID)) {
    const pack_id = store.get(MV_PACK_LSID);
    const pack = getPack(pack_id);
    if (!pack) {
      return packs[0];
    }else{
      return pack;
    }
  } else {
    return packs[0];
  }
}

// set pack by its index in the packs array
function setPack(pack_id){
  let index = 0;
  Object.keys(packs).map((packId) => {
    if(packs[packId].pack_id == pack_id){
      index = packId;
    }
  })
  loadPack(index);
  current_pack = packs[index];
  store.set(MV_PACK_LSID, current_pack.pack_id);
}

// set pack by its string id
function setPackByIndex(index){
  loadPack(index);
  current_pack = packs[index];
  store.set(MV_PACK_LSID, current_pack.pack_id);
}

function packsToOptions(packs, pack_list) {
  const selected_pack_id = store.get(MV_PACK_LSID);
  const groups = [];
  packs.map((pack) => {
    const exists = groups.find((group) => group.id == pack.group);
    if (!exists) {
      const group = {
        id: pack.group,
        name: pack.group || 'Default',
        packs: [pack],
      };
      groups.push(group);
    } else {
      exists.packs.push(pack);
    }
  });

  for (let group of groups) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.name;
    for (let pack of group.packs) {
      const is_selected = selected_pack_id == pack.pack_id;
      const opt = document.createElement('option');
      opt.text = pack.name;
      opt.value = pack.pack_id;
      opt.selected = is_selected ? 'selected' : false;
      optgroup.appendChild(opt);
    }
    pack_list.appendChild(optgroup);
  }

  pack_list.addEventListener('change', (e) => {
    const selected_id = e.target.options[e.target.selectedIndex].value;
    setPack(selected_id);
  });
}

(function (window, document) {
  window.addEventListener('DOMContentLoaded', async () => {
    const version = document.getElementById('app-version');
    const mechvibes_muted = document.getElementById('mechvibes-muted');
    const system_muted = document.getElementById('system-muted');
    const app_logo = document.getElementById('logo');
    const app_body = document.getElementById('app-body');
    const pack_list = document.getElementById('pack-list');
    const random_button = document.getElementById('random-button');
    const volume_value = document.getElementById('volume-value-display');
    const volume = document.getElementById('volume');
    const tray_icon_toggle = document.getElementById("tray_icon_toggle");
    const tray_icon_toggle_group = document.getElementById("tray_icon_toggle_group");
    const random_pitch_toggle = document.getElementById("random_pitch_toggle");
    const random_pitch_toggle_group = document.getElementById("random_pitch_toggle_group");

    app_logo.innerHTML = 'Loading...';
    version.innerHTML = APP_VERSION;

    await loadPacks(app_logo, app_body);
    packsToOptions(packs, pack_list);

    Array.from(document.getElementsByClassName('open-in-browser')).forEach((elem) => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        shell.openExternal(e.target.href);
      });
    });

    current_pack = getSavedPack();
    loadPack()

    if (store.get(MV_TRAY_LSID) !== undefined){
      tray_icon_toggle.checked = store.get(MV_TRAY_LSID);
    }
    tray_icon_toggle_group.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      tray_icon_toggle.checked = !tray_icon_toggle.checked;
      ipcRenderer.send("show_tray_icon", tray_icon_toggle.checked);
      store.set(MV_TRAY_LSID, tray_icon_toggle.checked);
    }

    const MV_RANDOM_PITCH_LSID = 'mechvibes-random-pitch';
    if (store.get(MV_RANDOM_PITCH_LSID) !== undefined){
      random_pitch_toggle.checked = store.get(MV_RANDOM_PITCH_LSID);
      random_pitch_enabled = random_pitch_toggle.checked;
    } else {
      random_pitch_toggle.checked = false;
      random_pitch_enabled = false;
    }
    random_pitch_toggle_group.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      random_pitch_toggle.checked = !random_pitch_toggle.checked;
      random_pitch_enabled = random_pitch_toggle.checked;
      store.set(MV_RANDOM_PITCH_LSID, random_pitch_toggle.checked);
      ipcRenderer.send("random-pitch-change", random_pitch_toggle.checked);
    }

    let initTray = () => {
      ipcRenderer.send("show_tray_icon", tray_icon_toggle.checked);
    }
    initTray();

    let displayVolume = () => {
      let primary = document.createElement('span');
      primary.innerText = `${volume.value}`;
      volume_value.innerHTML = `${primary.outerHTML}`;
      if(active_volume){
        let adjusted = document.createElement('span');
        adjusted.innerText = `(${Math.round(volume.value * (100 / system_volume))})`;
        adjusted.style.marginLeft = '1em';
        adjusted.style.fontSize = '12px';
        adjusted.style.fontWeight = 'normal';
        adjusted.style.opacity = '0.5';

        volume_value.appendChild(adjusted);
      }
    }
    if (store.get(MV_VOL_LSID)) {
      volume.value = store.get(MV_VOL_LSID);
    }else{
      volume.value = 50;
    }
    displayVolume();
    volume.oninput = function (e) {
      store.set(MV_VOL_LSID, this.value);
      displayVolume();
    };

    ipcRenderer.on("system-volume-update", (_event, vol) => {
      system_volume = vol;
      displayVolume();
    });

    ipcRenderer.on("system-mute-status", (_event, enabled) => {
      if(enabled){
        system_muted.classList.remove("hidden");
      }else{
        system_muted.classList.add("hidden");
      }
    });

    ipcRenderer.on("mechvibes-mute-status", (_event, enabled) => {
      if(enabled){
        mechvibes_muted.classList.remove("hidden");
      }else{
        mechvibes_muted.classList.add("hidden");
      }
    });

    ipcRenderer.on("ava-toggle", (_event, enabled) => {
      active_volume = enabled;
      displayVolume();
    });

    ipcRenderer.on("random-pitch-toggle", (_event, enabled) => {
      random_pitch_enabled = enabled;
      random_pitch_toggle.checked = enabled;
    });

    let pressed_keys = {};

    ipcRenderer.on('keyup', (_, { keycode }) => {
      let holding = false;
      pressed_keys[`${keycode}`] = false;
      for (const key in pressed_keys) {
        if(pressed_keys[key]){
          holding = true;
        }
      }
      if(current_pack) {
        const sound_id = `keycode-${keycode}-up`;
        playSound(sound_id, volume.value);
      }

      if(!holding){
        app_logo.classList.remove('pressed');
      }
    });

    ipcRenderer.on('keydown', (_, { keycode }) => {
      if(pressed_keys[`${keycode}`] !== undefined && pressed_keys[`${keycode}`]){
        return;
      }
      pressed_keys[`${keycode}`] = true;

      app_logo.classList.add('pressed');
      current_key_down = keycode;
      const sound_id = `keycode-${current_key_down}`;

      if (current_pack) {
        playSound(sound_id, volume.value);
      }
    });

    random_button.addEventListener('click', (e) => {
      e.preventDefault();
      let getRandomPackId = () => {
        let randomId = Math.floor(Math.random() * packs.length);
        if (packs[randomId].pack_id === current_pack.pack_id) {
          return getRandomPackId();
        }
        return randomId;
      }
      const packId = getRandomPackId();
      pack_list.selectedIndex = packId;
      setPackByIndex(packId);
    });
  });
})(window, document);

function playSound(sound_id, volume) {
  if(current_pack.audio === undefined){
    // sound for this pack hasn't been loaded
    return;
  }
  const play_type = current_pack.key_define_type ? current_pack.key_define_type : 'single';
  const sound = play_type == 'single' ? current_pack.audio : current_pack.audio[sound_id];
  if (!sound) {
    return;
  }

  if(active_volume){
    // dynamic volume adjustment
    log.silly(`Volume: ${volume}`);
    log.silly(`System Volume: ${system_volume}`);

    const adjustedVolume = volume * (100 / system_volume);

    log.silly(`Adjusted Volume: ${adjustedVolume}`);
    log.silly(`Result Volume: ${adjustedVolume / 100}`);

    sound.volume(1);
    Howler.masterGain.gain.setValueAtTime(Number(adjustedVolume / 100), Howler.ctx.currentTime);
  }else{
    sound.volume(1);
    Howler.masterGain.gain.setValueAtTime(Number(volume / 100), Howler.ctx.currentTime);
  }

  let soundId;
  if (play_type == 'single') {
    // When the pack ships multiple samples per key, pick one at random per keypress.
    const variants = current_pack.audio_variants && current_pack.audio_variants[sound_id];
    soundId = sound.play(variants ? variants[Math.floor(Math.random() * variants.length)] : sound_id);
  } else {
    soundId = sound.play();
  }

  if (random_pitch_enabled && soundId) {
    const randomRate = 1 + (Math.random() - 0.5) * 0.08; // ±4% speed/pitch variation
    sound.rate(randomRate, soundId);
    const randomVolume = 1 + (Math.random() - 0.5) * 0.15; // ±7.5% volume variation
    sound.volume(Math.max(0.1, Math.min(1.0, randomVolume)), soundId);
  }
}
