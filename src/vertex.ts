import {Vector3} from "./math/vector3"

interface VertexIterator { (vertex: VertexRef): void }

export interface Vertex {
    id?: number
    position: Vector3
    normal: Vector3
    color: Vector3
}

export class Vector3Ref {
    private readonly buffer: Float32Array
    private readonly offset: number

    constructor(buffer: Float32Array, offset: number) {
        this.buffer = buffer
        this.offset = offset
    }

    get x(): number { return this.buffer[this.offset] }
    set x(x: number) { this.buffer[this.offset] = x }

    get y(): number { return this.buffer[this.offset+1] }
    set y(y: number) { this.buffer[this.offset+1] = y }

    get z(): number { return this.buffer[this.offset+2] }
    set z(z: number) { this.buffer[this.offset+2] = z }
}

export class VertexRef {
    public readonly id: number

    private readonly buffer: Float32Array
    private readonly offset: number

    static readonly positionOffset = 0
    static readonly normalOffset = 3
    static readonly colorOffset = 6
    static readonly components = 9

    constructor(id: number, buffer: Float32Array, offset: number) {
        this.id = id
        this.buffer = buffer
        this.offset = offset
    }

    get position(): Vector3 {
        const offset = this.offset + VertexRef.positionOffset

        return new Vector3Ref(this.buffer, offset)
    }
    set position(position: Vector3) {
        const offset = this.offset + VertexRef.positionOffset

        this.buffer[offset] = position.x
        this.buffer[offset+1] = position.y
        this.buffer[offset+2] = position.z
    }

    get normal(): Vector3 {
        const offset = this.offset + VertexRef.normalOffset

        return new Vector3Ref(this.buffer, offset)
    }
    set normal(normal: Vector3) {
        const offset = this.offset + VertexRef.normalOffset

        this.buffer[offset] = normal.x
        this.buffer[offset+1] = normal.y
        this.buffer[offset+2] = normal.z
    }

    get color(): Vector3 {
        const offset = this.offset + VertexRef.colorOffset

        return new Vector3Ref(this.buffer, offset)
    }
    set color(color: Vector3) {
        const offset = this.offset + VertexRef.colorOffset

        this.buffer[offset] = color.x
        this.buffer[offset+1] = color.y
        this.buffer[offset+2] = color.z
    }
}

export class VertexBuffer {
    public readonly buffer: Float32Array
    public count: number

    constructor(maxParticles: number) {
        this.buffer = new Float32Array(maxParticles * VertexRef.components)
        this.count = 0
    }

    add(vertex: Vertex) {
        const id = this.count
        const offset = this.count * VertexRef.components

        const p = new VertexRef(id, this.buffer, offset)

        p.position = vertex.position
        p.normal = vertex.normal
        p.color = vertex.color

        this.count++
    }

    get(i: number): Vertex {
        return new VertexRef(i, this.buffer, i * VertexRef.components)
    }

    forEach(cb: VertexIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new VertexRef(i, this.buffer, i * VertexRef.components))
        }
    }
}
