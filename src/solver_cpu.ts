import * as vec3 from "./math/vector3"
import {Vector3} from "./math/vector3"

import {Particle, ParticleRef} from "./particle"
import {Cloth} from "./cloth"
import logger from "./logger"

// SolverConfig holds the configuration of the solver.
interface SolverConfig {
    subSteps?: number
    gravity?: Vector3
}

// Solver is a XPBD physic solver.
export class Solver {
    public paused: boolean

    private readonly config: SolverConfig

    constructor(config?: SolverConfig) {
        this.paused = true
        this.config = {
            ...{
                subSteps: 10,
                gravity: vec3.create(0, -9.8, 0),
            },
            ...config
        }

        logger.info(`subSteps: **${this.config.subSteps}**`)
    }

    public solve(deltaTime: number, cloth: Cloth): void {
        if (this.paused) return

        const dt = deltaTime / this.config.subSteps
        const idt = 1.0 / dt
        const gravity = vec3.multiplyByScalar(this.config.gravity, dt)

        shuffle(cloth.constraints)

        for (let subStep = 0; subStep < this.config.subSteps; subStep++) {
            cloth.particles.forEach((particle: ParticleRef): void => {
                if (particle.inverseMass > 0) {
                    vec3.addMut(particle.velocity, gravity)
                }

                particle.estimatedPosition = vec3.add(particle.position, vec3.multiplyByScalar(particle.velocity, dt))
            })

            for (let constraint of cloth.constraints) {
                constraint.project(dt, cloth.particles)
            }

            cloth.particles.forEach((particle: Particle): void => {
                particle.velocity = vec3.multiplyByScalar(vec3.sub(particle.estimatedPosition, particle.position), idt)
                particle.position = particle.estimatedPosition
            })
        }

        cloth.updatePositionsAndNormals()
    }
}


function shuffle<T>(arr: Array<T>): void {
    for (let i = arr.length - 1; i >= 1; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       const tmp = arr[j];

       arr[j] = arr[i];
       arr[i] = tmp;
    }
}
