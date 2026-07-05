const Store = require('electron-store');
const { app } = require('electron');
const store = new Store({ cwd: app.getPath('userData'), name: 'config' });

class StorageToggle {
  constructor(key, defaultVal) {
    this.key = key;
    this.default = defaultVal;
  }

  get is_enabled() {
    if(!store.has(this.key)) return this.default;
    return store.get(this.key);
  }

  enable() {
    store.set(this.key, true);
  }

  disable() {
    store.set(this.key, false);
  }

  toggle() {
    if (this.is_enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }
}

module.exports = StorageToggle;
