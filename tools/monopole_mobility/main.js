/*
© 2025 Rick Molloy. All rights reserved.

This calculator implements the Gore-style monopole mobility jig workflow.
Permission is granted to view and reference this source for educational purposes only.
Redistribution, modification, or commercial use requires written consent from the author.
*/

const g = 9.8;
const defaults = {
  name: "Rick Molloy OM (10/25/2025)",
  type: "steel",
  freq: 153,
  deflection: 0.18,
  mass: 1.02,
};

const typeLabels = {
  steel: "Steel-string",
  classical: "Classical",
  other: "Other",
};

const getTypeLabel = (value) => typeLabels[value] || "Other";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sliders = {
  freq: document.getElementById("freq"),
  deflection: document.getElementById("deflection"),
  mass: document.getElementById("mass"),
};

const fields = {
  freq: document.getElementById("freq_field"),
  deflection: document.getElementById("deflection_field"),
  mass: document.getElementById("mass_field"),
};

const nameInput = document.getElementById("instrument_name");
const typeSelect = document.getElementById("instrument_type");

const instrumentDisplay = document.getElementById("instrument_display");

const outputs = {
  stiffness: document.getElementById("stiffness"),
  effMass: document.getElementById("effMass"),
  mobilityScore: document.getElementById("mobilityScore"),
  status: document.getElementById("status"),
  warnings: document.getElementById("warnings")
};

const buttons = {
  reset: document.getElementById("reset"),
  copy: document.getElementById("copy"),
};

const formatter = (options = {}) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: options.max ?? 2,
    minimumFractionDigits: options.min ?? 0,
    notation: options.notation ?? "standard",
  });

const fmtMobility = formatter({ min: 1, max: 1 });

function updateInstrumentLabel() {
  const name = nameInput.value.trim() || "Untitled sample";
  const typeLabel = getTypeLabel(typeSelect.value);
  instrumentDisplay.textContent = `${name} • ${typeLabel}`;
}

function compute() {
  const freq = parseFloat(fields.freq.value);
  const deflection = parseFloat(fields.deflection.value);
  const mass = parseFloat(fields.mass.value);
  updateInstrumentLabel();

  const valid =
    Number.isFinite(freq) &&
    freq > 0 &&
    Number.isFinite(deflection) &&
    deflection > 0 &&
    Number.isFinite(mass) &&
    mass > 0;

  if (!valid) {
    setOutputs("--");
    outputs.status.textContent = "Waiting for complete inputs…";
    return;
  }

  const defM = deflection / 1000;
  const stiffness = (mass * g) / defM;
  const meffKg = stiffness / Math.pow(2 * Math.PI * freq, 2);
  const meffG = meffKg * 1000;
  const mobilitySI = 1 / Math.sqrt(stiffness * meffKg);
  const mobilityScore = 1000 * mobilitySI;

  outputs.stiffness.textContent = formatter({ max: 0 }).format(stiffness);
  outputs.effMass.textContent = formatter({ min: 1, max: 1 }).format(meffG);
  outputs.mobilityScore.textContent = fmtMobility.format(mobilityScore);
  setWarnings({ freq, deflection, mass, mobilityScore });

  const nameMatches = nameInput.value.trim() === defaults.name;
  const typeMatches = typeSelect.value === defaults.type;

  if (
    Math.abs(freq - defaults.freq) < 1e-9 &&
    Math.abs(deflection - defaults.deflection) < 1e-9 &&
    Math.abs(mass - defaults.mass) < 1e-9 &&
    nameMatches &&
    typeMatches
  ) {
    outputs.status.textContent = "Live: Rick Molloy OM (10/25/2025)";
  } else {
    outputs.status.textContent = "Live: custom input";
  }

  buttons.copy.disabled = false;
}

function setOutputs(value) {
  outputs.stiffness.textContent = value;
  outputs.effMass.textContent = value;
  outputs.mobilityScore.textContent = value;
  outputs.warnings.textContent = "";
  buttons.copy.disabled = true;
}

function resetInputs() {
  nameInput.value = defaults.name;
  typeSelect.value = defaults.type;
  sliders.freq.value = defaults.freq;
  sliders.deflection.value = defaults.deflection;
  sliders.mass.value = defaults.mass;
  fields.freq.value = defaults.freq;
  fields.deflection.value = defaults.deflection;
  fields.mass.value = defaults.mass;
  updateInstrumentLabel();
  compute();
}

function copyResults() {
  const payload = [
    `Sample: ${nameInput.value.trim() || "Untitled sample"} (${getTypeLabel(
      typeSelect.value
    )})`,
    `f_u (Hz): ${fields.freq.value}`,
    `Deflection (mm): ${fields.deflection.value}`,
    `Mass (kg): ${fields.mass.value}`,
    `K (N/m): ${outputs.stiffness.textContent}`,
    `M_eff (g): ${outputs.effMass.textContent}`,
    `Mobility score: ${outputs.mobilityScore.textContent}`,
  ].join("\n");

  navigator.clipboard
    .writeText(payload)
    .then(() => {
      outputs.status.textContent = "Copied results to clipboard";
      setTimeout(compute, 1500);
    })
    .catch(() => {
      outputs.status.textContent = "Clipboard copy failed";
    });
}

buttons.reset.addEventListener("click", resetInputs);
buttons.copy.addEventListener("click", copyResults);

Object.entries(sliders).forEach(([key, slider]) => {
  slider.addEventListener("input", (event) => {
    const value = parseFloat(event.target.value);
    if (Number.isFinite(value)) {
      fields[key].value = value;
    }
    compute();
  });
});

Object.entries(fields).forEach(([key, field]) => {
  field.addEventListener("input", (event) => {
    const raw = parseFloat(event.target.value);
    if (Number.isFinite(raw)) {
      const min = parseFloat(sliders[key].min);
      const max = parseFloat(sliders[key].max);
      if (raw >= min && raw <= max) {
        sliders[key].value = raw;
      }
    }
    compute();
  });

  field.addEventListener("change", () => {
    const value = parseFloat(field.value);
    if (!Number.isFinite(value)) {
      return;
    }
    const min = parseFloat(sliders[key].min);
    const max = parseFloat(sliders[key].max);
    const clamped = clamp(value, min, max);
    sliders[key].value = clamped;
    field.value = clamped;
    compute();
  });
});

nameInput.addEventListener("input", compute);
typeSelect.addEventListener("change", compute);

resetInputs();

function setWarnings({ freq, deflection, mass, mobilityScore }) {
  const notes = [];
  if (freq < 90 || freq > 220) {
    notes.push("f\u2090 is outside 90–220 Hz. Re-check the sealed-soundhole peak.");
  }
  if (deflection < 0.05) {
    notes.push("Deflection is very small. Confirm gauge reading and load; may be outside normal jig range.");
  } else if (deflection > 0.5) {
    notes.push("Deflection is high. Reduce test mass to avoid overloading the top.");
  }
  if (mass < 0.3 || mass > 2.0) {
    notes.push("Test mass is outside the usual 0.3–2.0 kg band. Typical jigs use 0.5–1.5 kg.");
  }
  if (mobilityScore < 15) {
    notes.push("Mobility <15 suggests a very stiff top. Confirm deflection, mass, and units.");
  } else if (mobilityScore > 40) {
    notes.push("Mobility >40 suggests a very compliant top. Confirm mass and dial gauge readings.");
  }
  outputs.warnings.textContent = notes.join(" ");
}
