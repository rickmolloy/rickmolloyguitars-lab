/*
© 2025 Rick Molloy. All rights reserved.

This work extends and builds upon the acoustic-guitar modeling framework
originally developed and published by Trevor Gore and Gerard Gilet in
*Contemporary Acoustic Guitar Design and Build*. Their research established
the theoretical foundation used here. This implementation is an independent
derivative applying those principles in software form.

Permission is granted to view and reference this source code for educational
and research purposes only. Redistribution, modification, or commercial use
of this code or any derivative works is strictly prohibited without written
permission from the author.

This license supersedes all previous licensing for this repository.
*/

/* exported $, fmt, computeResponse */

/* --------------------- Utilities & constants --------------------- */
const $ = id => {
  if (typeof document === "undefined" || typeof document.getElementById !== "function") return null;
  return document.getElementById(id);
};
const DEFAULT_C = 340;       // m/s
const DEFAULT_RHO = 1.205;   // kg/m^3
const pref = 50;     // reference pressure (Kirby)
const mic_r = 1.0;   // microphone distance (m)

function fmt(v) { if (Math.abs(v) >= 1) return v.toFixed(2); if (Math.abs(v) >= 0.01) return v.toFixed(4); return v.toPrecision(5); }
function sweep(f1 = 0, f2 = 500, step = 0.1) { const out = []; for (let f = f1; f <= f2 + 1e-9; f += step) out.push(+f.toFixed(4)); return out; }

