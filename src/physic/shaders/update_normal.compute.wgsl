@group(0) @binding(0) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read> indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> normals: array<atomic<i32>>;

@compute @workgroup_size(16, 16)
fn main(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= arrayLength(&indices) / 3u) {
        return;
    }

    let a = indices[id*3u];
    let b = indices[id*3u + 1u];
    let c = indices[id*3u + 2u];

    let face_normal = vec3<i32>(cross(positions[b] - positions[a], positions[c] - positions[a]) * 10000.0);

    atomicAdd(&normals[a*4u], face_normal.x);
    atomicAdd(&normals[a*4u + 1u], face_normal.y);
    atomicAdd(&normals[a*4u + 2u], face_normal.z);

    atomicAdd(&normals[b*4u], face_normal.x);
    atomicAdd(&normals[b*4u + 1u], face_normal.y);
    atomicAdd(&normals[b*4u + 2u], face_normal.z);

    atomicAdd(&normals[c*4u], face_normal.x);
    atomicAdd(&normals[c*4u + 1u], face_normal.y);
    atomicAdd(&normals[c*4u + 2u], face_normal.z);
}
