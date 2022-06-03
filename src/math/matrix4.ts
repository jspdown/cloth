import {Vector3} from "./vector3"

export type Matrix4 = [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
]

export function identity(): Matrix4 {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]
}

export function translation(a: Vector3): Matrix4 {
    const mat = identity()

    mat[12] = a.x
    mat[13] = a.y
    mat[14] = a.z

    return mat
}

export function rotation(a: Vector3): Matrix4 {
    return rotateZMut(rotateYMut(rotateXMut(identity(), a.x), a.y), a.z)
}

export function rotateXMut(a: Matrix4, rad: number): Matrix4 {
    const s = Math.sin(rad)
    const c = Math.cos(rad)

    const a10 = a[4]
    const a11 = a[5]
    const a12 = a[6]
    const a13 = a[7]
    const a20 = a[8]
    const a21 = a[9]
    const a22 = a[10]
    const a23 = a[11]

    a[4] = a10 * c + a20 * s
    a[5] = a11 * c + a21 * s
    a[6] = a12 * c + a22 * s
    a[7] = a13 * c + a23 * s
    a[8] = a20 * c - a10 * s
    a[9] = a21 * c - a11 * s
    a[10] = a22 * c - a12 * s
    a[11] = a23 * c - a13 * s

    return a
}

export function rotateYMut(a: Matrix4, rad: number): Matrix4 {
    const s = Math.sin(rad)
    const c = Math.cos(rad)

    const a00 = a[0]
    const a01 = a[1]
    const a02 = a[2]
    const a03 = a[3]
    const a20 = a[8]
    const a21 = a[9]
    const a22 = a[10]
    const a23 = a[11]

    a[0] = a00 * c - a20 * s
    a[1] = a01 * c - a21 * s
    a[2] = a02 * c - a22 * s
    a[3] = a03 * c - a23 * s
    a[8] = a00 * s + a20 * c
    a[9] = a01 * s + a21 * c
    a[10] = a02 * s + a22 * c
    a[11] = a03 * s + a23 * c

    return a
}

export function rotateZMut(a: Matrix4, rad: number): Matrix4 {
    const s = Math.sin(rad)
    const c = Math.cos(rad)

    const a00 = a[0]
    const a01 = a[1]
    const a02 = a[2]
    const a03 = a[3]
    const a10 = a[4]
    const a11 = a[5]
    const a12 = a[6]
    const a13 = a[7]

    a[0] = a00 * c + a10 * s
    a[1] = a01 * c + a11 * s
    a[2] = a02 * c + a12 * s
    a[3] = a03 * c + a13 * s
    a[4] = a10 * c - a00 * s
    a[5] = a11 * c - a01 * s
    a[6] = a12 * c - a02 * s
    a[7] = a13 * c - a03 * s

    return a
}

export function mulMut(a: Matrix4, b: Matrix4): Matrix4 {
    const a00 = a[0]
    const a01 = a[1]
    const a02 = a[2]
    const a03 = a[3]

    const a10 = a[4]
    const a11 = a[5]
    const a12 = a[6]
    const a13 = a[7]

    const a20 = a[8]
    const a21 = a[9]
    const a22 = a[10]
    const a23 = a[11]

    const a30 = a[12]
    const a31 = a[13]
    const a32 = a[14]
    const a33 = a[15]

    let b0 = b[0]
    let b1 = b[1]
    let b2 = b[2]
    let b3 = b[3]

    a[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    a[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    a[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    a[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[4]
    b1 = b[5]
    b2 = b[6]
    b3 = b[7]

    a[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    a[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    a[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    a[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[8]
    b1 = b[9]
    b2 = b[10]
    b3 = b[11]

    a[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    a[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    a[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    a[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[12]
    b1 = b[13]
    b2 = b[14]
    b3 = b[15]

    a[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    a[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    a[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    a[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    return a
}

export function perspective(fovy: number, near: number, far: number, aspect: number): Matrix4 {
    const f = 1.0 / Math.tan(fovy / 2)
    const nearFar = 1 / (near - far)

    const mat = identity()

    mat[0] = f / aspect
    mat[5] = f
    mat[10] = (far + near) * nearFar
    mat[11] = -1
    mat[14] = 2 * far * near * nearFar

    return mat
}