/* --------------------- Complex arithmetic --------------------- */
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im);
const sub = (a, b) => C(a.re - b.re, a.im - b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const scl = (a, s) => C(a.re * s, a.im * s);
const inv = a => { const d = a.re * a.re + a.im * a.im || 1e-30; return C(a.re / d, -a.im / d); };
const div = (a, b) => mul(a, inv(b));
const abs = a => Math.hypot(a.re, a.im);

/* determinants */
function det2(a11, a12, a21, a22) { return sub(mul(a11, a22), mul(a12, a21)); }
function det3(a11, a12, a13, a21, a22, a23, a31, a32, a33) {
  const t1 = mul(a11, sub(mul(a22, a33), mul(a23, a32)));
  const t2 = mul(a12, sub(mul(a21, a33), mul(a23, a31)));
  const t3 = mul(a13, sub(mul(a21, a32), mul(a22, a31)));
  return add(sub(t1, t2), t3);
}

/* shared helpers */
function resolveAtmosphere(p) {
  const rho = (typeof p.air_density === "number" && !Number.isNaN(p.air_density)) ? p.air_density : DEFAULT_RHO;
  const c = (typeof p.speed_of_sound === "number" && !Number.isNaN(p.speed_of_sound)) ? p.speed_of_sound : DEFAULT_C;
  return { rho, c };
}
function scalePressure(y, area, om, rhoOverride) {
  const rho = (typeof rhoOverride === "number" && !Number.isNaN(rhoOverride)) ? rhoOverride : DEFAULT_RHO;
  const scale = (om * om * rho) / (4 * Math.PI * mic_r);
  return scl(y, area * scale);
}
function kappaFrom(p, atm) {
  const { c, rho } = atm || resolveAtmosphere(p);
  return (c * c) * rho / p.volume_air;
}

/* --------------------- 1DOF, 2DOF, 3DOF, 4DOF solvers --------------------- */
/* 1DOF: Helmholtz-only (air mass + cavity spring). Force applied to air. */
function computeResponse1DOF(p) {
  const atm = resolveAtmosphere(p);
  const kappa = kappaFrom(p, atm);
  const oma = Math.sqrt((kappa * p.area_hole * p.area_hole) / p.mass_air);
  const freqs = sweep(0, 500, 0.1);

  const total = [], top = [], back = [], air = [], sides = [];
  const F = p.driving_force;

  for (const f of freqs) {
    const omega = 2 * Math.PI * f;
    const airImpedance = C(p.mass_air * (oma * oma - omega * omega), p.damping_air * omega);
    const airResponse = div(C(F, 0), airImpedance); // Force applied on air coordinate
    const airPressure = scalePressure(airResponse, p.area_hole, omega, atm.rho);
    const totalPressure = airPressure;

    const totalDb = 20 * Math.log10((abs(totalPressure) / pref) || 1e-30);
    const airDb = 20 * Math.log10((abs(airPressure) / pref) || 1e-30);

    total.push({ x: f, y: totalDb });
    air.push({ x: f, y: airDb });
    top.push({ x: f, y: -140 }); back.push({ x: f, y: -140 }); sides.push({ x: f, y: -140 });
  }
  return { total, top, back, air, sides };
}

/* 2DOF: Top + Air (force on Top). */
function computeResponse2DOF(p) {
  const atm = resolveAtmosphere(p);
  const kappa = kappaFrom(p, atm);
  const omt = Math.sqrt((p.stiffness_top + kappa * p.area_top * p.area_top) / p.mass_top);
  const oma = Math.sqrt((kappa * p.area_hole * p.area_hole) / p.mass_air);
  const alpha_t = kappa * p.area_hole * p.area_top;

  const freqs = sweep(0, 500, 0.1);
  const total = [], top = [], back = [], air = [], sides = [];
  const F = p.driving_force;

  for (const f of freqs) {
    const omega = 2 * Math.PI * f;
    const topImpedance = C(p.mass_top * (omt * omt - omega * omega), p.damping_top * omega);
    const airImpedance = C(p.mass_air * (oma * oma - omega * omega), p.damping_air * omega);
    const systemDet = det2(topImpedance, C(-alpha_t, 0), C(-alpha_t, 0), airImpedance);
    const topResponse = div(mul(airImpedance, C(F, 0)), systemDet);      // (Da*F)/Δ
    const airResponse = div(mul(C(alpha_t, 0), C(F, 0)), systemDet);     // (α_t*F)/Δ

    const topPressure = scalePressure(topResponse, p.area_top, omega, atm.rho);
    const airPressure = scalePressure(airResponse, p.area_hole, omega, atm.rho);
    const totalPressure = add(topPressure, airPressure);

    total.push({ x: f, y: 20 * Math.log10((abs(totalPressure) / pref) || 1e-30) });
    top.push({ x: f, y: 20 * Math.log10((abs(topPressure) / pref) || 1e-30) });
    air.push({ x: f, y: 20 * Math.log10((abs(airPressure) / pref) || 1e-30) });
    back.push({ x: f, y: -140 });
    sides.push({ x: f, y: -140 });
  }
  return { total, top, back, air, sides };
}

/* 3DOF: Top + Back + Air (force on Top). */
function computeResponse3DOF(p) {
  const atm = resolveAtmosphere(p);
  const kappa = kappaFrom(p, atm);
  const omt = Math.sqrt((p.stiffness_top + kappa * p.area_top * p.area_top) / p.mass_top);
  const omb = Math.sqrt((p.stiffness_back + kappa * p.area_back * p.area_back) / p.mass_back);
  const oma = Math.sqrt((kappa * p.area_hole * p.area_hole) / p.mass_air);

  const alpha_t = kappa * p.area_hole * p.area_top;
  const alpha_b = kappa * p.area_hole * p.area_back;

  const freqs = sweep(0, 500, 0.1);
  const total = [], top = [], back = [], air = [], sides = [];
  const F = p.driving_force;

  for (const f of freqs) {
    const omega = 2 * Math.PI * f;
    const topImpedance = C(p.mass_top * (omt * omt - omega * omega), p.damping_top * omega);
    const backImpedance = C(p.mass_back * (omb * omb - omega * omega), p.damping_back * omega);
    const airImpedance = C(p.mass_air * (oma * oma - omega * omega), p.damping_air * omega);

    // M = [[topImpedance,   0, -αt],
    //      [      0, backImpedance, -αb],
    //      [-αt,-αb,  airImpedance]]
    const detSystem = det3(
      topImpedance, C(0, 0), C(-alpha_t, 0),
      C(0, 0), backImpedance, C(-alpha_b, 0),
      C(-alpha_t, 0), C(-alpha_b, 0), airImpedance
    );

    // b = [F, 0, 0]^T
    const detTop = det3(
      C(F, 0), C(0, 0), C(-alpha_t, 0),
      C(0, 0), backImpedance, C(-alpha_b, 0),
      C(0, 0), C(-alpha_b, 0), airImpedance
    );
    const detBack = det3(
      topImpedance, C(F, 0), C(-alpha_t, 0),
      C(0, 0), C(0, 0), C(-alpha_b, 0),
      C(-alpha_t, 0), C(0, 0), airImpedance
    );
    const detAir = det3(
      topImpedance, C(0, 0), C(F, 0),
      C(0, 0), backImpedance, C(0, 0),
      C(-alpha_t, 0), C(-alpha_b, 0), C(0, 0)
    );

    const topResponse = div(detTop, detSystem);
    const backResponse = div(detBack, detSystem);
    const airResponse = div(detAir, detSystem);

    const topPressure = scalePressure(topResponse, p.area_top, omega, atm.rho);
    const backPressure = scalePressure(backResponse, p.area_back, omega, atm.rho);
    const airPressure = scalePressure(airResponse, p.area_hole, omega, atm.rho);
    const totalPressure = add(add(topPressure, backPressure), airPressure);

    total.push({ x: f, y: 20 * Math.log10((abs(totalPressure) / pref) || 1e-30) });
    top.push({ x: f, y: 20 * Math.log10((abs(topPressure) / pref) || 1e-30) });
    back.push({ x: f, y: 20 * Math.log10((abs(backPressure) / pref) || 1e-30) });
    air.push({ x: f, y: 20 * Math.log10((abs(airPressure) / pref) || 1e-30) });
    sides.push({ x: f, y: -140 });
  }
  return { total, top, back, air, sides };
}

/* 4DOF: Determinant-expanded Kirby/Gore–Gilet (legacy math) */
function computeResponse4DOF(p) {
  const atm = resolveAtmosphere(p);
  const kappa = kappaFrom(p, atm);

  const omt = Math.sqrt((p.stiffness_top + kappa * p.area_top * p.area_top) / p.mass_top);
  const oms = Math.sqrt((p.stiffness_back + p.stiffness_top) / p.mass_sides);
  const omb = Math.sqrt((p.stiffness_back + kappa * p.area_back * p.area_back) / p.mass_back);
  const oma = Math.sqrt((kappa * p.area_hole * p.area_hole) / p.mass_air);

  const alphat = kappa * p.area_hole * p.area_top;
  const alphab = kappa * p.area_hole * p.area_back;
  const alphbt = kappa * p.area_back * p.area_top;

  const freqs = sweep(0, 500, 0.1);

  const F = p.driving_force;
  const total = [], top = [], back = [], air = [], sides = [];

  for (const f of freqs) {
    const omega = 2 * Math.PI * f;

    const topImpedance = C(p.mass_top * (omt * omt - omega * omega), p.damping_top * omega);
    const sidesImpedance = C(p.mass_sides * (oms * oms - omega * omega), p.damping_sides * omega);
    const backImpedance = C(p.mass_back * (omb * omb - omega * omega), p.damping_back * omega);
    const airImpedance = C(p.mass_air * (oma * oma - omega * omega), p.damping_air * omega);

    const Kt = p.stiffness_top, Kb = p.stiffness_back;

    const topTimesSides = mul(topImpedance, sidesImpedance);
    const sidesTimesBack = mul(sidesImpedance, backImpedance);
    const topSidesBack = mul(topTimesSides, backImpedance);
    const topSidesBackAir = mul(topSidesBack, airImpedance);

    const term1 = topSidesBackAir;
    const term2 = scl(airImpedance, -2 * alphbt * Kt * Kb);
    const term3 = scl(sidesImpedance, 2 * alphbt * alphab * alphat);
    const term4 = C(2 * alphat * alphab * Kt * Kb, 0);
    const term5 = scl(sub(topTimesSides, C(Kt * Kt, 0)), -(alphab * alphab));
    const term6 = scl(sub(sidesTimesBack, C(Kb * Kb, 0)), -(alphat * alphat));
    const term7 = scl(mul(sidesImpedance, airImpedance), -(alphbt * alphbt));
    const term8 = scl(mul(topImpedance, airImpedance), -(Kb * Kb));
    const term9 = scl(mul(backImpedance, airImpedance), -(Kt * Kt));

    let systemDet = term1;
    [term2, term3, term4, term5, term6, term7, term8, term9].forEach(t => { systemDet = add(systemDet, t); });

    const term_t1 = mul(mul(sidesImpedance, backImpedance), airImpedance);
    const term_t2 = scl(sidesImpedance, -(alphab * alphab));
    const term_t3 = scl(airImpedance, -(Kb * Kb));
    const topResponse = scl(div(add(add(term_t1, term_t2), term_t3), systemDet), F);

    const term_s1 = scl(mul(backImpedance, airImpedance), Kt);
    const term_s2 = C(-Kt * (alphab * alphab), 0);
    const term_s3 = scl(airImpedance, alphbt * Kb);
    const term_s4 = C(-alphat * alphab * Kb, 0);
    const sidesResponse = scl(div(add(add(add(term_s1, term_s2), term_s3), term_s4), systemDet), F);

    const term_b1 = scl(airImpedance, -Kt * Kb);
    const term_b2 = scl(mul(airImpedance, sidesImpedance), -alphbt);
    const term_b3 = scl(sidesImpedance, alphab * alphat);
    const backResponse = scl(div(add(add(term_b1, term_b2), term_b3), systemDet), F);

    const term_a1 = C(Kt * Kb * alphab, 0);
    const term_a2 = scl(sidesImpedance, alphbt * alphab);
    const term_a3 = scl(mul(sidesImpedance, backImpedance), -alphat);
    const term_a4 = C(alphat * (Kb * Kb), 0);
    const airResponse = scl(div(add(add(add(term_a1, term_a2), term_a3), term_a4), systemDet), F);

    const topPressure = scalePressure(topResponse, p.area_top, omega, atm.rho);
    const sidesPressure = scalePressure(sidesResponse, p.area_sides, omega, atm.rho);
    const backPressure = scalePressure(backResponse, p.area_back, omega, atm.rho);
    const airPressure = scalePressure(airResponse, p.area_hole, omega, atm.rho);
    const totalPressure = add(add(add(topPressure, sidesPressure), backPressure), airPressure);

    const totalDb = 20 * Math.log10((abs(totalPressure) / pref) || 1e-30);
    const topDb = 20 * Math.log10((abs(topPressure) / pref) || 1e-30);
    const backDb = 20 * Math.log10((abs(backPressure) / pref) || 1e-30);
    const airDb = 20 * Math.log10((abs(airPressure) / pref) || 1e-30);
    const sidesDb = 20 * Math.log10((abs(sidesPressure) / pref) || 1e-30);

    total.push({ x: f, y: totalDb });
    top.push({ x: f, y: topDb });
    back.push({ x: f, y: backDb });
    air.push({ x: f, y: airDb });
    sides.push({ x: f, y: sidesDb });
  }
  return { total, top, back, air, sides };
}

function computeResponse5DOF(p) {
  return computeExtendedResponse(p, { includeDipole: true, includeTripole: false });
}

function computeResponse6DOF(p) {
  return computeExtendedResponse(p, { includeDipole: true, includeTripole: true });
}

/* wrapper */
function computeResponse(p) {
  switch (p.model_order) {
    case 1: return computeResponse1DOF(p);
    case 2: return computeResponse2DOF(p);
    case 3: return computeResponse3DOF(p);
    case 5: return computeResponse5DOF(p);
    case 6: return computeResponse6DOF(p);
    default: return computeResponse4DOF(p);
  }
}

function computeExtendedResponse(p, { includeDipole = false, includeTripole = false } = {}) {
  const atm = resolveAtmosphere(p);
  const kappa = kappaFrom(p, atm);
  const config = buildExtendedSystem(p, kappa, { includeDipole, includeTripole });
  return solveCoupledSystem(p, atm, config);
}

function buildExtendedSystem(p, kappa, { includeDipole, includeTripole }) {
  const eta = (key, fallback) => (typeof p[key] === "number" ? p[key] : fallback);
  const dofs = [
    {
      id: "top",
      traceKey: "top",
      mass: p.mass_top,
      stiffness: p.stiffness_top + kappa * p.area_top * p.area_top,
      damping: p.damping_top,
      area: p.area_top,
      eta: eta("eta_top", 1)
    },
    {
      id: "sides",
      traceKey: "sides",
      mass: p.mass_sides,
      stiffness: p.stiffness_top + p.stiffness_back,
      damping: p.damping_sides,
      area: p.area_sides,
      eta: eta("eta_sides", 1)
    },
    {
      id: "back",
      traceKey: "back",
      mass: p.mass_back,
      stiffness: p.stiffness_back + kappa * p.area_back * p.area_back,
      damping: p.damping_back,
      area: p.area_back,
      eta: eta("eta_back", 1)
    },
    {
      id: "air",
      traceKey: "air",
      mass: p.mass_air,
      stiffness: kappa * p.area_hole * p.area_hole,
      damping: p.damping_air,
      area: p.area_hole,
      eta: eta("eta_air", 1)
    }
  ];

  const couplings = [
    { source: "top", target: "sides", stiffness: p.stiffness_top },
    { source: "sides", target: "back", stiffness: p.stiffness_back },
    { source: "top", target: "air", stiffness: kappa * p.area_top * p.area_hole },
    { source: "back", target: "air", stiffness: kappa * p.area_back * p.area_hole },
    { source: "sides", target: "air", stiffness: kappa * p.area_back * p.area_top }
  ];

  if(includeDipole){
    const massDip = (typeof p.mass_dipole === "number") ? p.mass_dipole : p.mass_top * 0.12;
    const stiffDip = (typeof p.stiffness_dipole === "number")
      ? p.stiffness_dipole
      : massDip * Math.pow(2 * Math.PI * 300, 2);
    const dampDip = (typeof p.damping_dipole === "number") ? p.damping_dipole : p.damping_top * 0.3;
    const areaDip = (typeof p.area_dipole === "number") ? p.area_dipole : p.area_top * 0.8;
    const etaDip = eta("eta_dipole", 0.4);
    const kTopDip = (typeof p.k_top_dipole === "number") ? p.k_top_dipole : p.stiffness_top * 0.05;
    const alphaDip = (typeof p.alpha_dipole === "number") ? p.alpha_dipole : 0;

    dofs.push({
      id: "dipole",
      traceKey: "dipole",
      mass: massDip,
      stiffness: stiffDip,
      damping: dampDip,
      area: areaDip,
      eta: etaDip
    });
    couplings.push({ source: "top", target: "dipole", stiffness: kTopDip });
    if(alphaDip) couplings.push({ source: "dipole", target: "air", stiffness: alphaDip });
  }

  if(includeTripole){
    const massTri = (typeof p.mass_tripole === "number") ? p.mass_tripole : p.mass_top * 0.1;
    const stiffTri = (typeof p.stiffness_tripole === "number")
      ? p.stiffness_tripole
      : massTri * Math.pow(2 * Math.PI * 380, 2);
    const dampTri = (typeof p.damping_tripole === "number") ? p.damping_tripole : p.damping_top * 0.35;
    const areaTri = (typeof p.area_tripole === "number") ? p.area_tripole : p.area_top * 0.7;
    const etaTri = eta("eta_tripole", 0.3);
    const kTopTri = (typeof p.k_top_tripole === "number") ? p.k_top_tripole : p.stiffness_top * 0.03;
    const alphaTri = (typeof p.alpha_tripole === "number") ? p.alpha_tripole : 0;

    dofs.push({
      id: "tripole",
      traceKey: "tripole",
      mass: massTri,
      stiffness: stiffTri,
      damping: dampTri,
      area: areaTri,
      eta: etaTri
    });
    couplings.push({ source: "top", target: "tripole", stiffness: kTopTri });
    if(alphaTri) couplings.push({ source: "tripole", target: "air", stiffness: alphaTri });
  }

  return {
    dofs,
    couplings: couplings.filter(c => typeof c.stiffness === "number" && Math.abs(c.stiffness) > 0),
    driveId: "top"
  };
}

function solveCoupledSystem(p, atm, config) {
  const size = config.dofs.length;
  const freqs = sweep(0, 500, 0.1);
  const idToIndex = new Map();
  config.dofs.forEach((dof, idx) => idToIndex.set(dof.id, idx));
  const driveIndex = idToIndex.get(config.driveId) ?? 0;
  const couplings = config.couplings.map(c => ({
    i: idToIndex.get(c.source),
    j: idToIndex.get(c.target),
    stiffness: c.stiffness
  })).filter(c => Number.isInteger(c.i) && Number.isInteger(c.j));

  const traceSeries = {};
  config.dofs.forEach(d => { traceSeries[d.traceKey] = []; });
  const total = [];

  for(const f of freqs){
    const omega = 2 * Math.PI * f;
    const matrix = buildSystemMatrix(config.dofs, couplings, omega);
    const rhs = Array.from({ length: size }, () => C(0, 0));
    rhs[driveIndex] = C(p.driving_force, 0);
    const amplitudes = solveComplexLinearSystem(matrix, rhs);
    let totalPressure = C(0, 0);

    config.dofs.forEach((dof, idx)=>{
      let pressure = null;
      if(dof.area && dof.area > 0){
        const basePressure = scalePressure(amplitudes[idx], dof.area, omega, atm.rho);
        pressure = scl(basePressure, dof.eta ?? 1);
        totalPressure = add(totalPressure, pressure);
      }
      const y = pressure ? 20 * Math.log10((abs(pressure) / pref) || 1e-30) : -140;
      traceSeries[dof.traceKey].push({ x: f, y });
    });

    total.push({ x: f, y: 20 * Math.log10((abs(totalPressure) / pref) || 1e-30) });
  }

  return { total, ...traceSeries };
}

function buildSystemMatrix(dofs, couplings, omega) {
  const size = dofs.length;
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => C(0, 0)));
  for(let i=0;i<size;i++){
    const dof = dofs[i];
    const re = dof.stiffness - dof.mass * omega * omega;
    const im = dof.damping * omega;
    matrix[i][i] = C(re, im);
  }
  couplings.forEach(({ i, j, stiffness })=>{
    if(!Number.isFinite(stiffness)) return;
    matrix[i][j] = add(matrix[i][j], C(-stiffness, 0));
    matrix[j][i] = add(matrix[j][i], C(-stiffness, 0));
  });
  return matrix;
}

