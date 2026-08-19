/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.03.2020
 *
 *  A WebGL recreation of Halo 3's Loading Screen.
 *  
 *  This program was built atop a simple GPU-based particle shader program
 *  provided by Dr. Henry Kang in UMSL's Topics in Computer Graphics course.
 *  We stand on the shoulders of giants.
 */ 



/*--- Global Configuration ---*/

let config = {
	SPEED: 1.1,                                // Speed of animation
    LENGTH_LOOP:80000,                         // Length of full animation (Final = 75000)
	LENGTH_START_DELAY: 600,                   // Time between full canvas visibility and animation start
	LENGTH_ASSEMBLY_DELAY: 2000,               // Time between animation start and ring assembly start
	LENGTH_RING_ASSEMBLY: 71000,               // Final = 66000
	LENGTH_SLICE_ASSEMBLY: 20,
	LENGTH_PARTICLE_FADE: 1000,                // Length of each particle's fade-in
	LENGTH_BLOCK_FADE: 70,
	LENGTH_BLOCK_HIGHLIGHT: 1000,
	LENGTH_SCENE_FADE: 1500,                   // Length of scene fade-out
    PROGRESS_SMOOTHING_SECONDS: 1.2,            // Loading progress positional correction time
    PROGRESS_VELOCITY_SMOOTHING_SECONDS: 0.35,
    PROGRESS_REPORT_VELOCITY_RESPONSE: 1,
    PROGRESS_LAG_ACCELERATION_THRESHOLD: 0.08,
    PROGRESS_BASELINE_RATE: 0.0035,
    PROGRESS_AHEAD_CRAWL_RATE: 0.0002,
    PROGRESS_AHEAD_SLOWDOWN_DISTANCE: 0.05,
    PROGRESS_SPECULATIVE_CEILING: 0.98,
    PROGRESS_SPECULATIVE_CEILING_SECONDS: 30,
    PROGRESS_FINISH_DURATION_SECONDS: 0.35,
	RESOLUTION_SCALE: 1.0,                     // Default: 1080p
	BACKGROUND_GRID_ALPHA: 0.045,
	VINGETTE_FACTOR: 0.7,
    RING_SLICES: 1950,                         // Final = 1950
    RING_RADIUS: 3,
    AMBIENT_PARTICLES: 50000,
    AMBIENT_WIDTH: 5,                          // Horizontal area in which ambient particles are rendered
    AMBIENT_HEIGHT: 1.2,                       // Vertical area in which ambient particles are rendered
    AMBIENT_DRIFT: 0.8,                        // Speed at which ambient particles randomly move
    SLICE_PARTICLES: 62,                       // Must be even & match particle offset generation function below
    SLICE_SIZE: 0.006,                         // Distance between slice particles
    SLICE_WIDTH: 4,                            // Number of particles on top and bottom edges of ring
    SLICE_HEIGHT: NaN,                         // Calculated below: ((SLICE_PARTICLES / 2) - SLICE_WIDTH) + 1
    PARTICLE_SIZE: 2.5,
    PARTICLE_WAIT_VARIATION: 500,              // Amount of random flux in particle wait
    PARTICLE_SIZE_CLAMP: false,                // Whether to clamp max particle size when particle scaling enabled
    CAMERA_DIST_MAX: 14,                       // Maximum distance particles are expected to be from camera
    CAMERA_DIST_FACTOR: 1.65,                  // Multiplier for camera-position dependent effects
    CAMERA_FOV: 50,
    LOGO_SCALE: 0.3,                           // Logo Scale Relative to Screen Size
    LOGO_PADDING: 0.2,                         // Logo Padding Relative to Screen Size
    LOGO_ASPECT_RATIO: 16 / 9,                 // Source texture width divided by height
    USE_LOGO_AS_ALPHA: true,                   // Whether to treat logo as simple black/white alpha mask
    LINE_RESOLUTION: 1951,                     // Points Along Ring Guide Lines (Must Be Odd)
    LINE_OFFSET: .0002,                        // Distance Between Duplicate Guide Lines
    LINE_ALPHA: .13,
    ENABLE_BLOCK_RENDERING: true,              // Whether to render blocks
    ENABLE_DEVELOPER_CAMERA: false,            // Places camera statically perpindicular to first slice
    ENABLE_PARTICLES: true,
    ENABLE_PARTICLE_SCALING: true,             // Whether particle size changes based on distance from camera
    ENABLE_ALPHA_SCALING: true,                // Whether particle alpha changes based on distance from camera
    ENABLE_LOGO: true,                         // whether to render logo
    ENABLE_LINES: true,                        // Whether to render guide lines
    ENABLE_LINE_THICKNESS_HACK: true,          // Whether to render duplicate guide lines
    ENABLE_BACKGROUND_GRID: true,              // Whether to render background grid
    ENABLE_VINGETTE: true,                     // Whether to render vingette effect
    TEXTURE_BLOCK: "webgl/res/BlockTexture.png",
    TEXTURE_LOGO: "webgl/res/CornerLogoBungie.png",
    TEXTURE_VINGETTE: "webgl/res/VignetteAlpha.png"
}

// Color Constants
let color = {
	BACKGROUND: [0.0, 0.0, 0.0, 0.0],
	VINGETTE: [0.0, 0.0, 0.0, 0.0],
	PARTICLE: [0.5, 0.9, 1.0, 1.0],
	BLOCK: [0.28, 0.678, 0.86, 1.0],
	LOGO: [0.45, 0.82, 1.0, 1.0],
	LINE: [0.45, 0.8, 1.0, 1.0],
	GRID: [0.45, 0.8, 1.0, 1.0]
}

// Generated Global Initialization
config.PARTICLE_SIZE = config.PARTICLE_SIZE * config.RESOLUTION_SCALE;
config.TEXTURE_SIZE = Math.ceil(Math.sqrt(config.RING_SLICES * config.SLICE_PARTICLES + config.AMBIENT_PARTICLES));
if (config.SLICE_WIDTH == config.SLICE_PARTICLES) config.SLICE_HEIGHT = 1;
else if (config.SLICE_WIDTH == config.SLICE_PARTICLES / 2) config.SLICE_HEIGHT = 2;
else config.SLICE_HEIGHT = ((config.SLICE_PARTICLES / 2) - config.SLICE_WIDTH) + 2;



/*--- Variable Declarations ---*/

let gl, canvas;
let g_proj_mat = new Matrix4();
let g_view_mat = new Matrix4();

let vao_data_texture;           // VAO For Drawing Data Textures (2 Triangles)
let vao_blocks;                 // VAO For Drawing Ring Blocks
let vao_logo;                   // VAO For Drawing Halo Logo (2 Triangles)
let vao_line;                   // VAO For Drawing Single Ring Line Path
let vao_vingette;               // VAO For Drawing Background Vingette 

let vao_grid;                   // VAO For Drawing Background Grid
let grid_vertex_count = 0;
let block_group_first_appearance = [];

let uv_coord_data_buffer;       // Contains UV coordinates for each pixel in particle data textures 

let prog_particle;              // Particle Renderer
let prog_position;              // Particle Position Updater
let prog_data;                  // Particle Data Updater
let prog_blocks;                // Block Renderer
let prog_logo;                  // Logo Renderer
let prog_grid;                  // Grid Renderer
let prog_vingette;              // Vingette Renderer

let fbo_pos_initial;            // Particle Initial Position
let fbo_pos_swerve;             // Particle Swerve Position
let fbo_pos_final;              // Particle Final Position
let fbo_pos;                    // Particle Position
let fbo_data_dynamic;           // Changing Particle Metadata
let fbo_data_static;            // Unchanging Particle Metadata

let texture_list = [];
let viewport_width = -1;
let viewport_height = -1;

let camera_pos = [];
let camera_pos_control_points = [
    [-2.5, -0.2,  1.3],
    [-2.5, 0.11,  2.9],
    [ 1.2,  .175, 5.4],
    [ 2.2,  .19,  1.8],
    [ 2.5,  .175, 1.1]
];
let camera_pos_interpolator = new Interpolator(camera_pos_control_points);
let camera_focus = [];
let camera_focus_control_points = [
    [   -3,    0,    0],
    [ -2.1, -.045, 3.3],
    [ 2.88, -.02,  3.3],
    [  2.9,  -.15, -.5]
];
let camera_focus_interpolator = new Interpolator(camera_focus_control_points);

//                 [ Top1     Top2    Top3    Bottom1   Bottom2   Bottom3]
let line_heights = [ 0.0842,  0.0721, 0.06,   -0.0842,  -0.0721,  -0.06  ];
let line_radii   = [ 2.9855,  3.009,  3.0149, 2.9855,   3.009,    3.0149 ];
let line_factors = [ 1.012,   0.973,  0.946,  1.03,   1.054,    0.982  ];
let line_offsets = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
let line_progress_control_points = [[0.0], [0.2], [0.42], [0.59], [0.8], [1.0]];
let line_progress_interpolator = new Interpolator(line_progress_control_points);

let start_time, time;
let loading_progress_target = 0;
let loading_progress_display = 0;
let loading_progress_frame_time = 0;
let loading_progress_velocity = 0;
let loading_progress_reported_velocity = 0;
let loading_progress_report_time = 0;
let camera_track_distance = 0;
let loading_progress_finishing = false;
let loading_progress_finish_start_time = 0;
let loading_progress_finish_start = 0;
let loading_progress_finish_tangent = 0;
let loading_progress_finish_duration = 0;
let renderer_started = false;
let renderer_active = true;
let renderer_update = null;
let renderer_frame_pending = false;
let renderer_start_promise = null;

