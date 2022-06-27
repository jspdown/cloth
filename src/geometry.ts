import * as vec3 from "./math/vector3"

import {Vertices} from "./vertex"
import {logger} from "./logger";
import {TriangleRef, Triangles} from "./triangles";

// Geometry holds a mesh geometry.
export interface Geometry {
    vertices: Vertices
    triangles: Triangles
}

// buildPlaneGeometry builds a plane geometry.
export function buildPlaneGeometry(device: GPUDevice, width: number, height: number, widthDivisions: number, heightDivisions: number): Geometry {
    const widthStep = width / widthDivisions
    const heightStep = height / heightDivisions

    logger.info(`plane geometry: size=(**${width}**, **${height}**) divisions=(**${widthDivisions}**, **${heightDivisions}**)`)

    const vertices = new Vertices(device, (heightDivisions + 1) * (widthDivisions + 1))
    const triangles = new Triangles(device, 2 * heightDivisions * widthDivisions)

    for (let j = 0; j < heightDivisions + 1; j++) {
        const y = j * heightStep

        for (let i = 0; i < widthDivisions + 1; i++) {
            const x = i * widthStep

            vertices.add({
                position: vec3.create(x, 0, y),
                normal: vec3.create(0, 1, 0),
            })

            console.log("vertex ", x, 0, y)
        }
    }

    for (let j = 0; j < heightDivisions; j++) {
        for (let i = 0; i < widthDivisions; i++) {
            const a = i + (widthDivisions + 1) * j
            const b = i + (widthDivisions + 1) * (j + 1)
            const c = (i + 1) + (widthDivisions + 1) * (j + 1)
            const d = (i + 1) + (widthDivisions + 1) * j

            triangles.add(a, b, d)
            triangles.add(b, c, d)
        }
    }

    return { vertices, triangles }
}
