struct SolverConfig {
    gravity: vec3<f32>,
    deltaTime: f32,
};

@group(0) @binding(0) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read_write> estimatedPositions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read> inverseMasses: array<f32>;

@group(1) @binding(0) var<uniform> solverConfig: SolverConfig;

@compute @workgroup_size(16, 16)
fn main(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= arrayLength(&positions)) {
        return;
    }

    if (inverseMasses[id] > 0.0) {
        velocities[id] += solverConfig.gravity * solverConfig.deltaTime;
    }

    estimatedPositions[id] = positions[id] + velocities[id] * solverConfig.deltaTime;
}
