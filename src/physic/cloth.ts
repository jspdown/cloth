import vertShaderCode from "../shaders/triangle.vert.wgsl"
import fragShaderCode from "../shaders/triangle.frag.wgsl"

import * as vec3 from "../math/vector3"
import {Vector3} from "../math/vector3"
import * as mat4 from "../math/matrix4"

import {Geometry} from "../geometry"
import {Camera} from "../camera"
import {Vertex} from "../vertex"
import {Particle, Particles} from "./particle"
import {ConstraintType, Constraints} from "./constraint"
import {logger} from "../logger"

const unit = 0.01
const density = 0.270

// Cloth holds a cloth mesh.
export class Cloth {
    public particles: Particles
    public constraints: Constraints
    public uniformBindGroup: GPUBindGroup

    private _geometry: Geometry
    private _position: Vector3
    private _rotation: Vector3
    private updated: boolean

    private device: GPUDevice
    private renderPipeline: GPURenderPipeline | null
    private uniformBuffer: GPUBuffer

    private maxParticleMass: number

    constructor(device: GPUDevice, geometry: Geometry, position?: Vector3, rotation?: Vector3) {
        this.device = device
        this.geometry = geometry

        this.updated = false
        this._position = vec3.zero()
        this._rotation = vec3.zero()

        if (position) this.position = position
        if (rotation) this.rotation = rotation

        this.renderPipeline = null
    }

    public set geometry(geometry: Geometry) {
        this._geometry = geometry
        this.particles = buildParticles(this._geometry)
        this.constraints = buildConstraints(this._geometry, this.particles)

        // Compute max particle mass.
        this.maxParticleMass = 0.0
        this.particles.forEach((particle: Particle): void => {
            const mass = 1 / particle.inverseMass

            if (mass === Infinity) return

            if (mass > this.maxParticleMass) {
                this.maxParticleMass = mass
            }
        })

        logger.info(`vertices: **${this._geometry.vertices.count}**`)
        logger.info(`triangles: **${this._geometry.topology.triangles.length}**`)
        logger.info(`edges: **${this._geometry.topology.edges.length}**`)
        logger.info(`constraints: **${this.constraints.count}**`)
        logger.info(`max particle mass: **${this.maxParticleMass}** kg`)
    }
    public get geometry(): Geometry {
        return this._geometry
    }


    public set position(position: Vector3) {
        this._position = position
        this.updated = true
    }
    public get position(): Vector3 { return this._position }

    public set rotation(rotation: Vector3) {
        this._rotation = rotation
        this.updated = true
    }
    public get rotation(): Vector3 { return this._rotation }

    public set wireframe(wireframe: boolean) {
        this._geometry.wireframe = wireframe
        this.renderPipeline = null
    }
    public get wireframe(): boolean {
        return this._geometry.wireframe
    }

    // updatePositionsAndNormals updates the vertex positions and normals based
    // on particles positions.
    public updatePositionsAndNormals(): void {
        this._geometry.vertices.forEach((vertex: Vertex): void => {
            const particle = this.particles.get(vertex.id)

            vertex.position = particle.position
            vertex.normal = vec3.zero()
        })

        for (let triangle of this._geometry.topology.triangles) {
            const pa = this._geometry.vertices.get(triangle.a)
            const pb = this._geometry.vertices.get(triangle.b)
            const pc = this._geometry.vertices.get(triangle.c)

            const papb = vec3.sub(pb.position, pa.position)
            const papc = vec3.sub(pc.position, pa.position)

            const faceNormal = vec3.cross(papb, papc)

            vec3.addMut(pa.normal, faceNormal)
            vec3.addMut(pb.normal, faceNormal)
            vec3.addMut(pc.normal, faceNormal)
        }

        this._geometry.vertices.forEach((vertex: Vertex): void => {
            vec3.normalizeMut(vertex.normal)

            vertex.color = vertex.normal
        })

        this._geometry.upload()
    }

