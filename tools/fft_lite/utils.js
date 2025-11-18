(() => {
  function getCssVar(name, fallback) {
    if (typeof window === "undefined") return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(name);
    return val && val.trim() ? val.trim() : fallback;
  }

  function freqToNoteCents(freq) {
    if (!freq || freq <= 0) return { name: "—", cents: "—", midi: null, centsNum: null };
    const midi = 69 + 12 * Math.log2(freq / 440);
    const nearest = Math.round(midi);
    const cents = Math.round((midi - nearest) * 100);
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const name = `${names[(nearest + 1200) % 12]}${Math.floor(nearest / 12) - 1}`;
    const centsStr = `${cents >= 0 ? "+" : ""}${cents}¢`;
    return { name, cents: centsStr, midi, centsNum: cents };
  }

  function deviationColor(absCents) {
    if (!Number.isFinite(absCents)) return "var(--yellow)";
    if (absCents <= 10) return "var(--vermilion)";
    if (absCents < 25) return "var(--yellow)";
    if (absCents <= 50) return "var(--green)";
    return "var(--yellow)";
  }

  const COLOR_ORANGE = getCssVar("--orange", "#E69F00");

  window.FFTUtils = {
    getCssVar,
    COLOR_ORANGE,
    freqToNoteCents,
    deviationColor,
  };
})();
