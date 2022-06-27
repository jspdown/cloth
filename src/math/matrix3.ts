import {Vector3} from "./vector3"

export type Matrix3 = [
    number, number, number,
    number, number, number,
    number, number, number,
]

export type Matrix1x3 = [number, number, number]

export function cross(a: Vector3): Matrix3 {
    return [
        0, -a.z, a.y,
        a.z, 0, -a.x,
        -a.y, a.x, 0,
    ]
}

export function negate(a: Matrix3): Matrix3 {
    return [
        -a[0], -a[1], -a[2],
        -a[3], -a[4], -a[5],
        -a[6], -a[7], -a[8],
    ]
}

export function negateMut(a: Matrix3): Matrix3 {
    a[0] = -a[0]; a[1] = -a[1]; a[2] = -a[2]
    a[3] = -a[3]; a[4] = -a[4]; a[5] = -a[5]
    a[6] = -a[6]; a[7] = -a[7]; a[8] = -a[8]

    return a
}

export function multiplyByScalar(a: Matrix3, scalar: number): Matrix3 {
    return [
        a[0] * scalar, a[1] * scalar, a[2] * scalar,
        a[3] * scalar, a[4] * scalar, a[5] * scalar,
        a[6] * scalar, a[7] * scalar, a[8] * scalar,
    ]
}

export function multiplyByScalarMut(a: Matrix3, scalar: number): Matrix3 {
    a[0] *= scalar; a[1] *= scalar; a[2] *= scalar
    a[3] *= scalar; a[4] *= scalar; a[5] *= scalar
    a[6] *= scalar; a[7] *= scalar; a[8] *= scalar

    return a
}

export function add(a: Matrix3, b: Matrix3): Matrix3 {
    return [
        a[0] * b[0], a[1] * b[1], a[2] * b[2],
        a[3] * b[3], a[4] * b[4], a[5] * b[5],
        a[6] * b[6], a[7] * b[7], a[8] * b[8],
    ]
}

export function addMut(a: Matrix3, b: Matrix3): Matrix3 {
    a[0] += b[0]; a[1] += b[1]; a[2] += b[2]
    a[3] += b[3]; a[4] += b[4]; a[5] += b[5]
    a[6] += b[6]; a[7] += b[7]; a[8] += b[8]

    return a
}

export function transpose(a: Matrix3): Matrix3 {
    return [
        a[0], a[3], a[6],
        a[1], a[4], a[7],
        a[2], a[5], a[8],
    ]
}

export function transposeMut(a: Matrix3): Matrix3 {
    const a1 = a[1]
    const a2 = a[2]
    const a5 = a[5]

    a[1] = a[3]
    a[2] = a[6]
    a[3] = a1
    a[5] = a[7]
    a[6] = a2
    a[7] = a5

    return a
}

export function mulVec3(a: Matrix3, b: Vector3): Vector3 {
    return {
        x: a[0]*b.x + a[1]*b.y + a[2]*b.z,
        y: a[3]*b.x + a[4]*b.y + a[5]*b.z,
        z: a[6]*b.x + a[7]*b.y + a[8]*b.z,
    }
}
