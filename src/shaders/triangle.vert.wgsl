struct VSOut {
    @builtin(position) Position: vec4<f32>,
};

struct UBO {
  viewProj: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: UBO;

@stage(vertex)
fn main(@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>) -> VSOut {
    var vsOut: VSOut;

    vsOut.Position = uniforms.viewProj * vec4<f32>(position, 1.0);

    return vsOut;
}
