class AviatorAudio {
  private ctx: AudioContext | null = null;
  
  // Audio configuration
  private isMuted: boolean = false;
  private isMusicEnabled: boolean = true;
  private isSoundsEnabled: boolean = true;

  // Music loop state
  private musicTimer: any = null;
  private musicStep = 0;

  // Cool engine propeller state
  private engineTimer: any = null;
  private propellerRate = 120; // ms between pulses
  private propellerPitch = 100; // base hz
  private lastMult = 1.0;

  constructor() {
    // Lazily initialized
  }

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  setMuted(mute: boolean) {
    this.isMuted = mute;
    if (mute) {
      this.stopEngine();
      this.stopMusic();
    } else {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  getMuted() {
    return this.isMuted;
  }

  // Helper to create a custom waveshaper distortion curve for that cool cyberpunk crunch
  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // 1. NEON SYNTHWAVE LOOP (Extremely Cool Retro Background Track)
  // Plays a rich, looping bass line with warm neon pads and digital retro lead plucks
  startMusic() {
    this.init();
    if (this.isMuted || !this.isMusicEnabled || !this.ctx) return;
    if (this.musicTimer) return;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      this.musicStep = 0;
      const stepTime = 0.25; // 120 BPM upbeat groove

      this.musicTimer = setInterval(() => {
        if (!this.ctx || this.isMuted || !this.isMusicEnabled) return;
        this.playMusicStep();
      }, stepTime * 1000);

      this.playMusicStep();
    } catch (e) {
      console.warn("Failed to start music loop", e);
    }
  }

  private playMusicStep() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const step = this.musicStep % 16;
    this.musicStep++;

    // Chord progression: F# minor (0-3), A major (4-7), B minor (8-11), D major (12-15)
    let rootFreq = 92.50; // F#2
    let chordFreqs = [185.00, 220.00, 277.18]; // F#3, A3, C#4

    if (step >= 4 && step < 8) {
      rootFreq = 110.00; // A2
      chordFreqs = [220.00, 277.18, 329.63]; // A3, C#4, E4
    } else if (step >= 8 && step < 12) {
      rootFreq = 123.47; // B2
      chordFreqs = [246.94, 293.66, 369.99]; // B3, D4, F#4
    } else if (step >= 12) {
      rootFreq = 73.42; // D2
      chordFreqs = [146.83, 185.00, 220.00]; // D3, F#3, A3
    }

    // A. Warm, pulsing 16th-note analog bass chug - Volume boosted to 0.12
    if (step % 2 === 0) {
      try {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const bassFilter = this.ctx.createBiquadFilter();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(rootFreq, now);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(140, now);

        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.12, now + 0.03);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.ctx.destination);

        bassOsc.start(now);
        bassOsc.stop(now + 0.4);
      } catch (e) {}
    }

    // B. Warm neon synthpad chord swell - Volume boosted to 0.045
    if (step === 0 || step === 8) {
      chordFreqs.forEach((freq) => {
        try {
          const padOsc = this.ctx!.createOscillator();
          const padGain = this.ctx!.createGain();
          const padFilter = this.ctx!.createBiquadFilter();

          padOsc.type = 'triangle';
          padOsc.frequency.setValueAtTime(freq, now);

          padFilter.type = 'lowpass';
          padFilter.frequency.setValueAtTime(450, now);
          padFilter.Q.setValueAtTime(2, now);

          padGain.gain.setValueAtTime(0, now);
          padGain.gain.linearRampToValueAtTime(0.045, now + 0.6); // smooth swell
          padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

          padOsc.connect(padFilter);
          padFilter.connect(padGain);
          padGain.connect(this.ctx!.destination);

          padOsc.start(now);
          padOsc.stop(now + 2.0);
        } catch (e) {}
      });
    }

    // C. Catchy digital laser-pluck melody pattern - Volume boosted to 0.045
    const melodyPattern = [0, 4, 7, -1, 9, -1, 7, 4, 11, -1, 9, -1, 7, -1, 4, -1];
    const melodyIndex = melodyPattern[step];
    if (melodyIndex >= 0) {
      try {
        const melOsc = this.ctx.createOscillator();
        const melGain = this.ctx.createGain();
        const melFilter = this.ctx.createBiquadFilter();

        const freq = rootFreq * 4 * Math.pow(1.059463, melodyIndex);

        melOsc.type = 'sine';
        melOsc.frequency.setValueAtTime(freq, now);

        melFilter.type = 'bandpass';
        melFilter.frequency.setValueAtTime(freq * 1.2, now);
        melFilter.Q.setValueAtTime(3, now);

        melGain.gain.setValueAtTime(0, now);
        melGain.gain.linearRampToValueAtTime(0.045, now + 0.02);
        melGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        melOsc.connect(melFilter);
        melFilter.connect(melGain);
        melGain.connect(this.ctx.destination);

        melOsc.start(now);
        melOsc.stop(now + 0.3);
      } catch (e) {}
    }
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // 2. COOL HIGH-VOLTAGE POWER PROPELLER CHUG (SOUNDS)
  // A clean, incredibly satisfying rhythmic electronic pulse that accelerates and pitch-shifts - Volume boosted to 0.48
  startEngine() {
    this.init();
    if (this.isMuted || !this.isSoundsEnabled || !this.ctx) return;
    if (this.engineTimer) return;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      this.propellerRate = 120;
      this.propellerPitch = 90;

      const triggerClick = () => {
        if (!this.ctx || this.isMuted || !this.isSoundsEnabled) return;
        try {
          const now = this.ctx.currentTime;
          
          // Cool high-voltage hybrid pulse (sawtooth + sub-bass resonance)
          const osc = this.ctx.createOscillator();
          const sub = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(this.propellerPitch, now);
          osc.frequency.exponentialRampToValueAtTime(20, now + 0.025);

          sub.type = 'sine';
          sub.frequency.setValueAtTime(this.propellerPitch * 0.5, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(350, now);
          filter.Q.setValueAtTime(4, now); // cool resonant tick

          gain.gain.setValueAtTime(0.48, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022); // tight heavy pulse

          osc.connect(filter);
          sub.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          sub.start(now);
          osc.stop(now + 0.03);
          sub.stop(now + 0.03);
        } catch (e) {}

        // Reschedule based on current speed rate
        this.engineTimer = setTimeout(triggerClick, this.propellerRate);
      };

      triggerClick();
    } catch (e) {
      console.warn("Failed to start engine chug", e);
    }
  }

  updateEnginePitch(mult: number) {
    this.lastMult = mult;
    const clampedMult = Math.min(mult, 10); // cap scaling at 10x
    // Speed increases (interval decreases) and pitch sweeps upwards!
    this.propellerRate = Math.max(30, 120 - (clampedMult - 1) * 10); // speeds up to 30ms intervals
    this.propellerPitch = 90 + (clampedMult - 1) * 16; // sweeps pitch up for high-velocity feel
  }

  stopEngine() {
    if (this.engineTimer) {
      clearTimeout(this.engineTimer);
      this.engineTimer = null;
    }
  }

  // 3. COOL STAGE DELAY DOUBLE BELL CHIME (SOUNDS)
  // A glowing, majestic arpeggiated casino chord with delayed reflections - Volume boosted to 0.48 and echo to 0.24
  playCashout() {
    this.init();
    if (this.isMuted || !this.isSoundsEnabled || !this.ctx) return;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;

      // FEEDBACK DELAY CHAIN: Creates a highly professional stereo echo effect
      const delayNode = this.ctx.createDelay(1.0);
      delayNode.delayTime.setValueAtTime(0.15, now); // 150ms delay

      const feedbackGain = this.ctx.createGain();
      feedbackGain.gain.setValueAtTime(0.42, now); // feedback echo gain

      // Delay loop
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode);

      const echoGain = this.ctx.createGain();
      echoGain.gain.setValueAtTime(0.24, now);
      delayNode.connect(echoGain);
      echoGain.connect(this.ctx.destination);

      const playBell = (freq: number, timeOffset: number) => {
        const osc1 = this.ctx!.createOscillator();
        const osc2 = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now + timeOffset);

        osc2.type = 'triangle'; // Richer harmonics
        osc2.frequency.setValueAtTime(freq * 1.002, now + timeOffset);
        osc2.detune.setValueAtTime(10, now + timeOffset);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.5, now + timeOffset);
        filter.Q.setValueAtTime(3, now + timeOffset);

        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.48, now + timeOffset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.65);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        
        gain.connect(this.ctx!.destination);
        gain.connect(delayNode); // Feed into delay loop!

        osc1.start(now + timeOffset);
        osc2.start(now + timeOffset);
        osc1.stop(now + timeOffset + 0.7);
        osc2.stop(now + timeOffset + 0.7);
      };

      // Play rich ascending major 7th chord chime sequence
      playBell(587.33, 0.0);   // D5
      playBell(739.99, 0.05);  // F#5
      playBell(880.00, 0.10);  // A5
      playBell(1108.73, 0.15); // C#6
    } catch (e) {}
  }

  // 4. COOL SCI-FI FLY-AWAY WHOOSH & SUB-BASS SLIDE (SOUNDS)
  // An incredible electronic whoosh combined with a heavy distorted pitch sweep - Volume boosted to 0.40 and distortion sweep to 0.48
  playCrash() {
    this.init();
    if (this.isMuted || !this.isSoundsEnabled || !this.ctx) return;
    this.stopEngine();

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;

      // VOICE 1: Whistling pitch slide
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.75); // Slide whistle-whoosh

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.40, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // VOICE 2: Cool waveshaped sci-fi distortion bass sweep
      const distOsc = this.ctx.createOscillator();
      const distGain = this.ctx.createGain();
      const distFilter = this.ctx.createBiquadFilter();
      const waveshaper = this.ctx.createWaveShaper();

      distOsc.type = 'sawtooth';
      distOsc.frequency.setValueAtTime(120, now + 0.15);
      distOsc.frequency.exponentialRampToValueAtTime(30, now + 0.75); // deep sub bass slide

      waveshaper.curve = this.makeDistortionCurve(45); // heavy saturation

      distFilter.type = 'lowpass';
      distFilter.frequency.setValueAtTime(250, now + 0.15);

      distGain.gain.setValueAtTime(0, now + 0.15);
      distGain.gain.linearRampToValueAtTime(0.48, now + 0.25);
      distGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      distOsc.connect(waveshaper);
      waveshaper.connect(distFilter);
      distFilter.connect(distGain);
      distGain.connect(this.ctx.destination);

      osc.start(now);
      distOsc.start(now + 0.15);

      osc.stop(now + 0.85);
      distOsc.stop(now + 0.85);
    } catch (e) {
      console.warn("Crash audio failed", e);
    }
  }

  // 5. COOL FUTURISTIC LASER-CLICK (SOUNDS) - Volume boosted to 0.24
  playBetClick() {
    this.init();
    if (this.isMuted || !this.isSoundsEnabled || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now); // cool high interface chirrup
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(2, now);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }
}

export const gameAudio = new AviatorAudio();
