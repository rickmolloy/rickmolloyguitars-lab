/*
© 2025 Rick Molloy. All rights reserved.

Plate thickness calculator core math. Shared between the UI and Vitest.
*/

const PlateThickness = (() => {
  const YOUNGS_FACTOR = 0.94146;
  const SHEAR_FACTOR = 1.21585;
  const THICKNESS_FACTOR = 0.95977;

  function assertPositive(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${label} must be a finite, positive number.`);
    }
  }

  function calculateDensity(massKg, heightM, lengthM, widthM) {
    assertPositive(massKg, "mass");
    assertPositive(heightM, "panel height");
    assertPositive(lengthM, "panel length");
    assertPositive(widthM, "panel width");
    return massKg / (heightM * lengthM * widthM);
  }

  function calculateYoungsModulus(density, span, frequency, thickness) {
    assertPositive(density, "density");
    assertPositive(span, "span");
    assertPositive(frequency, "frequency");
    assertPositive(thickness, "thickness");
    return (YOUNGS_FACTOR * density * Math.pow(span, 4) * Math.pow(frequency, 2)) / Math.pow(thickness, 2);
  }

  function calculateShearModulus(density, spanL, spanW, frequency, thickness) {
    assertPositive(density, "density");
    assertPositive(spanL, "span length");
    assertPositive(spanW, "span width");
    assertPositive(frequency, "frequency");
    assertPositive(thickness, "thickness");
    return (SHEAR_FACTOR * density * Math.pow(spanL, 2) * Math.pow(spanW, 2) * Math.pow(frequency, 2)) / Math.pow(thickness, 2);
  }

  function computePlateSolution(params) {
    const required = [
      "bodyLength",
      "lowerBout",
      "panelMass",
      "panelHeight",
      "panelLength",
      "panelWidth",
      "longFreq",
      "crossFreq",
      "twistFreq",
      "targetFreq"
    ];
    required.forEach(key => assertPositive(params[key], key));

    const density = calculateDensity(params.panelMass, params.panelHeight, params.panelLength, params.panelWidth);
    const EL = calculateYoungsModulus(density, params.panelLength, params.longFreq, params.panelHeight);
    const EC = calculateYoungsModulus(density, params.panelWidth, params.crossFreq, params.panelHeight);
    const GLC = calculateShearModulus(density, params.panelLength, params.panelWidth, params.twistFreq, params.panelHeight);

    const ratio = params.bodyLength / params.lowerBout;
    const omega = params.targetFreq;
    const numerator = THICKNESS_FACTOR * omega * Math.pow(params.bodyLength, 2) * Math.sqrt(density);

    const coupling =
      Math.pow(ratio, 4) * EC +
      Math.pow(ratio, 2) * ((0.02857 * EL) + (1.12 * GLC));
    const denominator = Math.sqrt(EL + coupling);
    const thickness = numerator / denominator;

    if (!Number.isFinite(thickness)) {
      throw new Error("Unable to compute thickness with the provided inputs.");
    }

    const projectedMass = density * thickness * params.panelLength * params.panelWidth;

    return {
      density,
      thickness,            // meters
      thicknessMm: thickness * 1000,
      projectedMassKg: projectedMass,
      projectedMassG: projectedMass * 1000,
      EL,
      EC,
      GLC,
      ELoverEC: EL / EC
    };
  }

  return {
    calculateDensity,
    calculateYoungsModulus,
    calculateShearModulus,
    computePlateSolution
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PlateThickness;
}

if (typeof window !== "undefined") {
  window.PlateThickness = PlateThickness;
}
