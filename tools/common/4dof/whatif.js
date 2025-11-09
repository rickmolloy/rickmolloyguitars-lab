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

(function(){
  const toggle = document.getElementById("whatif_toggle");
  const resetBtn = document.getElementById("btn_reset_whatif");
  if(!toggle || !resetBtn) return;

  const EPS = 1e-6;
  const getCssVar = (name, fallback="")=>{
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  function ensureEnabled(){
    if(toggle.checked) return;
    toggle.checked = true;
    document.body.classList.add("whatif-mode");
    resetBtn.disabled = false;
    refreshSliders();
  }

  function resetWhatIf(){
    document.querySelectorAll(".dual-slider__overlay").forEach(slider=>{
      setOverlayValue(slider, slider.getAttribute("data-off-value"));
    });
    toggle.checked = false;
    document.body.classList.remove("whatif-mode");
    resetBtn.disabled = true;
    refreshSliders();
    if(window.setWhatIfSummary) window.setWhatIfSummary(null);
    if(window.render) window.render();
  }

  resetBtn.addEventListener("click", resetWhatIf);
  toggle.addEventListener("change", ()=>{
    if(toggle.checked){
      document.body.classList.add("whatif-mode");
      resetBtn.disabled = false;
      refreshSliders();
    } else {
      resetWhatIf();
    }
    if(window.render) window.render();
  });
  if(toggle.checked){
    document.body.classList.add("whatif-mode");
    resetBtn.disabled = false;
  }

  function setOverlayValue(slider, value){
    const offValue = parseFloat(slider.getAttribute("data-off-value"));
    const val = value == null ? offValue : parseFloat(value);
    slider.value = Number.isFinite(val) ? val : offValue;
    const baseId = slider.dataset.baseId;
    if(Math.abs(slider.value - offValue) < EPS){
      slider.classList.remove("active");
      updateSliderVisual(baseId);
      return;
    }
    slider.classList.add("active");
    updateSliderVisual(baseId);
  }

  function refreshSliders(){
    document.querySelectorAll(".dual-slider__base").forEach(base=>{
      updateSliderVisual(base.id);
    });
  }

  function updateSliderVisual(baseId){
    const base = document.getElementById(baseId);
    const overlay = document.getElementById(`${baseId}_whatif`);
    const deltaBar = document.getElementById(`${baseId}_whatif_delta`);
    const label = document.getElementById(`${baseId}_whatif_val`);
    if(!base || !overlay || !deltaBar || !label) return;
    const valueEl = label.querySelector(".whatif-val__value");
    const deltaEl = label.querySelector(".whatif-val__delta");

    const min = parseFloat(base.min ?? overlay.min ?? 0);
    const max = parseFloat(base.max ?? overlay.max ?? 1);
    const baseVal = parseFloat(base.value);
    const offValue = parseFloat(overlay.getAttribute("data-off-value"));
    const whatVal = overlay.classList.contains("active") ? parseFloat(overlay.value) : offValue;
    const inWhatIfMode = toggle.checked && document.body.classList.contains("whatif-mode");
    const isActive = inWhatIfMode && overlay.classList.contains("active") && Math.abs(whatVal - offValue) > EPS;

    const baselineColor = getCssVar("--blue", "#56B4E9");
    const basePct = ((baseVal - min)/(max - min))*100;
    const neutral = getCssVar("--white", getCssVar("--track-neutral", getCssVar("--panel-hover", "#1a1f2b")));
    const baseGradient = `linear-gradient(to right, ${baselineColor} 0%, ${baselineColor} ${basePct}%, ${neutral} ${basePct}%, ${neutral} 100%)`;
    base.style.background = baseGradient;

    overlay.classList.toggle("active-thumb", isActive);

    if(!isActive){
      overlay.style.background = "transparent";
      deltaBar.style.display = "none";
      if(valueEl){
        valueEl.textContent = "Off";
        valueEl.classList.add("is-off");
      }
      if(deltaEl){
        deltaEl.innerHTML = '<span class="delta-label" title="Show change Δ">Δ</span> —';
      }
      return;
    }

    const deltaColor = getCssVar("--orange", "#E69F00");
    const whatPct = ((whatVal - min)/(max - min))*100;
    const start = Math.min(basePct, whatPct);
    let end = Math.max(basePct, whatPct);
    if(end - start < 0.001) end = start + 0.001;
    const pct = (val)=>`${val.toFixed(4)}%`;
    overlay.style.background = `linear-gradient(to right, transparent 0%, transparent ${pct(start)}, ${deltaColor} ${pct(start)}, ${deltaColor} ${pct(end)}, transparent ${pct(end)}, transparent 100%)`;

    deltaBar.style.display = "block";
    deltaBar.style.left = `${start}%`;
    deltaBar.style.width = `${Math.max(end - start, 0.001)}%`;
    deltaBar.style.background = deltaColor;

    const delta = whatVal - baseVal;
    const formatter = (typeof window !== "undefined" && typeof window.formatSliderValue === "function")
      ? window.formatSliderValue
      : null;
    const formatted = formatter
      ? formatter(baseId, whatVal)
      : whatVal.toFixed(4);
    const step = parseFloat(base.step) || 0.01;
    let precision = 3;
    if(step < 0.00001) precision = 6;
    else if(step < 0.0001) precision = 5;
    else if(step < 0.001) precision = 4;
    else if(step < 0.01) precision = 3;
    else precision = 2;
    const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(precision)}`;
    if(valueEl){
      valueEl.textContent = formatted;
      valueEl.classList.remove("is-off");
    }
    if(deltaEl){
      deltaEl.innerHTML = `<span class="delta-label" title="Show change Δ">Δ</span> <span class="delta">${deltaText}</span>`;
    }
  }

  const sliders = document.querySelectorAll(".controls-panel input[type=range]");
  sliders.forEach(slider=>{
    if(slider.id === "model_order") return;
    if(slider.dataset.whatifReady) return;
    slider.dataset.whatifReady = "1";
    const wrap = document.createElement("div");
    wrap.className = "dual-slider";
    slider.parentNode.insertBefore(wrap, slider);
    const base = slider;
    base.classList.add("dual-slider__base");
    wrap.appendChild(base);

    const deltaBar = document.createElement("div");
    deltaBar.className = "dual-slider__delta";
    deltaBar.id = `${base.id}_whatif_delta`;
    wrap.appendChild(deltaBar);

    const overlay = slider.cloneNode(true);
    overlay.id = `${base.id}_whatif`;
    overlay.classList.add("dual-slider__overlay");
    const offVal = overlay.min || base.min || base.value;
    overlay.value = offVal;
    overlay.setAttribute("data-off-value", offVal);
    overlay.dataset.baseId = base.id;
    overlay.addEventListener("pointerdown", ()=>ensureEnabled());
    overlay.addEventListener("input", ()=>{
      ensureEnabled();
      const offValue = parseFloat(overlay.getAttribute("data-off-value"));
      const current = parseFloat(overlay.value);
      const epsilon = Math.max(0.000001, (parseFloat(overlay.step) || 0.0001) * 0.5);
      if(Math.abs(current - offValue) <= epsilon){
        setOverlayValue(overlay, offValue);
        if(window.render) window.render();
        return;
      }
      overlay.classList.add("active");
      updateSliderVisual(base.id);
      if(window.render) window.render();
    });
    wrap.appendChild(overlay);

    const info = document.createElement("div");
    info.className = "whatif-val";
    info.id = `${base.id}_whatif_val`;
    info.innerHTML = `
      <div class="whatif-val__row">
        <span class="whatif-val__delta"><span class="delta-label" title="Show change Δ">Δ</span> —</span>
        <span class="whatif-val__value is-off">Off</span>
      </div>
    `;
    wrap.insertAdjacentElement("beforebegin", info);
    base.addEventListener("input", ()=>updateSliderVisual(base.id));
  });

  refreshSliders();
  window.resetWhatIfOverlays = resetWhatIf;
})();
