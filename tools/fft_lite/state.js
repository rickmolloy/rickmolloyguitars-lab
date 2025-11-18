(() => {
  const state = {
    annotations: [],
    fftHoverShapeApplied: false,
    waveRelayoutApplied: false,
    viewRangeMs: null,
    currentWave: null,
    currentBuffer: null,
    currentSampleRate: null,
    mediaRecorder: null,
    recordedChunks: [],
    lastSpectrum: null,
    playbackCtx: null,
    playbackSource: null,
    playbackActive: false,
    recordingActive: false,
  };

  window.FFTState = state;
})();
