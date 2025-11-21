"use strict";
(function initFlexuralRigidityUI() {
    const calculator = window.FlexuralRigidity;
    if (!calculator) {
        throw new Error("FlexuralRigidity calculator is unavailable. Ensure calculator.js is loaded first.");
    }
    const calc = calculator;
    const defaults = {
        spanAA: 500,
        topThickness: 4,
        topModulus: 10,
        brace_b: 20,
        brace_count: 2,
        brace_angle: 0,
        bottom_h: 5,
        middle_h: 5,
        top_h: 7,
        top_shape: "triangle",
        brace_modulus: 12,
        bridge_moment: 12,
        bridge_limit: 2
    };
    const fields = {};
    document.querySelectorAll("[data-field]").forEach(element => {
        const key = element.dataset.field;
        if (key)
            fields[key] = element;
    });
    const resultEls = {
        EI: requireElement("result_ei"),
        I: requireElement("result_I"),
        centroid: requireElement("result_centroid"),
        braceHeight: requireElement("result_brace_height"),
        rotation: requireElement("result_rotation"),
        rotationStatus: requireElement("result_rotation_status"),
        status: requireElement("result_status")
    };
    const vizEls = {
        svg: requireElement("aa_view"),
        axisX: requireElement("viz_axis_x"),
        axisY: requireElement("viz_axis_y"),
        spanLine: requireElement("viz_span_line"),
        top: requireElement("viz_top"),
        bracesGroup: requireElement("viz_braces"),
        centroid: requireElement("viz_centroid"),
        status: requireElement("viz_status")
    };
    function requireElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Missing element with id ${id}`);
        }
        return element;
    }
    function parseNumber(value) {
        if (value == null || value.trim() === "")
            return NaN;
        const num = Number(value);
        return Number.isFinite(num) ? num : NaN;
    }
    function numberOrDefault(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }
    function readInputs() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return {
            spanAA: parseNumber((_a = fields.spanAA) === null || _a === void 0 ? void 0 : _a.value),
            topThickness: parseNumber((_b = fields.topThickness) === null || _b === void 0 ? void 0 : _b.value),
            topModulus: parseNumber((_c = fields.topModulus) === null || _c === void 0 ? void 0 : _c.value),
            brace_b: parseNumber((_d = fields.brace_b) === null || _d === void 0 ? void 0 : _d.value),
            brace_count: parseNumber((_e = fields.brace_count) === null || _e === void 0 ? void 0 : _e.value),
            brace_angle: parseNumber((_f = fields.brace_angle) === null || _f === void 0 ? void 0 : _f.value),
            bottom_h: parseNumber((_g = fields.bottom_h) === null || _g === void 0 ? void 0 : _g.value),
            middle_h: parseNumber((_h = fields.middle_h) === null || _h === void 0 ? void 0 : _h.value),
            top_h: parseNumber((_j = fields.top_h) === null || _j === void 0 ? void 0 : _j.value),
            top_shape: ((_k = fields.top_shape) === null || _k === void 0 ? void 0 : _k.value) || defaults.top_shape,
            brace_modulus: parseNumber((_l = fields.brace_modulus) === null || _l === void 0 ? void 0 : _l.value),
            bridge_moment: parseNumber((_m = fields.bridge_moment) === null || _m === void 0 ? void 0 : _m.value),
            bridge_limit: parseNumber((_o = fields.bridge_limit) === null || _o === void 0 ? void 0 : _o.value)
        };
    }
    const shapeSet = new Set(Object.values(calc.Shapes));
    function normalizeShape(value) {
        return shapeSet.has(value) ? value : calc.Shapes.NONE;
    }
    function buildBrace(values) {
        const braceModulusNmm2 = numberOrDefault(values.brace_modulus, defaults.brace_modulus) * 1000;
        const planWidth = numberOrDefault(values.brace_b, defaults.brace_b);
        const rawAngle = Number.isFinite(values.brace_angle) ? values.brace_angle : 0;
        const angleFromPerp = calc.clamp(rawAngle, 0, 89.9);
        const phiDeg = 90 - angleFromPerp;
        return {
            w_plan: planWidth,
            phi_deg: phiDeg,
            bottom: { shape: calc.Shapes.RECTANGLE, h: numberOrDefault(values.bottom_h, defaults.bottom_h), material: { E: braceModulusNmm2 } },
            middle: { shape: calc.Shapes.RECTANGLE, h: numberOrDefault(values.middle_h, defaults.middle_h), material: { E: braceModulusNmm2 } },
            top: { shape: normalizeShape(values.top_shape), h: numberOrDefault(values.top_h, defaults.top_h), material: { E: braceModulusNmm2 } }
        };
    }
    function computeBraceOffsets(span, braceWidth, count) {
        const spanValue = Number.isFinite(span) ? span : defaults.spanAA;
        const width = Number.isFinite(braceWidth) ? braceWidth : defaults.brace_b;
        const n = Math.max(1, count);
        const halfSpan = spanValue / 2;
        const totalBraceWidth = width * n;
        if (totalBraceWidth >= spanValue) {
            const start = -halfSpan + width / 2;
            return Array.from({ length: n }, (_, index) => start + index * width);
        }
        const gap = (spanValue - totalBraceWidth) / (n + 1);
        const start = -halfSpan + gap + width / 2;
        const step = width + gap;
        return Array.from({ length: n }, (_, index) => start + index * step);
    }
    function resolveBraceCount(raw) {
        return Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 1;
    }
    function buildBraceSet(values) {
        const count = resolveBraceCount(values.brace_count);
        return {
            models: Array.from({ length: count }, () => buildBrace(values)),
            offsets: computeBraceOffsets(values.spanAA, values.brace_b, count)
        };
    }
    function computeRotation(values, EI) {
        const momentNmm = numberOrDefault(values.bridge_moment, defaults.bridge_moment) * 1e3;
        const safeEI = EI > 0 ? EI : Number.EPSILON;
        const rotationDeg = momentNmm / safeEI * (180 / Math.PI);
        const limit = values.bridge_limit;
        const rotationPass = Number.isFinite(limit) ? rotationDeg <= limit : true;
        return { rotationDeg, rotationPass };
    }
    function buildVizState(values, offsets, slice) {
        return {
            span: numberOrDefault(values.spanAA, defaults.spanAA),
            topThickness: numberOrDefault(values.topThickness, defaults.topThickness),
            braces: offsets.map((offset, index) => {
                var _a, _b, _c, _d;
                return ({
                    offset,
                    height: (_d = (_b = (_a = slice.braces[index]) === null || _a === void 0 ? void 0 : _a.height) !== null && _b !== void 0 ? _b : (_c = slice.braces[0]) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 0,
                    width: numberOrDefault(values.brace_b, defaults.brace_b)
                });
            })
        };
    }
    function annotateBraceRigidity(values, slice) {
        const modulus = numberOrDefault(values.topModulus, defaults.topModulus) * 1000;
        const annotated = slice.braces.map((brace, index) => {
            const EIbrace = modulus * brace.transformedI;
            console.debug(`[FlexuralRigidity] Brace ${index + 1} EI: ${EIbrace.toFixed(2)} N·mm²`);
            return { ...brace, EI: EIbrace };
        });
        return { ...slice, braces: annotated };
    }
    function format(value, digits = 2) {
        if (!Number.isFinite(value))
            return "—";
        return new Intl.NumberFormat("en-US", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }).format(value);
    }
    function setResults(slice) {
        var _a;
        const eiNm2 = slice.EI / 1e6;
        resultEls.EI.textContent = format(eiNm2, 3);
        resultEls.I.textContent = format(slice.transformedI, 1);
        resultEls.centroid.textContent = `${format(slice.centroid, 2)} mm`;
        const braceHeight = (_a = slice.braces[0]) === null || _a === void 0 ? void 0 : _a.height;
        resultEls.braceHeight.textContent = braceHeight ? `${format(braceHeight, 1)} mm` : "—";
        if (slice.rotationDeg != null) {
            resultEls.rotation.textContent = `${format(slice.rotationDeg, 3)} °`;
            resultEls.rotationStatus.textContent = slice.rotationPass ? "OK" : "Over limit";
            resultEls.rotationStatus.style.color = slice.rotationPass ? "var(--muted)" : "var(--orange)";
        }
        else {
            resultEls.rotation.textContent = "—";
            resultEls.rotationStatus.textContent = "—";
            resultEls.rotationStatus.style.color = "var(--muted)";
        }
        resultEls.status.textContent = "Live: computed from current inputs.";
    }
    function setError(message) {
        resultEls.EI.textContent = "—";
        resultEls.I.textContent = "—";
        resultEls.centroid.textContent = "—";
        resultEls.braceHeight.textContent = "—";
        resultEls.rotation.textContent = "—";
        resultEls.rotationStatus.textContent = "—";
        resultEls.rotationStatus.style.color = "var(--muted)";
        resultEls.status.textContent = message;
    }
    function run() {
        try {
            const values = readInputs();
            const { models: braceModels, offsets } = buildBraceSet(values);
            const slice = calc.computeSlice({
                spanAA: numberOrDefault(values.spanAA, defaults.spanAA),
                topThickness: numberOrDefault(values.topThickness, defaults.topThickness),
                topModulus: numberOrDefault(values.topModulus, defaults.topModulus) * 1000,
                braces: braceModels
            });
            const { rotationDeg, rotationPass } = computeRotation(values, slice.EI);
            const sliceWithRigidity = annotateBraceRigidity(values, slice);
            const vizState = buildVizState(values, offsets, sliceWithRigidity);
            setResults({ ...sliceWithRigidity, rotationDeg, rotationPass });
            renderViz(vizState, sliceWithRigidity);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setError(message);
        }
    }
    document.querySelectorAll("input[data-field], select[data-field]").forEach(element => {
        const eventType = element.tagName === "SELECT" ? "change" : "input";
        element.addEventListener(eventType, () => run());
    });
    function reset() {
        Object.entries(defaults).forEach(([key, value]) => {
            const field = fields[key];
            if (!field)
                return;
            if (field instanceof HTMLSelectElement) {
                field.value = String(value);
            }
            else {
                field.value = String(value);
            }
        });
        run();
    }
    reset();
    function renderViz(dimensions, slice) {
        const width = 700;
        const padding = 24;
        const span = Math.max(dimensions.span || 1, 1);
        const baseSpan = span <= 500 ? 500 : span * 1.2;
        const topH = Math.max(dimensions.topThickness || 0, 0);
        const braceHeights = dimensions.braces.map(b => Math.max(b.height || 0, 0));
        const maxBraceH = braceHeights.length ? Math.max(...braceHeights) : 0;
        const totalH = Math.max(topH + maxBraceH, 1);
        const baseScale = (width - 2 * padding) / baseSpan;
        const scaleX = baseScale;
        const scaleY = baseScale;
        const spanPx = span * scaleX;
        const spanDraw = Math.min(spanPx, width - 2 * padding);
        const offsetX = (width - spanDraw) / 2;
        const viewHeight = padding * 2 + Math.max(totalH * scaleY, padding);
        vizEls.svg.setAttribute("viewBox", `0 0 ${width} ${viewHeight}`);
        vizEls.svg.style.height = `${viewHeight}px`;
        const baseY = viewHeight - padding;
        vizEls.spanLine.setAttribute("x1", offsetX.toString());
        vizEls.spanLine.setAttribute("x2", (offsetX + spanDraw).toString());
        vizEls.spanLine.setAttribute("y1", baseY.toString());
        vizEls.spanLine.setAttribute("y2", baseY.toString());
        vizEls.axisX.setAttribute("x1", offsetX.toString());
        vizEls.axisX.setAttribute("x2", (offsetX + spanDraw).toString());
        vizEls.axisX.setAttribute("y1", baseY.toString());
        vizEls.axisX.setAttribute("y2", baseY.toString());
        vizEls.axisY.setAttribute("x1", offsetX.toString());
        vizEls.axisY.setAttribute("x2", offsetX.toString());
        vizEls.axisY.setAttribute("y1", baseY.toString());
        vizEls.axisY.setAttribute("y2", (baseY - totalH * scaleY).toString());
        const topY = baseY - topH * scaleY;
        vizEls.top.setAttribute("x", offsetX.toString());
        vizEls.top.setAttribute("y", topY.toString());
        vizEls.top.setAttribute("width", spanDraw.toString());
        vizEls.top.setAttribute("height", Math.max(topH * scaleY, 1).toString());
        vizEls.bracesGroup.replaceChildren();
        const centerX = offsetX + spanDraw / 2;
        dimensions.braces.forEach(brace => {
            const widthPx = (brace.width || 0) * scaleX;
            const heightPx = (brace.height || 0) * scaleY;
            const x = centerX + (brace.offset || 0) * scaleX - widthPx / 2;
            const y = topY - heightPx;
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", x.toString());
            rect.setAttribute("y", y.toString());
            rect.setAttribute("width", Math.max(widthPx, 1).toString());
            rect.setAttribute("height", Math.max(heightPx, 1).toString());
            rect.setAttribute("fill", "var(--blue)");
            rect.setAttribute("fill-opacity", "0.55");
            rect.setAttribute("stroke", "var(--border-soft)");
            vizEls.bracesGroup.appendChild(rect);
        });
        const centroidY = baseY - (slice.centroid || 0) * scaleY;
        vizEls.centroid.setAttribute("x1", offsetX.toString());
        vizEls.centroid.setAttribute("x2", (offsetX + spanDraw).toString());
        vizEls.centroid.setAttribute("y1", centroidY.toString());
        vizEls.centroid.setAttribute("y2", centroidY.toString());
        const reference = span <= 500 ? "500 mm reference" : `${format(baseSpan, 0)} mm span (+20%)`;
        vizEls.status.textContent = `Span: ${format(span, 0)} mm (${reference}) · Total height: ${format(totalH, 1)} mm · Braces: ${dimensions.braces.length}`;
    }
})();
