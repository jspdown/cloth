struct Config {
    particleCount: f32,
}

struct Particle {
    position: vec3<f32>,
    velocity: vec3<f32>,
    inverseMass: f32,
}

@group(0) @binding(0) var<storage, read> inputParticles: array<Particle>;
@group(0) @binding(1) var<storage, write> outputParticles: array<Particle>;
@group(1) @binding(0) var<uniform> config: Config;

@stage(compute) @workgroup_size(8, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    // Guard against out-of-bounds work group sizes
    if (global_id.x >= u32(config.particleCount)) {
        return;
    }

    var input = inputParticles[global_id.x].position;
    outputParticles[global_id.x].position = vec3<f32>(f32(global_id.x), f32(global_id.y), input.z);
}
