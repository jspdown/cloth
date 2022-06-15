struct Config {
    particleCount: f32,
}

struct Particle {
    position: vec3<f32>,
    inverseMass: f32,
}

struct Constraint {
    p1: int32
    p2: int32,
    restValue: f32,
    compliance: f32,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, write> deltaPositions: array<vec3<f32>>;
@group(1) @binding(0) var<uniform> config: Config;

@stage(compute) @workgroup_size(8, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    // Guard against out-of-bounds work group sizes
    if (global_id.x >= u32(config.particleCount)) {
        return;
    }

    var position = particles[global_id.x].position;
    deltaPositions[global_id.x] = vec3(position.x*0.0, position.y*0.0, position.z*0.0)
}
