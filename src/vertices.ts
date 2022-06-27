import {Vector3} from "./math/vector3"

interface VertexIterator { (vertex: VertexRef): void }

export interface Vertex {
    id?: number
    position: Vector3
    normal: Vector3
}

export class Vector3Ref {
    private readonly buffer: Float32Array|Int32Array
    private readonly offset: number

    static alignedLength = 3 + 1

    constructor(buffer: Float32Array|Int32Array, offset: number) {
        this.buffer = buffer
        this.offset = offset
    }

    get x(): number { return this.buffer[this.offset] }
    set x(x: number) { this.buffer[this.offset] = x }

    get y(): number { return this.buffer[this.offset+1] }
    set y(y: number) { this.buffer[this.offset+1] = y }

    get z(): number { return this.buffer[this.offset+2] }
    set z(z: number) { this.buffer[this.offset+2] = z }

    public toString(): string {
        return `(${this.x}, ${this.y}, ${this.z})`
    }
}

export class VertexRef {
    public readonly id: number

    private readonly data: VerticesData
    private readonly offset: number

    static normalFactor: 10000

    constructor(id: number, data: VerticesData, offset: number) {
        this.id = id
        this.data = data
        this.offset = offset
    }

    get position(): Vector3 {
        return new Vector3Ref(this.data.positions, this.offset*Vector3Ref.alignedLength)
    }
    set position(position: Vector3) {
        this.data.positions[this.offset*Vector3Ref.alignedLength] = position.x
        this.data.positions[this.offset*Vector3Ref.alignedLength+1] = position.y
        this.data.positions[this.offset*Vector3Ref.alignedLength+2] = position.z

        this.data.uploadNeeded = true
    }

    get normal(): Vector3 {
        return new Vector3Ref(this.data.normals, this.offset*Vector3Ref.alignedLength)
    }
    set normal(normal: Vector3) {
        this.data.normals[this.offset*Vector3Ref.alignedLength] = normal.x
        this.data.normals[this.offset*Vector3Ref.alignedLength+1] = normal.y
        this.data.normals[this.offset*Vector3Ref.alignedLength+2] = normal.z

        this.data.uploadNeeded = true
    }
}

interface VerticesData {
    uploadNeeded: boolean

    positions: Float32Array
    normals: Int32Array
}

export class Vertices {
    public count: number

    public readonly positionBuffer: GPUBuffer
    public readonly normalBuffer: GPUBuffer

    private readonly data: VerticesData
    private readonly max: number

    private readonly device: GPUDevice

    constructor(device: GPUDevice, maxVertices: number) {
        this.device = device
        this.data = {
            uploadNeeded: true,
            positions: new Float32Array(maxVertices * Vector3Ref.alignedLength),
            normals: new Int32Array(maxVertices * Vector3Ref.alignedLength),
        }

        this.positionBuffer = device.createBuffer({
            size: fourBytesAlignment(this.data.positions.byteLength),
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.normalBuffer = device.createBuffer({
            size: fourBytesAlignment(this.data.normals.byteLength),
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })

        this.count = 0
        this.max = maxVertices
    }

    public get uploadNeeded(): boolean {
        return this.data.uploadNeeded
    }

    public upload(): void {
        this.device.queue.writeBuffer(
            this.positionBuffer, 0,
            this.data.positions, 0,
            this.data.positions.length)

        this.device.queue.writeBuffer(
            this.normalBuffer, 0,
            this.data.normals, 0,
            this.data.normals.length)

        this.data.uploadNeeded = false
    }

    public add(vertex: Vertex) {
        if (this.count >= this.max) {
            return new Error("max number of vertices reached")
        }

        const v = new VertexRef(this.count, this.data, this.count)

        v.position = vertex.position
        v.normal = vertex.normal

        this.count++
    }

    public get(i: number): VertexRef {
        return new VertexRef(i, this.data, i)
    }

    public forEach(cb: VertexIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new VertexRef(i, this.data, i))
        }
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
