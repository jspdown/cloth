import * as vec3 from "../math/vector3"

import {Particle, Particles} from "./particle"
import {Method} from "./solver_cpu";

const epsilon = 1e-6

export interface Config {
    method: Method
    stretchCompliance: number
    bendCompliance: number
}

export enum ConstraintType {
    Stretch,
    Bend,
}

// ConstraintRef presents a specific part of a buffer as a constraint.
export class ConstraintRef {
    private readonly buffer: Float32Array
    private readonly offset: number

    static readonly components = 4
    static readonly typeOffset = 0
    static readonly restValueOffset = 1
    static readonly p1Offset = 2
    static readonly p2Offset = 3

    constructor(buffer: Float32Array, offset: number) {
        this.buffer = buffer
        this.offset = offset
    }

    public project(particles: Particles, dt: number, config: Config) {
        const p1 = particles.get(this.p1)
        const p2 = particles.get(this.p2)

        const sumInvMasses = p1.inverseMass + p2.inverseMass
        if (sumInvMasses === 0) {
            return
        }

        const compliance = this.type === ConstraintType.Stretch
            ? config.stretchCompliance
            : config.bendCompliance

        const alphaTilde = compliance / (dt * dt)
        const p1p2 = vec3.sub(p1.estimatedPosition, p2.estimatedPosition)

        let distance = vec3.length(p1p2)
        if (distance < epsilon) {
            return
        }

        const grad = vec3.divideByScalar(p1p2, distance)

        const c = distance - this.restValue
        const lagrangeMultiplier = -c / (sumInvMasses + alphaTilde)

        const deltaP1 = vec3.multiplyByScalar(grad, lagrangeMultiplier * p1.inverseMass)
        const deltaP2 = vec3.multiplyByScalar(grad, -lagrangeMultiplier * p2.inverseMass)

        if (config.method === Method.Jacobi) {
            vec3.addMut(p1.deltaPosition, deltaP1)
            vec3.addMut(p2.deltaPosition, deltaP2)
        } else {
            vec3.addMut(p1.estimatedPosition, deltaP1)
            vec3.addMut(p2.estimatedPosition, deltaP2)
        }
    }

    public get p1(): number {
        return this.buffer[this.offset + ConstraintRef.p1Offset]
    }
    public set p1(p1: number) {
        this.buffer[this.offset + ConstraintRef.p1Offset] = p1
    }

    public get p2(): number {
        return this.buffer[this.offset + ConstraintRef.p2Offset]
    }
    public set p2(p2: number) {
        this.buffer[this.offset + ConstraintRef.p2Offset] = p2
    }

    public get restValue(): number {
        return this.buffer[this.offset + ConstraintRef.restValueOffset]
    }
    public set restValue(restValue: number) {
        this.buffer[this.offset + ConstraintRef.restValueOffset] = restValue
    }

    public get type(): number {
        return this.buffer[this.offset + ConstraintRef.typeOffset]
    }
    public set type(type: number) {
        this.buffer[this.offset + ConstraintRef.typeOffset] = type
    }
}

// StretchConstraints wraps a buffer of stretch constraints.
export class Constraints {
    private readonly buffer: Float32Array
    public count: number

    constructor(maxConstraints: number) {
        this.buffer = new Float32Array(maxConstraints * ConstraintRef.components)
        this.count = 0
    }

    // add adds a new stretch constraint.
    public addStretch(p1: Particle, p2: Particle) {
        if (this.count+1 >= this.buffer.length/2) {
            throw new Error("max number of constraints reached")
        }

        const offset = this.count * ConstraintRef.components
        const c = new ConstraintRef(this.buffer, offset)

        c.type = ConstraintType.Stretch
        c.restValue = vec3.distance(p1.position, p2.position)
        c.p1 = p1.id
        c.p2 = p2.id

        p1.constraintCount++
        p2.constraintCount++

        this.count++
    }

    public addBend(p1: Particle, p2: Particle) {
        if (this.count+1 >= this.buffer.length/2) {
            throw new Error("max number of constraints reached")
        }

        const offset = this.count * ConstraintRef.components
        const c = new ConstraintRef(this.buffer, offset)

        c.type = ConstraintType.Bend
        c.restValue = vec3.distance(p1.position, p2.position)
        c.p1 = p1.id
        c.p2 = p2.id

        p1.constraintCount++
        p2.constraintCount++

        this.count++
    }

    // project projects all the constraints on the given particles.
    public project(particles: Particles, dt: number, config: Config) {
        for (let i = 0; i < this.count; i++) {
            const offset = i * ConstraintRef.components
            const constraint = new ConstraintRef(this.buffer, offset)

            constraint.project(particles, dt, config)
        }
    }
}
