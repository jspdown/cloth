@stage(fragment)
fn main(
    @location(0) normal: vec3<f32>,
    @location(1) color: vec3<f32>) -> @location(0) vec4<f32> {

    return vec4<f32>(color, 1.0);
}