function setHalo3LoadingProgressTuning(options) {
    if (!options) return;

    if (Number.isFinite(options.smoothingSeconds)) {
        config.PROGRESS_SMOOTHING_SECONDS = Math.max(0, options.smoothingSeconds);
    }
    if (Number.isFinite(options.velocitySmoothingSeconds)) {
        config.PROGRESS_VELOCITY_SMOOTHING_SECONDS = Math.max(0, options.velocitySmoothingSeconds);
    }
    if (Number.isFinite(options.reportVelocityResponse)) {
        config.PROGRESS_REPORT_VELOCITY_RESPONSE = Math.max(0, options.reportVelocityResponse);
    }
    if (Number.isFinite(options.lagAccelerationThresholdPercent)) {
        config.PROGRESS_LAG_ACCELERATION_THRESHOLD = Math.max(
            0,
            Math.min(options.lagAccelerationThresholdPercent / 100, 1)
        );
    }
    if (Number.isFinite(options.baselineDriftPercentPerSecond)) {
        config.PROGRESS_BASELINE_RATE = Math.max(0, options.baselineDriftPercentPerSecond / 100);
    }
    if (Number.isFinite(options.aheadCrawlPercentPerSecond)) {
        config.PROGRESS_AHEAD_CRAWL_RATE = Math.max(0, options.aheadCrawlPercentPerSecond / 100);
    }
    if (Number.isFinite(options.aheadSlowdownThresholdPercent)) {
        config.PROGRESS_AHEAD_SLOWDOWN_DISTANCE = Math.max(
            0,
            options.aheadSlowdownThresholdPercent / 100
        );
    }
    if (Number.isFinite(options.speculativeCeilingPercent)) {
        config.PROGRESS_SPECULATIVE_CEILING = Math.max(
            0,
            Math.min(options.speculativeCeilingPercent / 100, 0.999)
        );
    }
    if (Number.isFinite(options.finishDurationSeconds)) {
        config.PROGRESS_FINISH_DURATION_SECONDS = Math.max(
            0,
            Math.min(options.finishDurationSeconds, 0.5)
        );
    }
}

function getHalo3LoadingProgressTuning() {
    return {
        smoothingSeconds: config.PROGRESS_SMOOTHING_SECONDS,
        velocitySmoothingSeconds: config.PROGRESS_VELOCITY_SMOOTHING_SECONDS,
        reportVelocityResponse: config.PROGRESS_REPORT_VELOCITY_RESPONSE,
        lagAccelerationThresholdPercent: config.PROGRESS_LAG_ACCELERATION_THRESHOLD * 100,
        baselineDriftPercentPerSecond: config.PROGRESS_BASELINE_RATE * 100,
        aheadCrawlPercentPerSecond: config.PROGRESS_AHEAD_CRAWL_RATE * 100,
        aheadSlowdownThresholdPercent: config.PROGRESS_AHEAD_SLOWDOWN_DISTANCE * 100,
        speculativeCeilingPercent: config.PROGRESS_SPECULATIVE_CEILING * 100,
        finishDurationSeconds: config.PROGRESS_FINISH_DURATION_SECONDS
    };
}

function configureHalo3LoadingScreen(options) {
    if (renderer_started || !options) return;

    if (typeof options.logoUrl === "string" && options.logoUrl.length > 0) {
        config.TEXTURE_LOGO = options.logoUrl;
    }
    if (typeof options.showLogo === "boolean") config.ENABLE_LOGO = options.showLogo;
    if (typeof options.logoUsesAlphaMask === "boolean") config.USE_LOGO_AS_ALPHA = options.logoUsesAlphaMask;
    if (Number.isFinite(options.logoScale)) config.LOGO_SCALE = Math.max(0.05, Math.min(options.logoScale, 0.8));
    if (Number.isFinite(options.logoPadding)) config.LOGO_PADDING = Math.max(0, Math.min(options.logoPadding, 0.8));
    setHalo3LoadingProgressTuning(options);
    if (typeof options.showGrid === "boolean") config.ENABLE_BACKGROUND_GRID = options.showGrid;
    if (typeof options.showLines === "boolean") config.ENABLE_LINES = options.showLines;
    if (typeof options.showBlocks === "boolean") config.ENABLE_BLOCK_RENDERING = options.showBlocks;
    if (typeof options.showParticles === "boolean") config.ENABLE_PARTICLES = options.showParticles;
    if (typeof options.showVignette === "boolean") config.ENABLE_VINGETTE = options.showVignette;
}

function setHalo3LoadingProgress(progress, reset) {
    let normalized = Math.max(0, Math.min(Number(progress) || 0, 1));
    let now = performance.now();

    if (reset) {
        loading_progress_target = normalized;
        loading_progress_display = normalized;
        loading_progress_velocity = normalized < 1 ? config.PROGRESS_BASELINE_RATE : 0;
        loading_progress_reported_velocity = 0;
        loading_progress_report_time = now;
        loading_progress_finishing = false;
        camera_track_distance = normalized;
        return;
    }

    let previous_target = loading_progress_target;
    loading_progress_target = Math.max(loading_progress_target, normalized);
    let report_seconds = loading_progress_report_time > 0
        ? Math.max((now - loading_progress_report_time) / 1000, 1 / 240)
        : 0;

    if (report_seconds > 0) {
        let reported_rate = (loading_progress_target - previous_target) / report_seconds;
        let report_factor = config.PROGRESS_VELOCITY_SMOOTHING_SECONDS === 0
            ? 1
            : 1 - Math.exp(-report_seconds / config.PROGRESS_VELOCITY_SMOOTHING_SECONDS);
        loading_progress_reported_velocity +=
            (reported_rate - loading_progress_reported_velocity) * report_factor;
    }
    loading_progress_report_time = now;
}

function finishHalo3LoadingProgress() {
    loading_progress_target = 1;
    if (loading_progress_finishing) return;
    if (loading_progress_display >= 1) {
        loading_progress_display = 1;
        loading_progress_velocity = 0;
        loading_progress_finishing = false;
        camera_track_distance = 1;
        return;
    }

    let configured_duration = config.PROGRESS_FINISH_DURATION_SECONDS;
    if (configured_duration === 0) {
        loading_progress_display = 1;
        loading_progress_velocity = 0;
        loading_progress_finishing = false;
        camera_track_distance = 1;
        if (renderer_active && renderer_started && renderer_update) renderer_update(true);
        return;
    }

    let remaining = 1 - loading_progress_display;
    let current_velocity = Math.max(loading_progress_velocity, 0);
    let monotonic_duration = current_velocity > 0
        ? 3 * remaining / current_velocity
        : configured_duration;

    loading_progress_finish_duration = Math.max(
        1 / 60,
        Math.min(configured_duration, monotonic_duration)
    );
    loading_progress_finish_start_time = performance.now();
    loading_progress_finish_start = loading_progress_display;
    loading_progress_finish_tangent = Math.min(
        current_velocity * loading_progress_finish_duration,
        3 * remaining
    );
    loading_progress_finishing = true;
}
function setHalo3LoadingActive(active) {
    renderer_active = Boolean(active);
    if (renderer_active && renderer_started && renderer_update && !renderer_frame_pending) {
        loading_progress_frame_time = performance.now();
        renderer_frame_pending = true;
        requestAnimationFrame(renderer_update);
    }
}

window.Halo3LoadingScreen = {
    configure: configureHalo3LoadingScreen,
    getProgress: function () {
        return {
            displayed: loading_progress_display,
            target: loading_progress_target,
            velocity: loading_progress_velocity,
            reportedVelocity: loading_progress_reported_velocity,
            cameraDistance: camera_track_distance,
            finishing: loading_progress_finishing
        };
    },
    getTuning: getHalo3LoadingProgressTuning,
    finish: finishHalo3LoadingProgress,
    setActive: setHalo3LoadingActive,
    setProgress: setHalo3LoadingProgress,
    setTuning: setHalo3LoadingProgressTuning,
    start: main
};



/*--- Shader Definitions ---*/


const vertex_display = `#version 300 es
	in vec2 a_position;	
	out vec2 v_coord;

	void main() {
		gl_Position = vec4(a_position, 0.0, 1.0); // 4 corner vertices of quad
		v_coord = a_position * 0.5 + 0.5; // UV coords: (0, 0), (0, 1), (1, 1), (1, 0)
	}
`;

let frag_position = `#version 300 es
	precision highp float;

    // Input Variables
    uniform sampler2D texture_initial_position;
    uniform sampler2D texture_swerve_position;
	uniform sampler2D texture_final_position;
	uniform sampler2D texture_position;
	uniform sampler2D texture_data_static;
	uniform float delay_time;
	uniform float animation_time;
	uniform float length_loop;
	uniform float length_assembly_delay;
	uniform float length_slice_assembly;
	in vec2 v_coord; // UV coordinate of current point.

    // Output Variables
	out vec4 cg_FragColor;

	// 3-Point Curve Interpolator
	// Note: Returns a position in 3D space representing a particle's location on
	//       a smooth curve between three points given factor t [0-1]. 
	vec4 interpolate_location(vec4 v1, vec4 v2, vec4 v3, float t) {
		vec4 path1 = v1 * (1.0 - t) + v3 * t;
		float middle_factor = (0.5 - abs(0.5 - t)) * 2.0;
		vec4 path2 = path1 * (1.0 - middle_factor) + v2 * middle_factor;
		return vec4(path2.x, path2.y, path2.z, 1.0);
	}

	void main() {

		// Local Variables
		vec4 initial_position = texture(texture_initial_position, v_coord);
		vec4 swerve_position = texture(texture_swerve_position, v_coord);
		vec4 final_position = texture(texture_final_position, v_coord);
		vec4 current_position = texture(texture_position, v_coord);
		float wait = texture(texture_data_static, v_coord).r;
		float seed = texture(texture_data_static, v_coord).g;
		float ambient = texture(texture_data_static, v_coord).b;

        if (ambient != 1.0) {

        	// Calculate Ring Particle Animation Factor
			float factor = 0.0;
			if (delay_time > wait) {
				factor = min((delay_time - wait - length_assembly_delay) / length_slice_assembly, 1.0);
			}

			// Find Current Position Along Curve
			vec4 position = interpolate_location(initial_position, swerve_position, final_position, factor);

			cg_FragColor = position;
        
        } else {

        	// Calculate Ambient Particle Animation Factor
			float factor = mod(animation_time, length_loop) / length_loop;

            // Apply Particle Drift
        	cg_FragColor = vec4(
                initial_position[0] + (final_position[0] * factor),
                initial_position[1] + (final_position[1] * factor),
                initial_position[2] + (final_position[2] * factor),
                1.0
        	);
        }
	}
`;

