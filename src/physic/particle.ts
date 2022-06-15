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

export class ParticleRef {
    public readonly id: number

    private readonly buffer: Float32Array
    private readonly offset: number

    static readonly positionOffset = 0
    static readonly estimatedPositionOffset = 3
    static readonly deltaPositionOffset = 6
    static readonly velocityOffset = 9
    static readonly inverseMassOffset = 12
    static readonly constraintCountOffset = 13
    static readonly components = 14

    constructor(id: number, buffer: Float32Array, offset: number) {
        this.id = id
        this.buffer = buffer
        this.offset = offset
    }

    get position(): Vector3 {
        const offset = this.offset + ParticleRef.positionOffset

        return new Vector3Ref(this.buffer, offset)
    }
    set position(position: Vector3) {
        const offset = this.offset + ParticleRef.positionOffset

        this.buffer[offset] = position.x
        this.buffer[offset+1] = position.y
        this.buffer[offset+2] = position.z
    }

    get estimatedPosition(): Vector3 {
        const offset = this.offset + ParticleRef.estimatedPositionOffset

        return new Vector3Ref(this.buffer, offset)
    }
    set estimatedPosition(estimatedPosition: Vector3) {
        const offset = this.offset + ParticleRef.estimatedPositionOffset

        this.buffer[offset] = estimatedPosition.x
        this.buffer[offset+1] = estimatedPosition.y
        this.buffer[offset+2] = estimatedPosition.z
    }

    get deltaPosition(): Vector3 {
        const offset = this.offset + ParticleRef.deltaPositionOffset

        return new Vector3Ref(this.buffer, offset)
    }
    set deltaPosition(deltaPosition: Vector3) {
        const offset = this.offset + ParticleRef.deltaPositionOffset

        this.buffer[offset] = deltaPosition.x
        this.buffer[offset+1] = deltaPosition.y
        this.buffer[offset+2] = deltaPosition.z
    }

    get velocity(): Vector3 {
        const offset = this.offset + ParticleRef.velocityOffset

        return new Vector3Ref(this.buffer, offset)
    }
    set velocity(velocity: Vector3) {
        const offset = this.offset + ParticleRef.velocityOffset

        this.buffer[offset] = velocity.x
        this.buffer[offset+1] = velocity.y
        this.buffer[offset+2] = velocity.z
    }

    get inverseMass(): number {
        return this.buffer[this.offset + ParticleRef.inverseMassOffset]
    }
    set inverseMass(inverseMass: number) {
        this.buffer[this.offset + ParticleRef.inverseMassOffset] = inverseMass
    }

    get constraintCount(): number {
        return this.buffer[this.offset + ParticleRef.constraintCountOffset]
    }
    set constraintCount(constraintCount: number) {
        this.buffer[this.offset + ParticleRef.constraintCountOffset] = constraintCount
    }
}

export class Particles {
    public count: number
    public readonly buffer: Float32Array

    constructor(maxParticles: number) {
        this.buffer = new Float32Array(maxParticles * ParticleRef.components)
        this.count = 0
    }

    add(particle: Particle) {
        const id = this.count
        const offset = this.count * ParticleRef.components

        const p = new ParticleRef(id, this.buffer, offset)

        p.position = particle.position
        p.estimatedPosition = particle.estimatedPosition
        p.deltaPosition = particle.deltaPosition
        p.velocity = particle.velocity
        p.inverseMass = particle.inverseMass

        this.count++
    }

    get(i: number): Particle {
        return new ParticleRef(i, this.buffer, i * ParticleRef.components)
    }

    forEach(cb: ParticleIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new ParticleRef(i, this.buffer, i * ParticleRef.components))
        }
    }
}

