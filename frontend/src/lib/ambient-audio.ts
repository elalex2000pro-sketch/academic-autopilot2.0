/**
 * Motor de audio ambiental generado en el navegador con Web Audio.
 *
 * No descarga pistas ni depende de servicios externos: sintetiza lluvia,
 * murmullo de cafetería, ruido rosa y un pad de lo-fi con vinilo. Así el Modo
 * Enfoque funciona también sin conexión.
 */

export type AmbientPreset = "lofi" | "rain" | "cafe" | "white";

const LOFI_CHORDS = [
  [220, 261.63, 329.63, 392],
  [174.61, 220, 261.63, 329.63],
  [196, 246.94, 293.66, 349.23],
  [164.81, 196, 246.94, 293.66],
];

export class AmbientEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private chordTimer: number | null = null;
  private chordIndex = 0;
  private volume = 0.55;

  async start(preset: AmbientPreset, volume: number): Promise<void> {
    this.stop();

    const Ctor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) throw new Error("Tu navegador no permite reproducir audio en la app.");

    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(context.destination);

    this.context = context;
    this.master = master;
    this.volume = volume;

    await context.resume();

    if (preset === "lofi") this.buildLofi();
    else if (preset === "rain") this.buildRain();
    else if (preset === "cafe") this.buildCafe();
    else this.buildWhiteNoise();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.08);
  }

  stop(): void {
    if (this.chordTimer !== null) {
      window.clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* La fuente ya había terminado. */
      }
    }
    this.sources = [];
    if (this.context) {
      const context = this.context;
      this.context = null;
      this.master = null;
      void context.close().catch(() => undefined);
    }
    this.chordTimer = null;
  }

  private noiseBuffer(kind: "white" | "pink" | "brown", seconds = 4): AudioBuffer {
    const context = this.context as AudioContext;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    let last = 0;

    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;

      if (kind === "white") {
        data[index] = white * 0.6;
        continue;
      }

      if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[index] = last * 3.2;
        continue;
      }

      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    return buffer;
  }

  private loopNoise(kind: "white" | "pink" | "brown", seconds = 4): AudioBufferSourceNode {
    const source = (this.context as AudioContext).createBufferSource();
    source.buffer = this.noiseBuffer(kind, seconds);
    source.loop = true;
    this.sources.push(source);
    return source;
  }

  private buildRain(): void {
    const context = this.context as AudioContext;
    const master = this.master as GainNode;

    const source = this.loopNoise("white", 3);
    const high = context.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 480;
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 4200;
    const gain = context.createGain();
    gain.gain.value = 0.2;

    source.connect(high).connect(low).connect(gain).connect(master);
    source.start();

    const lfo = context.createOscillator();
    lfo.frequency.value = 0.11;
    const depth = context.createGain();
    depth.gain.value = 0.05;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
    this.sources.push(lfo);

    const rumble = this.loopNoise("brown", 4);
    const rumbleFilter = context.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 260;
    const rumbleGain = context.createGain();
    rumbleGain.gain.value = 0.08;
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);
    rumble.start();
  }

  private buildCafe(): void {
    const context = this.context as AudioContext;
    const master = this.master as GainNode;

    const murmur = this.loopNoise("brown", 5);
    const murmurFilter = context.createBiquadFilter();
    murmurFilter.type = "lowpass";
    murmurFilter.frequency.value = 720;
    const murmurGain = context.createGain();
    murmurGain.gain.value = 0.24;
    murmur.connect(murmurFilter).connect(murmurGain).connect(master);
    murmur.start();

    const voices = this.loopNoise("pink", 5);
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 520;
    band.Q.value = 0.9;
    const voiceGain = context.createGain();
    voiceGain.gain.value = 0.1;
    voices.connect(band).connect(voiceGain).connect(master);
    voices.start();

    const lfo = context.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = context.createGain();
    depth.gain.value = 0.035;
    lfo.connect(depth).connect(voiceGain.gain);
    lfo.start();
    this.sources.push(lfo);
  }

  private buildWhiteNoise(): void {
    const context = this.context as AudioContext;
    const master = this.master as GainNode;

    const source = this.loopNoise("pink", 4);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 8500;
    const gain = context.createGain();
    gain.gain.value = 0.16;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  private buildLofi(): void {
    const context = this.context as AudioContext;
    const master = this.master as GainNode;

    // Vinilo: ruido suave y constante.
    const crackle = this.loopNoise("white", 4);
    const crackleHigh = context.createBiquadFilter();
    crackleHigh.type = "highpass";
    crackleHigh.frequency.value = 2600;
    const crackleGain = context.createGain();
    crackleGain.gain.value = 0.022;
    crackle.connect(crackleHigh).connect(crackleGain).connect(master);
    crackle.start();

    const playChord = () => {
      if (!this.context || !this.master) return;
      const now = context.currentTime;
      const chord = LOFI_CHORDS[this.chordIndex % LOFI_CHORDS.length];
      this.chordIndex += 1;

      chord.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = index === 0 ? "triangle" : "sine";
        oscillator.frequency.value = frequency;

        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1150;

        const gain = context.createGain();
        const peak = 0.09 / chord.length;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 1.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 7.6);

        oscillator.connect(filter).connect(gain).connect(master);
        oscillator.start(now);
        oscillator.stop(now + 8);
        this.sources.push(oscillator);
      });

      const bass = context.createOscillator();
      bass.type = "sine";
      bass.frequency.value = chord[0] / 2;
      const bassGain = context.createGain();
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.055, now + 0.8);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 7.6);
      bass.connect(bassGain).connect(master);
      bass.start(now);
      bass.stop(now + 8);
      this.sources.push(bass);
    };

    playChord();
    this.chordTimer = window.setInterval(playChord, 8000);
  }
}
