// ============================================================
// SlideController — core
// ============================================================
// Declarative, per-slide step controller for Reveal.js.
//
// A deck's deck.js calls registerSlide(slideId, [step1, step2, ...])
// to attach an ordered list of step functions to a slide. Pressing
// Enter on that slide runs the next step; pressing R resets.
//
// The core has no dependencies beyond reveal.js + the DOM.
// Animation helpers that depend on d3 / anime.js live in the
// optional d3-helpers.js sibling file (load it only when needed).
//
// Public API (window.SlideController):
//   registerSlide(slideId, steps, { replace? })
//   registerReset(slideId, fn)
//   registerSlideInit(slideId, fn)
//   getSlideId() → string|null
//
// Key bindings (installed on Reveal's 'ready' event):
//   Enter → advance one step on the current slide
//   R     → reset the current slide
// ============================================================

(function () {
    'use strict';

    /** slideId → ordered list of step functions `(slideId) => void`. */
    var slideAnimations = {};
    /** slideId → user-registered reset function `(slideId) => void`. */
    var slideResetExtras = {};
    /** slideId → 1-based index of the NEXT step to run. */
    var progress = {};
    /**
     * slideId → opaque entries used by helper plugins to undo side-effects
     * on reset. The core never reads this; d3-helpers owns its format.
     */
    var shown = {};

    /**
     * Return the current slide's id.
     * Resolution order: `<section id>` first, then the first child `<div>`'s
     * id (for decks that wrap content in a named container).
     *
     * @returns {string|null}
     */
    function getSlideId() {
        var slide = Reveal.getCurrentSlide();
        if (!slide) return null;
        return slide.id || slide.getElementsByTagName('div')[0]?.id || null;
    }

    /**
     * Attach step functions to a slide.
     * By default, new steps are appended to any existing registration (so a
     * helper plugin can seed steps that a deck's deck.js then extends).
     * Pass `{ replace: true }` to overwrite.
     *
     * @param {string} slideId
     * @param {Array<(slideId: string) => void>} steps
     * @param {{ replace?: boolean }} [opts]
     */
    function registerSlide(slideId, steps, opts) {
        opts = opts || {};
        if (opts.replace || !slideAnimations[slideId]) {
            slideAnimations[slideId] = steps;
        } else {
            slideAnimations[slideId] = slideAnimations[slideId].concat(steps);
        }
    }

    /**
     * Register a reset function that runs when the user presses R on `slideId`.
     * Called after the core's progress counter is reset to 1.
     *
     * @param {string} slideId
     * @param {(slideId: string) => void} fn
     */
    function registerReset(slideId, fn) {
        slideResetExtras[slideId] = fn;
    }

    /**
     * Run `fn` exactly once, the first time `slideId` becomes visible.
     * Useful for expensive setup (loading an SVG, starting a video) that
     * shouldn't happen on page load.
     *
     * @param {string} slideId
     * @param {() => void} fn
     */
    function registerSlideInit(slideId, fn) {
        var called = false;
        Reveal.addEventListener('slidechanged', function (event) {
            var slide = event.currentSlide;
            var id = slide.id || slide.getElementsByTagName('div')[0]?.id;
            if (id === slideId && !called) {
                called = true;
                fn();
            }
        });
    }

    /** Enter-key handler: advance one step on the current slide. */
    function onEnter() {
        var slideId = getSlideId();
        if (!slideId) return;
        var steps = slideAnimations[slideId];
        if (!steps) return;

        var step = progress[slideId] || 1;
        if (step > steps.length) return;

        steps[step - 1](slideId);
        progress[slideId] = step + 1;
    }

    /** R-key handler: reset the current slide's progress counter + run extras. */
    function onReset() {
        var slideId = getSlideId();
        if (!slideId) return;
        progress[slideId] = 1;
        if (slideResetExtras[slideId]) {
            slideResetExtras[slideId](slideId);
        }
    }

    /** One-shot init: bind Enter and R via Reveal's keybinding API. */
    function init() {
        Reveal.addKeyBinding(
            { keyCode: 13, key: 'Enter', description: 'Advance step' },
            onEnter
        );
        Reveal.addKeyBinding(
            { keyCode: 82, key: 'r', description: 'Reset slide' },
            onReset
        );
    }

    window.SlideController = {
        registerSlide: registerSlide,
        registerReset: registerReset,
        registerSlideInit: registerSlideInit,
        getSlideId: getSlideId,

        // Exposed for optional helper plugins (d3-helpers.js, etc.) to read
        // and write. NOT part of the stable public API — don't rely on this
        // from a deck's deck.js.
        _internal: {
            progress: progress,
            shown: shown,
        },
    };

    // Run init() after Reveal is ready. Handles all three plugin-loading
    // orderings (before Reveal.initialize, after, or before DOMContentLoaded).
    if (typeof Reveal !== 'undefined' && Reveal.isReady && Reveal.isReady()) {
        init();
    } else if (typeof Reveal !== 'undefined' && Reveal.on) {
        Reveal.on('ready', init);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof Reveal !== 'undefined' && Reveal.on) {
                Reveal.on('ready', init);
            }
        });
    }
})();
