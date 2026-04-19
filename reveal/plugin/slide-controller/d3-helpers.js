// ============================================================
// SlideController — d3 helpers (optional)
// ============================================================
// Opt-in animation helpers for decks that use d3 / SVG / anime.js.
// Load this AFTER slide-controller/index.js and AFTER d3 (+ anime,
// if you plan to call morphPaths) are on window.
//
// Extends window.SlideController with:
//   show(slideId, selection, method?)
//   hide(selection, method?)
//   sel(containerId, svgId?)
//   loadSVG(containerSelector, svgPath, svgId, viewBox?, onLoad?)
//   animatePath(d, i)       — d3 .each() helper, bounce easing
//   animatePathLin(d, i)    — d3 .each() helper, cubic easing
//   animatePathLin2(d, i)   — d3 .each() helper, linear easing + auto-hide
//   animateImg(d, i)        — d3 .each() helper, SVG <image> height bounce
//   morphPaths(pathFrom, pathTo, duration?) — anime.js path morph
//
// Side effect: wraps the core's registerReset so any selection passed
// through show() is hidden automatically on R, in addition to the user's
// registered reset. This uses SlideController._internal.shown as the
// bookkeeping map — that field is plugin-private, not a public API.
// ============================================================

(function () {
    'use strict';

    if (typeof window.SlideController === 'undefined') {
        console.warn('[slide-controller/d3-helpers] core not loaded; skipping');
        return;
    }
    if (typeof d3 === 'undefined') {
        console.warn('[slide-controller/d3-helpers] d3 not on window; skipping');
        return;
    }

    /** slideId → [{ sel, method }]. Lazily populated by show(). */
    var shown = window.SlideController._internal.shown;

    /**
     * Make a d3 selection visible and record it for reset.
     * Chainable: returns the selection so callers can .each(animatePath) etc.
     *
     * @param {string} slideId Owning slide id — tracks reset scope.
     * @param {d3.Selection} selection
     * @param {'style'|'attr'} [method='style'] Which visibility knob to touch.
     */
    function show(slideId, selection, method) {
        method = method || 'style';
        if (method === 'attr') {
            selection.attr('visibility', 'visible');
        } else {
            selection.style('visibility', 'visible');
        }
        (shown[slideId] = shown[slideId] || []).push({ sel: selection, method: method });
        return selection;
    }

    /**
     * Hide a d3 selection without touching the reset bookkeeping.
     * Use directly when you've made something visible without show().
     */
    function hide(selection, method) {
        method = method || 'style';
        if (method === 'attr') {
            selection.attr('visibility', 'hidden');
        } else {
            selection.style('visibility', 'hidden');
        }
    }

    /**
     * Shorthand for `d3.select('#container').select('#svg')`.
     * If `svgId` is omitted, returns just the container selection.
     */
    function sel(containerId, svgId) {
        if (svgId) return d3.select('#' + containerId).select('#' + svgId);
        return d3.select('#' + containerId);
    }

    /**
     * Fetch an SVG file and append it to `containerSelector`, pre-configured
     * for use in a slide: 100% width/height, optional viewBox, hidden by
     * default. The `#defs` group (if present) is made visible immediately
     * so linearGradients/filters/patterns defined there work.
     *
     * @param {string} containerSelector CSS selector for the host element.
     * @param {string} svgPath URL of the SVG file.
     * @param {string} svgId id attribute of the loaded SVG's root element.
     * @param {string} [viewBox] Optional viewBox override.
     * @param {(svg: d3.Selection) => void} [onLoad] Post-load callback.
     */
    function loadSVG(containerSelector, svgPath, svgId, viewBox, onLoad) {
        d3.svg(svgPath).then(function (data) {
            d3.select(containerSelector).node().append(data.documentElement);
            var svg = d3.select(containerSelector).select('#' + svgId);
            svg.attr('width', '100%').attr('height', '100%');
            if (viewBox) svg.attr('viewBox', viewBox);
            svg.attr('visibility', 'hidden');
            var defs = svg.select('#defs');
            if (!defs.empty()) defs.attr('visibility', 'visible');
            if (onLoad) onLoad(svg);
        });
    }

    /**
     * d3 `.each()` helper: draw a path over 700ms with bounce easing,
     * staggered by 100ms × index.
     */
    function animatePath(d, i) {
        i = i || 0;
        var path = d3.select(this);
        var totalLength = path.node().getTotalLength();
        path
            .style('stroke-dasharray', totalLength + ' ' + totalLength)
            .style('stroke-dashoffset', totalLength)
            .transition()
            .duration(700)
            .delay(200 + (100 * i))
            .style('stroke-dashoffset', 0)
            .ease(d3.easeBounceOut);
    }

    /**
     * d3 `.each()` helper: same timing as animatePath but cubic easing,
     * and sets visibility visible as it animates.
     */
    function animatePathLin(d, i) {
        i = i || 0;
        var path = d3.select(this);
        var totalLength = path.node().getTotalLength();
        path
            .style('stroke-dasharray', totalLength + ' ' + totalLength)
            .style('stroke-dashoffset', totalLength)
            .transition()
            .duration(700)
            .delay(200 + (100 * i))
            .style('visibility', 'visible')
            .style('stroke-dashoffset', 0)
            .ease(d3.easeCubic);
    }

    /**
     * d3 `.each()` helper: linear-easing path draw over 1s that
     * auto-hides itself on `end`. Useful for sequential reveals where
     * you want each path to disappear as the next one starts.
     */
    function animatePathLin2(d, i) {
        i = i || 0;
        var path = d3.select(this);
        var totalLength = path.node().getTotalLength();
        path
            .style('stroke-dasharray', totalLength + ' ' + totalLength)
            .style('stroke-dashoffset', totalLength)
            .transition()
            .duration(1000)
            .delay(1000 * i)
            .style('visibility', 'visible')
            .style('stroke-dashoffset', 0)
            .ease(d3.easeLinear)
            .on('end', function () {
                d3.select(this).style('visibility', 'hidden');
            });
    }

    /**
     * d3 `.each()` helper: animate an SVG `<image>`'s height from 0 to
     * its `height` attribute, bouncing in.
     */
    function animateImg(d, i) {
        i = i || 0;
        var el = d3.select(this);
        var h = el.attr('height');
        el.style('height', 0)
            .transition()
            .delay(500 + (100 * i))
            .duration(200 + (100 * i))
            .ease(d3.easeBounce)
            .style('height', h);
    }

    /**
     * Morph one path's `d` into another's using anime.js.
     * NOTE: targets `#scan-outline-2` — this is carried over from the
     * original deck the plugin was authored for. Treat as an escape
     * hatch rather than a general-purpose helper.
     */
    function morphPaths(pathFrom, pathTo, duration) {
        if (typeof anime === 'undefined') {
            console.warn('[slide-controller/d3-helpers] morphPaths requires anime.js');
            return;
        }
        duration = duration || 250;
        anime({
            targets: '#scan-outline-2',
            d: [pathFrom.attr('d'), pathTo.attr('d')],
            duration: duration,
            delay: duration,
            loop: false,
            direction: 'alternate',
            easing: 'linear',
        });
    }

    // Wrap registerReset so every d3-tracked show() is hidden on reset,
    // then the user's custom reset runs on top. This is the mechanism
    // that keeps decks ergonomic: authors call show() freely without
    // thinking about reset bookkeeping.
    var coreRegisterReset = window.SlideController.registerReset;
    window.SlideController.registerReset = function (slideId, fn) {
        coreRegisterReset(slideId, function (id) {
            (shown[id] || []).forEach(function (entry) { hide(entry.sel, entry.method); });
            shown[id] = [];
            if (fn) fn(id);
        });
    };

    // Auto-register a d3-aware reset the first time show() is used on a
    // slide, so decks that call show() but never call registerReset still
    // get their tracked selections hidden on R.
    function showAndTrack(slideId, selection, method) {
        if (!shown[slideId]) {
            window.SlideController.registerReset(slideId, null);
        }
        return show(slideId, selection, method);
    }

    window.SlideController.show = showAndTrack;
    window.SlideController.hide = hide;
    window.SlideController.sel = sel;
    window.SlideController.loadSVG = loadSVG;
    window.SlideController.animatePath = animatePath;
    window.SlideController.animatePathLin = animatePathLin;
    window.SlideController.animatePathLin2 = animatePathLin2;
    window.SlideController.animateImg = animateImg;
    window.SlideController.morphPaths = morphPaths;
})();
