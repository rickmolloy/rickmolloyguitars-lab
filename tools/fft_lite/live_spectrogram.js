(() => {
  const DEFAULT_OPTS = {
    fftSize: 2048,
    smoothingTimeConstant: 0.6,
  };

  function createAnalyser(audioCtx, opts = {}) {
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = opts.fftSize || DEFAULT_OPTS.fftSize;
    analyser.smoothingTimeConstant = opts.smoothingTimeConstant ?? DEFAULT_OPTS.smoothingTimeConstant;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    return analyser;
  }

  function createLiveSpectrogram(opts) {
    const state = {
      audioCtx: opts.audioCtx || new (window.AudioContext || window.webkitAudioContext)(),
      analyser: null,
      source: null,
      rafId: null,
      onFrame: opts.onFrame || (() => {}),
    };

    async function startFromStream(stream) {
      stop();
      state.analyser = createAnalyser(state.audioCtx, opts);
      state.source = state.audioCtx.createMediaStreamSource(stream);
      state.source.connect(state.analyser);
      loop();
    }

    function loop() {
      const bufferLength = state.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      state.analyser.getByteFrequencyData(dataArray);
      state.onFrame(dataArray, state.analyser);
      state.rafId = requestAnimationFrame(loop);
    }

    function stop() {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = null;
      if (state.source) {
        try { state.source.disconnect(); } catch { /* noop */ }
      }
      state.source = null;
      state.analyser = null;
    }

    return { startFromStream, stop, audioCtx: state.audioCtx };
  }

  window.createLiveSpectrogram = createLiveSpectrogram;
})();
