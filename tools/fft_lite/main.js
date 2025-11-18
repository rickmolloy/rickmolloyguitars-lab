/* global FFTState, FFTUtils, FFTAudio, FFTWaveform, FFTPlot, createFftEngine */

const wasmAllowed = typeof window !== "undefined" && window.location?.protocol !== "file:";
const fftEngine = createFftEngine(wasmAllowed ? { wasmUrl: "./vendor/kissfft.wasm" } : {});

const FREQ_MIN = 20;
const FREQ_MAX_DEFAULT = 1000;
const state = FFTState;
const { freqToNoteCents } = FFTUtils;
let toneOn = false;
let mediaStream = null;
let playButton = null;
let recordButton = null;
let stopButton = null;

function updateMeta(sampleLengthMs, sampleRate, window) {
  document.getElementById("wave_meta").textContent = `${(sampleLengthMs / 1000).toFixed(2)} s window • ${(sampleRate / 1000).toFixed(1)} kHz`;
  document.getElementById("fft_meta").textContent = `${window} window • tone gen: Off`;
}

function renderAnnotations() {
  const table = document.getElementById("annotation_table");
  const header = `
    <div class="annotation-row annotation-head">
      <span>Label</span><span>Frequency (Hz)</span><span>dB</span><span>Note / cents</span>
    </div>`;
  if (!state.annotations.length) {
    table.innerHTML = `${header}<div class="annotation-row"><span colspan="4">No markers yet.</span></div>`;
    return;
  }
  const rows = state.annotations.map((a) => `
    <div class="annotation-row">
      <span>${a.label || "—"}</span>
      <span>${a.freq.toFixed(2)}</span>
      <span>${a.db.toFixed(2)}</span>
      <span>${a.note} ${a.cents}</span>
    </div>
  `).join("");
  table.innerHTML = header + rows;
}

function addAnnotation(point) {
  const freq = point.x;
  const db = point.y;
  const note = freqToNoteCents(freq);
  state.annotations.push({
    label: `Marker ${state.annotations.length + 1}`,
    freq,
    db,
    note: note.name,
    cents: note.cents,
  });
  renderAnnotations();
}
window.addAnnotation = addAnnotation;

function clearAnnotations() {
  state.annotations.length = 0;
  renderAnnotations();
}

