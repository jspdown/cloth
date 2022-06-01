import {Particle, ParticleBuffer} from "./particle"
import * as vec from "./vector";
import {Vector3} from "./vector";

// Constraint is rule restricting a set of particles movement.
export interface Constraint {
    project(dt: number, particles: ParticleBuffer): void
}

const satisfiedEpsilon = 0.0001
const distanceEpsilon = 0.000001

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

        this.restDistance = vec.distance(p1.position, p2.position)
        this.sumInvMasses = p1.inverseMass + p2.inverseMass
    }

    project(dt: number, particles: ParticleBuffer): void {
        const p1 = particles.get(this.p1)
        const p2 = particles.get(this.p2)

        const alphaTilde = this.compliance / (dt * dt)

        const p1p2 = vec.sub(p1.estimatedPosition, p2.estimatedPosition)

        let distance = vec.length(p1p2)
        if (Math.abs(distance) <= distanceEpsilon) {
            distance = distanceEpsilon
        }

        const n = vec.divideByScalar(p1p2, distance)
        const grad1 = n
        const grad2 = vec.negate(n)

        const c = distance - this.restDistance
        if (Math.abs(c) < satisfiedEpsilon) {
            return
        }

        const lagrangeMultiplier = -c / (this.sumInvMasses + alphaTilde)

        vec.addMut(p1.estimatedPosition, vec.multiplyByScalarMut(grad1, p1.inverseMass * lagrangeMultiplier))
        vec.addMut(p2.estimatedPosition, vec.multiplyByScalarMut(grad2, p2.inverseMass * lagrangeMultiplier))
    }
}

export class FixedConstraint {
    private readonly p: number
    private readonly position: Vector3

    constructor(p: Particle) {
        this.p = p.id
        this.position = vec.clone(p.position)
    }

    project(dt: number, particles: ParticleBuffer): void {
        const p = particles.get(this.p)

        p.estimatedPosition = vec.clone(this.position)
    }
}
