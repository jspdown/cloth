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

    public toString = (): string => {
        return `(${this.x}, ${this.y}, ${this.z})`
    }
}

export class VertexRef {
    public readonly id: number

    private readonly vertices: Vertices
    private readonly offset: number

    static normalFactor: 10000

    constructor(id: number, vertices: Vertices, offset: number) {
        this.id = id
        this.vertices = vertices
        this.offset = offset
    }

    get position(): Vector3 {
        return new Vector3Ref(this.vertices.positions, this.offset*Vector3Ref.alignedLength)
    }
    set position(position: Vector3) {
        this.vertices.positions[this.offset*Vector3Ref.alignedLength] = position.x
        this.vertices.positions[this.offset*Vector3Ref.alignedLength+1] = position.y
        this.vertices.positions[this.offset*Vector3Ref.alignedLength+2] = position.z
    }

    get normal(): Vector3 {
        return new Vector3Ref(this.vertices.normals, this.offset*Vector3Ref.alignedLength)
    }
    set normal(normal: Vector3) {
        this.vertices.normals[this.offset*Vector3Ref.alignedLength] = normal.x
        this.vertices.normals[this.offset*Vector3Ref.alignedLength+1] = normal.y
        this.vertices.normals[this.offset*Vector3Ref.alignedLength+2] = normal.z
    }
}

export class Vertices {
    public count: number

    public readonly positions: Float32Array
    public readonly normals: Int32Array

    public readonly max: number

    constructor(maxVertices: number) {
        this.positions = new Float32Array(maxVertices * Vector3Ref.alignedLength)
        this.normals = new Int32Array(maxVertices * Vector3Ref.alignedLength)

        this.count = 0
        this.max = maxVertices
    }

    add(vertex: Vertex) {
        if (this.count+1 > this.max) {
            return new Error("max number of vertices reached")
        }

        const v = new VertexRef(this.count, this, this.count)

        v.position = vertex.position
        v.normal = vertex.normal

        this.count++
    }

    get(i: number): Vertex {
        return new VertexRef(i, this, i)
    }

    forEach(cb: VertexIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new VertexRef(i, this, i))
        }
    }
}