function solveComplexLinearSystem(matrix, rhs) {
  const n = matrix.length;
  const A = matrix.map(row => row.map(cell => C(cell.re, cell.im)));
  const b = rhs.map(cell => C(cell.re, cell.im));
  for(let i=0;i<n;i++){
    let pivot = i;
    for(let r=i;r<n;r++){
      if(abs(A[r][i]) > abs(A[pivot][i])) pivot = r;
    }
    if(abs(A[pivot][i]) < 1e-12){
      throw new Error("Singular system in coupled solver.");
    }
    if(pivot !== i){
      [A[i], A[pivot]] = [A[pivot], A[i]];
      [b[i], b[pivot]] = [b[pivot], b[i]];
    }
    for(let r=i+1;r<n;r++){
      const factor = div(A[r][i], A[i][i]);
      if(Math.abs(factor.re) < 1e-15 && Math.abs(factor.im) < 1e-15) continue;
      for(let c=i;c<n;c++){
        A[r][c] = sub(A[r][c], mul(factor, A[i][c]));
      }
      b[r] = sub(b[r], mul(factor, b[i]));
    }
  }
  const x = Array(n).fill(C(0, 0));
  for(let i=n-1;i>=0;i--){
    let sum = C(0, 0);
    for(let j=i+1;j<n;j++){
      sum = add(sum, mul(A[i][j], x[j]));
    }
    x[i] = div(sub(b[i], sum), A[i][i]);
  }
  return x;
}

const SolverCore = {
  $,
  C,
  add,
  sub,
  mul,
  scl,
  inv,
  div,
  abs,
  det2,
  det3,
  resolveAtmosphere,
  scalePressure,
  kappaFrom,
  fmt,
  sweep,
  computeResponse,
  computeResponse1DOF,
  computeResponse2DOF,
  computeResponse3DOF,
  computeResponse4DOF,
  computeResponse5DOF,
  computeResponse6DOF,
  constants: {
    DEFAULT_C,
    DEFAULT_RHO,
    pref,
    mic_r
  }
};

if (typeof window !== "undefined") {
  window.SolverCore = SolverCore;
  window.ModelCore = SolverCore;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SolverCore;
}
