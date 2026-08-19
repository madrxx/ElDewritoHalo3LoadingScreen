(function () {
    "use strict";

    var WEBGL_SCRIPTS = [
        "webgl/lib/decimal.js",
        "webgl/lib/mersenne-twister.js",
        "webgl/lib/umsl/cuon-utils.js",
        "webgl/lib/umsl/cuon-matrix.js",
        "webgl/src/math/Rotator.js",
        "webgl/src/math/Interpolator.js",
        "webgl/src/model/LoadingParticle.js",
        "webgl/src/model/LoadingParticleFactory.js",
        "webgl/src/image/ImageLoader.js",
        "webgl/src/model/BackgroundGrid.js",
        "webgl/src/Halo3LoadingScreen.js"
    ];

    var DEFAULT_CONFIG = {
        branding: {
            show: true,
            logo: "eldorito",
            customLogo: "",
            customLogoUsesAlphaMask: false,
            scale: 0.24,
            padding: 0.14
        },
        display: {
            mapName: true,
            gameVariant: true,
            mapDescription: true,
            serverName: true,
            serverMessage: false,
            mapAuthor: false,
            modDetails: false,
            gameRules: false,
            campaignDetails: true
        },
        progress: {
            smoothingSeconds: 1.2,
            velocitySmoothingSeconds: 0.35,
            reportVelocityResponse: 1,
            lagAccelerationThresholdPercent: 8,
            baselineDriftPercentPerSecond: 0.35,
            aheadCrawlPercentPerSecond: 0.02,
            aheadSlowdownThresholdPercent: 5,
            speculativeCeilingPercent: 98,
            finishDurationSeconds: 0.35,
            showPercentage: false
        },
        render: {
            grid: true,
            lines: true,
            blocks: true,
            particles: true,
            vignette: true,
            fadeInSeconds: 1.25,
            fadeOutSeconds: 0.5
        }
    };

    var loadingConfig = mergeConfig(DEFAULT_CONFIG, {});
    var configurationPromise = loadConfiguration();
    var rendererPromise = null;
    var rendererPreparationPromise = null;
    var latestScreenData = {};
    var currentProgress = 0;
    var mapLoading = false;
    var firstRun = true;
    var testingMode = hasUrlFlag("testing");
    var testingTimer = null;
    var testingReportedProgress = 0;
    var testingStatusFrame = null;
    var hideFinishToken = 0;
    var hideFinishing = false;
    var hideRequestSent = false;
    var nativeHideRecoveryPending = false;
    var nativeHideRecoveryToken = 0;

    function mergeConfig(base, override) {
        override = override || {};
        return {
            branding: Object.assign({}, base.branding, override.branding || {}),
            display: Object.assign({}, base.display, override.display || {}),
            progress: Object.assign({}, base.progress, override.progress || {}),
            render: Object.assign({}, base.render, override.render || {})
        };
    }

    function hasUrlFlag(name) {
        var parameters = window.location.search.replace(/^\?/, "").split("&");
        for (var i = 0; i < parameters.length; i++) {
            if (!parameters[i]) continue;
            var pair = parameters[i].split("=");
            if (pair[0].toLowerCase() !== name.toLowerCase()) continue;
            if (pair.length === 1 || pair[1] === "") return true;
            var value = pair.slice(1).join("=").toLowerCase();
            return value !== "0" && value !== "false" && value !== "off";
        }
        return false;
    }

    function loadConfiguration() {
        if (typeof fetch !== "function") return Promise.resolve(loadingConfig);

        return fetch("loading-config.json", { cache: "no-store" })
            .then(function (response) {
                if (!response.ok) throw new Error("HTTP " + response.status);
                return response.json();
            })
            .then(function (configuration) {
                loadingConfig = mergeConfig(DEFAULT_CONFIG, configuration);
                applyMetadata(latestScreenData);
                return loadingConfig;
            })
            .catch(function (error) {
                console.warn("Unable to load loading-config.json; using defaults.", error);
                return loadingConfig;
            });
    }

    function loadScript(source) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = source + (window.loadingBrowserTestingMode ? "?v=20260819-1" : "");
            script.async = false;
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error("Unable to load " + source));
            };
            document.body.appendChild(script);
        });
    }

    function loadWebGLScripts() {
        // CEF does not consistently honor async=false execution order for a batch of
        // dynamically inserted scripts. Load each dependency only after the prior one executes.
        return WEBGL_SCRIPTS.reduce(function (promise, source) {
            return promise.then(function () {
                return loadScript(source);
            });
        }, Promise.resolve());
    }

    function getRendererOptions() {
        var branding = loadingConfig.branding;
        var logo = String(branding.logo || "none").toLowerCase();
        var logoUrl = "";
        var logoUsesAlphaMask = false;

        if (logo === "eldorito") {
            logoUrl = "dew://assets/ed/EldoritoLogoFinalSmall.png";
        } else if (logo === "halo3") {
            logoUrl = "webgl/res/CornerLogo.png";
            logoUsesAlphaMask = true;
        } else if (logo === "halo3-bungie") {
            logoUrl = "webgl/res/CornerLogoBungie.png";
            logoUsesAlphaMask = true;
        } else if (logo === "custom") {
            logoUrl = String(branding.customLogo || "");
            logoUsesAlphaMask = Boolean(branding.customLogoUsesAlphaMask);
        }

        return {
            logoUrl: logoUrl,
            showLogo: Boolean(branding.show) && logo !== "none" && logoUrl.length > 0,
            logoUsesAlphaMask: logoUsesAlphaMask,
            logoScale: Number(branding.scale),
            logoPadding: Number(branding.padding),
            smoothingSeconds: Number(loadingConfig.progress.smoothingSeconds),
            velocitySmoothingSeconds: Number(loadingConfig.progress.velocitySmoothingSeconds),
            reportVelocityResponse: Number(loadingConfig.progress.reportVelocityResponse),
            lagAccelerationThresholdPercent: Number(loadingConfig.progress.lagAccelerationThresholdPercent),
            baselineDriftPercentPerSecond: Number(loadingConfig.progress.baselineDriftPercentPerSecond),
            aheadCrawlPercentPerSecond: Number(loadingConfig.progress.aheadCrawlPercentPerSecond),
            aheadSlowdownThresholdPercent: Number(loadingConfig.progress.aheadSlowdownThresholdPercent),
            speculativeCeilingPercent: Number(loadingConfig.progress.speculativeCeilingPercent),
            finishDurationSeconds: Number(loadingConfig.progress.finishDurationSeconds),
            showGrid: Boolean(loadingConfig.render.grid) &&
                !(window.loadingBrowserTestingMode && window.location.protocol === "file:"),
            showLines: Boolean(loadingConfig.render.lines),
            showBlocks: Boolean(loadingConfig.render.blocks),
            showParticles: Boolean(loadingConfig.render.particles),
            showVignette: Boolean(loadingConfig.render.vignette)
        };
    }

    function prepareRenderer() {
        if (rendererPreparationPromise) return rendererPreparationPromise;

        var rendererOptions;
        rendererPreparationPromise = Promise.all([configurationPromise, loadWebGLScripts()])
            .then(function () {
                rendererOptions = getRendererOptions();
                window.Halo3LoadingScreen.configure(rendererOptions);
                return rendererOptions.showGrid
                    ? window.BackgroundGrid.load("webgl/res/BackgroundGrid.bin")
                    : Promise.resolve();
            })
            .then(function () {
                return rendererOptions;
            });

        return rendererPreparationPromise;
    }

    function showRendererError(error) {
        var message = error && error.message ? error.message : String(error);
        var errorElement = document.getElementById("renderer-error");
        errorElement.textContent = message === "WebGL 2 is unavailable"
            ? "WebGL 2 is required for the loading animation."
            : "Loading animation failed: " + message;
        window.loadingRendererError = message;
        document.documentElement.classList.add("renderer-unavailable");
        console.error("Unable to start the Halo 3 loading renderer.", error);
    }

    function ensureRenderer() {
        if (rendererPromise) return rendererPromise;

        rendererPromise = prepareRenderer()
            .then(function () {
                // The CEF browser itself must be visible before creating its WebGL context.
                document.getElementById("map-loader").style.display = "block";
                window.Halo3LoadingScreen.setActive(false);
                return Promise.resolve(window.Halo3LoadingScreen.start());
            })
            .then(function (started) {
                if (!started) throw new Error("WebGL 2 is unavailable");
                window.Halo3LoadingScreen.setProgress(0, true);
                window.Halo3LoadingScreen.setProgress(currentProgress, false);
                window.Halo3LoadingScreen.setActive(mapLoading);
            })
            .catch(function (error) {
                showRendererError(error);
                throw error;
            });

        return rendererPromise;
    }

    function ensureRendererWhenVisible() {
        if (rendererPromise) return rendererPromise;

        return new Promise(function (resolve, reject) {
            requestAnimationFrame(function () {
                setTimeout(function () {
                    ensureRenderer().then(resolve, reject);
                }, 0);
            });
        });
    }

    function hasValue(value) {
        return value !== undefined && value !== null && String(value).trim().length > 0;
    }

    function setField(fieldId, valueId, value, enabled) {
        var field = document.getElementById(fieldId);
        var valueElement = document.getElementById(valueId);
        var visible = Boolean(enabled) && hasValue(value);

        field.hidden = !visible;
        valueElement.textContent = visible ? String(value) : "";
    }

    function setGroupVisibility(groupId, fieldIds) {
        var visible = fieldIds.some(function (fieldId) {
            return !document.getElementById(fieldId).hidden;
        });
        document.getElementById(groupId).hidden = !visible;
        return visible;
    }

    function formatRules(info) {
        var rules = [];
        if (Number(info.rounds) > 0) rules.push("Rounds " + info.rounds);
        else if (Number(info.rounds) === 0) rules.push("Unlimited rounds");

        if (Number(info.scoreToWin) > -1) rules.push("Score " + info.scoreToWin);
        else if (Number(info.scoreToWin) === -1) rules.push("Unlimited score");

        if (Number(info.timeLimit) > 0) rules.push("Time " + info.timeLimit + ":00");
        else if (Number(info.timeLimit) === 0) rules.push("No time limit");

        return rules.join(" / ");
    }

    function formatCampaignDetails(info) {
        var details = [];
        if (hasValue(info.insertionPointName)) details.push(info.insertionPointName);
        if (hasValue(info.difficulty)) details.push(info.difficulty);
        if (Array.isArray(info.skulls) && info.skulls.length > 0) {
            details.push(info.skulls.join(", "));
        }
        return details.join(" / ");
    }

    function formatModDetails(info) {
        if (!hasValue(info.modHash)) return "";

        var name = hasValue(info.modName) ? info.modName : "Unnamed mod";
        if (hasValue(info.modVersion)) name += " " + info.modVersion;
        if (hasValue(info.modAuthor)) name += " by " + info.modAuthor;
        return name;
    }

    function applyMetadata(info) {
        info = info || {};
        var display = loadingConfig.display;
        var campaign = Number(info.gameMode) === 1;

        setField("map-name-field", "map-name", info.mapName || info.map, display.mapName);
        setField("game-variant-field", "game-variant", info.gameType, display.gameVariant && !campaign);
        setField("map-description-field", "map-description", info.mapDescription, display.mapDescription);
        setField("server-name-field", "server-name", info.serverName, display.serverName && !campaign);
        setField(
            "server-message-field",
            "server-message",
            hasValue(info.serverMessage) ? String(info.serverMessage).slice(0, 512).replace(/\\n/g, "\n") : "",
            display.serverMessage && !campaign
        );
        setField("map-author-field", "map-author", info.mapAuthor, display.mapAuthor && !campaign);
        setField("mod-details-field", "mod-details", formatModDetails(info), display.modDetails && !campaign);
        setField("game-rules-field", "game-rules", formatRules(info), display.gameRules && !campaign);
        setField(
            "campaign-details-field",
            "campaign-details",
            formatCampaignDetails(info),
            display.campaignDetails && campaign
        );
        setField(
            "progress-percentage-field",
            "progress-percentage",
            Math.round(currentProgress * 100) + "%",
            loadingConfig.progress.showPercentage
        );

        var sessionVisible = setGroupVisibility(
            "session-details",
            ["game-variant-field", "game-rules-field"]
        );
        var serverVisible = setGroupVisibility(
            "server-details",
            ["server-name-field", "server-message-field"]
        );
        var mapVisible = setGroupVisibility(
            "map-details",
            [
                "map-name-field",
                "campaign-details-field",
                "map-description-field",
                "map-author-field",
                "mod-details-field"
            ]
        );
        document.getElementById("metadata").hidden = !(
            sessionVisible ||
            serverVisible ||
            mapVisible ||
            !document.getElementById("progress-percentage-field").hidden
        );
    }

    function fadeInGenericLoader() {
        var genericLoader = document.querySelector(".genericLoader");
        var duration = firstRun ? 1000 : 200;

        genericLoader.style.display = "block";
        genericLoader.style.opacity = "0";
        genericLoader.style.transition = "opacity " + duration + "ms linear";
        requestAnimationFrame(function () {
            genericLoader.style.opacity = "1";
        });
        firstRun = false;
    }
    function prepareMapFade() {
        var mapLoader = document.getElementById("map-loader");
        var fade = document.getElementById("map-fade");
        var fadeSeconds = Number(loadingConfig.render.fadeInSeconds);

        mapLoader.style.setProperty(
            "--map-fade-seconds",
            (Number.isFinite(fadeSeconds) ? Math.max(fadeSeconds, 0) : 1.25) + "s"
        );
        fade.style.transition = "none";
        fade.classList.remove("revealed");
        void fade.offsetWidth;
        fade.style.transition = "";
    }

    function revealMapFade() {
        requestAnimationFrame(function () {
            if (mapLoading) document.getElementById("map-fade").classList.add("revealed");
        });
    }


    function resetMapLoaderFade() {
        var mapLoader = document.getElementById("map-loader");
        mapLoader.style.transition = "none";
        mapLoader.classList.remove("hiding");
        mapLoader.style.removeProperty("--map-hide-seconds");
        mapLoader.style.removeProperty("opacity");
        void mapLoader.offsetWidth;
        mapLoader.style.transition = "";
    }

    function loadMap(info) {
        hideFinishToken++;
        hideFinishing = false;
        hideRequestSent = false;
        nativeHideRecoveryPending = false;
        nativeHideRecoveryToken++;
        resetMapLoaderFade();
        mapLoading = true;
        latestScreenData = info || {};
        document.querySelector(".genericLoader").style.display = "none";
        document.getElementById("map-loader").style.display = "block";
        prepareMapFade();
        applyMetadata(latestScreenData);

        ensureRendererWhenVisible().then(function () {
            if (mapLoading) prepareMapFade();
            window.Halo3LoadingScreen.setActive(mapLoading);
            revealMapFade();
        }).catch(function () {
            // The visible WebGL error state is set by ensureRenderer.
        });
    }

    function loadGeneric() {
        hideFinishToken++;
        hideFinishing = false;
        hideRequestSent = false;
        nativeHideRecoveryPending = false;
        nativeHideRecoveryToken++;
        resetMapLoaderFade();
        mapLoading = false;
        document.getElementById("map-loader").style.display = "none";
        fadeInGenericLoader();
        if (window.Halo3LoadingScreen) window.Halo3LoadingScreen.setActive(false);
        ensureRendererWhenVisible().catch(function () {
            // A later map show will surface the prepared renderer's diagnostic.
        });
    }

    function resetLoader() {
        hideFinishToken++;
        hideFinishing = false;
        hideRequestSent = false;
        nativeHideRecoveryPending = false;
        nativeHideRecoveryToken++;
        resetMapLoaderFade();
        mapLoading = false;
        document.querySelector(".genericLoader").style.display = "none";
        document.getElementById("map-loader").style.display = "none";
        if (window.Halo3LoadingScreen) {
            window.Halo3LoadingScreen.setProgress(0, true);
            window.Halo3LoadingScreen.setActive(false);
        }
    }

    function recoverFromNativeHide() {
        if (nativeHideRecoveryPending || hideRequestSent || !mapLoading) return;

        nativeHideRecoveryPending = true;
        nativeHideRecoveryToken++;
        hideFinishToken++;
        hideFinishing = false;
        resetMapLoaderFade();

        if (window.dew && typeof dew.show === "function") {
            dew.show("loading", latestScreenData);
        } else {
            nativeHideRecoveryPending = false;
            finishLoaderBeforeHide();
        }
    }

    function finishLoaderBeforeHide() {
        if (hideFinishing) return;
        if (!mapLoading) {
            resetLoader();
            return;
        }

        hideFinishing = true;
        var finishToken = ++hideFinishToken;
        var finishStart = performance.now();
        var fadeDuration = Math.max(
            0,
            Math.min(Number(loadingConfig.render.fadeOutSeconds) || 0, 0.5)
        );
        var ringDuration = Math.max(
            0,
            Math.min(Number(loadingConfig.progress.finishDurationSeconds) || 0, 0.5)
        );
        var maximumWait = Math.max(
            Math.max(fadeDuration, ringDuration) * 1000 + 1000,
            2000
        );
        var mapLoader = document.getElementById("map-loader");
        var renderer = window.Halo3LoadingScreen;

        updateProgress(100, false);
        if (renderer) {
            renderer.setActive(true);
            renderer.finish();
        }

        mapLoader.style.setProperty("--map-hide-seconds", fadeDuration + "s");
        void mapLoader.offsetWidth;
        mapLoader.classList.add("hiding");

        function requestHide() {
            if (finishToken !== hideFinishToken || hideRequestSent) return;
            hideRequestSent = true;
            if (window.dew && typeof dew.hide === "function") dew.hide();
            requestAnimationFrame(function () {
                if (finishToken === hideFinishToken) resetLoader();
            });
        }

        function waitForCompletion() {
            if (finishToken !== hideFinishToken) return;

            var progress = renderer ? renderer.getProgress() : null;
            var elapsed = performance.now() - finishStart;
            var timedOut = elapsed >= maximumWait;
            var fadeComplete = elapsed >= fadeDuration * 1000;
            var fadeOpacity = Number.parseFloat(getComputedStyle(mapLoader).opacity);
            var fadeTransparent = fadeOpacity <= 0.001;
            var ringComplete = !progress ||
                (progress.displayed >= 1 && !progress.finishing);

            if (timedOut && !fadeTransparent) {
                mapLoader.style.transition = "none";
                mapLoader.style.opacity = "0";
                requestAnimationFrame(waitForCompletion);
                return;
            }
            if ((ringComplete && fadeComplete && fadeTransparent) ||
                (timedOut && fadeTransparent)) {
                requestHide();
                return;
            }
            requestAnimationFrame(waitForCompletion);
        }

        requestAnimationFrame(waitForCompletion);
    }

    function updateProgress(progress, reset) {
        var percentage = Math.max(0, Math.min(Number(progress) || 0, 100));
        currentProgress = percentage / 100;

        if (mapLoading) {
            if (window.Halo3LoadingScreen) {
                window.Halo3LoadingScreen.setProgress(currentProgress, Boolean(reset));
            }
            setField(
                "progress-percentage-field",
                "progress-percentage",
                Math.round(percentage) + "%",
                loadingConfig.progress.showPercentage
            );
        } else {
            document.querySelector(".genericLoader .loading").style.webkitClipPath =
                "inset(" + percentage + "% 0 0 0)";
        }
    }

    function getTestingNumber(id, fallback, minimum) {
        var value = Number(document.getElementById(id).value);
        if (!Number.isFinite(value)) value = fallback;
        return Math.max(value, minimum);
    }

    function stopTestingSimulation() {
        if (testingTimer !== null) {
            clearTimeout(testingTimer);
            testingTimer = null;
        }
    }

    function setTestingProgress(progress, reset, finish) {
        var normalized = Math.max(0, Math.min(Number(progress) || 0, 1));
        var shouldReset = Boolean(reset) || normalized < testingReportedProgress;
        testingReportedProgress = normalized;
        updateProgress(normalized * 100, shouldReset);
        if (finish && normalized >= 1 && window.Halo3LoadingScreen) {
            window.Halo3LoadingScreen.finish();
        }

        var slider = document.getElementById("testing-progress");
        var output = document.getElementById("testing-progress-value");
        if (slider) slider.value = String(normalized * 100);
        if (output) output.textContent = (normalized * 100).toFixed(1) + "%";
    }

    function applyTestingTuning() {
        if (!window.Halo3LoadingScreen) return;
        window.Halo3LoadingScreen.setTuning({
            smoothingSeconds: getTestingNumber("testing-smoothing", 1.2, 0),
            velocitySmoothingSeconds: getTestingNumber("testing-velocity-smoothing", 0.35, 0),
            reportVelocityResponse: getTestingNumber("testing-report-response", 1, 0),
            lagAccelerationThresholdPercent: getTestingNumber("testing-lag-threshold", 8, 0),
            baselineDriftPercentPerSecond: getTestingNumber("testing-baseline-drift", 0.35, 0),
            aheadCrawlPercentPerSecond: getTestingNumber("testing-ahead-crawl", 0.02, 0),
            aheadSlowdownThresholdPercent: getTestingNumber("testing-ahead-slowdown", 5, 0),
            speculativeCeilingPercent: getTestingNumber("testing-speculative-ceiling", 98, 0),
            finishDurationSeconds: getTestingNumber("testing-finish-duration", 0.35, 0)
        });
    }

    function startTestingSimulation() {
        stopTestingSimulation();
        applyTestingTuning();

        if (testingReportedProgress >= 1) setTestingProgress(0, true);

        var totalDuration = getTestingNumber("testing-duration", 8, 0.1) * 1000;
        var eventInterval = getTestingNumber("testing-interval", 100, 16);
        var initialProgress = testingReportedProgress;
        var remainingDuration = Math.max(totalDuration * (1 - initialProgress), 1);
        var startTime = performance.now();

        function tick() {
            var elapsed = performance.now() - startTime;
            var factor = Math.min(elapsed / remainingDuration, 1);
            setTestingProgress(
                initialProgress + (1 - initialProgress) * factor,
                false,
                factor >= 1
            );

            if (factor < 1) {
                testingTimer = setTimeout(tick, Math.min(eventInterval, remainingDuration - elapsed));
            } else {
                testingTimer = null;
            }
        }

        tick();
    }

    function updateTestingReadout(frameTime) {
        var readout = document.getElementById("testing-readout");
        if (!readout) return;

        if (!updateTestingReadout.sampleTime) {
            updateTestingReadout.sampleTime = frameTime;
            updateTestingReadout.frameCount = 0;
            updateTestingReadout.fps = 0;
        }
        updateTestingReadout.frameCount++;
        var sampleDuration = frameTime - updateTestingReadout.sampleTime;
        if (sampleDuration >= 500) {
            updateTestingReadout.fps = updateTestingReadout.frameCount * 1000 / sampleDuration;
            updateTestingReadout.sampleTime = frameTime;
            updateTestingReadout.frameCount = 0;
        }

        if (window.Halo3LoadingScreen) {
            var progress = window.Halo3LoadingScreen.getProgress();
            readout.textContent = [
                "FPS              " + updateTestingReadout.fps.toFixed(1),
                "Reported         " + (progress.target * 100).toFixed(2) + "%",
                "Rendered         " + (progress.displayed * 100).toFixed(2) + "%",
                "Ring velocity    " + (progress.velocity * 100).toFixed(2) + "%/s",
                "Report velocity  " + (progress.reportedVelocity * 100).toFixed(2) + "%/s",
                "Camera distance  " + progress.cameraDistance.toFixed(3),
                "Finishing        " + (progress.finishing ? "yes" : "no")
            ].join("\n");
        } else {
            readout.textContent = "Preparing renderer...";
        }

        testingStatusFrame = requestAnimationFrame(updateTestingReadout);
    }

    function createTestingControls() {
        if (document.getElementById("testing-controls")) return;

        var panel = document.createElement("aside");
        panel.id = "testing-controls";
        panel.innerHTML = [
            "<h2>Loading Test</h2>",
            "<div class=\"testing-actions\">",
            "<button type=\"button\" id=\"testing-start\">Start</button>",
            "<button type=\"button\" id=\"testing-pause\">Pause</button>",
            "<button type=\"button\" id=\"testing-reset\">Reset</button>",
            "<button type=\"button\" id=\"testing-complete\">Complete</button>",
            "</div>",
            "<label class=\"testing-control\"><span>Total load time</span>",
            "<input id=\"testing-duration\" type=\"number\" min=\"0.1\" step=\"0.5\" value=\"8\"><b>s</b></label>",
            "<label class=\"testing-control\"><span>Progress event interval</span>",
            "<input id=\"testing-interval\" type=\"number\" min=\"16\" step=\"16\" value=\"100\"><b>ms</b></label>",
            "<label class=\"testing-progress-control\"><span>Reported progress</span>",
            "<input id=\"testing-progress\" type=\"range\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\">",
            "<output id=\"testing-progress-value\">0.0%</output></label>",
            "<fieldset><legend>Interpolation</legend>",
            "<label class=\"testing-control\"><span>Position smoothing</span>",
            "<input id=\"testing-smoothing\" type=\"number\" min=\"0\" step=\"0.05\"><b>s</b></label>",
            "<label class=\"testing-control\"><span>Velocity smoothing</span>",
            "<input id=\"testing-velocity-smoothing\" type=\"number\" min=\"0\" step=\"0.05\"><b>s</b></label>",
            "<label class=\"testing-control\"><span>Report velocity response</span>",
            "<input id=\"testing-report-response\" type=\"number\" min=\"0\" step=\"0.1\"><b>x</b></label>",
            "<label class=\"testing-control\"><span>Lag acceleration threshold</span>",
            "<input id=\"testing-lag-threshold\" type=\"number\" min=\"0\" max=\"100\" step=\"0.5\"><b>%</b></label>",
            "<label class=\"testing-control\"><span>Baseline drift</span>",
            "<input id=\"testing-baseline-drift\" type=\"number\" min=\"0\" step=\"0.05\"><b>%/s</b></label>",
            "<label class=\"testing-control\"><span>Ahead crawl</span>",
            "<input id=\"testing-ahead-crawl\" type=\"number\" min=\"0\" step=\"0.01\"><b>%/s</b></label>",
            "<label class=\"testing-control\"><span>Ahead slowdown</span>",
            "<input id=\"testing-ahead-slowdown\" type=\"number\" min=\"0\" step=\"0.5\"><b>%</b></label>",
            "<label class=\"testing-control\"><span>Speculative ceiling</span>",
            "<input id=\"testing-speculative-ceiling\" type=\"number\" min=\"0\" max=\"99.9\" step=\"0.5\"><b>%</b></label>",
            "<label class=\"testing-control\"><span>Finish duration</span>",
            "<input id=\"testing-finish-duration\" type=\"number\" min=\"0\" max=\"0.5\" step=\"0.05\"><b>s</b></label>",
            "<button type=\"button\" id=\"testing-apply\">Apply interpolation</button>",
            "</fieldset>",
            "<pre id=\"testing-readout\">Preparing renderer...</pre>"
        ].join("");
        document.body.appendChild(panel);

        var progressConfig = loadingConfig.progress;
        document.getElementById("testing-smoothing").value = String(progressConfig.smoothingSeconds);
        document.getElementById("testing-velocity-smoothing").value =
            String(progressConfig.velocitySmoothingSeconds);
        document.getElementById("testing-report-response").value =
            String(progressConfig.reportVelocityResponse);
        document.getElementById("testing-lag-threshold").value =
            String(progressConfig.lagAccelerationThresholdPercent);
        document.getElementById("testing-baseline-drift").value =
            String(progressConfig.baselineDriftPercentPerSecond);
        document.getElementById("testing-ahead-crawl").value =
            String(progressConfig.aheadCrawlPercentPerSecond);
        document.getElementById("testing-ahead-slowdown").value =
            String(progressConfig.aheadSlowdownThresholdPercent);
        document.getElementById("testing-speculative-ceiling").value =
            String(progressConfig.speculativeCeilingPercent);
        document.getElementById("testing-finish-duration").value =
            String(progressConfig.finishDurationSeconds);

        document.getElementById("testing-start").addEventListener("click", startTestingSimulation);
        document.getElementById("testing-pause").addEventListener("click", stopTestingSimulation);
        document.getElementById("testing-reset").addEventListener("click", function () {
            stopTestingSimulation();
            setTestingProgress(0, true);
        });
        document.getElementById("testing-complete").addEventListener("click", function () {
            stopTestingSimulation();
            setTestingProgress(1, false, true);
        });
        document.getElementById("testing-apply").addEventListener("click", applyTestingTuning);
        document.getElementById("testing-progress").addEventListener("input", function () {
            stopTestingSimulation();
            setTestingProgress(Number(this.value) / 100, false);
        });

        if (testingStatusFrame === null) {
            testingStatusFrame = requestAnimationFrame(updateTestingReadout);
        }
    }

    function initializeTestingMode() {
        document.documentElement.classList.add("testing-mode");
        if (window.dew && typeof dew.captureInput === "function") dew.captureInput(true);

        configurationPromise.then(function () {
            createTestingControls();
            loadMap({
                map: "guardian",
                mapName: "Loading Test",
                mapDescription: "URL testing mode",
                gameMode: 0,
                gameType: "Simulation",
                serverName: "Local"
            });
            setTestingProgress(0, true);
        }).catch(function () {
            // The testing panel remains visible with the renderer diagnostic.
        });
    }

    document.documentElement.addEventListener("keydown", function (event) {
        if (testingMode) return;
        if (!window.dew) return;

        if (event.which === 84 || event.which === 89) {
            dew.show("chat", {
                captureInput: true,
                teamChat: event.which === 89
            });
        }
        if (event.which === 192 || event.which === 112) dew.show("console");
    });

    if (window.dew && typeof dew.on === "function") {
        dew.on("show", function (event) {
            if (testingMode) return;
            var data = event.data || {};
            var mapName = data.map || "";

            if (nativeHideRecoveryPending && mapName !== "mainmenu" && mapName !== "") {
                var recoveryToken = nativeHideRecoveryToken;
                nativeHideRecoveryPending = false;
                mapLoading = true;
                latestScreenData = data;
                resetMapLoaderFade();
                document.querySelector(".genericLoader").style.display = "none";
                document.getElementById("map-loader").style.display = "block";
                applyMetadata(latestScreenData);
                dew.captureInput(true);

                ensureRendererWhenVisible().then(function () {
                    window.Halo3LoadingScreen.setActive(true);
                    requestAnimationFrame(function () {
                        requestAnimationFrame(function () {
                            if (recoveryToken === nativeHideRecoveryToken &&
                                mapLoading && !hideRequestSent) {
                                finishLoaderBeforeHide();
                            }
                        });
                    });
                }).catch(function () {
                    finishLoaderBeforeHide();
                });
                return;
            }

            currentProgress = 0;
            if (mapName !== "mainmenu" && mapName !== "") {
                loadMap(data);
                dew.captureInput(true);
            } else {
                loadGeneric();
                dew.captureInput(false);
            }
            updateProgress(0, true);
        });

        dew.on("hide", function () {
            if (testingMode) return;
            if (hideRequestSent || !mapLoading) {
                resetLoader();
                return;
            }
            recoverFromNativeHide();
        });

        dew.on("loadprogress", function (event) {
            if (testingMode) return;
            var data = event.data || {};
            var totalBytes = Number(data.totalBytes);
            var progress = totalBytes > 0 ? Number(data.currentBytes) / totalBytes * 100 : 0;
            updateProgress(progress, false);
            if (mapLoading && progress >= 100) finishLoaderBeforeHide();
        });
    }

    // Fetch and parse all non-WebGL dependencies immediately. Context creation waits for the
    // first visible overlay frame because hidden CEF browser surfaces cannot reliably create it.
    prepareRenderer().catch(function () {
        // ensureRendererWhenVisible owns the visible error state and diagnostic.
    });

    if (testingMode) initializeTestingMode();
}());