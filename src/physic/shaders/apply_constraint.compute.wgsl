struct SolverConfig {
    gravity: vec3<f32>,
    deltaTime: f32,
};

struct ColorConfig {
    start: u32,
    count: u32,
}

@group(0) @binding(0) var<storage, read_write> estimatedPositions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read> inverseMasses: array<f32>;
@group(0) @binding(2) var<storage, read> restValues: array<f32>;
@group(0) @binding(3) var<storage, read> compliances: array<f32>;
@group(0) @binding(4) var<storage, read> affectedParticles: array<f32>;

@group(1) @binding(0) var<uniform> solverConfig: SolverConfig;
@group(2) @binding(0) var<uniform> colorConfig: ColorConfig;

@compute @workgroup_size(16, 16)
fn main(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let constraint_id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Skip constraints that are not of the right color.
    if constraint_id < colorConfig.start || constraint_id >= colorConfig.start + colorConfig.count {
        return;
    }

    var p1_id = u32(affectedParticles[constraint_id * 2u]);
    var p2_id = u32(affectedParticles[constraint_id * 2u + 1u]);

    var w1 = inverseMasses[p1_id];
    var w2 = inverseMasses[p2_id];

    var sumWeight = w1 + w2;
    if (sumWeight <= 0.0) {
        return;
    }

    var alphaTilde = compliances[constraint_id] / (solverConfig.deltaTime * solverConfig.deltaTime);
    var p1p2 = estimatedPositions[p1_id] - estimatedPositions[p2_id];

    var distance = length(p1p2);

    if (distance < 0.0000001) {
        return;
    }

    var grad = p1p2 / distance;
    var c = distance - restValues[constraint_id];
    var lagrangeMultiplier = -c / (sumWeight + alphaTilde);

    estimatedPositions[p1_id] += grad * lagrangeMultiplier * w1;
    estimatedPositions[p2_id] += grad * -lagrangeMultiplier * w2;
}
