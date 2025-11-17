/*
© 2025 Rick Molloy. All rights reserved.

Plate thickness calculator UI logic.
*/

(function initPlateThicknessTool() {
  const calculator = (typeof window !== "undefined" && window.PlateThickness) ? window.PlateThickness : null;
  if (!calculator) {
    throw new Error("PlateThickness calculator unavailable. Ensure calculator.js is loaded before main.js.");
  }

  const defaults = {
    bodyLength: 0.49,
    lowerBout: 0.39,
    panelMass: 0.2114,
    panelHeight: 0.0041,
    panelLength: 0.555,
    panelWidth: 0.227,
    longFreq: 74,          // Hz
    crossFreq: 109,        // Hz
    twistFreq: 42,         // Hz
    targetFreq: 75         // Hz
  };

  const fields = {};
  document.querySelectorAll("[data-field]").forEach(input => {
    fields[input.dataset.field] = input;
  });

  const resultEls = {
    thickness: document.getElementById("result_thickness"),
    mass: document.getElementById("result_mass"),
    density: document.getElementById("result_density"),
    EL: document.getElementById("result_el"),
    EC: document.getElementById("result_ec"),
    ratio: document.getElementById("result_ratio"),
    shear: document.getElementById("result_shear"),
    status: document.getElementById("result_status")
  };

  function format(number, { digits = 2, notation = "standard" } = {}) {
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      notation
    }).format(number);
  }

  function readInputs() {
    const values = {};
    for (const [key, input] of Object.entries(fields)) {
      const value = parseFloat(input.value);
      values[key] = value;
    }
    return values;
  }

  function setResults(result) {
    resultEls.thickness.textContent = `${format(result.thicknessMm, { digits: 2 })} mm`;
    resultEls.mass.textContent = `${format(result.projectedMassG, { digits: 1 })} g`;
    resultEls.density.textContent = `${format(result.density, { digits: 1 })} kg/m³`;
    resultEls.EL.textContent = `${format(result.EL / 1e9, { digits: 2 })} GPa`;
    resultEls.EC.textContent = `${format(result.EC / 1e9, { digits: 2 })} GPa`;
    resultEls.ratio.textContent = format(result.ELoverEC, { digits: 2 });
    resultEls.shear.textContent = `${format(result.GLC / 1e9, { digits: 2 })} GPa`;
    resultEls.status.textContent = "Live: computed from current inputs";
  }

  function setError(message) {
    resultEls.thickness.textContent = "—";
    resultEls.mass.textContent = "—";
    resultEls.density.textContent = "—";
    resultEls.EL.textContent = "—";
    resultEls.EC.textContent = "—";
    resultEls.ratio.textContent = "—";
    resultEls.shear.textContent = "—";
    resultEls.status.textContent = message;
  }

  function run() {
    try {
      const raw = readInputs();
      const mapped = {
        bodyLength: (raw.body_length ?? 0) / 1000,
        lowerBout: (raw.lower_bout ?? 0) / 1000,
        panelMass: (raw.panel_mass ?? 0) / 1000,
        panelHeight: (raw.panel_height ?? 0) / 1000,
        panelLength: (raw.panel_length ?? 0) / 1000,
        panelWidth: (raw.panel_width ?? 0) / 1000,
        longFreq: raw.long_freq,
        crossFreq: raw.cross_freq,
        twistFreq: raw.twist_freq,
        targetFreq: raw.target_freq
      };
      const result = calculator.computePlateSolution(mapped);
      setResults(result);
    } catch (error) {
      setError(error.message);
    }
  }

  function reset() {
    Object.entries(fields).forEach(([key, input]) => {
      const defaultKey = key;
      const value = defaults[camelCase(defaultKey)];
      if (typeof value === "number") {
        const scaled = scaleForField(key, value);
        input.value = Number.isFinite(scaled) ? formatNumber(scaled) : "";
      }
    });
    applyQueryParams();
    run();
  }

  function scaleForField(key, baseValue) {
    if (key.includes("mass")) return baseValue * 1000;
    if (key.includes("height") || key.includes("length") || key.includes("width") || key.includes("body") || key.includes("bout")) {
      return baseValue * 1000;
    }
    return baseValue;
  }

  function camelCase(snake) {
    return snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function applyQueryParams() {
    if (typeof window === "undefined" || !window.location) return;
    const params = new URLSearchParams(window.location.search);
    const overrides = {
      long_freq: params.get("long"),
      cross_freq: params.get("cross"),
      twist_freq: params.get("twisting")
    };
    let changed = false;
    Object.entries(overrides).forEach(([field, raw]) => {
      if (!raw) return;
      const numeric = parseFloat(raw);
      if (!Number.isFinite(numeric)) return;
      if (fields[field]) {
        const scaled = field.includes("_freq") ? numeric : numeric;
        fields[field].value = formatNumber(scaled);
        changed = true;
      }
    });
    if (changed) run();
  }

  document.querySelectorAll("input[data-field]").forEach(input => {
    input.addEventListener("input", event => {
      const value = parseFloat(event.target.value);
      if (Number.isFinite(value)) {
        event.target.value = formatNumber(value);
      }
      run();
    });
  });

  const resetBtn = document.getElementById("reset_inputs");
  if (resetBtn) resetBtn.addEventListener("click", event => {
    event.preventDefault();
    reset();
  });

  reset();

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "";
    const fixed = value.toFixed(2);
    return fixed.replace(/\.?0+$/, "");
  }
})();
