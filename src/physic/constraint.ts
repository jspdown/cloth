import * as vec3 from "../math/vector3"

import {Particle, Particles} from "./particle"

const epsilon = 1e-6

// StretchConstraint presents a specific part of a buffer as a stretch constraint.
export class StretchConstraintRef {
    private readonly buffer: Float32Array
    private readonly offset: number

    static readonly components = 4
    static readonly p1Offset = 0
    static readonly p2Offset = 1
    static readonly restDistanceOffset = 2
    static readonly complianceOffset = 3

    constructor(buffer: Float32Array, offset: number) {
        this.buffer = buffer
        this.offset = offset
    }

    public project(particles: Particles, dt: number) {
        const p1 = particles.get(this.p1)
        const p2 = particles.get(this.p2)

        const sumInvMasses = p1.inverseMass + p2.inverseMass
        if (sumInvMasses === 0) {
            return
        }

        const alphaTilde = this.compliance / (dt * dt)

        const p1p2 = vec3.sub(p1.estimatedPosition, p2.estimatedPosition)
        let distance = vec3.length(p1p2)
        if (distance < epsilon) {
            return
        }

        const grad = vec3.divideByScalar(p1p2, distance)

        const c = distance - this.restDistance
        const lagrangeMultiplier = -c / (sumInvMasses + alphaTilde)

        vec3.addMut(p1.estimatedPosition, vec3.multiplyByScalar(grad, lagrangeMultiplier * p1.inverseMass))
        vec3.addMut(p2.estimatedPosition, vec3.multiplyByScalar(grad, -lagrangeMultiplier * p2.inverseMass))
    }

    public get p1(): number {
        return this.buffer[this.offset + StretchConstraintRef.p1Offset]
    }
    public set p1(p1: number) {
        this.buffer[this.offset + StretchConstraintRef.p1Offset] = p1
    }

    public get p2(): number {
        return this.buffer[this.offset + StretchConstraintRef.p2Offset]
    }
    public set p2(p2: number) {
        this.buffer[this.offset + StretchConstraintRef.p2Offset] = p2
    }

    public get restDistance(): number {
        return this.buffer[this.offset + StretchConstraintRef.restDistanceOffset]
    }
    public set restDistance(restDistance: number) {
        this.buffer[this.offset + StretchConstraintRef.restDistanceOffset] = restDistance
    }

    public get compliance(): number {
        return this.buffer[this.offset + StretchConstraintRef.complianceOffset]
    }
    public set compliance(compliance: number) {
        this.buffer[this.offset + StretchConstraintRef.complianceOffset] = compliance
    }
}

// StretchConstraints wraps a buffer of stretch constraints.
export class StretchConstraints {
    private readonly buffer: Float32Array
    public count: number

    constructor(maxConstraints: number) {
        this.buffer = new Float32Array(maxConstraints * StretchConstraintRef.components)
        this.count = 0
    }

    // add adds a new stretch constraint.
    public add(p1: Particle, p2: Particle, compliance: number) {
        if (this.count+1 >= this.buffer.length/2) {
            throw new Error("max number of constraints reached")
        }

        const offset = this.count * StretchConstraintRef.components
        const c = new StretchConstraintRef(this.buffer, offset)

        c.p1 = p1.id
        c.p2 = p2.id
        c.restDistance = vec3.distance(p1.position, p2.position)
        c.compliance = compliance

        this.count++
    }

    // project projects all the constraints on the given particles.
    public project(particles: Particles, dt: number) {
        for (let i = 0; i < this.count; i++) {
            const offset = i * StretchConstraintRef.components
            const constraint = new StretchConstraintRef(this.buffer, offset)

            constraint.project(particles, dt)
        }
    }
}