let frag_data = `#version 300 es
	precision mediump float;

    // Input Variables
    uniform sampler2D texture_position;
	uniform sampler2D texture_data_dynamic;
	uniform sampler2D texture_data_static;
	uniform vec3 position_camera;
	uniform float scene_fade_in_factor;
	uniform float scene_fade_out_factor;
	uniform float delay_time;
	uniform float length_loop;
	uniform float length_start_delay;
	uniform float length_slice_assembly;
	uniform float length_particle_fade;
	uniform float length_scene_fade;
	uniform float camera_dist_max;
	uniform float camera_dist_factor;
	uniform float alpha_fade;
	in vec2 v_coord;

    // Output Variables
	out vec4 cg_FragColor; 

	void main() {

		// Local Variables
		vec4 position = texture(texture_position, v_coord);
		float alpha = texture(texture_data_dynamic, v_coord).r;
		float brightness = texture(texture_data_dynamic, v_coord).g;
        float wait = texture(texture_data_static, v_coord).r;
        float seed = texture(texture_data_static, v_coord).g;
        float ambient = texture(texture_data_static, v_coord).b;
		float distance = abs(distance(position, vec4(position_camera[0], position_camera[1], position_camera[2], 1.0)));

        // Calculate & Set Alpha Scale
 		float alpha_scale = 1.0;
 		if (alpha_fade == 1.0) {
            alpha_scale = 1.0 - ((distance * camera_dist_factor) / camera_dist_max);
        }

        // Adjust Alpha for Camera Clipping
        float camera_distance_min = 0.05;
 		float camera_distance_min_fade = .5;
 		float factor = (distance - camera_distance_min) / (camera_distance_min_fade - camera_distance_min);
 		factor = min(max(factor, 0.0), 1.0);
        alpha_scale *= factor;

        // Calculate & Set Alpha
        alpha = 0.0;
        if (delay_time <= 0.0) {

        	// Scene Hasn't Started
        	alpha = 0.0;
        	
        } else if (delay_time > length_loop - length_scene_fade) {

			// All Particles - Scene Fade Out
			alpha = ambient * scene_fade_out_factor * alpha_scale;

		} else if (ambient == 1.0) {

			// Ambient Particles
			alpha = scene_fade_in_factor * alpha_scale;

		} else if (delay_time > wait) {

			// Assembly Particles

			// Calculate Fade In Factor
			float particle_fade_in_factor = min((delay_time - wait) / length_particle_fade, 1.0);

            // Calculate Fade Out Factor
            float animation_complete = wait + length_scene_fade + length_start_delay + length_slice_assembly;
            float particle_fade_out_factor = 1.0;
            if (delay_time > animation_complete) {
				particle_fade_out_factor = max(1.0 - ((delay_time - animation_complete) / length_particle_fade), 0.0);
			}

            // Apply Alpha
			alpha = particle_fade_in_factor * particle_fade_out_factor * alpha_scale;
		}
		    
        cg_FragColor = vec4(alpha, brightness, 1.0, 1.0);
	}	
`;

let vertex_particle = `#version 300 es

    // Input Variables
    in vec2 uv_coord_data;
    uniform mat4 u_proj_mat;
	uniform mat4 u_model_mat;
	uniform mat4 u_view_mat;
	uniform sampler2D u_pos;
	uniform sampler2D texture_data_static;
	uniform float particle_size;
	uniform float particle_scaling;
	uniform float particle_size_clamp;
	uniform float camera_dist_max;
	uniform float camera_dist_factor;
	uniform float resolution_scale;
	uniform vec3 position_camera;

    // Output Variables
	out vec2 uv_coord_data_frag;
	out float vertical_factor_frag;

	void main() {

		// Local Variables
		vec4 pos = texture(u_pos, uv_coord_data); // this particle position
		float ambient = texture(texture_data_static, uv_coord_data).b;
		gl_Position = u_proj_mat * u_view_mat * pos;
		vertical_factor_frag = min(max(abs(pos[1] / 0.04), 0.66) * 1.1, 1.0);

        // Scale Particles Based on Camera Distance
        if (particle_scaling == 1.0) {
        	float distance = distance(pos, vec4(position_camera[0], position_camera[1], position_camera[2], 1.0));
		    gl_PointSize = particle_size * (1.0 / (distance));
		    if (particle_size_clamp == 1.0) gl_PointSize = min(gl_PointSize, particle_size);
        } else {
        	gl_PointSize = particle_size;
        }

        // Scale Particles Based on Role
        float ambient_particle_scale = 2.75;
        float active_particle_scale = 1.07;
        if (ambient == 1.0) {
        	gl_PointSize += gl_PointSize * ambient_particle_scale;
        } else {
        	gl_PointSize += gl_PointSize * active_particle_scale;
        }

        // Scale Particles Based on Resolution
        gl_PointSize = gl_PointSize * resolution_scale;

        // Send UV Coordinates to Fragment Shader
        uv_coord_data_frag = uv_coord_data;
    }
`;

let frag_particle = `#version 300 es
	precision highp float;

    // Input Variables
    in vec2 uv_coord_data_frag;
    in float vertical_factor_frag;
    uniform sampler2D texture_data_dynamic;
    uniform sampler2D texture_data_static;
    uniform vec4 color;

    // Output Variables
	out vec4 cg_FragColor; 

	void main() {

		// Local Variables
		float alpha = texture(texture_data_dynamic, uv_coord_data_frag).r;
		float ambient = texture(texture_data_static, uv_coord_data_frag).b;

        // Calculate Particle Transparency
		vec2 location = (gl_PointCoord - 0.5) * 2.0;
		float distance = (1.0 - sqrt(location.x * location.x + location.y * location.y));
		float alpha_final = alpha * (distance / 3.5);
 		
 		// Boost Alpha
        if (ambient != 1.0) {
        	alpha_final = min(alpha_final * 6.0, 1.0) * 0.42 * vertical_factor_frag;
        } else {
        	alpha_final = min(alpha_final * 1.3, 0.5) * 0.95;
        }


        cg_FragColor = vec4(color.x, color.y, color.z, alpha_final);
	}
`;

let vertex_blocks = `#version 300 es

    // Input Variables
    in vec4 vertex_position;
    in vec2 uv_coordinate;
    uniform mat4 u_proj_mat;
	uniform mat4 u_model_mat;
	uniform mat4 u_view_mat;
    uniform float scene_fade_in_factor;
    uniform float scene_fade_out_factor;
    uniform float delay_time;
    uniform float time;
	uniform float length_loop;
	uniform float length_start_delay;
	uniform float length_slice_assembly;
	uniform float length_particle_fade;
	uniform float length_block_fade;
	uniform float length_block_highlight;
	uniform float length_scene_fade;

    // Output Variables
    out vec2 uv_coordinate_frag;
    out float block_highlight_factor_frag;
    out float block_fade_factor_frag;
    out float block_alpha_frag;

	void main() {

        // Local Variables
        vec4 position = vec4(vertex_position[0], vertex_position[1], vertex_position[2], 1.0);
		float particle_wait = vertex_position[3];
		float appearance_time = particle_wait + length_scene_fade + length_start_delay + length_slice_assembly + 50.0;
		float block_vertical_factor = min(max(abs(vertex_position[1] / 0.04), 0.66) * 1.1, 1.1);

        // Calculate Vertex Position
		gl_Position = u_proj_mat * u_view_mat * position;

        // Calculate Block Alpha
        float block_alpha = 0.0;
		if (delay_time > appearance_time) {

			// Adjust Alpha for Fade In
			block_fade_factor_frag = min((delay_time - appearance_time) / length_block_fade, 1.0);
			block_alpha = block_fade_factor_frag * 0.05;

			// Adjust Alpha for Highlight
			float length_extended_highlight = length_block_highlight + (mod(time, length_loop) / length_loop) * length_block_highlight * 0.5;
			block_highlight_factor_frag = min((delay_time - appearance_time) / length_extended_highlight, 1.0);
		}

        // Pass Fragment Shader UV Coordinates
        uv_coordinate_frag = uv_coordinate;

		// Pass Fragment Shader Variables
		block_alpha_frag = block_alpha * block_vertical_factor * scene_fade_out_factor;
    }
`;

let frag_blocks = `#version 300 es
	precision highp float;

    // Input Variables
    in vec2 uv_coordinate_frag;
    in float block_highlight_factor_frag;
    in float block_fade_factor_frag;
    in float block_alpha_frag;
    uniform sampler2D highlight_texture;
    uniform vec4 color;

    // Output Variables
	out vec4 cg_FragColor; 

	void main() {

		// Local Variables
		float highlight_alpha = texture(highlight_texture, uv_coordinate_frag).r;

        // Calculate & Set Draw Color
        float block_alpha_final = block_alpha_frag + ((1.0 - block_highlight_factor_frag) / 33.5) * (block_fade_factor_frag * highlight_alpha * 8.5);
        cg_FragColor = vec4(
            color.x,
            color.y,
            color.z,
            block_alpha_final
        );
	}
`;

