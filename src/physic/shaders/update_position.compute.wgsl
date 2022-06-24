struct Config {
    deltaTime: f32,
    constraintCount: f32,
    particlesCount: f32,
    gravity: vec3<f32>,
};

@group(0) @binding(0) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read> estimatedPositions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, write> velocities: array<vec3<f32>>;

@group(1) @binding(0) var<uniform> config: Config;

@stage(compute) @workgroup_size(16, 16)
fn main(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= u32(config.particlesCount)) {
        return;
    }

    velocities[id] = (estimatedPositions[id] - positions[id]) / config.deltaTime;
    positions[id] = estimatedPositions[id];
}