// ============================================================
// SlideController — Refactored
// ============================================================
// Declarative, config-driven slide animations for reveal.js.
// Each slide ID maps to an ordered array of step functions.
// Press Enter to advance steps; press R to reset the current slide.
// ============================================================

(function () {
    'use strict';

    // ── Constants ────────────────────────────────────────────
    var CH_COLORS = ['#4B0082', '#0000FF', '#00FFFF', '#008000', '#FFD700', '#DC143C'];
    var WIDTH = 1920;
    var HEIGHT = 1080;

    // ── State ────────────────────────────────────────────────
    var progress = {};      // slideId -> current step index (1-based)
    var shown = {};         // slideId -> [d3 selections] for undo
    var imageIndex = 0;
    var filterRotation = true;
    var clusteringInitialized = false;

    // ── Helpers ──────────────────────────────────────────────

    function getSlideId() {
        return Reveal.getCurrentSlide().getElementsByTagName('div')[0]?.id;
    }

    /** Show a d3 selection and track it for reset */
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

    /** Hide a d3 selection */
    function hide(selection, method) {
        method = method || 'style';
        if (method === 'attr') {
            selection.attr('visibility', 'hidden');
        } else {
            selection.style('visibility', 'hidden');
        }
    }

    /** Reset all shown elements on a slide */
    function resetShown(slideId) {
        (shown[slideId] || []).forEach(function (entry) {
            hide(entry.sel, entry.method);
        });
        shown[slideId] = [];
        progress[slideId] = 1;
    }

    /** Animate a path with bounce easing */
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

    /** Animate a path with cubic easing, makes visible */
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

    /** Animate a path with linear easing, hides on end */
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

    /** Animate an image height from 0 */
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

    /** Morph SVG paths using anime.js */
    function morphPaths(pathFrom, pathTo, duration) {
        duration = duration || 250;
        var paths = [pathFrom.attr('d'), pathTo.attr('d')];
        anime({
            targets: '#scan-outline-2',
            d: paths,
            duration: duration,
            delay: duration,
            loop: false,
            direction: 'alternate',
            easing: 'linear'
        });
    }

    /** Select inside a slide container: d3.select('#id').select('#svgId') */
    function sel(containerId, svgId) {
        if (svgId) {
            return d3.select('#' + containerId).select('#' + svgId);
        }
        return d3.select('#' + containerId);
    }

    // ── SVG Loaders ─────────────────────────────────────────
    // Each loader appends an SVG into a container div and configures it.

    function loadSVG(containerSelector, svgPath, svgId, viewBox, onLoad) {
        d3.svg(svgPath).then(function (data) {
            d3.select(containerSelector).node().append(data.documentElement);
            var svg = d3.select(containerSelector).select('#' + svgId);
            svg.attr('width', '100%')
                .attr('height', '100%');
            if (viewBox) svg.attr('viewBox', viewBox);
            svg.attr('visibility', 'hidden');
            var defs = svg.select('#defs');
            if (!defs.empty()) defs.attr('visibility', 'visible');
            if (onLoad) onLoad(svg);
        });
    }

    function initSVGs() {
        // Front page
        d3.svg('../../images/front_page.svg').then(function (data) {
            d3.select('#first_page').node().append(data.documentElement);
            var fp = sel('first_page', 'first_page');
            fp.attr('width', '100%')
                .attr('height', '100%')
                .attr('viewBox', '00 20 1900 1500')
                .attr('visibility', 'visible');
            var image = fp.select('image');
            moveImage(image);
            fp.append('foreignObject')
                .attr('x', 800).attr('y', 850)
                .attr('width', 400).attr('height', 400)
                .append('xhtml:div')
                .html('<button id="allow interation">Interactive Mode</button>');
        });

        function moveImage(image) {
            if (Reveal.getIndices().h === 0 && Reveal.getIndices().v === 0) {
                image.transition().duration(20000).ease(d3.easeLinear)
                    .attr('transform', 'translate(10,10)').attr('transform', 'scale(1.05)')
                    .transition().duration(20000).ease(d3.easeLinear)
                    .attr('transform', 'translate(-10,-10)').attr('transform', 'scale(1.0)')
                    .transition().duration(20000).ease(d3.easeLinear)
                    .attr('transform', 'translate(10,-10)').attr('transform', 'scale(0.95)')
                    .transition().duration(20000).ease(d3.easeLinear)
                    .attr('transform', 'translate(-10,10)').attr('transform', 'scale(1.0)')
                    .on('end', function () { moveImage(image); });
            }
        }

        // Protocol
        loadSVG('#protocol1', '../../images/protocol.svg', 'protocol', '-720 0 2954 2856');

        // Stats (with pie charts)
        d3.svg('../../images/Stats.svg').then(function (data) {
            d3.select('#Stats').node().append(data.documentElement);
            var svg = sel('Stats', 'stats');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '0 0 1920 1080')
                .attr('visibility', 'visible');
            buildPieCharts(svg);
        });

        // Fluorescence data
        loadSVG('#fl_data', '../../images/fl_data.svg', 'fl_data', '-650 0 3220 1280', function (svg) {
            svg.select('#laser_pulse').attr('visibility', 'visible');
            svg.select('#vis-img').attr('visibility', 'visible');
            svg.select('#colorbar').call(d3.zoom().on('zoom', function () {
                d3.select(this).attr('transform', d3.event.transform);
            }));
            svg.select('#colorbar').on('click', function () {
                d3.select(this).transition().duration(500).attr('transform', d3.zoomIdentity);
            });
        });

        // Training
        loadSVG('#training', '../../images/why_training.svg', 'why_training', '550 800 600 600');

        // Clustering
        loadSVG('#clustering', '../../images/clustering.svg', 'clustering', '-200 0 2420 1080');

        // Examples (with zoom + image gallery)
        d3.svg('../../images/examples.svg').then(function (data) {
            d3.select('#examples').node().append(data.documentElement);
            var svg = sel('examples', 'examples');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-400 0 2820 1080')
                .attr('visibility', 'hidden');
            svg.select('#defs').attr('visibility', 'visible');
            initExamplesGallery(svg);
        });

        // Challenges
        d3.svg('../../images/challenges.svg').then(function (data) {
            d3.select('#challenges').node().append(data.documentElement);
            var svg = sel('challenges', 'protocol');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-70 0 800 500')
                .attr('visibility', 'hidden');
            svg.select('#defs2').attr('visibility', 'visible');
        });

        // Causes / additional factors
        d3.svg('../../images/causes.svg').then(function (data) {
            d3.select('#additional-factors').node().append(data.documentElement);
            var svg = d3.select('#additional-factors').select('#causes');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-300 0 2000 1000')
                .attr('visibility', 'hidden');
            svg.select('#defs').style('visibility', 'visible');
            svg.select('#already_here').style('visibility', 'visible');
            appendCausesVideo(svg);
        });

        // Solutions
        d3.svg('../../images/our_solution.svg').then(function (data) {
            d3.select('#solutions').node().append(data.documentElement);
            var svg = sel('solutions', 'solution');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-300 0 2000 1000')
                .attr('visibility', 'hidden');
            if (!svg.select('#defs2').empty()) svg.select('#defs2').attr('visibility', 'visible');
            initSolutionsVideo(svg);
        });

        // Solution 2
        loadSVG('#solution2', '../../images/solution2.svg', 'solution2', null);

        // Sector analysis / data_analysis
        d3.svg('../../images/sector_analysis.svg').then(function (data) {
            d3.select('#data_analysis').node().append(data.documentElement);
            var svg = sel('data_analysis', 'data_analysis');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-300 0 2500 1200')
                .attr('visibility', 'visible');
            svg.select('#defs').attr('visibility', 'visible');
            svg.select('#svg_head_txt').attr('visibility', 'visible');
            svg.select('#all_imgs').attr('visibility', 'visible');
        });

        // Pixel level results
        d3.svg('../../images/pixel_level_results.svg').then(function (data) {
            d3.select('#pixel_level_results').node().append(data.documentElement);
            var svg = sel('pixel_level_results', 'pixel_lvl_results');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-450 0 2820 1080')
                .attr('visibility', 'visible');
            svg.select('#defs').attr('visibility', 'visible');
            svg.select('#pix_lvl_head_txt').attr('visibility', 'visible');
            svg.select('#results_grp').attr('visibility', 'hidden');
        });
    }

    // ── Pie Charts (Stats slide) ────────────────────────────

    function buildPieCharts(svg) {
        var colors = d3.scaleOrdinal(d3.schemeSet3);

        function makePie(groupId, translateX, data, label) {
            var g = svg.append('g')
                .attr('transform', 'translate(' + translateX + ',0)')
                .attr('id', groupId);
            var pieData = d3.pie().sort(null).value(function (d) { return d.number; })(data);
            var arc = d3.arc().innerRadius(50).outerRadius(200)
                .padAngle(0.05).padRadius(50).cornerRadius(10);
            var sections = g.append('g').attr('transform', 'translate(960,540)')
                .selectAll('path').data(pieData);
            sections.enter().append('path')
                .attr('d', arc)
                .attr('fill', function (d) { return colors(d.data.type); })
                .on('mouseover', function () {
                    d3.select(this).transition().duration(50).attr('opacity', 0.5);
                })
                .on('mouseout', function () {
                    d3.select(this).transition().duration(50).attr('opacity', 1);
                });
            d3.select('#' + groupId).selectAll('text').data(pieData)
                .enter().append('text').each(function (d) {
                    var center = arc.centroid(d);
                    d3.select(this)
                        .attr('x', center[0]).attr('y', center[1])
                        .attr('transform', 'translate(960,540)')
                        .text(d.data.number !== 0 ? d.data.number : '')
                        .style('font-size', '1em').attr('fill', 'black');
                });
            svg.append('text')
                .attr('transform', 'translate(' + ((WIDTH / 2) + translateX) + ',' + 300 + ')')
                .attr('text-anchor', 'middle').style('font-size', '30px')
                .style('stroke', 'none').text(label).attr('fill', 'white');
        }

        var trainData = [
            { type: 'IDC', number: 5 }, { type: 'DCIS', number: 2 },
            { type: 'IDC + DCIS', number: 3 }, { type: 'No cancer', number: 4 }
        ];
        var testData = [
            { type: 'IDC', number: 4 }, { type: 'DCIS', number: 3 },
            { type: 'IDC + DCIS', number: 0 }, { type: 'No cancer', number: 3 }
        ];

        makePie('piechrt1', WIDTH / 5, testData, 'Test (N: 10)');
        makePie('piechrt2', WIDTH / -5, trainData, 'Training (N: 14)');

        // Legend
        var pieDataForLegend = d3.pie().sort(null).value(function (d) { return d.number; })(trainData);
        var legends = svg.append('g')
            .attr('transform', 'translate(' + ((WIDTH / 2) - 50) + ',' + 150 + ')')
            .selectAll('.legend').data(pieDataForLegend);
        var legend = legends.enter().append('g').classed('legend', true)
            .attr('transform', function (d, i) { return 'translate(0,' + (i + 1) * 30 + ')'; });
        legend.append('rect').attr('width', 20).attr('height', 20)
            .attr('fill', function (d) { return colors(d.data.type); });
        legend.append('text')
            .text(function (d) { return d.data.type; })
            .attr('fill', function (d) { return colors(d.data.type); })
            .attr('x', 30).attr('y', 20);

        // Title
        svg.append('text')
            .attr('transform', 'translate(960,60)')
            .attr('text-anchor', 'middle').style('font-size', '50px')
            .style('stroke', 'none').text('Patient Distribution').attr('fill', 'white');
    }

    // ── Examples Gallery ─────────────────────────────────────

    function initExamplesGallery(svg) {
        d3.selectAll('.modal-btn').on('click', function (d, i) {
            var len = svg.selectAll('g').nodes().length - 1;
            imageIndex += (i === 1) ? 1 : -1;
            if (imageIndex >= len) imageIndex = 0;
            svg.selectAll('g').attr('visibility', 'hidden');
            svg.select('#image_' + imageIndex).attr('visibility', 'visible');
            if (!d3.select('#confusion_mtx').node().checked) {
                svg.select('#confusion_mtx_' + imageIndex).attr('visibility', 'hidden');
            } else {
                for (var j = 0; j <= len; j++) {
                    svg.select('#confusion_mtx_' + j).attr('visibility', 'hidden');
                }
                svg.select('#confusion_mtx_' + imageIndex).attr('visibility', 'visible');
            }
        });

        d3.select('#confusion_mtx').on('click', function () {
            var len = svg.selectAll('g').nodes().length - 1;
            if (!d3.select('#confusion_mtx').node().checked) {
                for (var j = 0; j <= len; j++) {
                    svg.select('#confusion_mtx_' + j).attr('visibility', 'hidden');
                }
            } else {
                svg.select('#confusion_mtx_' + imageIndex).attr('visibility', 'visible');
            }
        });

        svg.selectAll('image')
            .call(d3.zoom().on('zoom', function () {
                svg.selectAll('image').attr('transform', d3.event.transform);
            }));
        svg.selectAll('image').on('click', function () {
            svg.selectAll('image').transition().duration(500).attr('transform', d3.zoomIdentity);
        });
        d3.select('body').on('click', function () {
            svg.selectAll('image').transition().duration(500).attr('transform', d3.zoomIdentity);
        });
    }

    // ── Causes Video ─────────────────────────────────────────

    function appendCausesVideo(svg) {
        var fObj = svg.append('foreignObject')
            .attr('x', '5%').attr('y', '10%')
            .attr('width', '60%').attr('height', '80%');
        var vid = fObj.append('xhtml:video')
            .attr('width', '100%').attr('height', '100%')
            .attr('controls', '').attr('id', 'tissue_cutting');
        vid.append('xhtml:source')
            .attr('type', 'video/mp4')
            .attr('src', '../../images/tissue_cutting.mp4');
    }

    // ── Solutions Video + Buttons ────────────────────────────

    function initSolutionsVideo(svg) {
        var fObj = svg.append('foreignObject')
            .attr('x', '27.5%').attr('y', '1%')
            .attr('width', '20%').attr('height', '30%');
        var vid = fObj.append('xhtml:video')
            .attr('width', '100%').attr('height', '100%').attr('controls', '');
        vid.append('xhtml:source')
            .attr('type', 'video/mp4')
            .attr('src', '../../images/moving_tree.mp4');

        svg.append('foreignObject')
            .attr('x', 1000).attr('y', 0)
            .attr('width', 300).attr('height', 220)
            .append('xhtml:div')
            .html('<button id="playme">Play/Pause Video</button>' +
                '<button id="extract1">Extract frame 1</button>' +
                '<button id="extract2">Extract frame 2</button>');

        svg.selectAll('button').each(function () {
            d3.select(this)
                .style('display', 'inline-flex').style('visibility', 'visible')
                .style('height', '60px').style('width', '250px')
                .style('border', '2px solid #BFC0C0').style('margin', '5px')
                .style('color', '#454545').style('text-transform', 'uppercase')
                .style('text-decoration', 'none').style('font-size', '.6em')
                .style('letter-spacing', '1.5px').style('align-items', 'center')
                .style('justify-content', 'center').style('overflow', 'hidden')
                .on('mouseover', function () { d3.select(this).style('border', '2px solid red'); })
                .on('mouseout', function () { d3.select(this).style('border', '2px solid #BFC0C0'); });
        });

        var myvideo = svg.select('video');
        myvideo.style('visibility', 'visible');

        document.getElementById('playme').addEventListener('click', function () {
            if (myvideo.node().paused) { myvideo.node().play(); }
            else { myvideo.node().pause(); }
        });

        document.getElementById('extract1').addEventListener('click', function () {
            myvideo.node().pause();
            myvideo.node().currentTime = 3;
            show('solutions', svg.select('#line2orig1')).each(animatePath);
            show('solutions', svg.select('#orig1bound')).each(animatePath);
            show('solutions', svg.select('#original1'));
        });

        document.getElementById('extract2').addEventListener('click', function () {
            myvideo.node().pause();
            myvideo.node().currentTime = 7;
            show('solutions', svg.select('#line2orig2')).each(animatePath);
            show('solutions', svg.select('#orig2bound')).each(animatePath);
            show('solutions', svg.select('#original2'));
        });
    }

    // ── Clustering: slidechanged handler ─────────────────────
    // Appends video elements into the SVG when the clustering slide is first shown.

    function initClusteringVideos() {
        if (clusteringInitialized) return;
        clusteringInitialized = true;

        var container = sel('clustering', 'clustering');
        var frameCords = container.select('#rectBox').node().getBBox();

        function addVideo(id, x, y, w, h, src) {
            var fObj = container.append('foreignObject')
                .attr('x', x).attr('y', y).attr('width', w).attr('height', h);
            var vid = fObj.append('xhtml:video')
                .attr('width', '100%').attr('height', id === 'pca_video' ? '90%' : '100%')
                .attr('controls', '').attr('loop', '').attr('id', id);
            vid.append('xhtml:source')
                .attr('type', 'video/mp4').attr('src', src);
        }

        addVideo('k-mean_video',
            frameCords.x + 40, frameCords.y + 20,
            frameCords.width - 40, frameCords.height - 40,
            '../../images/Visualizing_K-Means_algorithm_1_eefbvf.mp4');

        addVideo('pca_video',
            frameCords.x + 20, frameCords.y + 40,
            frameCords.width - 40, frameCords.height - 40,
            '../../images/PCA_example3.webm');

        function addSourceText(id, text) {
            container.append('text')
                .text(text)
                .attr('x', frameCords.x)
                .attr('y', frameCords.height + 100)
                .attr('width', frameCords.width - 40)
                .attr('height', 40)
                .attr('id', id)
                .style('fill', 'white');
        }

        addSourceText('pca_source', 'source: http://setosa.io/ev/principal-component-analysis/');
        addSourceText('kmean_source', 'source: http://tech.nitoyon.com/en/blog/2013/11/07/k-means/');
        addSourceText('svm_source', 'source: https://medium.com/analytics-vidhya/how-to-classify-non-linear-data-to-linear-data-bb2df1a6b781');
    }

    // ── Filter rotation animation (fl_data slide) ───────────

    function rotateFilter() {
        var filterList = sel('fl_data').select('#filters').selectAll('ellipse').nodes();
        var filterLineList = sel('fl_data').select('#filter_wheel_lines').selectAll('path').nodes();
        var chDelay = 0;

        function rotate() {
            for (var i = 0; i < filterList.length; i++) {
                chDelay += 800;
                var totalLength = filterLineList[i].getTotalLength();
                d3.select(filterLineList[i])
                    .style('stroke-dasharray', totalLength + ' ' + totalLength)
                    .style('stroke-dashoffset', totalLength)
                    .transition().duration(800).delay(chDelay)
                    .style('visibility', 'visible')
                    .style('stroke-dashoffset', 0)
                    .ease(d3.easeLinear)
                    .on('end', function () { d3.select(this).style('visibility', 'hidden'); });

                if (i === 0) {
                    d3.select(filterList[i]).transition().duration(800).ease(d3.easeLinear)
                        .attr('cx', d3.select(filterList[filterList.length - 1]).attr('cx'))
                        .attr('cy', d3.select(filterList[filterList.length - 1]).attr('cy'));
                } else {
                    (function (idx) {
                        d3.select(filterList[idx]).transition().duration(800).ease(d3.easeLinear)
                            .attr('cx', d3.select(filterList[idx - 1]).attr('cx'))
                            .attr('cy', d3.select(filterList[idx - 1]).attr('cy'))
                            .on('end', function () {
                                if (filterRotation) rotate();
                            });
                    })(i);
                }
                sel('fl_data').select('#filter_wheel').select('path').each(animatePathLin);
                for (var j = 1; j <= 2; j++) {
                    sel('fl_data').select('#aro_' + i).each(animatePathLin);
                }
            }
        }
        rotate();
    }

    // ── Slide Animation Steps ────────────────────────────────
    // Each key is a slide container div ID.
    // Each value is an array of functions: steps[0] is step 1, etc.

    var slideAnimations = {

        // ─── fl_data ─────────────────────────────────────────
        'fl_data': [
            // Step 1: Show raw signal, filter wheel, start rotation
            function (id) {
                show(id, sel('fl_data').select('#raw_signal'));
                show(id, sel('fl_data').select('#filter_wheel'));
                show(id, sel('fl_data').select('#filters'));
                show(id, sel('fl_data').select('#filter_wheel_lines').selectAll('path'));
                sel('fl_data').select('#filter_wheel').select('path').each(animatePathLin);
                for (var i = 1; i <= 2; i++) {
                    show(id, sel('fl_data').select('#aro_' + i)).each(animatePath);
                }
                rotateFilter();
            },
            // Step 2: Stop rotation, show lifetimes
            function (id) {
                filterRotation = false;
                sel('fl_data').select('#lft2aro').selectAll('path').each(function () {
                    show(id, d3.select(this));
                });
                sel('fl_data').select('#lft2aro').selectAll('path').each(animatePath);
                var avg = show(id, sel('fl_data').select('#avg_lifetimes'));
                avg.select('#cancer_halo').style('visibility', 'hidden');
                avg.select('#cancer_line').style('visibility', 'hidden');
                avg.select('#fat_halo').style('visibility', 'hidden');
                avg.select('#fat_line').style('visibility', 'hidden');
                avg.selectAll('path').each(animatePath);
                avg.select('#lifetime_lines').select('#cancer_aro').style('visibility', 'hidden');
                avg.select('#lifetime_lines').select('#stroma_aro').style('visibility', 'hidden');
                avg.select('#lifetime_lines').select('#fat_aro').style('visibility', 'hidden');
            },
            // Step 3: Show fat raw data
            function (id) {
                sel('fl_data').select('#lft2aro').selectAll('path').each(function () {
                    d3.select(this).style('visibility', 'hidden');
                });
                show(id, sel('fl_data').select('#fat_raw_data'));
                show(id, sel('fl_data').select('#avg_lifetimes').select('#fat_halo')).each(animatePath);
                show(id, sel('fl_data').select('#avg_lifetimes').select('#fat_line')).each(animatePath);
            },
            // Step 4: Show channel images
            function (id) {
                sel('fl_data').select('#aro2bw').selectAll('path').each(function () {
                    show(id, d3.select(this));
                });
                sel('fl_data').select('#aro2bw').selectAll('path').each(animatePath);
                sel('fl_data').select('#ch-img').selectAll('image').each(function () {
                    show(id, d3.select(this));
                });
                sel('fl_data').select('#ch-img').selectAll('image').each(animateImg);
            },
            // Step 5: Color the arrows
            function (id) {
                sel('fl_data').select('#aro2bw').selectAll('path').each(function (d, i) {
                    d3.select(this).transition().duration(700).delay(100 + (200 * i))
                        .style('stroke', CH_COLORS[i]);
                });
                show(id, sel('fl_data').select('#aro2bw'));
                sel('fl_data').select('#color_labels').selectAll('text').each(function (d, i) {
                    d3.select(this).transition().duration(700).delay(100 + (200 * i))
                        .style('visibility', 'visible');
                    show(id, d3.select(this));
                });
                show(id, sel('fl_data').select('#color_labels'));
            },
            // Step 6: Show example images
            function (id) {
                sel('fl_data').select('#aro2bw').selectAll('path')
                    .style('stroke', '#fff').style('visibility', 'hidden');
                sel('fl_data').select('#color_labels').selectAll('text').style('visibility', 'hidden');
                show(id, sel('fl_data').select('#example-img-1'));
                show(id, sel('fl_data').select('#example-img-2_grp').select('path'));
                show(id, sel('fl_data').select('#example-img-2_grp').select('#colorbar'));
            },
            // Step 7: Show example image 2
            function (id) {
                show(id, sel('fl_data').select('#example-img-2'));
            },
            // Step 8: Cancer lifetime arrow
            function (id) {
                var lines = sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines');
                show(id, lines.select('#cancer_aro'));
                show(id, sel('fl_data').select('#avg_lifetimes').select('#cancer_halo'));
                show(id, sel('fl_data').select('#avg_lifetimes').select('#cancer_line'));
                lines.select('#cancer_line').style('Stroke', 'red');
                lines.select('#cancer_halo').style('Stroke', 'red');
            },
            // Step 9: Fat lifetime arrow
            function (id) {
                var lines = sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines');
                show(id, lines.select('#fat_aro'));
                lines.select('#fat_line').style('Stroke', '#435afa');
                lines.select('#fat_halo').style('Stroke', '#435afa');
                show(id, lines);
            },
            // Step 10: Stroma lifetime arrow
            function (id) {
                var lines = sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines');
                show(id, lines.select('#stroma_aro'));
                lines.select('#stroma_line').style('Stroke', '#32fecd');
                lines.select('#stroma_halo').style('Stroke', '#32fecd');
            }
        ],

        // ─── training ────────────────────────────────────────
        'training': [
            function (id) {
                show(id, sel('training', 'why_training').select('#part_data')).each(animateImg);
            },
            function (id) {
                var wt = sel('training', 'why_training');
                show(id, wt.select('#full_data'))
                    .style('opacity', 0).transition().duration(1000).style('opacity', 1);
                wt.transition().duration(1000).ease(d3.easeExp).attr('viewBox', '-225 50 2420 1080');
            },
            function (id) {
                var wt = sel('training', 'why_training');
                wt.select('#full_data').select('#infinite_lines').attr('visibility', 'hidden');
                show(id, wt.select('#classification_abcs'));
                show(id, wt.select('#edge'));
            },
            function (id) {
                show(id, sel('training', 'why_training').select('#extract_params'));
            },
            function (id) {
                show(id, sel('training', 'why_training').select('#aro1'));
                show(id, sel('training', 'why_training').select('#identify_features'));
            },
            function (id) {
                show(id, sel('training', 'why_training').select('#aro2'));
                show(id, sel('training', 'why_training').select('#train_classification'));
            },
            function (id) {
                show(id, sel('training', 'why_training').select('#tagged-grp'));
            }
        ],

        // ─── clustering ──────────────────────────────────────
        'clustering': [
            function (id) {
                var c = sel('clustering', 'clustering');
                show(id, c.select('#rectBox')).each(animatePathLin);
                show(id, c.select('#low_signal'));
                show(id, c.select('#low_sig_imgs'));
            },
            function (id) {
                var c = sel('clustering', 'clustering');
                c.select('#low_sig_imgs').style('visibility', 'hidden');
                show(id, c.select('#pca_perf'));
                show(id, c.select('#pca_video'));
                c.select('#pca_video').node().play();
                show(id, c.select('#pca_source'));
            },
            function (id) {
                var c = sel('clustering', 'clustering');
                c.select('#pca_video').node().pause();
                c.select('#pca_video').style('visibility', 'hidden');
                c.select('#pca_source').style('visibility', 'hidden');
                show(id, c.select('#cluster_divide'));
                show(id, c.select('#k-mean_video'));
                show(id, c.select('#kmean_source'));
                c.select('#k-mean_video').node().play();
            },
            function (id) {
                var c = sel('clustering', 'clustering');
                c.select('#k-mean_video').node().pause();
                c.select('#k-mean_video').style('visibility', 'hidden');
                c.select('#kmean_source').style('visibility', 'hidden');
                show(id, c.select('#only_stroma'));
                show(id, c.select('#cluster_grp'));
            },
            function (id) {
                var c = sel('clustering', 'clustering');
                c.select('#cluster_grp').style('visibility', 'hidden');
                show(id, c.select('#svm_source'));
                show(id, c.select('#SVM'));
            }
        ],

        // ─── pixel_level_results ─────────────────────────────
        'pixel_level_results': [
            function (id) {
                var p = sel('pixel_level_results', 'pixel_lvl_results');
                p.select('#results_grp').attr('visibility', 'visible');
                p.select('#vis-img').attr('visibility', 'hidden');
                p.select('#orig_tag_img').attr('visibility', 'hidden');
                p.select('#cluster_scan').attr('visibility', 'hidden');
            }
        ],

        // ─── challenges ──────────────────────────────────────
        'challenges': [
            function (id) {
                show(id, sel('challenges', 'protocol').select('#vis-img'));
            },
            function (id) {
                var p = sel('challenges', 'protocol');
                var mask = p.select('#defs2').select('mask').select('rect');
                show(id, p.select('#c-score-img'));
                var maskH = mask.style('height');
                mask.style('height', 0).style('visibility', 'visible')
                    .transition().duration(2000).style('height', maskH);
            },
            function (id) {
                var p = sel('challenges', 'protocol');
                show(id, p.select('#path-img'));
                show(id, p.select('#arrowText'));
                show(id, p.select('#visTopathAro'));
            },
            function (id) {
                show(id, sel('challenges', 'protocol').select('#scan-outline')).each(animatePathLin);
            },
            function (id) {
                var p = sel('challenges', 'protocol');
                var cancer = show(id, p.select('#cancer-outline')).each(animatePathLin);
                var opacity = cancer.style('opacity');
                cancer.style('opacity', 0).transition().duration(700).style('opacity', opacity);
            },
            function (id) {
                var p = sel('challenges', 'protocol');
                var toX = p.select('#scan-outline-2').node().getBBox().x;
                var fromX = p.select('#scan-outline').node().getBBox().x;
                var toY = p.select('#scan-outline-2').node().getBBox().y;
                var fromY = p.select('#scan-outline').node().getBBox().y;
                p.select('#scan-outline').transition().duration(1000)
                    .ease(d3.easeBounceOut)
                    .attr('transform', 'translate(' + (toX - fromX) + ',' + (toY - fromY) + ')')
                    .on('end', function () {
                        show(id, p.select('#scan-outline-2'));
                    });
                var toCX = p.select('#cancer-outline-2').node().getBBox().x;
                var fromCX = p.select('#cancer-outline').node().getBBox().x;
                var toCY = p.select('#cancer-outline-2').node().getBBox().y;
                var fromCY = p.select('#cancer-outline').node().getBBox().y;
                p.select('#cancer-outline').transition().duration(1000)
                    .ease(d3.easeBounceOut)
                    .attr('transform', 'translate(' + (toCX - fromCX) + ',' + (toCY - fromCY) + ')')
                    .on('end', function () {
                        show(id, p.select('#cancer-outline-2'));
                    });
            },
            function (id) {
                var p = sel('challenges', 'protocol');
                show(id, p.select('#scan-outline-3'));
                show(id, p.select('#cancer-outline-3'));
                anime({
                    targets: '#scan-outline-3',
                    d: [p.select('#scan-outline-2').attr('d'), p.select('#scan-outline-3').attr('d')],
                    duration: 1000, delay: 0, loop: false, direction: 'alternate', easing: 'linear'
                });
                anime({
                    targets: '#cancer-outline-3',
                    d: [p.select('#cancer-outline-2').attr('d'), p.select('#cancer-outline-3').attr('d')],
                    duration: 1000, delay: 0, loop: false, direction: 'alternate', easing: 'linear'
                });
                p.select('#scan-outline').style('visibility', 'hidden');
                p.select('#cancer-outline-2').style('fill-opacity', 0.2);
            }
        ],

        // ─── additional-factors ──────────────────────────────
        'additional-factors': [
            function (id) {
                show(id, sel('additional-factors', 'causes').select('#othercauses'));
            },
            function (id) {
                show(id, sel('additional-factors', 'causes').select('#slicePerspectiveorig'))
                    .selectAll('path').each(animatePathLin);
            },
            function (id) {
                var c = sel('additional-factors', 'causes');
                show(id, c.select('#perspectiveTosideviewline')).each(animatePath);
                show(id, c.select('#sideview')).selectAll('path').each(animatePathLin);
                show(id, c.select('#slicedepthmeasure')).selectAll('path').each(animatePathLin);
                show(id, c.select('#observeddepthmeasure')).selectAll('path').each(animatePathLin);
            },
            function (id) {
                var vid = sel('additional-factors', 'causes').select('foreignObject').select('video');
                show(id, vid);
                vid.node().play();
            },
            function (id) {
                var c = sel('additional-factors', 'causes');
                var vid = c.select('foreignObject').select('video');
                vid.node().pause();
                vid.style('visibility', 'hidden');
                c.select('#slicedepthmeasure').style('visibility', 'hidden');
                c.select('#observeddepthmeasure').style('visibility', 'hidden');
            },
            function (id) {
                var c = sel('additional-factors', 'causes');
                show(id, c.select('#cut1')).each(animatePathLin);
                show(id, c.select('#halo1')).each(animatePathLin);
                show(id, c.select('#halo1text'));
                show(id, c.select('#halo1line')).each(animatePath);
                show(id, c.select('#halo1slice')).selectAll('path').each(animatePathLin);
            },
            function (id) {
                var c = sel('additional-factors', 'causes');
                show(id, c.select('#cut2')).each(animatePathLin);
                show(id, c.select('#halo2')).each(animatePathLin);
                show(id, c.select('#halo2text'));
                show(id, c.select('#halo2line')).each(animatePath);
                show(id, c.select('#halo2slice')).selectAll('path').each(animatePathLin);
            },
            function (id) {
                var c = sel('additional-factors', 'causes');
                show(id, c.select('#cut3')).each(animatePathLin);
                show(id, c.select('#halo3')).each(animatePathLin);
                show(id, c.select('#halo3text'));
                show(id, c.select('#halo3line')).each(animatePath);
                show(id, c.select('#halo3slice')).selectAll('path').each(animatePathLin);
                show(id, c.select('#cut4')).each(animatePathLin);
                show(id, c.select('#halo4')).each(animatePathLin);
                show(id, c.select('#halo4text'));
                show(id, c.select('#halo4line')).each(animatePath);
                show(id, c.select('#halo4slice')).selectAll('path').each(animatePathLin);
            },
            function (id) {
                show(id, sel('additional-factors', 'causes').select('#finalQuestion'));
            }
        ],

        // ─── solutions ───────────────────────────────────────
        'solutions': [
            function (id) {
                var s = sel('solutions', 'solution');
                show(id, s.select('#orig_sub'));
                show(id, s.select('#orig_equal'));
                show(id, s.select('#full_pixel_solution'));
            },
            function (id) {
                var s = sel('solutions', 'solution');
                show(id, s.select('#orig_rect1')).each(animatePath);
                show(id, s.select('#line2orig_crop1')).each(animatePath);
                show(id, s.select('#orig_crop1'));
            },
            function (id) {
                var s = sel('solutions', 'solution');
                show(id, s.select('#orig_rect2')).each(animatePath);
                show(id, s.select('#line2orig_crop2')).each(animatePath);
                show(id, s.select('#orig_crop2'));
            },
            function (id) {
                var s = sel('solutions', 'solution');
                show(id, s.select('#solution_rect')).each(animatePath);
                show(id, s.select('#line2solution_crop')).each(animatePath);
                show(id, s.select('#solution_crop'));
            },
            function (id) {
                var s = sel('solutions', 'solution');
                show(id, s.select('#pixelated1'));
                show(id, s.select('#pixelated2'));
            },
            function (id) {
                var s = sel('solutions', 'solution');
                show(id, s.select('#pix_sub'));
                show(id, s.select('#pix_equal'));
            },
            function (id) {
                show(id, sel('solutions', 'solution').select('#pixelated_solution'));
            }
        ],

        // ─── solution2 ──────────────────────────────────────
        'solution2': [
            function (id) {
                show(id, sel('solution2', 'solution2').select('#vis-img'));
            },
            function (id) {
                show(id, sel('solution2', 'solution2').select('#confusion_mtx'));
            },
            function (id) {
                show(id, sel('solution2', 'solution2').select('#grid_over').selectAll('path'))
                    .each(animatePathLin);
            },
            function (id) {
                var s = sel('solution2', 'solution2');
                show(id, s.select('#arrow_to'));
                show(id, s.select('#sectors-img'));
            }
        ]
    };

    // ── Custom reset logic per slide (beyond hiding) ────────

    var slideResetExtras = {
        'fl_data': function () {
            sel('fl_data').select('#aro2bw').selectAll('path').each(function () {
                d3.select(this).style('stroke', '#fff');
            });
            sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines')
                .selectAll('path').each(function () {
                    d3.select(this).style('stroke', '#fff');
                });
            filterRotation = true;
        },
        'training': function () {
            sel('training', 'why_training').attr('viewBox', '550 800 600 600');
        },
        'pixel_level_results': function () {
            var p = sel('pixel_level_results', 'pixel_lvl_results');
            p.select('#results_grp').attr('visibility', 'hidden');
            p.select('#vis-img').attr('visibility', 'visible');
            p.select('#orig_tag_img').attr('visibility', 'visible');
            p.select('#cluster_scan').attr('visibility', 'visible');
        },
        'challenges': function () {
            sel('challenges', 'protocol').select('#cancer-outline').attr('transform', '');
            sel('challenges', 'protocol').select('#scan-outline').attr('transform', '');
        }
    };

    // ── Public API ────────────────────────────────────────────
    // Exposed as window.SlideController so per-deck scripts can:
    //   - Register slide animations: SlideController.registerSlide(id, steps)
    //   - Register reset logic:      SlideController.registerReset(id, fn)
    //   - Use shared helpers:        SlideController.show(), .sel(), .loadSVG(), etc.

    /**
     * Register animation steps for a slide ID.
     * If the slide already has steps (from the shared plugin), the new steps
     * are appended. Pass { replace: true } as 3rd arg to replace instead.
     */
    function registerSlide(slideId, steps, opts) {
        opts = opts || {};
        if (opts.replace || !slideAnimations[slideId]) {
            slideAnimations[slideId] = steps;
        } else {
            slideAnimations[slideId] = slideAnimations[slideId].concat(steps);
        }
    }

    /** Register custom reset logic for a slide ID (runs in addition to auto-reset). */
    function registerReset(slideId, fn) {
        slideResetExtras[slideId] = fn;
    }

    /** Register a slidechanged callback for a specific div ID. */
    function registerSlideInit(divId, fn) {
        var called = false;
        Reveal.addEventListener('slidechanged', function (event) {
            var id = event.currentSlide.getElementsByTagName('div')[0]?.id;
            if (id === divId && !called) {
                called = true;
                fn();
            }
        });
    }

    window.SlideController = {
        // Registration
        registerSlide: registerSlide,
        registerReset: registerReset,
        registerSlideInit: registerSlideInit,

        // Helpers (for use in deck.js files)
        show: show,
        hide: hide,
        sel: sel,
        loadSVG: loadSVG,
        animatePath: animatePath,
        animatePathLin: animatePathLin,
        animatePathLin2: animatePathLin2,
        animateImg: animateImg,
        morphPaths: morphPaths,

        // State access
        progress: progress,
        shown: shown
    };

    // ── Key Bindings ─────────────────────────────────────────

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

    function onReset() {
        var slideId = getSlideId();
        if (!slideId) return;

        resetShown(slideId);
        if (slideResetExtras[slideId]) {
            slideResetExtras[slideId]();
        }
    }

    // ── Init ─────────────────────────────────────────────────

    function init() {
        initSVGs();

        Reveal.addEventListener('slidechanged', function (event) {
            var divId = event.currentSlide.getElementsByTagName('div')[0]?.id;
            if (divId === 'clustering') {
                initClusteringVideos();
            }
        });

        Reveal.addKeyBinding(
            { keyCode: 13, key: 'Enter', description: 'progress' },
            onEnter
        );

        Reveal.addKeyBinding(
            { keyCode: 82, key: 'r', description: 'refresh' },
            onReset
        );
    }

    // Wait for Reveal.js to be ready before initializing.
    // Supports both: loaded before Reveal.initialize() (v6 plugins API)
    // and loaded after (legacy dependencies approach).
    if (typeof Reveal !== 'undefined' && Reveal.isReady && Reveal.isReady()) {
        init();
    } else if (typeof Reveal !== 'undefined' && Reveal.on) {
        Reveal.on('ready', init);
    } else {
        // Fallback: wait for DOMContentLoaded then poll for Reveal
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof Reveal !== 'undefined' && Reveal.on) {
                Reveal.on('ready', init);
            }
        });
    }

})();