let vertex_logo = `#version 300 es

  // Input Variables
  in vec4 a_position;
  in vec2 uv_coordinate;
  uniform float scene_fade_out_factor;
  uniform float logo_scale;
  uniform float logo_padding;
  uniform float logo_aspect_ratio;
  uniform float viewport_aspect_ratio;
  uniform float use_alpha;

  // Output Variables
  out vec2 uv_coordinate_frag;
  out float logo_alpha_frag;
  out float use_alpha_frag;
  
  void main() {

    // Fit the source image inside the exact 16:9-logo bounds without distortion.
    float viewport_aspect = max(viewport_aspect_ratio, 0.0001);
    float source_aspect = max(logo_aspect_ratio, 0.0001);
    float source_clip_aspect = source_aspect / viewport_aspect;
    float padding_vert = logo_padding;
    float padding_horiz = logo_padding / viewport_aspect;
    vec2 half_size = vec2(logo_scale);
    if (source_clip_aspect > 1.0) {
        half_size.y /= source_clip_aspect;
    } else {
        half_size.x *= source_clip_aspect;
    }
    vec2 logo_center = vec2(
        1.0 - padding_horiz - logo_scale,
        -1.0 + padding_vert + logo_scale
    );
    gl_Position = vec4(
        logo_center + a_position.xy * half_size,
        0.0,
        1.0
    );
	// Branding visibility follows the map screen fade, independently of loading progress.
	float logo_visibility = use_alpha == 1.0 ? 1.0 : 0.7;
	float logo_alpha = logo_visibility * scene_fade_out_factor;

    // Pass Fragment Variables
    uv_coordinate_frag = uv_coordinate;
    logo_alpha_frag = logo_alpha;
    use_alpha_frag = use_alpha;
  }
`;

let frag_logo = `#version 300 es
	precision mediump float;

	// Input Variables
	in vec2 uv_coordinate_frag;
	in float logo_alpha_frag;
	in float use_alpha_frag;
	uniform sampler2D logo_texture;
	uniform vec4 color;

	// Output Variables
	out vec4 cg_FragColor;

	void main() {

		// Calculate & Set Draw Color
		if (use_alpha_frag == 1.0) {
		    float logo_shape = texture(logo_texture, uv_coordinate_frag).r;
		    cg_FragColor = vec4(color.x, color.y, color.z, logo_alpha_frag * logo_shape);
		} else {
			vec4 texture_color = texture(logo_texture, uv_coordinate_frag).rgba;
		    cg_FragColor = vec4(texture_color.r, texture_color.g, texture_color.b, logo_alpha_frag * texture_color.a);
		}
    }
`;

let vertex_line = `#version 300 es

	// Input Variables
	in vec4 vertex_angle;
	uniform mat4 u_proj_mat;
	uniform mat4 u_view_mat;
	uniform float scene_fade_in_factor;
	uniform float scene_fade_out_factor;
	uniform float delay_time;
	uniform float length_start_delay;
	uniform float length_ring_assembly;
	uniform float line_height;
	uniform float line_radius;
	uniform float completion_factor;
	uniform float line_factor;

	// Output Variables
	out float scene_fade_out_factor_frag;

	void main() {

        // Calculate Completion Factor
        float final_completion_factor = completion_factor * line_factor;

		// Calculate Point Position
		float x_pos = line_radius * -cos(3.14159265 * max(min((vertex_angle[0] / 180.0) * final_completion_factor, 1.0), -1.0));
		float y_pos = line_radius *  sin(3.14159265 * max(min((vertex_angle[0] / 180.0) * final_completion_factor, 1.0), -1.0));
		vec4 position = vec4(x_pos, line_height, y_pos, 1.0);

		// Set Point Position
		gl_Position = u_proj_mat * u_view_mat * position;

		// Send Fragment Shader Values
		scene_fade_out_factor_frag = scene_fade_out_factor;
	}
`;

let frag_line = `#version 300 es
	precision mediump float;

	// Input Variables
	in float scene_fade_out_factor_frag;
    uniform float line_alpha;
	uniform vec4 color;

	// Output Variables
	out vec4 cg_FragColor;

	void main() {

		// Calculate Line Visibility
		float alpha = line_alpha * scene_fade_out_factor_frag;

		cg_FragColor = vec4(color.x, color.y, color.z, alpha);
    }
`;

let vertex_grid = `#version 300 es

	// Input Variables
	in vec4 vertex_position;
	uniform mat4 u_proj_mat;
	uniform mat4 u_view_mat;
	uniform float scene_fade_in_factor;
	uniform float scene_fade_out_factor;
	uniform float scale;
	uniform float alpha;
	uniform float visibility;

	// Output Variables
	out float alpha_frag;
	out float visibility_frag;
	out float scene_fade_in_factor_frag;
	out float scene_fade_out_factor_frag;

	void main() {

		// Set Point Position
		vec4 pos = vec4(vertex_position[0] * scale, vertex_position[1] * scale, vertex_position[2] * scale, 1.0);
		gl_Position = u_proj_mat * u_view_mat * pos;

		// Pass Fragment Values
		alpha_frag = alpha;
		visibility_frag = visibility;
		scene_fade_in_factor_frag = scene_fade_in_factor;
		scene_fade_out_factor_frag = scene_fade_out_factor;
	}
`;

let frag_grid = `#version 300 es
	precision mediump float;

	// Input Variables
	in float alpha_frag;
	in float visibility_frag;
	in float scene_fade_in_factor_frag;
	in float scene_fade_out_factor_frag;
	uniform vec4 color;

	// Output Variables
	out vec4 cg_FragColor;

	void main() {

        // Set Draw Color
		cg_FragColor = vec4(
		    color.x,
		    color.y,
		    color.z,
		    alpha_frag * visibility_frag * scene_fade_in_factor_frag * scene_fade_out_factor_frag
		);
    }
`;

let vertex_vingette = `#version 300 es

  // Input Variables
  in vec4 a_position;
  in vec2 uv_coordinate;

  // Output Variables
  out vec2 uv_coordinate_frag;
  
  void main() {

    // Set Vertex Position
    gl_Position = a_position;

    // Pass Fragment Shader UV Coordinates
    uv_coordinate_frag = uv_coordinate;
  }
`;

let frag_vingette = `#version 300 es
	precision mediump float;

	// Input Variables
	in vec2 uv_coordinate_frag;
	uniform sampler2D vingette_texture;
	uniform float scene_fade_in_factor;
	uniform float scene_fade_out_factor;
	uniform float vingette_factor;
	uniform vec4 vingette_color;

	// Output Variables
	out vec4 cg_FragColor;

	void main() {

		// Calculate & Set Draw Color
		float vingette_alpha = texture(vingette_texture, uv_coordinate_frag).r;
		cg_FragColor = vec4(
		    vingette_color[0],
		    vingette_color[1],
		    vingette_color[2],
		    vingette_alpha * vingette_factor * scene_fade_in_factor * scene_fade_out_factor
		);
    }
`;


/*--- Main Program ---*/

