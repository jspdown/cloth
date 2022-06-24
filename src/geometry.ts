import * as vec3 from "./math/vector3"

import {Vertices} from "./vertex"
import {logger} from "./logger";

// Geometry holds a mesh geometry.
export class Geometry {
    public vertices: Vertices
    public indexes: Uint32Array

    public topology: Topology

    public indexBuffer: GPUBuffer
    public positionBuffer: GPUBuffer
    public normalBuffer: GPUBuffer

    private device: GPUDevice

    constructor(device: GPUDevice, vertices: Vertices, indexes: Uint32Array) {
        this.vertices = vertices
        this.indexes = indexes

        this.topology = buildTopology(vertices, indexes)

        this.device = device

        this.indexBuffer = device.createBuffer({
            size: fourBytesAlignment(this.indexes.byteLength),
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        })
        this.positionBuffer = device.createBuffer({
            size: fourBytesAlignment(this.vertices.positions.byteLength),
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })
        this.normalBuffer = device.createBuffer({
            size: fourBytesAlignment(this.vertices.normals.byteLength),
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })

        const writeIndicesArr = new Uint32Array(this.indexBuffer.getMappedRange())
        writeIndicesArr.set(this.indexes)
        this.indexBuffer.unmap()

        const writePositionsArr = new Float32Array(this.positionBuffer.getMappedRange())
        writePositionsArr.set(this.vertices.positions)
        this.positionBuffer.unmap()

        const writeNormalsArr = new Float32Array(this.normalBuffer.getMappedRange())
        writeNormalsArr.set(this.vertices.normals)
        this.normalBuffer.unmap()
    }

    public upload(): void {
        this.device.queue.writeBuffer(this.positionBuffer, 0, this.vertices.positions, 0, this.vertices.positions.length)
        this.device.queue.writeBuffer(this.normalBuffer, 0, this.vertices.normals, 0, this.vertices.normals.length)
    }
}

interface Topology {
    triangles: Triangle[]
    edges: Edge[]
}

interface Triangle {
    a: number
    b: number
    c: number
}

interface Edge {
    start: number
    end: number
    triangles: number[]
}

function buildTopology(vertices: Vertices, indexes: Uint32Array) {
    const numTriangles = indexes.length / 3

    const vertexTriangles = new Array(vertices.count)
    const existingEdges: Record<string, number> = {}

    const triangles: Triangle[] = []
    const edges: Edge[] = []

    const addTriangleToVertex = (id: number, i: number) => {
        if (!vertexTriangles[id]) {
            vertexTriangles[id] = []
        }

        vertexTriangles[id].push(i)
    }

    for (let i = 0; i < numTriangles; i++) {
        const triangle = {
            a: indexes[i * 3],
            b: indexes[i * 3 + 1],
            c: indexes[i * 3 + 2],
        }

        addTriangleToVertex(triangle.a, i)
        addTriangleToVertex(triangle.b, i)
        addTriangleToVertex(triangle.c, i)

        const triangleEdges = [
            { start: Math.min(triangle.a, triangle.b), end: Math.max(triangle.a, triangle.b) },
            { start: Math.min(triangle.b, triangle.c), end: Math.max(triangle.b, triangle.c) },
            { start: Math.min(triangle.c, triangle.a), end: Math.max(triangle.c, triangle.a) },
        ]

        triangles.push(triangle)

        for (let edge of triangleEdges) {
            const key = `${edge.start}-${edge.end}`

            if (!existingEdges[key]) {
                edges.push({
                    start: edge.start,
                    end: edge.end,
                    triangles: [i],
                })
                existingEdges[key] = edges.length - 1
                continue
            }

            edges[existingEdges[key]].triangles.push(i)
        }
    }

    return { triangles, edges }
}

// buildPlaneGeometry builds a plane geometry.
export function buildPlaneGeometry(device: GPUDevice, width: number, height: number, widthDivisions: number, heightDivisions: number): Geometry {
    const widthStep = width / widthDivisions
    const heightStep = height / heightDivisions

    logger.info(`plane geometry: size=(**${width}**, **${height}**) divisions=(**${widthDivisions}**, **${heightDivisions}**)`)

    const vertices = new Vertices((heightDivisions + 1) * (widthDivisions + 1))
    const triangles = 2 * heightDivisions * widthDivisions
    const indexes = new Uint32Array(3 * triangles)

    let indexOffset = 0
    for (let j = 0; j < heightDivisions + 1; j++) {
        const y = j * heightStep

        for (let i = 0; i < widthDivisions + 1; i++) {
            const x = i * widthStep

            vertices.add({
                position: vec3.create(x, 0, y),
                normal: vec3.create(0, 1, 0),
            })
        }
    }

    for (let j = 0; j < heightDivisions; j++) {
        for (let i = 0; i < widthDivisions; i++) {
            const a = i + (widthDivisions + 1) * j
            const b = i + (widthDivisions + 1) * (j + 1)
            const c = (i + 1) + (widthDivisions + 1) * (j + 1)
            const d = (i + 1) + (widthDivisions + 1) * j

            indexes.set([a, b, d], indexOffset); indexOffset += 3
            indexes.set([b, c, d], indexOffset); indexOffset += 3
        }
    }

    return new Geometry(device, vertices, indexes)
}

function fourBytesAlignment(size: number) {
    return (size + 3) & ~3
}