    // getRenderPipeline returns the render pipeline of this object.
    public getRenderPipeline(camera: Camera): GPURenderPipeline {
        if (this.renderPipeline) {
            this.updateUniforms()

            return this.renderPipeline
        }

        const vertModule = this.device.createShaderModule({ code: vertShaderCode })
        const fragModule = this.device.createShaderModule({ code: fragShaderCode })

        const uniformData = this.computeUniform()
        this.uniformBuffer = this.device.createBuffer({
            size: fourBytesAlignment(uniformData.byteLength),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })

        const writeUniformArr = new Float32Array(this.uniformBuffer.getMappedRange())
        writeUniformArr.set(uniformData)
        this.uniformBuffer.unmap()

        const uniformBindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" as const },
            }]
        })

        this.uniformBindGroup = this.device.createBindGroup({
            layout: uniformBindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer },
            }]
        })

        const layout = this.device.createPipelineLayout({
            bindGroupLayouts: [
                camera.uniformBindGroupLayout,
                uniformBindGroupLayout,
            ],
        })

        this.renderPipeline = this.device.createRenderPipeline({
            layout,
            vertex: {
                module: vertModule,
                entryPoint: "main",
                buffers: [{
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" as const },
                        { shaderLocation: 1, offset: 3*4, format: "float32x3" as const },
                        { shaderLocation: 2, offset: 2*3*4, format: "float32x3" as const },
                    ],
                    arrayStride: 3 * 4*3,
                    stepMode: "vertex" as const
                }]
            },
            fragment: {
                module: fragModule,
                entryPoint: "main",
                targets: [{ format: "bgra8unorm" as const }],
            },
            primitive: {
                frontFace: "cw",
                cullMode: "none",
                topology: this._geometry.primitive,
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus-stencil8",
            },
        })

        return this.renderPipeline
    }

    private updateUniforms(): void {
        const data = this.computeUniform()
        this.device.queue.writeBuffer(this.uniformBuffer, 0, data, 0, data.length)
    }

    private computeUniform(): Float32Array {
        return new Float32Array(mat4.mulMut(
            mat4.translation(this.position),
            mat4.rotation(this.rotation),
        ))
    }
}

function buildParticles(geometry: Geometry): Particles {
    const particles = new Particles(geometry.vertices.count)

    geometry.vertices.forEach((vertex: Vertex) => {
        particles.add({
            position: vertex.position,
            velocity: vec3.zero(),
            estimatedPosition: vec3.zero(),
            deltaPosition: vec3.zero(),
            inverseMass: 0.0,
        })
    })

    // Compute particles mass.
    for (let triangle of geometry.topology.triangles) {
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
    }

    particles.forEach((particle: Particle): void => {
        if (particle.position.z === 0) {
            particle.inverseMass = 0.0
        }
    })

    return particles
}

interface constraint {
    type: ConstraintType
    p1: number
    p2: number
}

function buildConstraints(geometry: Geometry, particles: Particles): Constraints {
    const constraintParticles: constraint[] = []

    // Generate stretching constraints.
    for (let edge of geometry.topology.edges) {
        constraintParticles.push({
            type: ConstraintType.Stretch,
            p1: edge.start,
            p2: edge.end,
        })
    }

    // Generate bending constraints.
    for (let edge of geometry.topology.edges) {
        if (edge.triangles.length == 1) {
            continue
        }
        if (edge.triangles.length != 2) {
            throw new Error(`Non-manifold mesh: ${edge.start}-${edge.end} shared with ${edge.triangles.length} triangles`)
        }

        const t1 = geometry.topology.triangles[edge.triangles[0]]
        const t2 = geometry.topology.triangles[edge.triangles[1]]

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
            type: ConstraintType.Bend,
            p1, p2,
        })
    }

    // Shuffle constraints to prevent resonances.
    shuffle(constraintParticles)

    const constraints = new Constraints(constraintParticles.length)

    for (let c of constraintParticles) {
        if (c.type === ConstraintType.Stretch) {
            constraints.addStretch(particles.get(c.p1), particles.get(c.p2))
        } else {
            constraints.addBend(particles.get(c.p1), particles.get(c.p2))
        }
    }

    return constraints
}

function shuffle<T>(arr: Array<T>): void {
    for (let i = arr.length - 1; i >= 1; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       const tmp = arr[j];

       arr[j] = arr[i];
       arr[i] = tmp;
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}