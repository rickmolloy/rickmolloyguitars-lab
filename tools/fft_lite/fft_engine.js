(() => {
  class JsFftFallback {
    static applyWindow(buffer, windowType) {
      const n = buffer.length;
      if (windowType === "rect") return buffer;
      const out = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const frac = i / (n - 1 || 1);
        let w = 1;
        if (windowType === "hann") {
          w = 0.5 * (1 - Math.cos(2 * Math.PI * frac));
        } else if (windowType === "hamming") {
          w = 0.54 - 0.46 * Math.cos(2 * Math.PI * frac);
        }
        out[i] = buffer[i] * w;
      }
      return out;
    }

    static fftRadix2(real, imag) {
      const n = real.length;
      if ((n & (n - 1)) !== 0) return;

      let j = 0;
      for (let i = 0; i < n; i += 1) {
        if (i < j) {
          [real[i], real[j]] = [real[j], real[i]];
          [imag[i], imag[j]] = [imag[j], imag[i]];
        }
        let m = n >> 1;
        while (m >= 1 && j >= m) {
          j -= m;
          m >>= 1;
        }
        j += m;
      }

      for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wlenCos = Math.cos(ang);
        const wlenSin = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
          let wCos = 1;
          let wSin = 0;
          for (let k = 0; k < len / 2; k += 1) {
            const uReal = real[i + k];
            const uImag = imag[i + k];
            const vReal = real[i + k + len / 2] * wCos - imag[i + k + len / 2] * wSin;
            const vImag = real[i + k + len / 2] * wSin + imag[i + k + len / 2] * wCos;

            real[i + k] = uReal + vReal;
            imag[i + k] = uImag + vImag;
            real[i + k + len / 2] = uReal - vReal;
            imag[i + k + len / 2] = uImag - vImag;

            const nextCos = wCos * wlenCos - wSin * wlenSin;
            wSin = wCos * wlenSin + wSin * wlenCos;
            wCos = nextCos;
          }
        }
      }
    }

    static magnitudeSpectrum(wave, sampleRate, opts = {}) {
      const { window = "hann", maxFreq = 1200 } = opts;
      const padded = 1 << Math.ceil(Math.log2(wave.length * 2));
      const real = new Float64Array(padded);
      const imag = new Float64Array(padded);
      const windowed = JsFftFallback.applyWindow(wave, window);
      real.set(windowed);
      JsFftFallback.fftRadix2(real, imag);

      const freqs = [];
      const mags = [];
      const nyquist = sampleRate / 2;
      const limit = Math.min(Math.floor((maxFreq / nyquist) * (padded / 2)), padded / 2);
      const scale = 2 / padded; // normalize positive-frequency magnitudes
      for (let k = 1; k < limit; k += 1) {
        freqs.push((k * sampleRate) / padded);
        mags.push(Math.hypot(real[k], imag[k]) * scale);
      }
      return { freqs, mags };
    }
  }

  class KissFftWasm {
    constructor({ wasmUrl }) {
      this.wasmUrl = wasmUrl;
      this.ready = false;
    }

    async load() {
      if (!this.wasmUrl) throw new Error("No wasmUrl provided for KissFFT");
      const response = await fetch(this.wasmUrl);
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      this.instance = instance;
      this.ready = true;
      // NOTE: Glue for actual KissFFT calls will be wired once the WASM binary is added.
      return this;
    }

    // Placeholder: real WASM bridge to be implemented when the binary is available.
    transform() {
      throw new Error("KissFFT WASM bridge not wired yet");
    }
  }

  class FftEngine {
    constructor(opts = {}) {
      this.wasmUrl = opts.wasmUrl || null;
      this.wasm = null;
      this.useWasm = !!opts.wasmUrl;
      this.loadPromise = null;
    }

    async ensureLoaded() {
      if (!this.useWasm) return false;
      if (!this.loadPromise) {
        this.wasm = new KissFftWasm({ wasmUrl: this.wasmUrl });
        this.loadPromise = this.wasm.load().catch((err) => {
          console.warn("[FFT] KissFFT WASM load failed; falling back to JS FFT.", err);
          this.useWasm = false;
          return false;
        });
      }
      await this.loadPromise;
      return this.useWasm && this.wasm && this.wasm.ready;
    }

    async magnitude(wave, sampleRate, opts = {}) {
      const useWasm = await this.ensureLoaded();
      if (useWasm && this.wasm) {
        try {
          return await this.wasm.transform(wave, sampleRate, opts);
        } catch (err) {
          console.warn("[FFT] KissFFT transform failed; using JS fallback.", err);
        }
      }
      return JsFftFallback.magnitudeSpectrum(wave, sampleRate, opts);
    }
  }

  window.createFftEngine = function createFftEngine(opts) {
    return new FftEngine(opts);
  };
})();
