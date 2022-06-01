import {Particle, ParticleRef} from "./particle"
import {Cloth} from "./cloth";
import * as vec from "./vector";
import {Vector3} from "./vector";

// SolverConfig holds the configuration of the solver.
interface SolverConfig {
    subSteps?: number
    gravity?: Vector3
    maxVelocity?: number,
}

// Solver is a XPBD physic solver.
export class Solver {
    private readonly config: SolverConfig

    constructor(config?: SolverConfig) {
        this.config = {
            ...{
                subSteps: 10,
                gravity: { x: 0, y: -9.8, z: 0},
                maxVelocity: 10,
            },
            ...config
        }

        console.log("subSteps: ", this.config.subSteps)
    }

    public solve(deltaTime: number, cloth: Cloth): void {
        const dt = deltaTime / this.config.subSteps
        const idt = 1.0 / dt

        for (let subStep = 0; subStep < this.config.subSteps; subStep++) {
            cloth.particles.forEach((particle: ParticleRef): void => {
                vec.addMut(particle.velocity, vec.multiplyByScalar(this.config.gravity, dt * particle.inverseMass))

                particle.estimatedPosition = vec.add(particle.position, vec.multiplyByScalar(particle.velocity, dt))
            })

            for (let constraint of cloth.constraints) {
                constraint.project(dt, cloth.particles)
            }

            cloth.particles.forEach((particle: Particle): void => {
                particle.velocity = vec.multiplyByScalar(vec.sub(particle.estimatedPosition, particle.position), idt)

                vec.capMagnitudeMut(particle.velocity, this.config.maxVelocity)

                particle.position = particle.estimatedPosition
            })
        }

        cloth.updatePositionsAndNormals()
    }
}