function main () {
    if (renderer_start_promise) return renderer_start_promise;
    if (renderer_started) return Promise.resolve(true);


    /* Render Preparation */

	// Retrieve Canvas
	canvas = document.getElementById('canvas');

	// Get & Configure Rendering Context
	gl = canvas.getContext('webgl2');
    if (!gl) {
        document.documentElement.classList.add("renderer-unavailable");
        return false;
    }
    renderer_started = true;
    gl.clearColor(
        color.BACKGROUND[0],
        color.BACKGROUND[1],
        color.BACKGROUND[2],
        color.BACKGROUND[3]);
    gl.enable(gl.BLEND);

    // Upload only textures used by the selected render configuration.
    let texture_loads = [];
    if (config.ENABLE_BLOCK_RENDERING) {
        texture_loads.push(ImageLoader.loadImage(gl, texture_list, config.TEXTURE_BLOCK, 0));
    }
    if (config.ENABLE_LOGO) {
        texture_loads.push(ImageLoader.loadImage(
            gl,
            texture_list,
            config.TEXTURE_LOGO,
            7,
            function(width, height) {
                if (width > 0 && height > 0) config.LOGO_ASPECT_RATIO = width / height;
            }
        ));
    }
    if (config.ENABLE_VINGETTE) {
        texture_loads.push(ImageLoader.loadImage(gl, texture_list, config.TEXTURE_VINGETTE, 8));
    }

    // ElDewrito renders its loading UI at a fixed 16:9 resolution.
    canvas.width = 1920;
    canvas.height = 1080;

    // Create Rendering Programs
	prog_position = new GLProgram(vertex_display, frag_position);
    prog_data = new GLProgram(vertex_display, frag_data);
    prog_blocks = new GLProgram(vertex_blocks, frag_blocks);
    prog_logo = new GLProgram(vertex_logo, frag_logo);
    prog_line = new GLProgram(vertex_line, frag_line);
    prog_grid = new GLProgram(vertex_grid, frag_grid);
    prog_vingette = new GLProgram(vertex_vingette, frag_vingette);
    prog_particle = new GLProgram(vertex_particle, frag_particle);
	prog_particle.bind();

    // Set Up Camera
    if (config.ENABLE_DEVELOPER_CAMERA) {

    	// Define Developer Camera Position
        camera_pos[0] = -3.05; //0.0
        camera_pos[1] = 0.1;  //0.3
        camera_pos[2] = 0.1;  //4.9

        // Define Developer Camera View Matrix
    	g_proj_mat.setPerspective(config.CAMERA_FOV, canvas.width/canvas.height, .02, 10000);
    	// LookAt Parameters: camera pos, focus pos, up vector      
        g_view_mat.setLookAt(camera_pos[0], camera_pos[1], camera_pos[2], -3, 0.05, 0, 0, 1, 0);

    } else {

    	// Define Standard Initial Position
        camera_pos[0] = 0;
        camera_pos[1] = 0;
        camera_pos[2] = 0;

	    // Define Standard View Matrix
        g_proj_mat.setPerspective(config.CAMERA_FOV, canvas.width/canvas.height, .02, 10000);
        // LookAt Parameters: camera pos, focus pos, up vector     
	    g_view_mat.setLookAt(camera_pos[0], camera_pos[1], camera_pos[2], 0, 0, 0, 0, 1, 0);
    }

    // Generate Loading Particles
    let loadingParticleFactory = new LoadingParticleFactory(config);
	let pa = loadingParticleFactory.generateLoadingParticles();

    // Create Vertex Array Objects
    create_data_texture_vertex_array_object();
    if (config.ENABLE_BLOCK_RENDERING) create_ring_block_vertex_array_object(pa);
    if (config.ENABLE_LOGO) create_logo_vertex_array_object();
    if (config.ENABLE_LINES) create_line_vertex_array_object();
    if (config.ENABLE_BACKGROUND_GRID) create_grid_vertex_array_object();
    if (config.ENABLE_VINGETTE) create_vingette_vertex_array_object();

    // Create Buffers (Define Input Coordinates for Shaders)
   	initialize_buffers(prog_particle); 
	populate_buffers(pa);

    // Set Up Framebuffer Objects (Hold Particle Data Textures)
	initialize_framebuffer_objects();
	populate_framebuffer_objects(pa);

	// Send Variables to Particle Program
	gl.uniformMatrix4fv(prog_particle.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1i(prog_particle.uniforms.u_sampler, 0);
	gl.uniform1i(prog_particle.uniforms.texture_data_static, fbo_data_static.attach(1));
    gl.uniform1f(prog_particle.uniforms.particle_size, config.PARTICLE_SIZE);
    gl.uniform3fv(prog_particle.uniforms.position_camera, camera_pos);
    gl.uniform1f(prog_particle.uniforms.particle_scaling, config.ENABLE_PARTICLE_SCALING ? 1 : 0);
    gl.uniform1f(prog_particle.uniforms.particle_size_clamp, config.PARTICLE_SIZE_CLAMP ? 1 : 0);

    
    /*-- Preparation Complete --*/

	// Set Time Start
	start_time = performance.now();
    loading_progress_frame_time = start_time;

    // Include the original segment fade and block-highlight tail in the progress
    // timeline so the assembling particles resolve continuously before 100%.
    let ring_settled_time = Math.max(
        config.LENGTH_ASSEMBLY_DELAY + config.LENGTH_RING_ASSEMBLY,
        config.LENGTH_RING_ASSEMBLY +
            Math.abs(config.PARTICLE_WAIT_VARIATION) +
            config.LENGTH_SCENE_FADE +
            config.LENGTH_START_DELAY +
            config.LENGTH_SLICE_ASSEMBLY +
            config.LENGTH_PARTICLE_FADE
    );

    // Begin Update Loop
	let update = function(force_frame) {
        let forced = force_frame === true;
        if (!forced) renderer_frame_pending = false;
        if (!renderer_active && !forced) return;

		// Ambient particles remain time-based; rendered ring progress drives the camera.
        let frame_time = performance.now();
		time = (frame_time - start_time) * config.SPEED;
        let frame_delta = Math.min(frame_time - loading_progress_frame_time, 100);
        let frame_seconds = frame_delta / 1000;
        loading_progress_frame_time = frame_time;

        let velocity_smoothing = config.PROGRESS_VELOCITY_SMOOTHING_SECONDS;

        if (
            loading_progress_report_time > 0 &&
            frame_time - loading_progress_report_time > Math.max(velocity_smoothing, 1 / 60) * 1000
        ) {
            loading_progress_reported_velocity = velocity_smoothing === 0
                ? 0
                : loading_progress_reported_velocity * Math.exp(-frame_seconds / velocity_smoothing);
        }

        if (loading_progress_finishing) {
            let elapsed = Math.max((frame_time - loading_progress_finish_start_time) / 1000, 0);
            let factor = Math.min(elapsed / loading_progress_finish_duration, 1);
            let factor_squared = factor * factor;
            let factor_cubed = factor_squared * factor;
            let start_factor = 2 * factor_cubed - 3 * factor_squared + 1;
            let tangent_factor = factor_cubed - 2 * factor_squared + factor;
            let end_factor = -2 * factor_cubed + 3 * factor_squared;
            let interpolated_progress =
                start_factor * loading_progress_finish_start +
                tangent_factor * loading_progress_finish_tangent +
                end_factor;

            let progress_derivative =
                (6 * factor_squared - 6 * factor) * loading_progress_finish_start +
                (3 * factor_squared - 4 * factor + 1) * loading_progress_finish_tangent +
                (-6 * factor_squared + 6 * factor);

            loading_progress_display = Math.max(
                loading_progress_display,
                Math.min(interpolated_progress, 1)
            );
            loading_progress_velocity = Math.max(
                progress_derivative / loading_progress_finish_duration,
                0
            );

            if (factor >= 1) {
                loading_progress_display = 1;
                loading_progress_velocity = 0;
                loading_progress_finishing = false;
            }
        } else {
            let progress_gap = Math.max(loading_progress_target - loading_progress_display, 0);
            let progress_lead = Math.max(loading_progress_display - loading_progress_target, 0);
            let slowdown_factor = config.PROGRESS_AHEAD_SLOWDOWN_DISTANCE === 0
                ? (progress_lead > 0 ? 1 : 0)
                : Math.min(progress_lead / config.PROGRESS_AHEAD_SLOWDOWN_DISTANCE, 1);
            let smoothed_slowdown =
                slowdown_factor * slowdown_factor * (3 - 2 * slowdown_factor);
            let drift_rate =
                config.PROGRESS_BASELINE_RATE +
                (config.PROGRESS_AHEAD_CRAWL_RATE - config.PROGRESS_BASELINE_RATE) *
                    smoothed_slowdown;
            let lag_excess = Math.max(
                progress_gap - config.PROGRESS_LAG_ACCELERATION_THRESHOLD,
                0
            );
            let position_smoothing = Math.max(config.PROGRESS_SMOOTHING_SECONDS, 1 / 240);
            let desired_rate =
                drift_rate +
                loading_progress_reported_velocity *
                    config.PROGRESS_REPORT_VELOCITY_RESPONSE +
                (progress_gap + lag_excess) / position_smoothing;
            let velocity_factor = velocity_smoothing === 0
                ? 1
                : 1 - Math.exp(-frame_seconds / velocity_smoothing);

            loading_progress_velocity +=
                (desired_rate - loading_progress_velocity) * velocity_factor;
            loading_progress_velocity = Math.max(loading_progress_velocity, 0);

            let motion_ceiling = loading_progress_target >= 1
                ? 1
                : config.PROGRESS_SPECULATIVE_CEILING +
                    loading_progress_target *
                        (1 - config.PROGRESS_SPECULATIVE_CEILING);
            let remaining_motion = Math.max(motion_ceiling - loading_progress_display, 0);
            let ceiling_ease_seconds = progress_gap > 0
                ? Math.max(velocity_smoothing, 1 / 60)
                : config.PROGRESS_SPECULATIVE_CEILING_SECONDS;
            let maximum_step =
                remaining_motion * (1 - Math.exp(-frame_seconds / ceiling_ease_seconds));
            let progress_step = Math.min(
                loading_progress_velocity * frame_seconds,
                maximum_step
            );
            loading_progress_display += progress_step;

            if (
                loading_progress_target >= 1 &&
                1 - loading_progress_display <= 0.000001
            ) {
                loading_progress_display = 1;
                loading_progress_velocity = 0;
            }
        }

        camera_track_distance = loading_progress_display;

        let ring_time = config.LENGTH_ASSEMBLY_DELAY +
            loading_progress_display *
                (ring_settled_time - config.LENGTH_ASSEMBLY_DELAY);
		
        // Clear Canvas
		gl.clear(gl.COLOR_BUFFER_BIT);

        // Track the assembled position on the ring directly. This path is monotonic and slows
        // with rendered progress instead of ping-ponging when an ambient loop reaches its end.
        if (!config.ENABLE_DEVELOPER_CAMERA) {
            let camera_factor = Math.max(0, Math.min(camera_track_distance, 1));

        	// Update Camera Positions
			camera_pos = camera_pos_interpolator.getInterpolatedPoint(camera_factor);
			camera_focus = camera_focus_interpolator.getInterpolatedPoint(camera_factor);

			// Update View Matrix
			g_view_mat.setLookAt(
			    camera_pos[0],
			    camera_pos[1],
			    camera_pos[2],
			    camera_focus[0],
			    camera_focus[1],
			    camera_focus[2],
			    0,
			    1,
			    0
			);
        }

        // The loading screen owns its lifetime, so the scene fades in once and never loops to black.
        let scene_fade_in = Math.min(time / config.LENGTH_SCENE_FADE, 1.0);
        let scene_fade_out = 1.0;

        // Render Scene
		update_particle_positions(fbo_pos_initial, fbo_pos_swerve, fbo_pos_final, fbo_pos, fbo_data_static, ring_time, time);
		update_particle_data(fbo_pos, fbo_data_dynamic, fbo_data_static, scene_fade_in, scene_fade_out, ring_time);
		if (config.ENABLE_LINES) draw_lines(scene_fade_in, scene_fade_out, ring_time);
		if (config.ENABLE_BACKGROUND_GRID) {
			draw_grid(g_proj_mat, g_view_mat, 1.0, 1.0, scene_fade_in, scene_fade_out);
			draw_grid(g_proj_mat, g_view_mat, 1.5, 0.75, scene_fade_in, scene_fade_out);
			draw_grid(g_proj_mat, g_view_mat, 2.0, 0.5, scene_fade_in, scene_fade_out);
		}
		if (config.ENABLE_VINGETTE) draw_vingette(scene_fade_in, scene_fade_out);
		if (config.ENABLE_BLOCK_RENDERING) draw_blocks(g_proj_mat, g_view_mat, scene_fade_in, scene_fade_out, ring_time);
		if (config.ENABLE_PARTICLES) draw_particles(fbo_pos, fbo_data_dynamic, fbo_data_static, pa);
		if (config.ENABLE_LOGO) draw_logo(scene_fade_out);

        if (!forced) {
            renderer_frame_pending = true;
            requestAnimationFrame(update);
        }
	};
    renderer_update = update;
    renderer_start_promise = Promise.all(texture_loads).then(function() {
        document.documentElement.classList.add("renderer-ready");
        update();
        return true;
    });
    return renderer_start_promise;
}


/*--- Shader Program Class ---*/

class GLProgram {
    constructor (vertex_shader, fragment_shader) {
        this.attributes = {};
        this.uniforms = {};

        // Note: Method defined in cuon-utils.js.
        this.program = createProgram(gl, vertex_shader, fragment_shader);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw gl.getProgramInfoLog(this.program);
        
        // Register Attribute Variables
        const attribute_count = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < attribute_count; i++) {
            const attribute_name = gl.getActiveAttrib(this.program, i).name;
            this.attributes[attribute_name] = gl.getAttribLocation(this.program, attribute_name);
        }

        // Register Uniform Variables
        const uniform_count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniform_count; i++) {
            const uniform_name = gl.getActiveUniform(this.program, i).name;
            this.uniforms[uniform_name] = gl.getUniformLocation(this.program, uniform_name);
        }
    }

    bind () {
        gl.useProgram(this.program);
    }

    bind_time() {
    	gl.useProgram(this.program);
        gl.uniform1f(this.uniforms.time, time);
    }
}


