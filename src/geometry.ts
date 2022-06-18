import * as vec3 from "./math/vector3"

import {VertexBuffer, VertexRef} from "./vertex"
import {logger} from "./logger";

// Geometry holds a mesh geometry.
export class Geometry {
    public vertices: VertexBuffer
    public defaultIndices: Uint32Array
    public wireframeIndices?: Uint32Array
    public topology: Topology
    public primitive: GPUPrimitiveTopology

    private readonly defaultIndexBuffer: GPUBuffer
    private wireframeIndexBuffer?: GPUBuffer
    public vertexBuffer: GPUBuffer

    private device: GPUDevice
    private _wireframe: boolean

    constructor(device: GPUDevice, vertices: VertexBuffer, indices: Uint32Array) {
        this.vertices = vertices
        this.defaultIndices = indices
        this.topology = buildTopology(vertices, indices)
        this.primitive = "triangle-list"

        this.device = device
        this._wireframe = false

        // Initialize index buffer.
        this.defaultIndexBuffer = device.createBuffer({
            size: fourBytesAlignment(this.defaultIndices.byteLength),
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        })

        const writeIndicesArr = new Uint32Array(this.defaultIndexBuffer.getMappedRange())
        writeIndicesArr.set(this.defaultIndices)
        this.defaultIndexBuffer.unmap()


        // Initialize vertex buffer.
        this.vertexBuffer = device.createBuffer({
            size: fourBytesAlignment(this.vertices.buffer.byteLength),
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })

        const writeVerticesArr = new Float32Array(this.vertexBuffer.getMappedRange())
        writeVerticesArr.set(this.vertices.buffer)
        this.vertexBuffer.unmap()
    }

    public get indexBuffer(): GPUBuffer {
        if (this.wireframe) {
            return this.wireframeIndexBuffer
        }

        return this.defaultIndexBuffer
    }

    public get indexCount(): number {
        if (this.wireframe) {
            return this.wireframeIndices.length
        }
        return this.defaultIndices.length
    }

    public set wireframe(wireframe: boolean) {
        if (this._wireframe === wireframe) return

        this._wireframe = wireframe

        if (wireframe) {
            if (!this.wireframeIndices) {
                this.wireframeIndices = buildWireframeIndices(this.topology)
                this.wireframeIndexBuffer = this.device.createBuffer({
                    size: fourBytesAlignment(this.wireframeIndices.byteLength),
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                })
            }

            this.device.queue.writeBuffer(this.wireframeIndexBuffer, 0, this.wireframeIndices, 0, this.wireframeIndices.length)
            this.primitive = "line-list"
        } else {
            this.device.queue.writeBuffer(this.defaultIndexBuffer, 0, this.defaultIndices, 0, this.defaultIndices.length)
            this.primitive = "triangle-list"
        }
    }

    public get wireframe(): boolean {
        return this._wireframe
    }

    // upload uploads the vertices to the GPU.
    public upload(): void {
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices.buffer, 0, this.vertices.buffer.length)
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

function buildTopology(vertices: VertexBuffer, indices: Uint32Array) {
    const numTriangles = indices.length / 3

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
            a: indices[i * 3],
            b: indices[i * 3 + 1],
            c: indices[i * 3 + 2],
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

function buildWireframeIndices(topology: Topology): Uint32Array {
    const indices = new Uint32Array(topology.edges.length * 2)

    let idx = 0
    for (let edge of topology.edges) {
        indices[idx] = edge.start
        indices[idx+1] = edge.end

        idx += 2
    }

    return indices
}

// buildPlaneGeometry builds a plane geometry.
export function buildPlaneGeometry(device: GPUDevice, width: number, height: number, widthDivisions: number, heightDivisions: number): Geometry {
    const widthStep = width / widthDivisions
    const heightStep = height / heightDivisions

    logger.info(`plane geometry: size=(**${width}**, **${height}**) divisions=(**${widthDivisions}**, **${heightDivisions}**)`)

    const vertices = new VertexBuffer((heightDivisions + 1) * (widthDivisions + 1))
    const triangles = 2 * heightDivisions * widthDivisions
    const indices = new Uint32Array(3 * triangles)

    let indicesIdx = 0
    for (let j = 0; j < heightDivisions + 1; j++) {
        const y = j * heightStep

        for (let i = 0; i < widthDivisions + 1; i++) {
            const x = i * widthStep

            vertices.add({
                position: vec3.create(x, 0, y),
                normal: vec3.create(0, 1, 0),
                color: vec3.create(0, 1, 0),
            })
        }
    }

    for (let j = 0; j < heightDivisions; j++) {
        for (let i = 0; i < widthDivisions; i++) {
            const a = i + (widthDivisions + 1) * j
            const b = i + (widthDivisions + 1) * (j + 1)
            const c = (i + 1) + (widthDivisions + 1) * (j + 1)
            const d = (i + 1) + (widthDivisions + 1) * j

            indices.set([a, b, d], indicesIdx); indicesIdx += 3
            indices.set([b, c, d], indicesIdx); indicesIdx += 3
        }
    }

    return new Geometry(device, vertices, indices)
}

function fourBytesAlignment(size: number) {
    return (size + 3) & ~3
}
