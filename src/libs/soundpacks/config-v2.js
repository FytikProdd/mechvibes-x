const { Howl } = require('howler');
const { keycodesRemap, keycodesFill } = require('../keycodes');
const { GetSoundpackFile } = require('./file-manager');

class SoundpackConfig {
	constructor(config, meta) {
		this.name = config.name ?? null;
		this.key_define_type = config.key_define_type ?? null;
		this.includes_numpad = config.includes_numpad !== false;
		this.sound = config.sound ?? null;
		this.soundup = config.soundup ?? null;
		this.defines = config.defines ?? null;

		this.pack_id = meta.pack_id ?? null;
		this.group = meta.group ?? null;
		this.abs_path = meta.abs_path ?? null;
		this.is_archive = meta.is_archive ?? null;
		this.is_custom = meta.is_custom ?? null;

		for (let key in this) {
			if (this[key] === null) {
				throw new Error(`SoundpackConfig: Missing required property: ${key}`);
			}
		}

		Object.keys(keycodesFill(this.defines)).map((kc) => {
			const upkey = `${kc}-up`;
			const downkey = kc;

			const setSound = (sound, key) => {
				if (sound && sound.indexOf('{') >= 0) {
					const range = sound.match(/\{(.+?)\}/g)[0];
					const range_values = range.replace("{", "").replace("}", "").split("-");
					const random_number = Math.floor(Math.random() * (range_values[1] - range_values[0] + 1) + range_values[0]);
					sound = sound.replace(range, random_number);
				}
				if (sound) {
					this.defines[key] = sound;
				}
			}

			setSound(this.defines[downkey] ?? this.sound, downkey);
			setSound(this.defines[upkey] ?? this.soundup, upkey);
		});

		this.version = 2;
	}

	LoadSounds(){
		return new Promise((resolve, reject) => {
			let settled = false;
			let finish = (err, result) => {
				if (settled) return;
				settled = true;
				if (err) reject(err);
				else resolve(result);
			};

			if(this.key_define_type == "single"){
				const sound = GetSoundpackFile(this.abs_path, this.sound);
				if (!sound) {
					finish(new Error(`Sound file "${this.sound}" not found in pack "${this.name}"`));
					return;
				}
				const sound_data = { src: [sound], sprite: keycodesRemap(this.defines) };

				const audio = new Howl(sound_data);
				const onLoad = () => {
					this.audio = audio;
					finish(null, true);
				};
				const onError = (_id, err) => {
					finish(new Error(`Failed to load sound: ${err || 'unknown error'}`));
				};

				if(audio.state() == "loaded"){
					onLoad();
				}else{
					audio.once('load', onLoad);
					audio.once('loaderror', onError);
				}
			}else if(this.key_define_type == "multi"){
				let loaded = {};
				let pending = 0;
				let hasAny = false;

				for (const kc of Object.keys(this.defines)) {
					const file = this.defines[kc];
					if (!file) continue;

					const soundData = GetSoundpackFile(this.abs_path, file);
					if (!soundData) continue;

					pending++;
					hasAny = true;
					const remapped = keycodesRemap({ [kc]: { src: [soundData] } });
					const mappedKc = Object.keys(remapped)[0];
					const audio = new Howl(remapped[mappedKc]);

					const onLoad = () => {
						loaded[mappedKc] = audio;
						pending--;
						if (pending === 0) {
							if (Object.keys(loaded).length === 0) {
								finish(new Error(`No sounds could be loaded for pack "${this.name}"`));
							} else {
								this.audio = loaded;
								finish(null, true);
							}
						}
					};
					const onError = (_id, err) => {
						pending--;
						if (pending === 0) {
							if (Object.keys(loaded).length === 0) {
								finish(new Error(`No sounds could be loaded for pack "${this.name}"`));
							} else {
								this.audio = loaded;
								finish(null, true);
							}
						}
					};

					if(audio.state() == "loaded"){
						onLoad();
					}else{
						audio.once('load', onLoad);
						audio.once('loaderror', onError);
					}
				}

				if (!hasAny) {
					finish(new Error(`Pack "${this.name}" has no valid sound entries`));
				}
			}else{
				finish(new Error("Invalid key_define_type"));
			}
		});
	}

	UnloadSounds(){
		if(this.audio){
			if(this.key_define_type == "single"){
				this.audio.unload();
				delete this.audio;
			}else if(this.key_define_type == "multi"){
				for (const kc of Object.keys(this.audio)) {
					this.audio[kc].unload();
				}
				delete this.audio;
			}
		}
	}
}

module.exports = SoundpackConfig;