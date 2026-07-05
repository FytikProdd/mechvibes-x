'use strict';

const Store = require('electron-store');
const { shell, remote, ipcRenderer } = require('electron');
const store = new Store({ cwd: remote.getGlobal('user_dir'), name: 'config' });
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

// Active settings state variables
let active_volume = true;
let system_volume = 50;
let current_pack = null;
let random_pitch_enabled = false;
let spatial_audio_enabled = false;
const packs = [];

// IPC logging helper
const log = {
  info(msg) { ipcRenderer.send("electron-log", msg, "info"); },
  warn(msg) { ipcRenderer.send("electron-log", msg, "warn"); },
  error(msg) { ipcRenderer.send("electron-log", msg, "error"); }
};

// Scan and parse both default and custom soundpacks
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

  folders.map((folder) => {
    try{
      const folder_name = path.basename(folder);
      const is_custom = (folder.substring(0, CUSTOM_PACKS_DIR.length) == CUSTOM_PACKS_DIR) ? true : false;
      const is_archive = path.extname(folder) == '.zip';
      
      if(path.extname(folder) == '.rar') return;

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
        if(config_file !== null){
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
        if(config_json.version === undefined){
          const SoundpackConfig = require("./libs/soundpacks/config-v1");
          soundpack_config = new SoundpackConfig(config_json, soundpack_metadata);
        }else{
          const SoundpackConfig = require(`./libs/soundpacks/config-v${config_json.version}`);
          soundpack_config = new SoundpackConfig(config_json, soundpack_metadata);
        }
        if (soundpack_config) {
          packs.push(soundpack_config);
        }
      }
    }catch(err){
      log.warn(`Skipping invalid soundpack "${path.basename(folder)}": ${err.message}`);
    }
  });
}

function getPack(pack_id){
  return packs.find((pack) => pack.pack_id == pack_id);
}

// Get saved soundpack config from store
function getSavedPack() {
  if (store.has(MV_PACK_LSID)) {
    const pack_id = store.get(MV_PACK_LSID);
    const pack = getPack(pack_id);
    return pack || packs[0];
  }
  return packs[0];
}

// Select soundpack by string ID
function setPack(pack_id){
  let index = 0;
  Object.keys(packs).map((packId) => {
    if(packs[packId].pack_id == pack_id){
      index = packId;
    }
  });
  current_pack = packs[index];
  store.set(MV_PACK_LSID, current_pack.pack_id);
  ipcRenderer.send("settings-changed");
}

function setPackByIndex(index){
  current_pack = packs[index];
  store.set(MV_PACK_LSID, current_pack.pack_id);
  ipcRenderer.send("settings-changed");
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

// DOM elements and settings initialization
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
    const spatial_audio_toggle = document.getElementById("spatial_audio_toggle");
    const spatial_audio_toggle_group = document.getElementById("spatial_audio_toggle_group");

    app_logo.innerHTML = 'Loading...';
    version.innerHTML = APP_VERSION;

    await loadPacks();
    packsToOptions(packs, pack_list);

    app_logo.innerHTML = 'Mechvibes';

    Array.from(document.getElementsByClassName('open-in-browser')).forEach((elem) => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        shell.openExternal(e.target.href);
      });
    });

    current_pack = getSavedPack();

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

    const MV_SPATIAL_AUDIO_LSID = 'mechvibes-spatial-audio';
    if (store.get(MV_SPATIAL_AUDIO_LSID) !== undefined){
      spatial_audio_toggle.checked = store.get(MV_SPATIAL_AUDIO_LSID);
      spatial_audio_enabled = spatial_audio_toggle.checked;
    } else {
      spatial_audio_toggle.checked = false;
      spatial_audio_enabled = false;
    }
    spatial_audio_toggle_group.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      spatial_audio_toggle.checked = !spatial_audio_toggle.checked;
      spatial_audio_enabled = spatial_audio_toggle.checked;
      store.set(MV_SPATIAL_AUDIO_LSID, spatial_audio_toggle.checked);
      ipcRenderer.send("spatial-audio-change", spatial_audio_toggle.checked);
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
      ipcRenderer.send("settings-changed");
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

    ipcRenderer.on("spatial-audio-toggle", (_event, enabled) => {
      spatial_audio_enabled = enabled;
      spatial_audio_toggle.checked = enabled;
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
