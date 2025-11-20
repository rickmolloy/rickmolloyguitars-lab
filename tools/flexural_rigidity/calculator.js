(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FlexuralRigidity = exports.Shapes = void 0;
    exports.shapeProperties = shapeProperties;
    exports.computeInterceptBreadth = computeInterceptBreadth;
    exports.computeBraceTransformed = computeBraceTransformed;
    exports.computeTopSection = computeTopSection;
    exports.computeSlice = computeSlice;
    exports.Shapes = {
        RECTANGLE: "rectangle",
        TRIANGLE: "triangle",
        PARABOLIC: "parabolic",
        NONE: "none"
    };
    function assertPositive(value, label) {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
            throw new Error(`${label} must be a finite, positive number.`);
        }
    }
    function degToRad(deg) {
        return (deg * Math.PI) / 180;
    }
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    function shapeProperties(shape, breadth, height) {
        if (shape === exports.Shapes.NONE)
            return { area: 0, centroid: 0, I: 0 };
        assertPositive(breadth, "breadth");
        assertPositive(height, "height");
        switch (shape) {
            case exports.Shapes.RECTANGLE: {
                const area = breadth * height;
                const centroid = height / 2;
                const I = (breadth * height ** 3) / 12;
                return { area, centroid, I };
            }
            case exports.Shapes.TRIANGLE: {
                const area = (breadth * height) / 2;
                const centroid = height / 3;
                const I = (breadth * height ** 3) / 36;
                return { area, centroid, I };
            }
            case exports.Shapes.PARABOLIC: {
                const area = (2 / 3) * breadth * height;
                const centroid = (3 / 8) * height;
                const I = (19 / 480) * breadth * height ** 3;
                return { area, centroid, I };
            }
            default:
                throw new Error(`Unsupported shape: ${shape}`);
        }
    }
    function computeInterceptBreadth(brace, spanAA) {
        var _a, _b;
        assertPositive(spanAA, "AA span");
        if (brace.b) {
            assertPositive(brace.b, "brace breadth b");
            return clamp(brace.b, 0, spanAA);
        }
        assertPositive(brace.w_plan, "brace plan width");
        const phiDeg = (_b = (_a = brace.phi_deg) !== null && _a !== void 0 ? _a : brace.phiDeg) !== null && _b !== void 0 ? _b : brace.phi;
        assertPositive(phiDeg, "brace angle");
        const sinPhi = Math.sin(degToRad(phiDeg));
        if (Math.abs(sinPhi) < 1e-3) {
            throw new Error("Brace angle too shallow; enter intercept breadth b directly.");
        }
        const bRaw = brace.w_plan / Math.abs(sinPhi);
        return clamp(bRaw, 0, spanAA);
    }
    function computeBraceTransformed(brace, spanAA, ETop) {
        var _a, _b, _c, _d, _e;
        assertPositive(ETop, "top modulus");
        const breadth = computeInterceptBreadth(brace, spanAA);
        const segments = [];
        const stack = [
            brace.bottom && { ...brace.bottom, label: "bottom" },
            brace.middle && { ...brace.middle, label: "middle" },
            brace.top && { ...brace.top, label: "top" }
        ].filter(Boolean);
        let runningBase = 0;
        let transformedArea = 0;
        let transformedCentroidNumerator = 0;
        const transformedMoments = [];
        for (const segment of stack) {
            const shape = (_a = segment.shape) !== null && _a !== void 0 ? _a : exports.Shapes.NONE;
            const height = (_c = (_b = segment.h) !== null && _b !== void 0 ? _b : segment.height) !== null && _c !== void 0 ? _c : 0;
            if (height <= 0 || shape === exports.Shapes.NONE) {
                continue;
            }
            const props = shapeProperties(shape, breadth, height);
            const yAbs = runningBase + props.centroid;
            const Eseg = (_e = (_d = segment.material) === null || _d === void 0 ? void 0 : _d.E) !== null && _e !== void 0 ? _e : segment.E;
            assertPositive(Eseg, `${segment.label || "segment"} modulus`);
            const modularRatio = Eseg / ETop;
            const APrime = modularRatio * props.area;
            const IPrime = modularRatio * props.I;
            transformedArea += APrime;
            transformedCentroidNumerator += APrime * yAbs;
            transformedMoments.push({ APrime, IPrime, yAbs });
            segments.push({
                label: segment.label,
                shape,
                height,
                breadth,
                area: props.area,
                centroid: yAbs,
                I: props.I,
                modularRatio,
                APrime,
                IPrime
            });
            runningBase += height;
        }
        if (transformedArea === 0) {
            throw new Error("Brace has no active segments.");
        }
        const yBar = transformedCentroidNumerator / transformedArea;
        let ITransformed = 0;
        for (const entry of transformedMoments) {
            const dy = yBar - entry.yAbs;
            ITransformed += entry.IPrime + entry.APrime * dy ** 2;
        }
        return {
            breadth,
            height: runningBase,
            transformedArea,
            transformedCentroid: yBar,
            transformedI: ITransformed,
            segments
        };
    }
    function computeTopSection(spanAA, thickness) {
        assertPositive(spanAA, "AA span");
        assertPositive(thickness, "top thickness");
        const area = spanAA * thickness;
        const centroid = thickness / 2;
        const I = (spanAA * thickness ** 3) / 12;
        return { area, centroid, I };
    }
    function computeSlice(params) {
        const { spanAA, topThickness, topModulus, braces = [] } = params;
        assertPositive(topModulus, "top modulus");
        const top = computeTopSection(spanAA, topThickness);
        const braceResults = braces.map(brace => computeBraceTransformed(brace, spanAA, topModulus));
        const totalTransformedArea = braceResults.reduce((sum, brace) => sum + brace.transformedArea, top.area);
        const centroidNumerator = top.area * top.centroid +
            braceResults.reduce((sum, brace) => sum + brace.transformedArea * brace.transformedCentroid, 0);
        const yBar = centroidNumerator / totalTransformedArea;
        let ITransformed = top.I + top.area * (yBar - top.centroid) ** 2;
        for (const brace of braceResults) {
            const dy = yBar - brace.transformedCentroid;
            ITransformed += brace.transformedI + brace.transformedArea * dy ** 2;
        }
        const EI = topModulus * ITransformed;
        return {
            centroid: yBar,
            transformedI: ITransformed,
            EI,
            top,
            braces: braceResults
        };
    }
    exports.FlexuralRigidity = {
        Shapes: exports.Shapes,
        shapeProperties,
        computeInterceptBreadth,
        computeBraceTransformed,
        computeTopSection,
        computeSlice,
        clamp,
        degToRad
    };
    exports.default = exports.FlexuralRigidity;
    if (typeof window !== "undefined") {
        window.FlexuralRigidity = exports.FlexuralRigidity;
    }
    if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
        module.exports = exports.FlexuralRigidity;
    }
});