/*--- Vertex Array Object Setup ---*/

// Note: This VertexArrayObject contains a square consisting of two triangles,
//       on which each data texture is drawn.
function create_data_texture_vertex_array_object () {

	// Create Vertex Array Object
    vao_data_texture = gl.createVertexArray();
    gl.bindVertexArray(vao_data_texture);

    // Create Vertex Buffer
    let vertex_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1, -1,
            -1, 1,
            1, 1,
            1, -1
        ]),
        gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(prog_particle.uniforms.a_position);

    // Create Vertex Element Buffer (Specifies Shared Vertices by Index)
    let vertex_element_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertex_element_buffer);
    // Note: Six vertices representing two triangles with a shared edge from bottom left to top right 
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    
    // Unbind
    gl.bindVertexArray(null);
}

// Note: This VertexArrayObject contains the vertices and shared vertex indices
//       required to draw each block in the final ring.
function create_ring_block_vertex_array_object (pa) {

    /* Variable Declarations */

    /* Base Block Vertices
     *
	 *     v6----- v5
	 *    /|      /|
	 *   v1------v0|
	 *   | |     | |
	 *   | |v7---|-|v4
	 *   |/      |/
	 *   v2------v3
	 *
	 * Note: This vertex list contains three vertices for each of the 12 triangles
	 *       in a single cube. Vertices may not be shared when each face requires
	 *       distinct texture coordinates. See Notes.txt for more info.
	 */
    let BLOCK_VERTICES = [
		.1, .1, .1,  -.1, .1, .1,  -.1,-.1, .1,    .1, .1, .1,  -.1,-.1, .1,   .1,-.1, .1, // front
		.1, .1, .1,   .1,-.1, .1,   .1,-.1,-.1,    .1, .1, .1,   .1,-.1,-.1,   .1, .1,-.1, // right
		.1, .1, .1,   .1, .1,-.1,  -.1, .1,-.1,    .1, .1, .1,  -.1, .1,-.1,  -.1, .1, .1, // up
	   -.1, .1, .1,  -.1, .1,-.1,  -.1,-.1,-.1,   -.1, .1, .1,  -.1,-.1,-.1,  -.1,-.1, .1, // left
	   -.1,-.1,-.1,   .1,-.1,-.1,   .1,-.1, .1,   -.1,-.1,-.1,   .1,-.1, .1,  -.1,-.1, .1, // down
		.1,-.1,-.1,  -.1,-.1,-.1,  -.1, .1,-.1,    .1,-.1,-.1,  -.1, .1,-.1,   .1, .1,-.1  // back
    ];

    /* Base Block UV's
	 * Note: This uv list contains an x and y coordinate for each vertex in the
	 *       list above. The order of the two lists matches.
	 */
    let BLOCK_UVS = [
		1,1, 0,1, 0,0,  1,1, 0,0, 1,0, // front
		0,1, 0,0, 1,0,  0,1, 1,0, 1,1, // right
		1,1, 1,0, 0,0,  1,1, 0,0, 0,1, // up
		1,1, 0,1, 0,0,  1,1, 0,0, 1,0, // left
		0,0, 1,0, 1,1,  0,0, 1,1, 0,1, // down
		0,0, 1,0, 1,1,  0,0, 1,1, 0,1  // back
    ];

    /* Block Generation Code */

    /* Note: This section generates the vertices for every block in the constructed 
     *       ring as a triple [X, Y, Z] representing coordinades in 3D space. It then
     *       appends a fourth constant to each vertex W, representing the wait value
     *       of the particle corresponding to that vertex. This value is used to toggle
     *       each block's visibility during rendering in the fragment shader. Next, the
     *       section generates the uv coordinates for each block vertex. Last, the 
     *       loop creates an array containing indices that specify which vertices of
     *       each block are shared (in this case, none) and stores all three lists as
     *       buffer data for processing in the vertex shader.
     * 
     *       Block UV Structure:       [U, V]
     *       Block Vertex Structure:   [X, Y, Z, Wait]
     */
    let FINAL_VERTICES = [];
    let FINAL_UVS = [];

    block_group_first_appearance.length = 0;
    // For Each Slice
    for (let slice = 0; slice < config.RING_SLICES; slice++) {
        let first_appearance = Infinity;

    	// For Each Block
    	for (let block = 0; block < config.SLICE_PARTICLES; block++) {

			// Determine Block Data
			let slice_index = slice * config.SLICE_PARTICLES;
			let slice_angle = pa[slice_index + block].slice_angle;
			let block_position = pa[slice_index + block].position_final;
			let block_visibility_offset = pa[slice_index + block].wait;
            let appearance_time = Number(block_visibility_offset)
                + config.LENGTH_SCENE_FADE
                + config.LENGTH_START_DELAY
                + config.LENGTH_SLICE_ASSEMBLY
                + 50;
            first_appearance = Math.min(first_appearance, appearance_time);

			// Add 36 Block Vertices
			for (let v = 0; v < 36; v++) {

				// Calculate Vertex Position
				let vertex = [
					BLOCK_VERTICES[(v * 3) + 0] * .029,
					BLOCK_VERTICES[(v * 3) + 1] * .0305235,
					BLOCK_VERTICES[(v * 3) + 2] * .04845
				];

				// Apply Block Rotation
				vertex = Rotator.rotateAroundYAxis(slice_angle, vertex);

				// Add Vertex Values
				FINAL_VERTICES.push(block_position[0] + vertex[0]);
				FINAL_VERTICES.push(block_position[1] + vertex[1]);
				FINAL_VERTICES.push(block_position[2] + vertex[2]);

				FINAL_VERTICES.push(block_visibility_offset);
			}

			// Add 36 * 2 UV Coordinates
			for (let position = 0; position < 72; position++) {
				FINAL_UVS.push(BLOCK_UVS[position]);
			}
    	}
        block_group_first_appearance.push(first_appearance);
    }


    /* VAO Construction */

	// Create Vertex Array Object
    vao_blocks = gl.createVertexArray();
    gl.bindVertexArray(vao_blocks);

    // Create Vertex Buffer
    let vertex_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.enableVertexAttribArray(prog_blocks.uniforms.vertex_position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(FINAL_VERTICES), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

    // Create UV Buffer
    let uv_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uv_buffer);
    gl.enableVertexAttribArray(prog_blocks.attributes.uv_coordinate);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(FINAL_UVS), gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    
    // Unbind
    gl.bindVertexArray(null);
}

// Note: This VertexArrayObject contains a square consisting of two triangles,
//       on which the Halo 3 Logo is drawn.
function create_logo_vertex_array_object () {

    /* Variable Declarations */

    /* Logo Vertices
     *
     *  v1-------v2   v4
     *  |       /    / |
     *  |     /    /   |
     *  |   /    /     |
     *  | /    /       |
     *  v0   v3-------v5
     *
	 *
	 * Note: This vertex list contains three vertices for each of the 2 triangles
	 *       in the plane on which the logo is drawn.
	 */
    let LOGO_VERTICES = [
        -1, -1,  -1,  1,   1,  1, // Left Triangle 
        -1, -1,   1,  1,   1, -1  // Right Triangle
    ];

    /* Logo UV's
	 * Note: This uv list contains an x and y coordinate for each vertex in the
	 *       list above. The order of the two lists matches.
	 */
    let LOGO_UVS = [
		0,0, 0,1, 1,1, // Left Triangle 
        0,0, 1,1, 1,0  // Right Triangle
    ];

    // Logo Index Array
    let LOGO_INDICES = [0, 1, 2, 3, 4, 5];

    /* VAO Construction */

	// Create Vertex Array Object
    vao_logo = gl.createVertexArray();
    gl.bindVertexArray(vao_logo);

    // Create Vertex Buffer
    let vertex_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(LOGO_VERTICES),gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(prog_logo.uniforms.a_position);

    // Create UV Buffer
    let uv_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uv_buffer);
    gl.enableVertexAttribArray(prog_logo.attributes.uv_coordinate);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(LOGO_UVS), gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    // Create Vertex Element Buffer (Specifies Shared Vertices by Index)
    let vertex_element_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertex_element_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(LOGO_INDICES), gl.STATIC_DRAW);
    
    // Unbind
    gl.bindVertexArray(null);
}

// Note: This VertexArrayObject contains a list of points representing a single
//       guide line around the ring's perimeter.
function create_line_vertex_array_object () {

    /* Variable Declarations */

    /* Line Vertices
     *
     *  -180  -90   0   +90  +180
     *  @-----@-----@-----@-----@
     *
     *  Where Line Resolution = 5
	 *
	 * Note: This block generates a single value for each vertex, representing its final 
	 *       angle around the ring. All other values are calculated at runtime in the
	 *       vertex shader.
	 */
    let LINE_VERTICES = [];
    let half = (config.LINE_RESOLUTION - 1) / 2.0;
    for (let x = 0; x < config.LINE_RESOLUTION; x++) {
    	// -180 * ( (half - x) / half )
    	LINE_VERTICES.push((((new Decimal(half)).minus(x)).dividedBy(half)).times(-180).toPrecision(10));
    }

    // Line Index Array
    let LINE_INDICES = [];
    for (let x = 0; x < config.LINE_RESOLUTION; x++) {
    	LINE_INDICES.push(x);
    }

    /* VAO Construction */

	// Create Vertex Array Object
    vao_line = gl.createVertexArray();
    gl.bindVertexArray(vao_line);

    // Create Vertex Buffer
    let vertex_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(LINE_VERTICES),gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(prog_line.uniforms.vertex_angle);

    // Create Vertex Element Buffer (Specifies Shared Vertices by Index)
    let vertex_element_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertex_element_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(LINE_INDICES), gl.STATIC_DRAW);
    
    // Unbind
    gl.bindVertexArray(null);
}

