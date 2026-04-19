/**
 * Shared Reveal.js initializer for all presentation decks.
 *
 * Usage in deck index.html:
 *   <script src="../../dist/reveal.js"></script>
 *   <script src="../../dist/plugin/markdown.js"></script>
 *   <script src="../../dist/plugin/highlight.js"></script>
 *   <script src="../../dist/plugin/notes.js"></script>
 *   <script src="../../dist/plugin/zoom.js"></script>
 *   <script src="../../dist/plugin/search.js"></script>
 *   <!-- optional: <script src="../../plugin/pramod/index.js"></script> -->
 *   <script src="../deck-init.js"></script>
 *   <script>
 *     DeckInit.initialize();
 *     // or with overrides:
 *     DeckInit.initialize({ transition: 'fade' });
 *   </script>
 */
var DeckInit = (function () {
    'use strict';

    // Default canvas dimensions and margin. Authors override these via
    // front-matter (width / height / margin) on a per-deck basis.
    //
    // Margin 0.04 = 4% of the viewport is reserved as empty space around
    // the slide canvas. This is Reveal's own default and prevents content
    // from running edge-to-edge. Authors who want the canvas to fill the
    // viewport can set `margin: 0` explicitly in front-matter.
    var defaults = {
        width: 1920,
        height: 1080,
        margin: 0.04,
        minScale: 0.2,
        maxScale: 2.0,
        controls: true,
        progress: true,
        history: true,
        center: true,
        hash: true,
        slideNumber: true,
        transition: 'convex',
        plugins: []
    };

    function collectPlugins() {
        var plugins = [];
        if (typeof RevealMarkdown !== 'undefined') plugins.push(RevealMarkdown);
        if (typeof RevealHighlight !== 'undefined') plugins.push(RevealHighlight);
        if (typeof RevealNotes !== 'undefined') plugins.push(RevealNotes);
        if (typeof RevealZoom !== 'undefined') plugins.push(RevealZoom);
        if (typeof RevealSearch !== 'undefined') plugins.push(RevealSearch);
        if (typeof RevealMath !== 'undefined') plugins.push(RevealMath);
        return plugins;
    }

    function initialize(overrides) {
        overrides = overrides || {};
        var config = {};

        // Merge defaults
        for (var key in defaults) {
            config[key] = defaults[key];
        }
        // Merge overrides
        for (var key in overrides) {
            config[key] = overrides[key];
        }

        // Auto-detect loaded plugins
        config.plugins = collectPlugins().concat(config.plugins || []);

        return Reveal.initialize(config);
    }

    return { initialize: initialize };
})();
