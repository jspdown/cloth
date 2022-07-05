import { v4 as uuid } from "uuid"

import * as vec3 from "./math/vector3"

import {VertexRef} from "./vertices"
import {Particles, ParticleRef} from "./physic/particles"
import {Pair, TriangleRef} from "./triangles"
import {Constraints} from "./physic/constraints"
import {Geometry} from "./geometry"

export interface ClothConfig {
    unit: number
    density: number
    stretchCompliance: number
    bendCompliance: number

    enableBendConstraints: boolean
}

// Cloth holds a cloth mesh.
export class Cloth {
    public id: string
    public geometry: Geometry
    public particles: Particles
    public constraints: Constraints
    public wireframe: boolean

    private readonly config: ClothConfig
    private readonly device: GPUDevice

    constructor(device: GPUDevice, geometry: Geometry, config: ClothConfig) {
        this.id = uuid()
        this.config = config
        this.device = device

        this.geometry = geometry
        this.wireframe = false

        this.initParticles()
        this.initConstraints()
    }

    public get uploadNeeded(): boolean {
        return this.geometry.vertices.uploadNeeded
            || this.geometry.triangles.uploadNeeded
            || this.particles.uploadNeeded
            || this.constraints.uploadNeeded
    }
    public async upload(): Promise<void> {
        if (this.geometry.vertices.uploadNeeded) this.geometry.vertices.upload()
        if (this.geometry.triangles.uploadNeeded) this.geometry.triangles.upload()
        if (this.particles.uploadNeeded) this.particles.upload()
        if (this.constraints.uploadNeeded) {
            await this.constraints.upload()
        }
    }

    private initParticles() {
        this.particles = new Particles(this.device, this.geometry.vertices.count)

        this.geometry.vertices.forEach((vertex: VertexRef) => this.particles.add({
            position: vertex.position,
            velocity: vec3.zero(),
            estimatedPosition: vec3.zero(),
            inverseMass: 0.0,
        }))

        // Compute particles mass.
        this.geometry.triangles.forEach((triangle: TriangleRef) => {
            const pa = this.particles.get(triangle.a)
            const pb = this.particles.get(triangle.b)
            const pc = this.particles.get(triangle.c)

            const papb = vec3.sub(pb.position, pa.position)
            const papc = vec3.sub(pc.position, pa.position)

            const area = 0.5 * vec3.length(vec3.crossMut(papb, papc))
            const edgeInverseMass = 1 / (this.config.unit * area * this.config.density) / 3

            pa.inverseMass += edgeInverseMass
            pb.inverseMass += edgeInverseMass
            pc.inverseMass += edgeInverseMass
        })

        this.particles.forEach((particle: ParticleRef): void => {
            if (particle.position.z === 0) {
                particle.inverseMass = 0.0
            }
        })
    }

    private initConstraints() {
        const topology = this.geometry.triangles.extractTopology()

        const constraintsCount = topology.edges.length + topology.adjacentTriangles.length
        this.constraints = new Constraints(this.device, constraintsCount)

        topology.edges.forEach(([start, end]: Pair<number>) => {
            this.constraints.add(
                this.particles.get(start),
                this.particles.get(end),
                this.config.stretchCompliance)
        })

        if (!this.config.enableBendConstraints) {
            return
        }

        topology.adjacentTriangles.forEach(([a, b]: Pair<number>) => {
            const ta = this.geometry.triangles.get(a).toArray()
            const tb = this.geometry.triangles.get(b).toArray()

            const [start] = ta.filter(vertex => !tb.includes(vertex))
            const [end] = tb.filter(vertex => !ta.includes(vertex))

            this.constraints.add(
                this.particles.get(start),
                this.particles.get(end),
                this.config.bendCompliance,
            )
        })
    }
}
