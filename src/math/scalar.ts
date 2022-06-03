
export function clamp(scalar: number, min: number, max: number): number {
    if (scalar < min) {
        return min
    }
    if (scalar > max) {
        return max
    }
    return scalar
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

export function radToDeg(rad: number): number {
  return rad / (Math.PI / 180)
}
