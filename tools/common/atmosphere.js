'use strict';

(function bootstrap(globalScope) {
  const ISA = {
    T0: 288.15, // K
    P0: 101325, // Pa
    LAPSE: 0.0065, // K/m
    R: 287.05, // J/(kg·K)
    GAMMA: 1.4,
    G: 9.80665
  };

  ISA.EXP = ISA.G / (ISA.R * ISA.LAPSE);

  const MAX_ATM_ALT = 10000; // m
  const FT_PER_M = 3.28084;
  const REFERENCE_RHO = 1.205; // kg/m^3

  function clamp(value, lower, upper) {
    return Math.min(Math.max(value, lower), upper);
  }

  function deriveAtmosphere(altitudeMeters = 0, tempC = 20) {
    const altitude = clamp(altitudeMeters ?? 0, 0, MAX_ATM_ALT);
    const tempKelvin = (tempC ?? 20) + 273.15;
    const lapseRatio = Math.max(0.01, 1 - (ISA.LAPSE * altitude) / ISA.T0);
    const pressure = ISA.P0 * Math.pow(lapseRatio, ISA.EXP);
    const rho = pressure / (ISA.R * tempKelvin);
    const c = Math.sqrt(ISA.GAMMA * ISA.R * tempKelvin);
    return {
      rho,
      c,
      pressure,
      tempK: tempKelvin,
      tempC: tempKelvin - 273.15,
      altitude
    };
  }

  function formatAtmosphereSummary(atm) {
    if (!atm) return "ρ ≈ ? kg/m³ • c ≈ ? m/s • P ≈ ? hPa";
    const rho = atm.rho?.toFixed(4) ?? "?";
    const c = atm.c?.toFixed(1) ?? "?";
    const pressure = atm.pressure ? (atm.pressure / 100).toFixed(0) : "?";
    return `ρ ≈ ${rho} kg/m³ • c ≈ ${c} m/s • P ≈ ${pressure} hPa`;
  }

  function formatEffectiveAirMass(atm) {
    if (!atm || !Number.isFinite(atm.effectiveMassAirKg)) return null;
    const effectiveG = atm.effectiveMassAirKg * 1000;
    const baseG = (atm.baseMassAirKg ?? atm.effectiveMassAirKg) * 1000;
    const densityPct = (atm.densityScale ?? 1) * 100;
    if (Math.abs(effectiveG - baseG) < 0.0005) {
      return `${effectiveG.toFixed(2)} g`;
    }
    return `${effectiveG.toFixed(2)} g (slider ${baseG.toFixed(2)} g * ${densityPct.toFixed(0)}% rho)`;
  }

  const Atmosphere = {
    ISA,
    MAX_ATM_ALT,
    FT_PER_M,
    REFERENCE_RHO,
    deriveAtmosphere,
    formatAtmosphereSummary,
    formatEffectiveAirMass
  };

  if (globalScope) {
    globalScope.Atmosphere = Atmosphere;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Atmosphere;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
