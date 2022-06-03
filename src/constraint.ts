import * as vec3 from "./math/vector3"

import {Particle, ParticleBuffer} from "./particle"

// Constraint is rule restricting a set of particles movement.
export interface Constraint {
    project(dt: number, particles: ParticleBuffer): void
}

const epsilon = 1e-6

export class StretchConstraint {
    private readonly p1: number
    private readonly p2: number
    private readonly compliance: number

    private readonly restDistance: number
    private readonly sumInvMasses: number

    constructor(p1: Particle, p2: Particle, compliance: number) {
        this.p1 = p1.id
        this.p2 = p2.id
        this.compliance = compliance

        this.restDistance = vec3.distance(p1.position, p2.position)
        this.sumInvMasses = p1.inverseMass + p2.inverseMass
    }

    project(dt: number, particles: ParticleBuffer): void {
        if (this.sumInvMasses === 0) {
            return
        }

        const p1 = particles.get(this.p1)
        const p2 = particles.get(this.p2)

        const alphaTilde = this.compliance / (dt * dt)

        const p1p2 = vec3.sub(p1.estimatedPosition, p2.estimatedPosition)
        let distance = vec3.length(p1p2)
        if (distance < epsilon) {
            return
        }

        const grad = vec3.divideByScalar(p1p2, distance)

        const c = distance - this.restDistance
        const lagrangeMultiplier = -c / (this.sumInvMasses + alphaTilde)

        vec3.addMut(p1.estimatedPosition, vec3.multiplyByScalar(grad, lagrangeMultiplier * p1.inverseMass))
        vec3.addMut(p2.estimatedPosition, vec3.multiplyByScalar(grad, -lagrangeMultiplier * p2.inverseMass))
    }
}
