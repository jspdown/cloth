import { v4 as uuid } from "uuid"

import * as vec3 from "../math/vector3"

import {Vertex, Vertices} from "../vertex"
import {Particle, Particles} from "./particle"
import {Constraints} from "./constraint"
import {logger, render} from "../logger"
import {TriangleRef, Triangles} from "../triangles";
import {Geometry} from "../geometry";

interface Indexable {
    [key: string]: any;
}

export interface ClothConfig {
    unit?: number
    density?: number
    stretchCompliance?: number
    bendCompliance?: number
}

// Cloth holds a cloth mesh.
export class Cloth {
    public id: string
    public triangles: Triangles
    public vertices: Vertices
    public particles: Particles
    public constraints: Constraints

    private _config: ClothConfig
    private readonly device: GPUDevice

    static defaultConfig: ClothConfig = {
        unit: 0.01,
        density: 0.270,
        stretchCompliance: 0,
        bendCompliance: 0.3,
    }

    constructor(device: GPUDevice, geometry: Geometry, config: ClothConfig) {
        this.id = uuid()
        this._config = {
            ...Cloth.defaultConfig,
            ...config
        }

        this.device = device
        this.geometry = geometry
    }

    public get uploadNeeded(): boolean {
        return this.vertices.uploadNeeded
            || this.triangles.uploadNeeded
            || this.particles.uploadNeeded
            || this.constraints.uploadNeeded
    }
    public upload(): void {
        if (this.vertices.uploadNeeded) this.vertices.upload()
        if (this.triangles.uploadNeeded) this.triangles.upload()
        if (this.particles.uploadNeeded) this.particles.upload()
        if (this.constraints.uploadNeeded) this.constraints.upload()
    }

    public set geometry(geometry: Geometry) {
        this.triangles = geometry.triangles
        this.vertices = geometry.vertices
        this.particles = buildParticles(this.device, this.vertices, this.triangles, this._config.unit, this._config.density)
        this.constraints = buildConstraints(this.device, this.vertices, this.triangles, this.particles, this._config.stretchCompliance, this._config.bendCompliance)

        logger.info(`vertices: **${this.vertices.count}**`)
        logger.info(`triangles: **${this.triangles.count}**`)
        logger.info(`constraints: **${this.constraints.count}**`)
    }

    public set config(config: ClothConfig) {
        const cfg: ClothConfig = {
            ...Cloth.defaultConfig,
            ...config
        }

        const particlesNeedsUpdate = cfg.unit !== this._config.unit
            || cfg.density !== this._config.density
        const constraintsNeedsUpdate = cfg.stretchCompliance !== this._config.stretchCompliance
            || cfg.bendCompliance !== this._config.bendCompliance
            || cfg.density

        if (!constraintsNeedsUpdate && !particlesNeedsUpdate) return

        Object.keys(cfg).forEach((prop: string) => {
            const oldValue = (this._config as Indexable)[prop]
            const newValue = (cfg as Indexable)[prop]

            if (newValue !== oldValue) {
                logger.info(`${prop}: **${render(newValue)}**`)
            }
        })

        if (particlesNeedsUpdate) {
            this.particles = buildParticles(this.device, this.vertices, this.triangles, cfg.unit, cfg.density)
        }
        if (constraintsNeedsUpdate) {
            this.constraints = buildConstraints(this.device, this.vertices, this.triangles, this.particles, cfg.stretchCompliance, cfg.bendCompliance)
        }

        this._config = cfg
    }
    public get config(): ClothConfig {
        return this._config
    }
}

