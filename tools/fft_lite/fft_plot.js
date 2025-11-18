/* global Plotly */

(() => {
  const state = window.FFTState;
  const { freqToNoteCents, deviationColor, COLOR_ORANGE } = window.FFTUtils;

  function makeFftPlot(spectrum, opts) {
    const { showNoteGrid, showPeaks, peaks, freqMin, freqMax } = opts;
    const { freqs, mags } = spectrum;
    const peakData = peaks || [];
    const maxFreq = Math.min(freqMax, freqs[freqs.length - 1] || freqMax);
    const noteData = freqs.map((f) => {
      const { name, cents, centsNum } = freqToNoteCents(f);
      const color = deviationColor(Math.abs(centsNum ?? 999));
      return [name, cents, centsNum, color];
    });
    state.lastSpectrum = {
      freqs,
      mags,
      dbs: spectrum.dbs || [],
      maxDb: spectrum.maxDb || (spectrum.dbs ? Math.max(...spectrum.dbs, -120) : null),
      maxMag: spectrum.maxMag || Math.max(...mags, 1e-9),
    };
    const ySeries = spectrum.dbs && spectrum.dbs.length ? spectrum.dbs : mags;
    const inRange = freqs.map((f, idx) => ({ f, v: ySeries[idx] })).filter((p) => p.f >= freqMin && p.f <= maxFreq);
    const yMax = inRange.length ? Math.max(...inRange.map((p) => p.v)) : Math.max(...ySeries);
    const yMin = inRange.length ? Math.min(...inRange.map((p) => p.v)) : Math.min(...ySeries);
    const span = Math.max(1, yMax - yMin);
    const pad = span * 0.2;
    const trace = {
      x: freqs,
      y: ySeries,
      type: "scatter",
      mode: "lines",
      line: { color: "var(--blue)", width: 1.5 },
      hovertemplate: "%{x:.1f} Hz<br>%{y:.2f} dB<br>%{customdata[0]} <span style=\"color:%{customdata[3]};font-weight:700;\">%{customdata[1]}</span><extra></extra>",
      customdata: noteData,
    };

    const overlay = [];
    if (showPeaks && peakData.length > 0) {
      overlay.push({
        x: peakData.map((p) => p.f),
        y: peakData.map(() => Math.max(...ySeries) * 0.85),
        mode: "markers+text",
        type: "scatter",
        marker: { color: "var(--orange)", size: 8 },
        text: peakData.map((p) => p.label),
        textposition: "top center",
        hoverinfo: "skip",
      });
    }

    const layout = {
      margin: { l: 55, r: 10, t: 10, b: 40 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      hovermode: "x",
      hoverdistance: -1,
      xaxis: {
        title: "Frequency (Hz)",
        gridcolor: "var(--border-soft)",
        range: [freqMin, maxFreq],
        showspikes: true,
        spikemode: "across",
        spikecolor: COLOR_ORANGE,
        spikethickness: 2,
        spikedash: "solid",
      },
      yaxis: {
        title: "Level (dB)",
        gridcolor: "var(--border-soft)",
        range: [yMin - pad, yMax + pad],
        showspikes: false,
      },
      hoverlabel: {
        bgcolor: "rgba(50,105,165,0.9)",
        bordercolor: "var(--white)",
        font: { color: "#fff", size: 12, family: "system-ui, -apple-system, Segoe UI, sans-serif" },
      },
      showlegend: false,
      shapes: showNoteGrid ? buildNoteGridShapes() : [],
    };

    state.fftHoverShapeApplied = false;
    Plotly.newPlot("plot_fft", [trace, ...overlay], layout, { displayModeBar: false, responsive: true });
    attachFftHoverHandlers();
  }

  function buildNoteGridShapes() {
    const grid = [];
    const notes = [
      { name: "E2", freq: 82.41 },
      { name: "A2", freq: 110.0 },
      { name: "D3", freq: 146.83 },
      { name: "G3", freq: 196.0 },
      { name: "B3", freq: 246.94 },
      { name: "E4", freq: 329.63 },
      { name: "A4", freq: 440.0 },
      { name: "D5", freq: 587.33 },
    ];

    notes.forEach((n) => {
      grid.push({
        type: "line",
        x0: n.freq,
        x1: n.freq,
        y0: 0,
        y1: 1,
        xref: "x",
        yref: "paper",
        line: { color: "var(--muted)", width: 1, dash: "dot" },
      });
    });
    return grid;
  }

  function renderNoteGridPills() {
    const noteGrid = document.getElementById("note_grid");
    const notes = [
      { name: "E2", freq: 82.41 },
      { name: "A2", freq: 110.0 },
      { name: "D3", freq: 146.83 },
      { name: "G3", freq: 196.0 },
      { name: "B3", freq: 246.94 },
      { name: "E4", freq: 329.63 },
      { name: "A4", freq: 440.0 },
      { name: "D5", freq: 587.33 },
    ];
    noteGrid.innerHTML = notes.map((n) => (
      `<div class="note-pill"><span class="note">${n.name}</span><span class="freq">${n.freq.toFixed(2)} Hz</span></div>`
    )).join("");
  }

  function renderHoverReadout({ freq, db }) {
    const note = freqToNoteCents(freq);
    const hasFreq = Number.isFinite(freq);
    const hasDb = Number.isFinite(db);
    document.getElementById("hover_freq").textContent = hasFreq ? `${freq.toFixed(2)} Hz` : "— Hz";
    document.getElementById("hover_db").textContent = hasDb ? `${db.toFixed(2)} dB` : "— dB";
    const color = deviationColor(Math.abs(note.centsNum ?? 999));
    document.getElementById("hover_note").innerHTML = `Note: ${note.name} <span style="color:${color};font-weight:700;">${note.cents}</span>`;
    if (hasFreq) {
      const toneFreq = document.getElementById("tone_freq");
      if (toneFreq) toneFreq.value = freq.toFixed(2);
    }
  }

  function dbForFreq(freq) {
    if (!state.lastSpectrum) return null;
    let bestIdx = 0;
    let bestDist = Infinity;
    state.lastSpectrum.freqs.forEach((f, idx) => {
      const d = Math.abs(f - freq);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    if (state.lastSpectrum.dbs && state.lastSpectrum.dbs.length) {
      return state.lastSpectrum.dbs[bestIdx];
    }
    const mag = state.lastSpectrum.mags[bestIdx] || 1e-12;
    return 20 * Math.log10(mag);
  }

  function attachFftHoverHandlers() {
    const plot = document.getElementById("plot_fft");
    if (!plot || state.fftHoverShapeApplied) return;
    state.fftHoverShapeApplied = true;

    plot.on("plotly_hover", (evt) => {
      const pt = evt.points?.[0];
      if (!pt) return;
      const freq = pt.x;
      const db = dbForFreq(freq);
      renderHoverReadout({ freq, db });
      if (window.handleToneHover) window.handleToneHover(freq);
    });

    plot.on("plotly_unhover", () => {
      renderHoverReadout({ freq: null, db: null });
      if (window.handleToneHover) window.handleToneHover(null);
    });

    plot.on("plotly_click", (evt) => {
      const pt = evt.points?.[0];
      if (!pt) return;
      window.addAnnotation?.(pt);
    });
  }

  function smoothSpectrum(spectrum, smoothHz) {
    if (!smoothHz || smoothHz <= 0) return spectrum;
    const { freqs, mags } = spectrum;
    const out = [];
    const bandwidth = smoothHz;
    for (let i = 0; i < freqs.length; i += 1) {
      const f = freqs[i];
      let acc = 0;
      let weight = 0;
      for (let j = 0; j < freqs.length; j += 1) {
        const df = Math.abs(freqs[j] - f);
        if (df <= bandwidth) {
          const w = 1 - (df / bandwidth);
          acc += mags[j] * w;
          weight += w;
        }
      }
      out.push(weight > 0 ? acc / weight : mags[i]);
    }
    return { freqs, mags: out };
  }

  function applyDb(spectrum) {
    const rawDb = spectrum.mags.map((m) => 20 * Math.log10(Math.max(m, 1e-12)));
    const maxDb = Math.max(...rawDb, -200);
    const floorDb = Math.max(maxDb - 80, -120);
    const dbs = rawDb.map((d) => Math.max(d, floorDb));
    return { ...spectrum, dbs, maxDb, floorDb };
  }

  window.FFTPlot = {
    makeFftPlot,
    renderNoteGridPills,
    smoothSpectrum,
    applyDb,
    renderHoverReadout,
  };
})();
