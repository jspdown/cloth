struct Config {
    trianglesCount: u32,
}

@group(0) @binding(0) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read> indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> normals: array<vec3<f32>>;

@group(1) @binding(0) var<storage, read> config: Config;

@stage(compute) @workgroup_size(16, 16)
fn compute_triangle_normal(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= u32(config.trianglesCount)) {
        return;
    }

    let a = id;
    let b = id + 1;
    let c = id + 2;

    let face_normal = cross(positions[b] - positions[a], positions[c] - positions[a]);

    normals[a] += face_normal;
    normals[b] += face_normal;
    normals[c] += face_normal;
}

@stage(compute) @workgroup_size(16, 16)
fn compute_vertex_normal(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= u32(config.trianglesCount)) {
        return;
    }

    normals[a] = normalize(normals[a]);
    normals[b] = normalize(normals[b]);
    normals[c] = normalize(normals[c]);
}
