struct Output {
    @builtin(position) Position: vec4<f32>,
    @location(0) Normal: vec3<f32>,
};

struct Camera {
    projection: mat4x4<f32>,
    view: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<uniform> model: mat4x4<f32>;

@stage(vertex)
fn main(@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>) -> Output {
    var output: Output;

    output.Normal = normal;
    output.Position = camera.projection * camera.view * model * vec4<f32>(position, 1.0);

    return output;
}
