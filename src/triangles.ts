
export interface TriangleIterator { (triangle: TriangleRef): void }

export interface Triangle {
    a: number
    b: number
    c: number
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
    public count: number;

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
            this.count)

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

    public get(i: number): Triangle {
        return new TriangleRef(i, this.data, i)
    }

    public forEach(cb: TriangleIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new TriangleRef(i, this.data, i))
        }
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
