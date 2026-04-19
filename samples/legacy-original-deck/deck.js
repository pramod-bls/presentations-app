// ============================================================
// Legacy original-deck animations & asset loaders
// ============================================================
// This is a SAMPLE deck.js preserving the animations and asset-
// loading logic that used to be baked into the core SlideController
// plugin. It targets one specific original deck; slide IDs are
// fl_data, training, clustering, pixel_level_results, challenges,
// additional-factors, solutions, solution2.
//
// To run this sample:
//   1. Copy the original deck's SVGs and videos into an `assets/`
//      folder next to this file.
//   2. Update every `../../images/...` path below to `assets/...`.
//   3. Copy this folder into your presentations folder.
//   4. Fill in deck.md with the real slide content.
//
// d3 + anime.js + SlideController d3-helpers are loaded via the
// `scripts:` front-matter in deck.md.
// ============================================================

(function () {
    'use strict';

    if (!window.SlideController || !window.SlideController.show) {
        console.error('[legacy deck] requires slide-controller + d3-helpers');
        return;
    }

    var SC = window.SlideController;
    var show = SC.show, sel = SC.sel, loadSVG = SC.loadSVG;
    var animatePath = SC.animatePath;
    var animatePathLin = SC.animatePathLin;
    var animateImg = SC.animateImg;

    var CH_COLORS = ['#4B0082', '#0000FF', '#00FFFF', '#008000', '#FFD700', '#DC143C'];
    var WIDTH = 1920;
    var imageIndex = 0;
    var filterRotation = true;
    var clusteringInitialized = false;

    // ── Asset loaders (initSVGs) ─────────────────────────────

    function initSVGs() {
        d3.svg('../../images/front_page.svg').then(function (data) {
            d3.select('#first_page').node().append(data.documentElement);
            var fp = sel('first_page', 'first_page');
            fp.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '00 20 1900 1500').attr('visibility', 'visible');
            moveImage(fp.select('image'));
            fp.append('foreignObject')
                .attr('x', 800).attr('y', 850).attr('width', 400).attr('height', 400)
                .append('xhtml:div').html('<button id="allow interation">Interactive Mode</button>');
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

        loadSVG('#protocol1', '../../images/protocol.svg', 'protocol', '-720 0 2954 2856');

        d3.svg('../../images/Stats.svg').then(function (data) {
            d3.select('#Stats').node().append(data.documentElement);
            var svg = sel('Stats', 'stats');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '0 0 1920 1080').attr('visibility', 'visible');
            buildPieCharts(svg);
        });

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

        loadSVG('#training', '../../images/why_training.svg', 'why_training', '550 800 600 600');
        loadSVG('#clustering', '../../images/clustering.svg', 'clustering', '-200 0 2420 1080');

        d3.svg('../../images/examples.svg').then(function (data) {
            d3.select('#examples').node().append(data.documentElement);
            var svg = sel('examples', 'examples');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-400 0 2820 1080').attr('visibility', 'hidden');
            svg.select('#defs').attr('visibility', 'visible');
            initExamplesGallery(svg);
        });

        d3.svg('../../images/challenges.svg').then(function (data) {
            d3.select('#challenges').node().append(data.documentElement);
            var svg = sel('challenges', 'protocol');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-70 0 800 500').attr('visibility', 'hidden');
            svg.select('#defs2').attr('visibility', 'visible');
        });

        d3.svg('../../images/causes.svg').then(function (data) {
            d3.select('#additional-factors').node().append(data.documentElement);
            var svg = d3.select('#additional-factors').select('#causes');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-300 0 2000 1000').attr('visibility', 'hidden');
            svg.select('#defs').style('visibility', 'visible');
            svg.select('#already_here').style('visibility', 'visible');
            appendCausesVideo(svg);
        });

        d3.svg('../../images/our_solution.svg').then(function (data) {
            d3.select('#solutions').node().append(data.documentElement);
            var svg = sel('solutions', 'solution');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-300 0 2000 1000').attr('visibility', 'hidden');
            if (!svg.select('#defs2').empty()) svg.select('#defs2').attr('visibility', 'visible');
            initSolutionsVideo(svg);
        });

        loadSVG('#solution2', '../../images/solution2.svg', 'solution2', null);

        d3.svg('../../images/sector_analysis.svg').then(function (data) {
            d3.select('#data_analysis').node().append(data.documentElement);
            var svg = sel('data_analysis', 'data_analysis');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-300 0 2500 1200').attr('visibility', 'visible');
            svg.select('#defs').attr('visibility', 'visible');
            svg.select('#svg_head_txt').attr('visibility', 'visible');
            svg.select('#all_imgs').attr('visibility', 'visible');
        });

        d3.svg('../../images/pixel_level_results.svg').then(function (data) {
            d3.select('#pixel_level_results').node().append(data.documentElement);
            var svg = sel('pixel_level_results', 'pixel_lvl_results');
            svg.attr('width', '100%').attr('height', '100%')
                .attr('viewBox', '-450 0 2820 1080').attr('visibility', 'visible');
            svg.select('#defs').attr('visibility', 'visible');
            svg.select('#pix_lvl_head_txt').attr('visibility', 'visible');
            svg.select('#results_grp').attr('visibility', 'hidden');
        });
    }

    // ── Pie charts, examples gallery, causes + solutions video,
    //    clustering videos, filter rotation, etc. ──────────────
    // (Inlined verbatim from the previous SlideController plugin.)

    function buildPieCharts(svg) {
        var colors = d3.scaleOrdinal(d3.schemeSet3);
        function makePie(groupId, translateX, data, label) {
            var g = svg.append('g').attr('transform', 'translate(' + translateX + ',0)').attr('id', groupId);
            var pieData = d3.pie().sort(null).value(function (d) { return d.number; })(data);
            var arc = d3.arc().innerRadius(50).outerRadius(200).padAngle(0.05).padRadius(50).cornerRadius(10);
            var sections = g.append('g').attr('transform', 'translate(960,540)').selectAll('path').data(pieData);
            sections.enter().append('path').attr('d', arc).attr('fill', function (d) { return colors(d.data.type); })
                .on('mouseover', function () { d3.select(this).transition().duration(50).attr('opacity', 0.5); })
                .on('mouseout', function () { d3.select(this).transition().duration(50).attr('opacity', 1); });
            d3.select('#' + groupId).selectAll('text').data(pieData).enter().append('text').each(function (d) {
                var center = arc.centroid(d);
                d3.select(this).attr('x', center[0]).attr('y', center[1])
                    .attr('transform', 'translate(960,540)')
                    .text(d.data.number !== 0 ? d.data.number : '')
                    .style('font-size', '1em').attr('fill', 'black');
            });
            svg.append('text').attr('transform', 'translate(' + ((WIDTH / 2) + translateX) + ',' + 300 + ')')
                .attr('text-anchor', 'middle').style('font-size', '30px').style('stroke', 'none')
                .text(label).attr('fill', 'white');
        }
        var trainData = [
            { type: 'IDC', number: 5 }, { type: 'DCIS', number: 2 },
            { type: 'IDC + DCIS', number: 3 }, { type: 'No cancer', number: 4 },
        ];
        var testData = [
            { type: 'IDC', number: 4 }, { type: 'DCIS', number: 3 },
            { type: 'IDC + DCIS', number: 0 }, { type: 'No cancer', number: 3 },
        ];
        makePie('piechrt1', WIDTH / 5, testData, 'Test (N: 10)');
        makePie('piechrt2', WIDTH / -5, trainData, 'Training (N: 14)');
        var pieDataForLegend = d3.pie().sort(null).value(function (d) { return d.number; })(trainData);
        var legend = svg.append('g').attr('transform', 'translate(' + ((WIDTH / 2) - 50) + ',' + 150 + ')')
            .selectAll('.legend').data(pieDataForLegend).enter().append('g').classed('legend', true)
            .attr('transform', function (d, i) { return 'translate(0,' + (i + 1) * 30 + ')'; });
        legend.append('rect').attr('width', 20).attr('height', 20).attr('fill', function (d) { return colors(d.data.type); });
        legend.append('text').text(function (d) { return d.data.type; })
            .attr('fill', function (d) { return colors(d.data.type); }).attr('x', 30).attr('y', 20);
        svg.append('text').attr('transform', 'translate(960,60)').attr('text-anchor', 'middle')
            .style('font-size', '50px').style('stroke', 'none').text('Patient Distribution').attr('fill', 'white');
    }

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
                for (var j = 0; j <= len; j++) svg.select('#confusion_mtx_' + j).attr('visibility', 'hidden');
                svg.select('#confusion_mtx_' + imageIndex).attr('visibility', 'visible');
            }
        });
        d3.select('#confusion_mtx').on('click', function () {
            var len = svg.selectAll('g').nodes().length - 1;
            if (!d3.select('#confusion_mtx').node().checked) {
                for (var j = 0; j <= len; j++) svg.select('#confusion_mtx_' + j).attr('visibility', 'hidden');
            } else {
                svg.select('#confusion_mtx_' + imageIndex).attr('visibility', 'visible');
            }
        });
        svg.selectAll('image').call(d3.zoom().on('zoom', function () {
            svg.selectAll('image').attr('transform', d3.event.transform);
        }));
        svg.selectAll('image').on('click', function () {
            svg.selectAll('image').transition().duration(500).attr('transform', d3.zoomIdentity);
        });
        d3.select('body').on('click', function () {
            svg.selectAll('image').transition().duration(500).attr('transform', d3.zoomIdentity);
        });
    }

    function appendCausesVideo(svg) {
        var fObj = svg.append('foreignObject').attr('x', '5%').attr('y', '10%').attr('width', '60%').attr('height', '80%');
        var vid = fObj.append('xhtml:video').attr('width', '100%').attr('height', '100%')
            .attr('controls', '').attr('id', 'tissue_cutting');
        vid.append('xhtml:source').attr('type', 'video/mp4').attr('src', '../../images/tissue_cutting.mp4');
    }

    function initSolutionsVideo(svg) {
        var fObj = svg.append('foreignObject').attr('x', '27.5%').attr('y', '1%').attr('width', '20%').attr('height', '30%');
        var vid = fObj.append('xhtml:video').attr('width', '100%').attr('height', '100%').attr('controls', '');
        vid.append('xhtml:source').attr('type', 'video/mp4').attr('src', '../../images/moving_tree.mp4');
        svg.append('foreignObject').attr('x', 1000).attr('y', 0).attr('width', 300).attr('height', 220)
            .append('xhtml:div').html('<button id="playme">Play/Pause Video</button>' +
                '<button id="extract1">Extract frame 1</button><button id="extract2">Extract frame 2</button>');
        svg.selectAll('button').each(function () {
            d3.select(this).style('display', 'inline-flex').style('visibility', 'visible')
                .style('height', '60px').style('width', '250px').style('border', '2px solid #BFC0C0')
                .style('margin', '5px').style('color', '#454545').style('text-transform', 'uppercase')
                .style('text-decoration', 'none').style('font-size', '.6em').style('letter-spacing', '1.5px')
                .style('align-items', 'center').style('justify-content', 'center').style('overflow', 'hidden')
                .on('mouseover', function () { d3.select(this).style('border', '2px solid red'); })
                .on('mouseout', function () { d3.select(this).style('border', '2px solid #BFC0C0'); });
        });
        var myvideo = svg.select('video');
        myvideo.style('visibility', 'visible');
        document.getElementById('playme').addEventListener('click', function () {
            if (myvideo.node().paused) myvideo.node().play(); else myvideo.node().pause();
        });
        document.getElementById('extract1').addEventListener('click', function () {
            myvideo.node().pause(); myvideo.node().currentTime = 3;
            show('solutions', svg.select('#line2orig1')).each(animatePath);
            show('solutions', svg.select('#orig1bound')).each(animatePath);
            show('solutions', svg.select('#original1'));
        });
        document.getElementById('extract2').addEventListener('click', function () {
            myvideo.node().pause(); myvideo.node().currentTime = 7;
            show('solutions', svg.select('#line2orig2')).each(animatePath);
            show('solutions', svg.select('#orig2bound')).each(animatePath);
            show('solutions', svg.select('#original2'));
        });
    }

    function initClusteringVideos() {
        if (clusteringInitialized) return;
        clusteringInitialized = true;
        var container = sel('clustering', 'clustering');
        var frameCords = container.select('#rectBox').node().getBBox();
        function addVideo(id, x, y, w, h, src) {
            var fObj = container.append('foreignObject').attr('x', x).attr('y', y).attr('width', w).attr('height', h);
            var vid = fObj.append('xhtml:video').attr('width', '100%').attr('height', id === 'pca_video' ? '90%' : '100%')
                .attr('controls', '').attr('loop', '').attr('id', id);
            vid.append('xhtml:source').attr('type', 'video/mp4').attr('src', src);
        }
        addVideo('k-mean_video', frameCords.x + 40, frameCords.y + 20, frameCords.width - 40, frameCords.height - 40,
            '../../images/Visualizing_K-Means_algorithm_1_eefbvf.mp4');
        addVideo('pca_video', frameCords.x + 20, frameCords.y + 40, frameCords.width - 40, frameCords.height - 40,
            '../../images/PCA_example3.webm');
        function addSourceText(id, text) {
            container.append('text').text(text)
                .attr('x', frameCords.x).attr('y', frameCords.height + 100)
                .attr('width', frameCords.width - 40).attr('height', 40)
                .attr('id', id).style('fill', 'white');
        }
        addSourceText('pca_source', 'source: http://setosa.io/ev/principal-component-analysis/');
        addSourceText('kmean_source', 'source: http://tech.nitoyon.com/en/blog/2013/11/07/k-means/');
        addSourceText('svm_source', 'source: https://medium.com/analytics-vidhya/how-to-classify-non-linear-data-to-linear-data-bb2df1a6b781');
    }

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
                    .transition().duration(800).delay(chDelay).style('visibility', 'visible')
                    .style('stroke-dashoffset', 0).ease(d3.easeLinear)
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
                            .on('end', function () { if (filterRotation) rotate(); });
                    })(i);
                }
                sel('fl_data').select('#filter_wheel').select('path').each(animatePathLin);
                for (var j = 1; j <= 2; j++) sel('fl_data').select('#aro_' + i).each(animatePathLin);
            }
        }
        rotate();
    }

    // ── Slide registrations (original deck) ──────────────────

    SC.registerSlide('fl_data', [
        function (id) {
            show(id, sel('fl_data').select('#raw_signal'));
            show(id, sel('fl_data').select('#filter_wheel'));
            show(id, sel('fl_data').select('#filters'));
            show(id, sel('fl_data').select('#filter_wheel_lines').selectAll('path'));
            sel('fl_data').select('#filter_wheel').select('path').each(animatePathLin);
            for (var i = 1; i <= 2; i++) show(id, sel('fl_data').select('#aro_' + i)).each(animatePath);
            rotateFilter();
        },
        function (id) {
            filterRotation = false;
            sel('fl_data').select('#lft2aro').selectAll('path').each(function () { show(id, d3.select(this)); });
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
        function (id) {
            sel('fl_data').select('#lft2aro').selectAll('path').each(function () { d3.select(this).style('visibility', 'hidden'); });
            show(id, sel('fl_data').select('#fat_raw_data'));
            show(id, sel('fl_data').select('#avg_lifetimes').select('#fat_halo')).each(animatePath);
            show(id, sel('fl_data').select('#avg_lifetimes').select('#fat_line')).each(animatePath);
        },
        function (id) {
            sel('fl_data').select('#aro2bw').selectAll('path').each(function () { show(id, d3.select(this)); });
            sel('fl_data').select('#aro2bw').selectAll('path').each(animatePath);
            sel('fl_data').select('#ch-img').selectAll('image').each(function () { show(id, d3.select(this)); });
            sel('fl_data').select('#ch-img').selectAll('image').each(animateImg);
        },
        function (id) {
            sel('fl_data').select('#aro2bw').selectAll('path').each(function (d, i) {
                d3.select(this).transition().duration(700).delay(100 + (200 * i)).style('stroke', CH_COLORS[i]);
            });
            show(id, sel('fl_data').select('#aro2bw'));
            sel('fl_data').select('#color_labels').selectAll('text').each(function (d, i) {
                d3.select(this).transition().duration(700).delay(100 + (200 * i)).style('visibility', 'visible');
                show(id, d3.select(this));
            });
            show(id, sel('fl_data').select('#color_labels'));
        },
        function (id) {
            sel('fl_data').select('#aro2bw').selectAll('path').style('stroke', '#fff').style('visibility', 'hidden');
            sel('fl_data').select('#color_labels').selectAll('text').style('visibility', 'hidden');
            show(id, sel('fl_data').select('#example-img-1'));
            show(id, sel('fl_data').select('#example-img-2_grp').select('path'));
            show(id, sel('fl_data').select('#example-img-2_grp').select('#colorbar'));
        },
        function (id) { show(id, sel('fl_data').select('#example-img-2')); },
        function (id) {
            var lines = sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines');
            show(id, lines.select('#cancer_aro'));
            show(id, sel('fl_data').select('#avg_lifetimes').select('#cancer_halo'));
            show(id, sel('fl_data').select('#avg_lifetimes').select('#cancer_line'));
            lines.select('#cancer_line').style('Stroke', 'red');
            lines.select('#cancer_halo').style('Stroke', 'red');
        },
        function (id) {
            var lines = sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines');
            show(id, lines.select('#fat_aro'));
            lines.select('#fat_line').style('Stroke', '#435afa');
            lines.select('#fat_halo').style('Stroke', '#435afa');
            show(id, lines);
        },
        function (id) {
            var lines = sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines');
            show(id, lines.select('#stroma_aro'));
            lines.select('#stroma_line').style('Stroke', '#32fecd');
            lines.select('#stroma_halo').style('Stroke', '#32fecd');
        },
    ]);

    SC.registerReset('fl_data', function () {
        sel('fl_data').select('#aro2bw').selectAll('path').each(function () { d3.select(this).style('stroke', '#fff'); });
        sel('fl_data').select('#avg_lifetimes').select('#lifetime_lines')
            .selectAll('path').each(function () { d3.select(this).style('stroke', '#fff'); });
        filterRotation = true;
    });

    SC.registerSlide('training', [
        function (id) { show(id, sel('training', 'why_training').select('#part_data')).each(animateImg); },
        function (id) {
            var wt = sel('training', 'why_training');
            show(id, wt.select('#full_data')).style('opacity', 0).transition().duration(1000).style('opacity', 1);
            wt.transition().duration(1000).ease(d3.easeExp).attr('viewBox', '-225 50 2420 1080');
        },
        function (id) {
            var wt = sel('training', 'why_training');
            wt.select('#full_data').select('#infinite_lines').attr('visibility', 'hidden');
            show(id, wt.select('#classification_abcs'));
            show(id, wt.select('#edge'));
        },
        function (id) { show(id, sel('training', 'why_training').select('#extract_params')); },
        function (id) {
            show(id, sel('training', 'why_training').select('#aro1'));
            show(id, sel('training', 'why_training').select('#identify_features'));
        },
        function (id) {
            show(id, sel('training', 'why_training').select('#aro2'));
            show(id, sel('training', 'why_training').select('#train_classification'));
        },
        function (id) { show(id, sel('training', 'why_training').select('#tagged-grp')); },
    ]);

    SC.registerReset('training', function () {
        sel('training', 'why_training').attr('viewBox', '550 800 600 600');
    });

    SC.registerSlide('clustering', [
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
        },
    ]);

    SC.registerSlide('pixel_level_results', [
        function (id) {
            var p = sel('pixel_level_results', 'pixel_lvl_results');
            p.select('#results_grp').attr('visibility', 'visible');
            p.select('#vis-img').attr('visibility', 'hidden');
            p.select('#orig_tag_img').attr('visibility', 'hidden');
            p.select('#cluster_scan').attr('visibility', 'hidden');
        },
    ]);

    SC.registerReset('pixel_level_results', function () {
        var p = sel('pixel_level_results', 'pixel_lvl_results');
        p.select('#results_grp').attr('visibility', 'hidden');
        p.select('#vis-img').attr('visibility', 'visible');
        p.select('#orig_tag_img').attr('visibility', 'visible');
        p.select('#cluster_scan').attr('visibility', 'visible');
    });

    SC.registerSlide('challenges', [
        function (id) { show(id, sel('challenges', 'protocol').select('#vis-img')); },
        function (id) {
            var p = sel('challenges', 'protocol');
            var mask = p.select('#defs2').select('mask').select('rect');
            show(id, p.select('#c-score-img'));
            var maskH = mask.style('height');
            mask.style('height', 0).style('visibility', 'visible').transition().duration(2000).style('height', maskH);
        },
        function (id) {
            var p = sel('challenges', 'protocol');
            show(id, p.select('#path-img'));
            show(id, p.select('#arrowText'));
            show(id, p.select('#visTopathAro'));
        },
        function (id) { show(id, sel('challenges', 'protocol').select('#scan-outline')).each(animatePathLin); },
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
            p.select('#scan-outline').transition().duration(1000).ease(d3.easeBounceOut)
                .attr('transform', 'translate(' + (toX - fromX) + ',' + (toY - fromY) + ')')
                .on('end', function () { show(id, p.select('#scan-outline-2')); });
            var toCX = p.select('#cancer-outline-2').node().getBBox().x;
            var fromCX = p.select('#cancer-outline').node().getBBox().x;
            var toCY = p.select('#cancer-outline-2').node().getBBox().y;
            var fromCY = p.select('#cancer-outline').node().getBBox().y;
            p.select('#cancer-outline').transition().duration(1000).ease(d3.easeBounceOut)
                .attr('transform', 'translate(' + (toCX - fromCX) + ',' + (toCY - fromCY) + ')')
                .on('end', function () { show(id, p.select('#cancer-outline-2')); });
        },
        function (id) {
            var p = sel('challenges', 'protocol');
            show(id, p.select('#scan-outline-3'));
            show(id, p.select('#cancer-outline-3'));
            anime({
                targets: '#scan-outline-3',
                d: [p.select('#scan-outline-2').attr('d'), p.select('#scan-outline-3').attr('d')],
                duration: 1000, delay: 0, loop: false, direction: 'alternate', easing: 'linear',
            });
            anime({
                targets: '#cancer-outline-3',
                d: [p.select('#cancer-outline-2').attr('d'), p.select('#cancer-outline-3').attr('d')],
                duration: 1000, delay: 0, loop: false, direction: 'alternate', easing: 'linear',
            });
            p.select('#scan-outline').style('visibility', 'hidden');
            p.select('#cancer-outline-2').style('fill-opacity', 0.2);
        },
    ]);

    SC.registerReset('challenges', function () {
        sel('challenges', 'protocol').select('#cancer-outline').attr('transform', '');
        sel('challenges', 'protocol').select('#scan-outline').attr('transform', '');
    });

    SC.registerSlide('additional-factors', [
        function (id) { show(id, sel('additional-factors', 'causes').select('#othercauses')); },
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
        function (id) { show(id, sel('additional-factors', 'causes').select('#finalQuestion')); },
    ]);

    SC.registerSlide('solutions', [
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
        function (id) { show(id, sel('solutions', 'solution').select('#pixelated_solution')); },
    ]);

    SC.registerSlide('solution2', [
        function (id) { show(id, sel('solution2', 'solution2').select('#vis-img')); },
        function (id) { show(id, sel('solution2', 'solution2').select('#confusion_mtx')); },
        function (id) {
            show(id, sel('solution2', 'solution2').select('#grid_over').selectAll('path'))
                .each(animatePathLin);
        },
        function (id) {
            var s = sel('solution2', 'solution2');
            show(id, s.select('#arrow_to'));
            show(id, s.select('#sectors-img'));
        },
    ]);

    // Kick off asset loading when Reveal is ready.
    if (Reveal.isReady && Reveal.isReady()) {
        initSVGs();
    } else {
        Reveal.on('ready', initSVGs);
    }

    // Show clustering videos on first view of the clustering slide.
    Reveal.addEventListener('slidechanged', function (event) {
        var slide = event.currentSlide;
        var id = slide.id || slide.getElementsByTagName('div')[0]?.id;
        if (id === 'clustering') initClusteringVideos();
    });
})();
