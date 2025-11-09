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

/*
Shared solver core is now centralized in /tools/common/solver_core.js.
This file bridges the legacy 4DOF entry point to the shared module so
existing script tags keep working while other views can reuse the same kernel.
*/

(function bootstrap(globalScope) {
  const getShared = () => {
    if (globalScope && globalScope.SolverCore) return globalScope.SolverCore;
    if (typeof require === "function") {
      try {
        return require("../solver_core.js");
      } catch {
        // ignore, handled below
      }
    }
    return null;
  };

  const shared = getShared();
  if (!shared) {
    throw new Error("Missing shared solver core. Ensure tools/common/solver_core.js is loaded first.");
  }

  // Preserve legacy globals (fmt, computeResponse, etc.) for existing scripts.
  if (globalScope) {
    Object.keys(shared).forEach(key => {
      if (key === "constants") return;
      globalScope[key] = shared[key];
    });
    globalScope.ModelCore = shared;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = shared;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
