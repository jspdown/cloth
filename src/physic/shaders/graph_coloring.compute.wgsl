struct Config {
    colorPalette: u32,
    seed: u32,
    constraintCount: u32,
    nextColor: u32,
}

struct Result {
    remainingConstraintsCount: atomic<u32>,
    needMoreColor: u32,
}

@group(0) @binding(0) var<storage, read_write> constraintColorPalettes: array<atomic<u32>>;
@group(0) @binding(1) var<storage, write> constraintColors: array<u32>;
@group(0) @binding(2) var<storage, read_write> remainingConstraintsToColor: array<u32>;
@group(0) @binding(3) var<storage> constraintNeighbours: array<u32>;
@group(0) @binding(4) var<storage> neighbourConstraints: array<u32>;
@group(0) @binding(5) var<storage, read_write> config: Config;
@group(0) @binding(6) var<storage, read_write> result: Result;
@group(1) @binding(0) var<storage, write> debug: array<u32>;

// init initialize the color palette of each constraint. The color palette is
// an u32 where each bit set to 1 represent a color.
@compute @workgroup_size(16, 16)
fn init(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= config.constraintCount) {
        return;
    }

    // Initialize the constraint color palette to all colors available in the
    // base palette. Each color occupies 1 bit in the palette.
    atomicStore(&constraintColorPalettes[id], config.colorPalette);
    remainingConstraintsToColor[id] = 1u;
    atomicAdd(&result.remainingConstraintsCount, 1u);
}

// pickRandomColor picks a random color for each uncolored constraints within its palette.
@compute @workgroup_size(16, 16)
fn pickRandomColor(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= config.constraintCount) {
        return;
    }

    // Increment the nextColor if we used an additional color in the last run.
    if (id == 0u && result.needMoreColor == 1u) {
        result.needMoreColor = 0u;
        config.nextColor += 1u;
    }

    if (remainingConstraintsToColor[id] != 1u) {
        debug[id] = constraintColors[id];
        return;
    }

    // Pick a random color from the palette.
    let seed = config.seed + id;
    let palette = atomicLoad(&constraintColorPalettes[id]);
    let color = randomColor(seed, palette, id);
    debug[id] = color;

    constraintColors[id] = color;
}

// resolveConflict checks if the randomly assigned color does not conflict with the neighbourhood.
@compute @workgroup_size(16, 16)
fn resolveConflict(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= config.constraintCount) {
        return;
    }

    if (remainingConstraintsToColor[id] != 1u) {
        debug[id] = constraintColors[id];
        return;
    }

    // Check wether or not the color conflicts with its neighbourhood. If
    // it doesn't conflict, meaning, none of its neighbour are of the same
    // color, the color is commited:
    // - The constraint is removed form the remaining constraint to color.
    // - The color is removed from the palette of its neighbours.
    let color = constraintColors[id];
    let neighbourStartIndex = constraintNeighbours[id];
    let neighbourEndIndex = constraintNeighbours[id + 1u];

    var hasHighestIndex = true;
    var conflict = false;
    for (var i = neighbourStartIndex; i < neighbourEndIndex; i++) {
        let neighbourIndex = neighbourConstraints[i];

        if (constraintColors[neighbourIndex] == color) {
            conflict = true;

            // Record whether or not the current instance has the highest index
            // among the neighbours that have a conflicting color.
            if (id < neighbourIndex) {
                hasHighestIndex = false;
            }
        }
    }

    if (conflict && !hasHighestIndex) {
        debug[id] = 1000u + atomicLoad(&constraintColorPalettes[id]);
        return;
    }

    atomicSub(&result.remainingConstraintsCount, 1u);
    remainingConstraintsToColor[id] = 0u;
    debug[id] = color;
    debug[id] = 40000u + color;

    // Remove the color from all its neighbours.
    for (var i = neighbourStartIndex; i < neighbourEndIndex; i++) {
        atomicAnd(&constraintColorPalettes[neighbourConstraints[i]], ~color);
    }
}

// feedTheHungry adds one more color to all the constraints 0 colors remaining in there palette.
@compute @workgroup_size(16, 16)
fn feedTheHungry(@builtin(num_workgroups) workgroup_size: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let w = workgroup_size.x * 16u;
    let h = workgroup_size.y * 16u;

    let id = global_id.x
        + (global_id.y * w)
        + (global_id.z * w * h);

    // Guard against out-of-bounds work group sizes.
    if (id >= config.constraintCount) {
        return;
    }

    // Increment the seed for the next pickRandomColor kernel run.
    if (id == 0u) {
        config.seed += 1123u;
    }

    if (remainingConstraintsToColor[id] != 1u) {
        debug[id] = constraintColors[id];
        return;
    }

    if (atomicLoad(&constraintColorPalettes[id]) == 0u) {
        atomicStore(&constraintColorPalettes[id], 1u << config.nextColor);
        result.needMoreColor = 1u;
        debug[id] = 100000u;
    }
}

fn randomColor(seed: u32, palette: u32, id:u32) -> u32 {
    let paletteSize = countOneBits(palette);
    let value = randomInt(seed, paletteSize);

    var v = 0u;
    for (var i = 0u; i < 32u; i++) {
        let color = 1u << i;

        if ((palette & color) == color) {
            v++;
        }

        if (v > value) {
            return color;
        }
    }

    return 0u;
}

fn randomInt(seed: u32, max: u32) -> u32 {
    var value = seed;

    value = (value << 13u) ^ value;
    value = value * (value * value * 15731u + 789221u) + 1376312589u;

    let normalized = f32(value & u32(0x7fffffffu))/f32(0x7fffffff);

    return u32(normalized * f32(max));
}
