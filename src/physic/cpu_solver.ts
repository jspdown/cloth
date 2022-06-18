import * as vec3 from "../math/vector3"
import {Vector3} from "../math/vector3"

import {Particle, ParticleRef, Particles} from "./particle"
import {Cloth} from "./cloth"
import {Solver} from "./solver"
import {ConstraintRef} from "./constraint"

const epsilon = 1e-6

export enum CPUSolverMethod {
    Jacobi = "jacobi",
    GaussSeidel = "gauss-seidel",
}

// Config holds the configuration of the solver.
export interface CPUSolverConfig {
    deltaTime?: number
    subSteps?: number
    gravity?: Vector3
    relaxation?: number
    method?: CPUSolverMethod
}

// CPUSolver is a XPBD physic solver.
export class CPUSolver implements Solver {
    public readonly config: CPUSolverConfig
    public readonly objects: Cloth[]

    constructor(config: CPUSolverConfig) {
        this.config = {
            deltaTime: 1/60,
            subSteps: 10,
            gravity: vec3.create(0, -9.8, 0),
            relaxation: 1,
            method: CPUSolverMethod.GaussSeidel,

            ...config
        }
        this.objects = []
    }

    public add(cloth: Cloth): void {
        this.objects.push(cloth)
    }

    public async solve(): Promise<void> {
        const dt = this.config.deltaTime / this.config.subSteps
        const idt = 1.0 / dt
        const gravity = vec3.multiplyByScalar(this.config.gravity, dt)

        for (let object of this.objects) {
            for (let subStep = 0; subStep < this.config.subSteps; subStep++) {
                object.particles.forEach((particle: ParticleRef): void => {
                    if (particle.inverseMass > 0) {
                        vec3.addMut(particle.velocity, gravity)
                    }

                    particle.estimatedPosition = vec3.add(particle.position, vec3.multiplyByScalar(particle.velocity, dt))
                })

                object.constraints.forEach((constraint: ConstraintRef) => {
                    projectConstraint(constraint, object.particles, this.config.method, dt)
                })

                object.particles.forEach((particle: Particle): void => {
                    if (this.config.method === CPUSolverMethod.Jacobi) {
                        if (!particle.constraintCount) return

                        vec3.multiplyByScalarMut(particle.deltaPosition, this.config.relaxation / particle.constraintCount)
                        vec3.addMut(particle.estimatedPosition, particle.deltaPosition)

                        particle.deltaPosition = vec3.zero()
                    }

                    particle.velocity = vec3.multiplyByScalar(vec3.sub(particle.estimatedPosition, particle.position), idt)
                    particle.position = particle.estimatedPosition
                })
            }

            object.updatePositionsAndNormals()
        }
    }
}

function projectConstraint(constraint: ConstraintRef, particles: Particles, method: CPUSolverMethod, deltaTime: number) {
    const p1 = particles.get(constraint.p1)
    const p2 = particles.get(constraint.p2)

    const sumInvMasses = p1.inverseMass + p2.inverseMass
    if (sumInvMasses === 0) {
        return
    }

    const alphaTilde = constraint.compliance / (deltaTime * deltaTime)
    const p1p2 = vec3.sub(p1.estimatedPosition, p2.estimatedPosition)

    let distance = vec3.length(p1p2)
    if (distance < epsilon) {
        return
    }

    const grad = vec3.divideByScalar(p1p2, distance)

    const c = distance - constraint.restValue
    const lagrangeMultiplier = -c / (sumInvMasses + alphaTilde)

    const deltaP1 = vec3.multiplyByScalar(grad, lagrangeMultiplier * p1.inverseMass)
    const deltaP2 = vec3.multiplyByScalar(grad, -lagrangeMultiplier * p2.inverseMass)

    if (method === CPUSolverMethod.Jacobi) {
        vec3.addMut(p1.deltaPosition, deltaP1)
        vec3.addMut(p2.deltaPosition, deltaP2)
    } else {
        vec3.addMut(p1.estimatedPosition, deltaP1)
        vec3.addMut(p2.estimatedPosition, deltaP2)
    }
}
