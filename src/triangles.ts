export interface TriangleIterator { (triangle: TriangleRef): void }

export type Pair<T> = [T, T]
export type Triple<T> = [T, T, T]

export interface Topology {
    edges: Pair<number>[]
    adjacentTriangles: Pair<number>[]
}

export class TriangleRef {
    public readonly id: number

    private readonly data: TrianglesData
    private readonly offset: number

    constructor(id: number, data: TrianglesData, offset: number) {
        this.id = id
        this.data = data
        this.offset = offset
    }

    get a(): number { return this.data.indices[this.offset * 3] }
    set a(a: number) {
        this.data.indices[this.offset * 3] = a
        this.data.uploadNeeded = true
    }

    get b(): number { return this.data.indices[this.offset * 3 + 1] }
    set b(b: number) {
        this.data.indices[this.offset * 3 + 1] = b
        this.data.uploadNeeded = true
    }

    get c(): number { return this.data.indices[this.offset * 3 + 2] }
    set c(c: number) {
        this.data.indices[this.offset * 3 + 2] = c
        this.data.uploadNeeded = true
    }

    public toArray(): number[] {
        return [this.a, this.b, this.c]
    }

    public toString(): string {
        return `(${this.a}, ${this.b}, ${this.c})`
    }
}

interface TrianglesData {
    uploadNeeded: boolean

    indices: Uint32Array
}

export class Triangles {
    public readonly indexBuffer: GPUBuffer
    public count: number

    private readonly device: GPUDevice
    private readonly max: number

    private readonly data: TrianglesData

    constructor(device: GPUDevice, maxTriangles: number) {
        this.device = device
        this.max = maxTriangles
        this.count = 0

        this.data = {
            uploadNeeded: true,
            indices: new Uint32Array(maxTriangles * 3),
        }

        this.indexBuffer = this.device.createBuffer({
            label: "index",
            size: fourBytesAlignment(this.data.indices.byteLength),
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
    }

    public get uploadNeeded(): boolean {
        return this.data.uploadNeeded
    }

    public upload(): void {
        this.device.queue.writeBuffer(
            this.indexBuffer, 0,
            this.data.indices, 0,
            this.data.indices.length)

        this.data.uploadNeeded = false
    }

    public add(a: number, b: number, c: number): void {
        if (this.count >= this.max) {
            throw new Error("max number of particles reached")
        }

        const t = new TriangleRef(this.count, this.data, this.count)

        t.a = a
        t.b = b
        t.c = c

        this.count++
    }

    public get(i: number): TriangleRef {
        return new TriangleRef(i, this.data, i)
    }

    public forEach(cb: TriangleIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new TriangleRef(i, this.data, i))
        }
    }

    public extractTopology(): Topology {
        const triangleEdges: Triple<number>[] = []

        this.forEach((triangle: TriangleRef) => {
            const [a, b, c] = [triangle.a, triangle.b, triangle.c].sort()

            triangleEdges.push(
                [a, b, triangle.id],
                [a, c, triangle.id],
                [b, c, triangle.id])
        })

        // Sort triangle edges by start and end vertices. Triangles sharing
        // the same vertices will be located next to each other.
        triangleEdges.sort((a, b) => a[0] === b[0]
            ? a[1] - b[1]
            : b[0] - a[0]
        )

        const edges: Pair<number>[] = []
        const adjacentTriangles: Pair<number>[] = []

        let lastEdge = [-1, -1]
        for (let i = 0; i < triangleEdges.length; i++) {
            const [start, end, triangle] = triangleEdges[i]
            const [lastStart, lastEnd, lastTriangle] = lastEdge

            if (start == lastStart && end == lastEnd) {
                adjacentTriangles.push([lastTriangle, triangle])
            } else {
                edges.push([start, end])
            }

            lastEdge = triangleEdges[i]
        }

        return { edges, adjacentTriangles }
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
