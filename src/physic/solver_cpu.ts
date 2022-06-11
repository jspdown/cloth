import * as vec3 from "../math/vector3"
import {Vector3} from "../math/vector3"

import {Particle, ParticleRef} from "./particle"
import {Cloth} from "./cloth"
import logger from "../logger"

// SolverConfig holds the configuration of the solver.
interface SolverConfig {
    deltaTime?: number
    subSteps?: number
    gravity?: Vector3
    jacobi?: boolean
}

// Solver is a XPBD physic solver.
export class Solver {
    public paused: boolean

    private readonly config: SolverConfig

    constructor(config?: SolverConfig) {
        this.paused = true
        this.config = {
            ...{
                deltaTime: 1/60,
                subSteps: 10,
                gravity: vec3.create(0, -9.8, 0),
                jacobi: false,
            },
            ...config
        }

        logger.info(`subSteps: **${this.config.subSteps}**`)
    }

    public solve(cloth: Cloth): void {
        if (this.paused) return

        const dt = this.config.deltaTime / this.config.subSteps
        const idt = 1.0 / dt
        const gravity = vec3.multiplyByScalar(this.config.gravity, dt)

        for (let subStep = 0; subStep < this.config.subSteps; subStep++) {
            cloth.particles.forEach((particle: ParticleRef): void => {
                if (particle.inverseMass > 0) {
                    vec3.addMut(particle.velocity, gravity)
                }

                particle.estimatedPosition = vec3.add(particle.position, vec3.multiplyByScalar(particle.velocity, dt))
            })

            cloth.stretchConstraints.project(cloth.particles, dt, this.config.jacobi)

            cloth.particles.forEach((particle: Particle): void => {
                 if (this.config.jacobi) {
                    vec3.addMut(particle.estimatedPosition, particle.deltaPosition)
                    particle.deltaPosition = vec3.zero()
                }

                particle.velocity = vec3.multiplyByScalar(vec3.sub(particle.estimatedPosition, particle.position), idt)
                particle.position = particle.estimatedPosition
            })
        }

        cloth.updatePositionsAndNormals()
    }
}
