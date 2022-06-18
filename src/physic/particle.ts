import {Vector3} from "../math/vector3"

interface ParticleIterator { (particle: ParticleRef): void }

export interface Particle {
    id?: number
    position: Vector3
    estimatedPosition: Vector3
    deltaPosition: Vector3
    velocity: Vector3
    inverseMass: number
    constraintCount: number
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

    private readonly particles: Particles
    private readonly offset: number

    constructor(id: number, particles: Particles, offset: number) {
        this.id = id
        this.particles = particles
        this.offset = offset
    }

    get position(): Vector3 {
        return new Vector3Ref(this.particles.positions, this.offset*Vector3Ref.alignedLength)
    }
    set position(position: Vector3) {
        this.particles.positions[this.offset*Vector3Ref.alignedLength] = position.x
        this.particles.positions[this.offset*Vector3Ref.alignedLength+1] = position.y
        this.particles.positions[this.offset*Vector3Ref.alignedLength+2] = position.z
    }

    get estimatedPosition(): Vector3 {
        return new Vector3Ref(this.particles.estimatedPositions, this.offset*Vector3Ref.alignedLength)
    }
    set estimatedPosition(estimatedPosition: Vector3) {
        this.particles.estimatedPositions[this.offset*Vector3Ref.alignedLength] = estimatedPosition.x
        this.particles.estimatedPositions[this.offset*Vector3Ref.alignedLength+1] = estimatedPosition.y
        this.particles.estimatedPositions[this.offset*Vector3Ref.alignedLength+2] = estimatedPosition.z
    }

    get deltaPosition(): Vector3 {
        return new Vector3Ref(this.particles.deltaPositions, this.offset*Vector3Ref.alignedLength)
    }
    set deltaPosition(deltaPosition: Vector3) {
        this.particles.deltaPositions[this.offset*Vector3Ref.alignedLength] = deltaPosition.x
        this.particles.deltaPositions[this.offset*Vector3Ref.alignedLength+1] = deltaPosition.y
        this.particles.deltaPositions[this.offset*Vector3Ref.alignedLength+2] = deltaPosition.z
    }

    get velocity(): Vector3 {
        return new Vector3Ref(this.particles.velocities, this.offset*Vector3Ref.alignedLength)
    }
    set velocity(velocity: Vector3) {
        this.particles.velocities[this.offset*Vector3Ref.alignedLength] = velocity.x
        this.particles.velocities[this.offset*Vector3Ref.alignedLength+1] = velocity.y
        this.particles.velocities[this.offset*Vector3Ref.alignedLength+2] = velocity.z
    }

    get inverseMass(): number {
        return this.particles.inverseMasses[this.offset]
    }
    set inverseMass(inverseMass: number) {
        this.particles.inverseMasses[this.offset] = inverseMass
    }

    get constraintCount(): number {
        return this.particles.constraintCounts[this.offset]
    }
    set constraintCount(constraintCount: number) {
        this.particles.constraintCounts[this.offset] = constraintCount
    }
}

export class Particles {
    public count: number

    public readonly positions: Float32Array
    public readonly velocities: Float32Array
    public readonly estimatedPositions: Float32Array
    public readonly deltaPositions: Float32Array
    public readonly inverseMasses: Float32Array
    public readonly constraintCounts: Float32Array

    private readonly max: number

    constructor(maxParticles: number) {
        this.positions = new Float32Array(maxParticles * Vector3Ref.alignedLength)
        this.velocities = new Float32Array(maxParticles * Vector3Ref.alignedLength)
        this.estimatedPositions = new Float32Array(maxParticles * Vector3Ref.alignedLength)
        this.deltaPositions = new Float32Array(maxParticles * Vector3Ref.alignedLength)
        this.inverseMasses = new Float32Array(maxParticles)
        this.constraintCounts = new Float32Array(maxParticles)

        this.count = 0
        this.max = maxParticles
    }

    add(particle: Particle) {
        if (this.count+1 > this.max) {
            return new Error("max number of particles reached")
        }

        const p = new ParticleRef(this.count, this, this.count)

        p.position = particle.position
        p.estimatedPosition = particle.estimatedPosition
        p.deltaPosition = particle.deltaPosition
        p.velocity = particle.velocity
        p.inverseMass = particle.inverseMass

        this.count++
    }

    get(i: number): Particle {
        return new ParticleRef(i, this, i)
    }

    forEach(cb: ParticleIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new ParticleRef(i, this, i))
        }
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
