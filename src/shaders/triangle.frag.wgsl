@stage(fragment)
fn main(@location(0) normal: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(normal, 1.0);
}