function buildParticles(device: GPUDevice, vertices: Vertices, triangles: Triangles, unit: number, density: number): Particles {
    const particles = new Particles(device, vertices.count)

    vertices.forEach((vertex: Vertex) => particles.add({
            position: vertex.position,
            velocity: vec3.zero(),
            estimatedPosition: vec3.zero(),
            inverseMass: 0.0,
    }))

    // Compute particles mass.
    triangles.forEach((triangle: TriangleRef) => {
        const pa = particles.get(triangle.a)
        const pb = particles.get(triangle.b)
        const pc = particles.get(triangle.c)

        const papb = vec3.sub(pb.position, pa.position)
        const papc = vec3.sub(pc.position, pa.position)

        const area = 0.5 * vec3.length(vec3.crossMut(papb, papc))
        const edgeInverseMass = 1 / (unit * area * density) / 3

        pa.inverseMass += edgeInverseMass
        pb.inverseMass += edgeInverseMass
        pc.inverseMass += edgeInverseMass
    })

    particles.forEach((particle: Particle): void => {
        if (particle.position.z === 0) {
            particle.inverseMass = 0.0
        }
    })

    return particles
}

interface constraint {
    compliance: number
    p1: number
    p2: number
}

function buildConstraints(device: GPUDevice, vertices: Vertices, triangles: Triangles, particles: Particles, stretchCompliance: number, bendCompliance: number): Constraints {
    const edges = buildEdges(vertices, triangles)
    const constraintParticles: constraint[] = []

    // Generate stretching constraints.
    for (let edge of edges) {
        constraintParticles.push({
            compliance: stretchCompliance,
            p1: edge.start,
            p2: edge.end,
        })
    }

    // Generate bending constraints.
    for (let edge of edges) {
        if (edge.triangles.length == 1) {
            continue
        }
        if (edge.triangles.length != 2) {
            throw new Error(`Non-manifold mesh: ${edge.start}-${edge.end} shared with ${edge.triangles.length} triangles`)
        }

        const t1 = triangles.get(edge.triangles[0])
        const t2 = triangles.get(edge.triangles[1])

        let p1: number
        if (t1.a != edge.start && t1.a != edge.end) {
            p1 = t1.a
        } else if (t1.b != edge.start && t1.b != edge.end) {
            p1 = t1.b
        } else {
            p1 = t1.c
        }

        let p2: number
        if (t2.a != edge.start && t2.a != edge.end) {
            p2 = t2.a
        } else if (t2.b != edge.start && t2.b != edge.end) {
            p2 = t2.b
        } else {
            p2 = t2.c
        }

        constraintParticles.push({
            compliance: bendCompliance,
            p1, p2,
        })
    }

    // Shuffle constraints to prevent resonances.
    shuffle(constraintParticles)

    const constraints = new Constraints(device, constraintParticles.length)
    for (let c of constraintParticles) {
        constraints.add(particles.get(c.p1), particles.get(c.p2), c.compliance)
    }

    return constraints
}

interface Edge {
    start: number
    end: number
    triangles: number[]
}

function buildEdges(vertices: Vertices, triangles: Triangles): Edge[] {
    const vertexTriangles = new Array(vertices.count)
    const existingEdges: Record<string, number> = {}

    const edges: Edge[] = []

    const addTriangleToVertex = (id: number, i: number) => {
        if (!vertexTriangles[id]) {
            vertexTriangles[id] = []
        }

        vertexTriangles[id].push(i)
    }

    triangles.forEach((triangle: TriangleRef): void => {
        addTriangleToVertex(triangle.a, triangle.id)
        addTriangleToVertex(triangle.b, triangle.id)
        addTriangleToVertex(triangle.c, triangle.id)

        const triangleEdges = [
            { start: Math.min(triangle.a, triangle.b), end: Math.max(triangle.a, triangle.b) },
            { start: Math.min(triangle.b, triangle.c), end: Math.max(triangle.b, triangle.c) },
            { start: Math.min(triangle.c, triangle.a), end: Math.max(triangle.c, triangle.a) },
        ]

        for (let edge of triangleEdges) {
            const key = `${edge.start}-${edge.end}`

            if (!existingEdges[key]) {
                edges.push({
                    start: edge.start,
                    end: edge.end,
                    triangles: [triangle.id],
                })
                existingEdges[key] = edges.length - 1
                continue
            }

            edges[existingEdges[key]].triangles.push(triangle.id)
        }
    })

    return edges
}

function shuffle<T>(arr: Array<T>): void {
    for (let i = arr.length - 1; i >= 1; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       const tmp = arr[j];

       arr[j] = arr[i];
       arr[i] = tmp;
    }
}