// The grid binary is already scaled and arranged as line-segment vertex pairs.
function create_grid_vertex_array_object () {
    let grid_vertices = BackgroundGrid.getVertices();
    grid_vertex_count = BackgroundGrid.getVertexCount();

    vao_grid = gl.createVertexArray();
    gl.bindVertexArray(vao_grid);

    let vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, grid_vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(prog_grid.attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(prog_grid.attributes.vertex_position);

    gl.bindVertexArray(null);
    BackgroundGrid.release();
}

// Note: This VertexArrayObject contains a square consisting of two triangles,
//       on which the vingette effect is drawn.
function create_vingette_vertex_array_object () {

	/* Variable Declarations */

    /* Vingette Vertices
     *
     *  v1-------v2   v4
     *  |       /    / |
     *  |     /    /   |
     *  |   /    /     |
     *  | /    /       |
     *  v0   v3-------v5
     *
	 *
	 * Note: This vertex list contains three vertices for each of the 2 triangles
	 *       in the plane on which the vingette effect is drawn.
	 */
    let VINGETTE_VERTICES = [
        -1, -1,  -1,  1,   1,  1, // Left Triangle 
        -1, -1,   1,  1,   1, -1  // Right Triangle
    ];

    /* Vingette UV's
	 * Note: This uv list contains an x and y coordinate for each vertex in the
	 *       list above. The order of the two lists matches.
	 */
    let VINGETTE_UVS = [
		0,0, 0,1, 1,1, // Left Triangle 
        0,0, 1,1, 1,0  // Right Triangle
    ];

    // Vingette Index Array
    let VINGETTE_INDICES = [0, 1, 2, 3, 4, 5];

    /* VAO Construction */

	// Create Vertex Array Object
    vao_vingette = gl.createVertexArray();
    gl.bindVertexArray(vao_vingette);

    // Create Vertex Buffer
    let vertex_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(VINGETTE_VERTICES),gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(prog_vingette.uniforms.a_position);

    // Create UV Buffer
    let uv_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uv_buffer);
    gl.enableVertexAttribArray(prog_vingette.attributes.uv_coordinate);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(VINGETTE_UVS), gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    // Create Vertex Element Buffer (Specifies Shared Vertices by Index)
    let vertex_element_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertex_element_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(VINGETTE_INDICES), gl.STATIC_DRAW);
    
    // Unbind
    gl.bindVertexArray(null);
}


/*--- Buffer Setup ---*/

function initialize_buffers (prog) {

    // Initialize Particle Data Buffer
  	uv_coord_data_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uv_coord_data_buffer);
	gl.vertexAttribPointer(prog.attributes.uv_coord_data, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(prog.attributes.uv_coord_data);

}

// Note: Calculations involving tiny decimals require special care
//       because JavaScript's math is broken. In this case, operations
//       on decimals representing the width of single pixels intermittently
//       produce the wrong result due to floating point errors. To work
//       around the issue, this method uses the arbitrary-precision decimal
//       library decimal.js.
// Source: https://github.com/MikeMcl/decimal.js/
function populate_buffers(pa) {


    /*-- Particle Data Buffer --*/

    // Note: This block calculates the UV coordinates for each pixel of the images
    //       representing a particle's data (initial pos, final pos, pos, etc). Values
    //       are in range [0, 1]. The coordinates are sent to the vertex_particle shader
    //       as uv_coord_data.

    // Declare Variables
    let uv_coord_data = [];
    let pixel_size = (new Decimal(1.0)).dividedBy(new Decimal(config.TEXTURE_SIZE)); // 1 / TEXTURE_SIZE
    let half_pixel_size = pixel_size.dividedBy(new Decimal(2)); // pixel_size / 2

    // Generate Texture Coordinates for Each Pixel
    for (let x = 0; x < config.TEXTURE_SIZE; x++) {
    	for (let y = 0; y < config.TEXTURE_SIZE; y++) {
    		let coord_x = pixel_size.times(new Decimal(x).plus(half_pixel_size)).toPrecision(10);
    		let coord_y = pixel_size.times(new Decimal(y).plus(half_pixel_size)).toPrecision(10);
		    uv_coord_data.push(coord_x);
		    uv_coord_data.push(coord_y);
    	}
    }

    // Send UV Coordinates to GPU
	gl.bindBuffer(gl.ARRAY_BUFFER, uv_coord_data_buffer);    
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv_coord_data), gl.STATIC_DRAW);
}

function initialize_framebuffer_objects() {

    // Enables Float Framebuffer Color Attachment
    gl.getExtension('EXT_color_buffer_float');


    fbo_pos_initial = create_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_pos_swerve = create_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_pos_final = create_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_pos = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_data_dynamic = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_data_static = create_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);

}

function populate_framebuffer_objects (pa) {

	// Initialize Texture Arrays
	let position_initial = [];
	let position_swerve = [];
	let position_final = [];
	let position = [];
	let data_dynamic = [];
	let data_static = [];

	for (let i = 0; i < pa.length; i++) {

		// Initial Position
		position_initial.push(pa[i].position_initial[0]);
		position_initial.push(pa[i].position_initial[1]);
		position_initial.push(pa[i].position_initial[2]);
		position_initial.push(1);

		// Swerve Position
		position_swerve.push(pa[i].position_swerve[0]);
		position_swerve.push(pa[i].position_swerve[1]);
		position_swerve.push(pa[i].position_swerve[2]);
		position_swerve.push(1);

        // Final Position
		position_final.push(pa[i].position_final[0]);
		position_final.push(pa[i].position_final[1]);
		position_final.push(pa[i].position_final[2]);
		position_final.push(1);

        // Current Position
		position.push(pa[i].position[0]);
		position.push(pa[i].position[1]);
		position.push(pa[i].position[2]);
		position.push(1);

        // Changing Particle Data
		data_dynamic.push(pa[i].alpha);
		data_dynamic.push(pa[i].brightness);
		data_dynamic.push(1);
		data_dynamic.push(1);

		// Unchanging Particle Data
		data_static.push(pa[i].wait);
		data_static.push(pa[i].seed);
		data_static.push(pa[i].ambient);
		data_static.push(0);

	}
    
    // Add Textures to Framebuffer Objects
	fbo_pos_initial.addTexture(new Float32Array(position_initial));
	fbo_pos_swerve.addTexture(new Float32Array(position_swerve));
	fbo_pos_final.addTexture(new Float32Array(position_final));
	fbo_pos.read.addTexture(new Float32Array(position));
	fbo_data_dynamic.read.addTexture(new Float32Array(data_dynamic));
	fbo_data_static.addTexture(new Float32Array(data_static));
}

function create_framebuffer_object (w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    // create texture image of resolution (w x h)
    // note that here we pass null as texture source data (no texture image source)
    // For this texture, we're only allocating memory and not actually filling it.
    // Filling texture will happen as soon as we render to the framebuffer.    
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    // attach texture to framebuffer so from now on, everything will be 
    // drawn on this texture image    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
    // back to system framebuffer
	
    let texel_x = 1.0 / w;
    let texel_y = 1.0 / h;

    return {
        texture,
        fbo,
        single: true,
        width: w,
        height: h,
        texel_x,
        texel_y,
        internalFormat,
        format,
        type,
        attach(id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        },
        addTexture(pixel) {
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);// do not flip the image's y-axis
			gl.bindTexture(gl.TEXTURE_2D, texture); // bind TEXTURE_2D to this FBO's texture 
			gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, gl.FLOAT, pixel);
        }
    };
}

function create_double_framebuffer_object (w, h, internalFormat, format, type, param, depth) {
    let fbo1 = create_framebuffer_object(w, h, internalFormat, format, type, param, depth);
    let fbo2 = create_framebuffer_object(w, h, internalFormat, format, type, param, depth);

    let texel_x = 1.0 / w;
    let texel_y = 1.0 / h;

    return {
        width: w,
        height: h,
        single: false,
        texel_x,
        texel_y,
        get read() {
            return fbo1;
        },
        set read(value) {
            fbo1 = value;
        },
        get write() {
            return fbo2;
        },
        set write(value) {
            fbo2 = value;
        },
        swap() {
            let temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        }
    }
}



/*--- Draw Methods ---*/
function set_viewport(width, height) {
    if (viewport_width === width && viewport_height === height) return;
    gl.viewport(0, 0, width, height);
    viewport_width = width;
    viewport_height = height;
}


function update_particle_positions (position_initial, position_swerve, position_final, position, data_static, delay_time, animation_time) {
    let program = prog_position;
    program.bind();

    gl.uniform1i(program.uniforms.texture_initial_position, position_initial.attach(1));
    gl.uniform1i(program.uniforms.texture_swerve_position, position_swerve.attach(2));
    gl.uniform1i(program.uniforms.texture_final_position, position_final.attach(3));
    gl.uniform1i(program.uniforms.texture_position, position.read.attach(4));
    gl.uniform1i(program.uniforms.texture_data_static, data_static.attach(5));

    gl.uniform1f(program.uniforms.delay_time, delay_time);
    gl.uniform1f(program.uniforms.animation_time, animation_time);
    gl.uniform1f(program.uniforms.length_loop, config.LENGTH_LOOP);
    gl.uniform1f(program.uniforms.length_assembly_delay, config.LENGTH_ASSEMBLY_DELAY);
    gl.uniform1f(program.uniforms.length_slice_assembly, config.LENGTH_SLICE_ASSEMBLY);
    gl.uniform1f(program.uniforms.camera_dist_max, config.CAMERA_DIST_MAX);
    gl.uniform1f(program.uniforms.camera_dist_factor, config.CAMERA_DIST_FACTOR);

    set_viewport(position.width, position.height);
 
    draw_to_framebuffer_object(position.write.fbo);
    position.swap();
}

