import {Vector3} from "../math/vector3"

interface ParticleIterator { (particle: ParticleRef): void }

export interface Particle {
    id?: number

    position: Vector3
    estimatedPosition: Vector3
    velocity: Vector3
    inverseMass: number
}

export class Vector3Ref {
    private readonly buffer: Float32Array
    private readonly offset: number

    static alignedLength = 3 + 1

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

    public toString = (): string => {
        return `(${this.x}, ${this.y}, ${this.z})`
    }
}

export class ParticleRef {
    public readonly id: number

    private readonly data: ParticlesData
    private readonly offset: number

    constructor(id: number, data: ParticlesData, offset: number) {
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

    get estimatedPosition(): Vector3 {
        return new Vector3Ref(this.data.estimatedPositions, this.offset*Vector3Ref.alignedLength)
    }
    set estimatedPosition(estimatedPosition: Vector3) {
        this.data.estimatedPositions[this.offset*Vector3Ref.alignedLength] = estimatedPosition.x
        this.data.estimatedPositions[this.offset*Vector3Ref.alignedLength+1] = estimatedPosition.y
        this.data.estimatedPositions[this.offset*Vector3Ref.alignedLength+2] = estimatedPosition.z

        this.data.uploadNeeded = true
    }

    get velocity(): Vector3 {
        return new Vector3Ref(this.data.velocities, this.offset*Vector3Ref.alignedLength)
    }
    set velocity(velocity: Vector3) {
        this.data.velocities[this.offset*Vector3Ref.alignedLength] = velocity.x
        this.data.velocities[this.offset*Vector3Ref.alignedLength+1] = velocity.y
        this.data.velocities[this.offset*Vector3Ref.alignedLength+2] = velocity.z

        this.data.uploadNeeded = true
    }

    get inverseMass(): number {
        return this.data.inverseMasses[this.offset]
    }
    set inverseMass(inverseMass: number) {
        this.data.inverseMasses[this.offset] = inverseMass

        this.data.uploadNeeded = true
    }
}

interface ParticlesData {
    uploadNeeded: boolean

    positions: Float32Array
    estimatedPositions: Float32Array
    velocities: Float32Array
    inverseMasses: Float32Array
}

export class Particles {
    public count: number

    private readonly data: ParticlesData

    public readonly estimatedPositionBuffer: GPUBuffer
    public readonly velocityBuffer: GPUBuffer
    public readonly inverseMassBuffer: GPUBuffer

    private readonly device: GPUDevice
    private readonly max: number

    constructor(device: GPUDevice, maxParticles: number) {
        this.device = device
        this.data = {
            uploadNeeded: true,
            positions: new Float32Array(maxParticles * Vector3Ref.alignedLength),
            velocities: new Float32Array(maxParticles * Vector3Ref.alignedLength),
            estimatedPositions: new Float32Array(maxParticles * Vector3Ref.alignedLength),
            inverseMasses: new Float32Array(maxParticles),
        }

        this.estimatedPositionBuffer = this.device.createBuffer({
            label: "estimated-position",
            size: fourBytesAlignment(this.data.estimatedPositions.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.velocityBuffer = this.device.createBuffer({
            label: "velocity",
            size: fourBytesAlignment(this.data.velocities.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        })
        this.inverseMassBuffer = this.device.createBuffer({
            label: "inverse-masses",
            size: fourBytesAlignment(this.data.inverseMasses.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })

        this.count = 0
        this.max = maxParticles
    }

    public get uploadNeeded(): boolean {
        return this.data.uploadNeeded
    }

    public upload(): void {
        this.device.queue.writeBuffer(
            this.estimatedPositionBuffer, 0,
            this.data.estimatedPositions, 0,
            this.count)

        this.device.queue.writeBuffer(
            this.velocityBuffer, 0,
            this.data.velocities, 0,
            this.count)

        this.device.queue.writeBuffer(
            this.inverseMassBuffer, 0,
            this.data.inverseMasses, 0,
            this.count)

        this.data.uploadNeeded = false
    }

    public add(particle: Particle): void {
        if (this.count >= this.max) {
            throw new Error("max number of particles reached")
        }

        const p = new ParticleRef(this.count, this.data, this.count)

        p.position = particle.position
        p.estimatedPosition = particle.estimatedPosition
        p.velocity = particle.velocity
        p.inverseMass = particle.inverseMass

        this.count++
    }

    public get(i: number): Particle {
        return new ParticleRef(i, this.data, i)
    }

    public forEach(cb: ParticleIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new ParticleRef(i, this.data, i))
        }
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
