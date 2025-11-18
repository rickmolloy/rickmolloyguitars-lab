/* global Plotly */

(() => {
  const state = window.FFTState;
  const { getCssVar } = window.FFTUtils;

  function makeWavePlot({ timeMs, wave }, onRangeChange) {
    const absWave = wave.map((v) => Math.abs(v));
    const trace = {
      x: timeMs,
      y: absWave,
      type: "scatter",
      mode: "lines",
      line: { color: getCssVar("--blue", "#56B4E9"), width: 1.5 },
      hovertemplate: "%{x:.1f} ms<br>%{y:.3f}<extra></extra>",
    };
    const layout = {
      margin: { l: 45, r: 10, t: 10, b: 40 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      xaxis: { title: "Time (ms)", gridcolor: "var(--border-soft)" },
      yaxis: { title: "Amplitude", gridcolor: "var(--border-soft)" },
      showlegend: false,
    };
    Plotly.newPlot("plot_waveform", [trace], layout, { displayModeBar: false, responsive: true });
    state.waveRelayoutApplied = false;
    attachWaveRelayout(onRangeChange);
  }

  function attachWaveRelayout(onRangeChange) {
    const plot = document.getElementById("plot_waveform");
    if (!plot || state.waveRelayoutApplied) return;
    state.waveRelayoutApplied = true;

    plot.on("plotly_relayout", (ev) => {
      const range0 = ev["xaxis.range[0]"];
      const range1 = ev["xaxis.range[1]"];
      const auto = ev["xaxis.autorange"];

      if (auto || range0 === undefined || range1 === undefined) {
        state.viewRangeMs = null;
        if (onRangeChange) onRangeChange(null);
        return;
      }

      const start = Number(range0);
      const end = Number(range1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      state.viewRangeMs = { start, end };
      if (onRangeChange) onRangeChange({ start, end });
    });
  }

  function sliceWave(src, sampleLengthMs) {
    if (!src || !src.wave) return null;
    const desiredSamples = Math.max(64, Math.round((sampleLengthMs / 1000) * src.sampleRate));
    const wave = src.wave.slice(0, desiredSamples);
    const timeMs = wave.map((_, i) => (i / src.sampleRate) * 1000);
    return { wave, timeMs, sampleRate: src.sampleRate };
  }

  function sliceWaveRange(src, startMs, endMs) {
    if (!src || !src.wave) return null;
    const clampedStart = Math.max(0, startMs);
    const clampedEnd = Math.max(clampedStart + 1, endMs);
    const startIdx = Math.floor((clampedStart / 1000) * src.sampleRate);
    const endIdx = Math.min(src.wave.length, Math.ceil((clampedEnd / 1000) * src.sampleRate));
    const wave = src.wave.slice(startIdx, endIdx);
    const timeMs = wave.map((_, i) => ((startIdx + i) / src.sampleRate) * 1000);
    return { wave, timeMs, sampleRate: src.sampleRate };
  }

  window.FFTWaveform = { makeWavePlot, sliceWave, sliceWaveRange };
})();