function update_particle_data (position, data_dynamic, data_static, scene_fade_in, scene_fade_out, delay_time) {
    let program = prog_data;
    program.bind();

    gl.uniform1i(program.uniforms.texture_position, position.read.attach(1));
    gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.read.attach(2));
    gl.uniform1i(program.uniforms.texture_data_static, data_static.attach(3));

    gl.uniform3fv(program.uniforms.position_camera, camera_pos);
    gl.uniform1f(program.uniforms.scene_fade_in_factor, scene_fade_in);
    gl.uniform1f(program.uniforms.scene_fade_out_factor, scene_fade_out);
    gl.uniform1f(program.uniforms.delay_time, delay_time);
    gl.uniform1f(program.uniforms.length_loop, config.LENGTH_LOOP);
    gl.uniform1f(program.uniforms.length_start_delay, config.LENGTH_START_DELAY);
    gl.uniform1f(program.uniforms.length_slice_assembly, config.LENGTH_SLICE_ASSEMBLY);
    gl.uniform1f(program.uniforms.length_particle_fade, config.LENGTH_PARTICLE_FADE);
    gl.uniform1f(program.uniforms.length_scene_fade, config.LENGTH_SCENE_FADE);
    gl.uniform1f(program.uniforms.camera_dist_max, config.CAMERA_DIST_MAX);
    gl.uniform1f(program.uniforms.camera_dist_factor, config.CAMERA_DIST_FACTOR);
    gl.uniform1f(program.uniforms.alpha_fade, config.ENABLE_ALPHA_SCALING ? 1 : 0); 

    set_viewport(data_dynamic.width, data_dynamic.height);
 
    draw_to_framebuffer_object(data_dynamic.write.fbo);
    data_dynamic.swap(); 
}

function draw_to_framebuffer_object (fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  	gl.bindVertexArray(vao_data_texture);
    
    // Draw Trangles Using 6 Vertices
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // Unbind
    gl.bindVertexArray(null);
}

function draw_blocks (g_proj_mat, g_view_mat, scene_fade_in, scene_fade_out, delay_time) {
    let program = prog_blocks;
    program.bind();

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    //gl.blendColor(0.51, 0.8, 1.0, 0.02);

    // Send Values to Block Shader
    gl.uniformMatrix4fv(program.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(program.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1i(program.uniforms.highlight_texture, 0);
	gl.uniform1f(program.uniforms.scene_fade_in_factor, scene_fade_in);
    gl.uniform1f(program.uniforms.scene_fade_out_factor, scene_fade_out);
    gl.uniform1f(program.uniforms.delay_time, delay_time);
	gl.uniform1f(program.uniforms.time, time);
    gl.uniform1f(program.uniforms.length_loop, config.LENGTH_LOOP);
    gl.uniform1f(program.uniforms.length_start_delay, config.LENGTH_START_DELAY);
    gl.uniform1f(program.uniforms.length_slice_assembly, config.LENGTH_SLICE_ASSEMBLY);
    gl.uniform1f(program.uniforms.length_particle_fade, config.LENGTH_PARTICLE_FADE);
    gl.uniform1f(program.uniforms.length_block_fade, config.LENGTH_BLOCK_FADE);
    gl.uniform1f(program.uniforms.length_block_highlight, config.LENGTH_BLOCK_HIGHLIGHT);
    gl.uniform1f(program.uniforms.length_scene_fade, config.LENGTH_SCENE_FADE);
    gl.uniform4fv(program.uniforms.color, color.BLOCK);
	
	set_viewport(canvas.width, canvas.height);
	
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindVertexArray(vao_blocks);

	// Groups are ordered by assembly time; later groups are entirely transparent.
    let visible_group_count = 0;
    for (let group = 0; group < block_group_first_appearance.length; group++) {
        if (delay_time > block_group_first_appearance[group]) visible_group_count = group + 1;
    }
    let vertices_to_draw = 36 * config.SLICE_PARTICLES * visible_group_count;
    if (vertices_to_draw > 0) gl.drawArrays(gl.TRIANGLES, 0, vertices_to_draw);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(null);
}


function draw_logo(scene_fade_out) {
    let program = prog_logo;
    program.bind();

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);

    // Send Values to Logo Shader
    gl.uniform1i(program.uniforms.logo_texture, 7);
    gl.uniform1f(program.uniforms.scene_fade_out_factor, scene_fade_out);
    gl.uniform1f(program.uniforms.logo_scale, config.LOGO_SCALE);
    gl.uniform1f(program.uniforms.logo_padding, config.LOGO_PADDING);
    gl.uniform1f(program.uniforms.logo_aspect_ratio, config.LOGO_ASPECT_RATIO);
    gl.uniform1f(program.uniforms.viewport_aspect_ratio, canvas.width / canvas.height);
    if (config.USE_LOGO_AS_ALPHA) gl.uniform1f(program.uniforms.use_alpha, 1.0);
    else gl.uniform1f(program.uniforms.use_alpha, 0.0);
    gl.uniform4fv(program.uniforms.color, color.LOGO);
	
	set_viewport(canvas.width, canvas.height);
	
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindVertexArray(vao_logo);

	// Draw Each Indexed Point of Logo
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(null);
}

function draw_lines(scene_fade_in, scene_fade_out, delay_time) {
    let program = prog_line;
    program.bind();

    let completion_factor = Math.min(Math.max((delay_time - 3.0 * config.LENGTH_START_DELAY) / config.LENGTH_RING_ASSEMBLY, 0.0), 1.0);
    let completion = line_progress_interpolator.getInterpolatedInteger(completion_factor);

    gl.uniformMatrix4fv(program.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(program.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1f(program.uniforms.scene_fade_in_factor, scene_fade_in);
    gl.uniform1f(program.uniforms.scene_fade_out_factor, scene_fade_out);
	gl.uniform1f(program.uniforms.delay_time, delay_time);
    gl.uniform1f(program.uniforms.length_start_delay, config.LENGTH_START_DELAY);
    gl.uniform1f(program.uniforms.length_ring_assembly, config.LENGTH_RING_ASSEMBLY);
    gl.uniform1f(program.uniforms.line_alpha, config.LINE_ALPHA);
    gl.uniform1f(program.uniforms.completion_factor, completion);
    gl.uniform4fv(program.uniforms.color, color.LINE);

    set_viewport(canvas.width, canvas.height);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindVertexArray(vao_line);

	for (let x = 0; x < line_heights.length; x++) {
		if (!config.ENABLE_LINE_THICKNESS_HACK) {
            draw_line(line_heights[x], line_radii[x], line_factors[x]);
            continue;
        }

        for (let offset = 0; offset < line_offsets.length; offset++) {
            draw_line(
                line_heights[x] + line_offsets[offset][0] * config.LINE_OFFSET,
                line_radii[x] + line_offsets[offset][1] * config.LINE_OFFSET,
                line_factors[x]
            );
        }
	}

    gl.bindVertexArray(null);
}

function draw_line(height, radius, factor) {
    gl.uniform1f(prog_line.uniforms.line_height, height);
    gl.uniform1f(prog_line.uniforms.line_radius, radius);
    gl.uniform1f(prog_line.uniforms.line_factor, factor);
    gl.drawElements(gl.LINE_STRIP, config.LINE_RESOLUTION, gl.UNSIGNED_SHORT, 0);
}

function draw_grid(g_proj_mat, g_view_mat, scale, visibility, scene_fade_in, scene_fade_out) {
	let program = prog_grid;
	program.bind();

    gl.uniformMatrix4fv(program.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(program.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1f(program.uniforms.scene_fade_in_factor, scene_fade_in);
    gl.uniform1f(program.uniforms.scene_fade_out_factor, scene_fade_out);
    gl.uniform1f(program.uniforms.scale, scale);
    gl.uniform1f(program.uniforms.alpha, config.BACKGROUND_GRID_ALPHA);
    gl.uniform1f(program.uniforms.visibility, visibility);
    gl.uniform4fv(program.uniforms.color, color.GRID);

    set_viewport(canvas.width, canvas.height);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindVertexArray(vao_grid);
    gl.drawArrays(gl.LINES, 0, grid_vertex_count);
	gl.bindVertexArray(null);
}

function draw_vingette(scene_fade_in, scene_fade_out) {
    let program = prog_vingette;
    program.bind();

    // Send Values to Logo Shader
    gl.uniform1i(program.uniforms.vingette_texture, 8);
    gl.uniform1f(program.uniforms.scene_fade_in_factor, scene_fade_in);
    gl.uniform1f(program.uniforms.scene_fade_out_factor, scene_fade_out);
    gl.uniform1f(program.uniforms.vingette_factor, config.VINGETTE_FACTOR);
    gl.uniform4fv(program.uniforms.vingette_color, color.VINGETTE);
	
	set_viewport(canvas.width, canvas.height);
	
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindVertexArray(vao_vingette);

	// Draw Each Indexed Point of Vingette
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
}

function draw_particles (position, data_dynamic, data_static, pa) {
    let program = prog_particle;
    program.bind();

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);

    gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform3fv(prog_particle.uniforms.position_camera, camera_pos);
	gl.uniform1f(prog_particle.uniforms.particle_scaling, config.ENABLE_PARTICLE_SCALING ? 1 : 0);
    gl.uniform1i(program.uniforms.u_pos, position.read.attach(1));
    gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.read.attach(2));
    gl.uniform1i(program.uniforms.texture_data_static, data_static.attach(3));
    gl.uniform1f(program.uniforms.resolution_scale, config.RESOLUTION_SCALE);
    gl.uniform4fv(program.uniforms.color, color.PARTICLE);
	
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	set_viewport(canvas.width, canvas.height);

	gl.drawArrays(gl.POINTS, 0, pa.length);

	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}