function saveAnnotations() {
  const blob = new Blob([JSON.stringify(state.annotations, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fft_annotations.json";
  a.click();
  URL.revokeObjectURL(url);
}

function handleWaveRangeChange(range) {
  state.viewRangeMs = range;
  if (range) {
    updateFftForRange(range).catch((err) => console.error("[FFT Lite] update FFT for range failed", err));
  } else {
    refresh().catch((err) => console.error("[FFT Lite] refresh failed", err));
  }
}

async function refreshDevices(requirePermission = false) {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    // Only ask for permission if we need labels (user clicked reset).
    if (requirePermission) {
      try {
        if (mediaStream) {
          mediaStream.getTracks().forEach((t) => t.stop());
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.warn("Audio permission denied; device labels may be blank.", err);
      }
    }

    let devices = await navigator.mediaDevices.enumerateDevices();
    let inputs = devices.filter((d) => d.kind === "audioinput");

    // If labels are still empty, try once more.
    const hasLabels = inputs.some((d) => d.label && d.label.trim());
    if (!hasLabels && requirePermission) {
      try {
        if (mediaStream) {
          mediaStream.getTracks().forEach((t) => t.stop());
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        devices = await navigator.mediaDevices.enumerateDevices();
        inputs = devices.filter((d) => d.kind === "audioinput");
      } catch (err) {
        console.warn("Second attempt to get mic labels failed.", err);
      }
    }

    const outputs = devices.filter((d) => d.kind === "audiooutput");

    const inputSelect = document.getElementById("input_devices");
    const outputSelect = document.getElementById("output_devices");
    const trackList = document.getElementById("track_list");
    const inputChannel = document.getElementById("input_channel");

    if (inputSelect) {
      inputSelect.innerHTML = inputs.map((d, idx) => (
        `<option value="${d.deviceId}">${d.label || `Input ${idx + 1}`}</option>`
      )).join("");
    }
    if (outputSelect) {
      outputSelect.innerHTML = outputs.map((d, idx) => (
        `<option value="${d.deviceId}">${d.label || `Output ${idx + 1}`}</option>`
      )).join("");
    }
    if (trackList) {
      const tracks = mediaStream?.getTracks?.() || [];
      trackList.textContent = tracks.length
        ? tracks.map((t) => `${t.kind}: ${t.label || "track"}`).join(" • ")
        : "No active tracks";
    }
    if (inputChannel) {
      inputChannel.innerHTML = Array.from({ length: 8 }).map((_, idx) => (
        `<option value="${idx + 1}">Channel ${idx + 1}</option>`
      )).join("");
    }
  } catch (err) {
    console.error("[FFT Lite] device enumeration failed", err);
  }
}

async function updateFftForRange(rangeMs) {
  const source = state.currentWave || FFTAudio.generateDemoWave(rangeMs.end - rangeMs.start);
  const windowType = document.getElementById("window_type").value;
  const smoothHz = Number(document.getElementById("smooth_hz").value) || 0;
  const showNoteGrid = document.getElementById("show_note_grid").checked;
  const showPeaks = document.getElementById("show_peaks").checked;

  const sliced = FFTWaveform.sliceWaveRange(source, rangeMs.start, rangeMs.end)
    || FFTWaveform.sliceWave(source, rangeMs.end - rangeMs.start);
  if (!sliced) return;
  const spectrum = await fftEngine.magnitude(sliced.wave, sliced.sampleRate, { maxFreq: FREQ_MAX_DEFAULT, window: windowType });
  const smoothed = FFTPlot.smoothSpectrum(spectrum, smoothHz);
  const withDb = FFTPlot.applyDb(smoothed);
  FFTPlot.makeFftPlot(withDb, { showNoteGrid, showPeaks, peaks: [], freqMin: FREQ_MIN, freqMax: FREQ_MAX_DEFAULT });
  updateMeta(rangeMs.end - rangeMs.start, sliced.sampleRate, windowType);
}

async function refresh() {
  const sampleInput = document.getElementById("sample_length");
  let sampleLengthMs = Number(sampleInput.value) || 1500;
  if (state.currentWave && state.currentWave.fullLengthMs && !state.viewRangeMs) {
    sampleLengthMs = state.currentWave.fullLengthMs;
    sampleInput.value = Math.round(sampleLengthMs);
  }
  const windowType = document.getElementById("window_type").value;
  const smoothHz = Number(document.getElementById("smooth_hz").value) || 0;
  const showNoteGrid = document.getElementById("show_note_grid").checked;
  const showPeaks = document.getElementById("show_peaks").checked;

  const source = state.currentWave || FFTAudio.generateDemoWave(sampleLengthMs);
  if (!state.currentWave) {
    state.currentWave = source;
  }
  const slice = state.viewRangeMs
    ? FFTWaveform.sliceWaveRange(source, state.viewRangeMs.start, state.viewRangeMs.end)
    : FFTWaveform.sliceWave(source, sampleLengthMs);
  if (!slice) return;

  FFTWaveform.makeWavePlot(slice, handleWaveRangeChange);
  const spectrum = await fftEngine.magnitude(slice.wave, slice.sampleRate, { maxFreq: FREQ_MAX_DEFAULT, window: windowType });
  const smoothed = FFTPlot.smoothSpectrum(spectrum, smoothHz);
  const withDb = FFTPlot.applyDb(smoothed);
  FFTPlot.makeFftPlot(withDb, { showNoteGrid, showPeaks, peaks: [], freqMin: FREQ_MIN, freqMax: FREQ_MAX_DEFAULT });
  FFTPlot.renderNoteGridPills();
  updateMeta(slice.timeMs[slice.timeMs.length - 1] || sampleLengthMs, slice.sampleRate, windowType);
  renderAnnotations();
}

function bindControls() {
  const safeRefresh = () => { refresh().catch((err) => console.error("[FFT Lite] refresh failed", err)); };
  document.getElementById("btn_refresh").addEventListener("click", safeRefresh);
  document.getElementById("show_note_grid").addEventListener("change", safeRefresh);
  document.getElementById("show_peaks").addEventListener("change", safeRefresh);
  document.getElementById("sample_length").addEventListener("change", safeRefresh);
  document.getElementById("window_type").addEventListener("change", safeRefresh);
  document.getElementById("smooth_hz").addEventListener("change", safeRefresh);

  const clearBtn = document.getElementById("btn_clear_annotations");
  if (clearBtn) clearBtn.addEventListener("click", clearAnnotations);
  const saveBtn = document.getElementById("btn_save_annotations");
  if (saveBtn) saveBtn.addEventListener("click", saveAnnotations);

  const btnRefreshDevices = document.getElementById("btn_refresh_devices");
  if (btnRefreshDevices) btnRefreshDevices.addEventListener("click", () => refreshDevices(true));

  const loadBtn = document.getElementById("btn_load");
  const fileInput = document.getElementById("file_input");
  if (loadBtn && fileInput) {
    loadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await FFTAudio.handleFile(file);
        state.viewRangeMs = null;
        await refresh();
      } catch (err) {
        console.error("[FFT Lite] load failed", err);
      }
    });
  }

  const btnRecord = document.getElementById("btn_record");
  const btnStop = document.getElementById("btn_stop");
  const btnPlay = document.getElementById("btn_play");
  playButton = btnPlay;
  recordButton = btnRecord;
  stopButton = btnStop;
  updateTransportLabels();

  if (btnRecord) btnRecord.addEventListener("click", () => {
    if (FFTAudio.isRecordingActive()) {
      FFTAudio.stopAll();
      updateTransportLabels();
      return;
    }
    FFTAudio.startRecording(() => {
      updateTransportLabels();
      refresh().catch((err) => console.error("[FFT Lite] refresh after record failed", err));
    }).catch((err) => console.error("[FFT Lite] record failed", err));
    updateTransportLabels(true, FFTAudio.isPlaybackActive());
  });

  if (btnStop) btnStop.addEventListener("click", () => {
    FFTAudio.stopAll();
    updateTransportLabels();
  });

  if (btnPlay) btnPlay.addEventListener("click", () => {
    if (FFTAudio.isPlaybackActive()) {
      FFTAudio.stopPlayback();
      updateTransportLabels();
      return;
    }
    const started = FFTAudio.playCurrent(() => updateTransportLabels());
    if (started) updateTransportLabels(FFTAudio.isRecordingActive(), true);
  });

  const btnSaveAudio = document.getElementById("btn_save_audio");
  if (btnSaveAudio) btnSaveAudio.addEventListener("click", FFTAudio.saveCurrentAudio);

  const toneToggle = document.getElementById("tone_toggle");
  if (toneToggle) {
    toneToggle.addEventListener("change", () => {
      toneOn = toneToggle.checked;
      FFTAudio.setToneEnabled(toneOn);
      if (!toneOn) FFTAudio.stopTone();
      document.getElementById("fft_meta").textContent = `${document.getElementById("window_type").value} window • tone gen: ${toneOn ? "On" : "Off"}`;
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  bindControls();
  refreshDevices(false).catch((err) => console.error("[FFT Lite] device refresh failed", err));
  refresh().catch((err) => console.error("[FFT Lite] initial refresh failed", err));
});

window.handleToneHover = (freq) => {
  if (!toneOn) return;
  if (freq === null) {
    FFTAudio.stopTone();
  } else {
    FFTAudio.updateToneFreq(freq);
  }
};

function updateTransportLabels(recording = FFTAudio.isRecordingActive(), playing = FFTAudio.isPlaybackActive()) {
  if (recordButton) recordButton.textContent = recording ? "■ Stop recording" : "● Record";
  if (playButton) playButton.textContent = playing ? "⏸ Pause" : "▶ Play";
  if (stopButton) stopButton.textContent = "■ Stop";
}
