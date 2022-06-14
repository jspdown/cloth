import * as vec3 from "../math/vector3"
import {Vector3} from "../math/vector3"

import {Particle, ParticleRef} from "./particle"
import {Cloth} from "./cloth"
import {logger, render} from "../logger"

export enum Method {
    Jacobi = "jacobi",
    GaussSeidel = "gauss-seidel",
}

// Config holds the configuration of the solver.
export interface Config {
    deltaTime?: number
    subSteps?: number
    gravity?: Vector3
    stretchCompliance?: number
    bendCompliance?: number
    relaxation?: number
    method?: Method
}

export interface Indexable {
    [key: string]: any;
}

// Solver is a XPBD physic solver.
export class Solver {
    public paused: boolean

    private _config: Config

    static defaultConfig: Config = {
        deltaTime: 1/60,
        subSteps: 10,
        gravity: vec3.create(0, -9.8, 0),
        stretchCompliance: 0,
        bendCompliance: 0.3,
        relaxation: 0.2,
        method: Method.GaussSeidel,
    }

    constructor(config?: Config) {
        this.paused = true
        this._config = {}

        this.config = config
    }

    public solve(cloth: Cloth): void {
        if (this.paused) return

        const dt = this._config.deltaTime / this._config.subSteps
        const idt = 1.0 / dt
        const gravity = vec3.multiplyByScalar(this._config.gravity, dt)

        for (let subStep = 0; subStep < this._config.subSteps; subStep++) {
            cloth.particles.forEach((particle: ParticleRef): void => {
                if (particle.inverseMass > 0) {
                    vec3.addMut(particle.velocity, gravity)
                }

                particle.estimatedPosition = vec3.add(particle.position, vec3.multiplyByScalar(particle.velocity, dt))
            })

            cloth.constraints.project(cloth.particles, dt, {
                method: this.config.method,
                stretchCompliance: this.config.stretchCompliance,
                bendCompliance: this.config.bendCompliance,
                relaxation: this.config.relaxation
            })

            cloth.particles.forEach((particle: Particle): void => {
                 if (this._config.method === Method.Jacobi) {
                    vec3.addMut(particle.estimatedPosition, particle.deltaPosition)
                    particle.deltaPosition = vec3.zero()
                }

                particle.velocity = vec3.multiplyByScalar(vec3.sub(particle.estimatedPosition, particle.position), idt)
                particle.position = particle.estimatedPosition
            })
        }

        cloth.updatePositionsAndNormals()
    }

    public set config(config: Config) {
        const cfg: Config = {
            ...Solver.defaultConfig,
            ...config
        }

        Object.keys(cfg).forEach((prop: string) => {
            const oldValue = (this._config as Indexable)[prop]
            const newValue = (cfg as Indexable)[prop]

            if (newValue !== oldValue) {
                logger.info(`${prop}: **${render(newValue)}**`)
            }
        })

        this._config = cfg
    }

    public get config(): Config {
        return this._config
    }
}
