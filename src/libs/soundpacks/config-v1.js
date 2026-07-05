const { Howl } = require('howler');
const { keycodesRemap } = require('../keycodes');
const { GetSoundpackFile } = require('./file-manager');

class SoundpackConfig {
	constructor(config, meta) {
		this.name = config.name ?? null;
		this.key_define_type = config.key_define_type ?? null;
		this.includes_numpad = config.includes_numpad !== false;
		this.sound = config.sound ?? null;
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

		this.version = 1;
		this.defines_v = config.defines_v ?? null;
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
				const sprite = keycodesRemap(this.defines);

				this.audio_variants = null;
				if(this.defines_v){
					const variantsByKc = keycodesRemap(this.defines_v);
					this.audio_variants = {};
					for(const kcKey in variantsByKc){
						const segs = variantsByKc[kcKey];
						if(!Array.isArray(segs) || segs.length === 0) continue;
						const ids = [];
						segs.forEach((seg, i) => {
							const id = `${kcKey}-v${i}`;
							sprite[id] = seg;
							ids.push(id);
						});
						this.audio_variants[kcKey] = ids;
					}
				}

				const audio = new Howl({ src: [sound], sprite });
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
				this.audio_variants = null;
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