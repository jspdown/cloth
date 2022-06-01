import vertShaderCode from "./shaders/triangle.vert.wgsl"
import fragShaderCode from "./shaders/triangle.frag.wgsl"

import {Geometry} from "./geometry"
import {Camera} from "./camera"
import {Matrix4, Vector3} from "@math.gl/core"
import {Particle, ParticleBuffer} from "./particle"
import {Constraint, FixedConstraint, StretchConstraint} from "./constraint"
import {Vertex} from "./vertex"
import * as vec from "./vector"

const stretchCompliance = 0.00000002

// Cloth holds a cloth mesh.
export class Cloth {
    public geometry: Geometry
    public topology: Topology
    public particles: ParticleBuffer
    public constraints: Constraint[]
    public uniformBindGroup: GPUBindGroup

    private _position: Vector3
    private _rotation: Vector3
    private updated: boolean

    private device: GPUDevice
    private renderPipeline: GPURenderPipeline | null
    private uniformBuffer: GPUBuffer

    constructor(device: GPUDevice, geometry: Geometry, position?: Vector3, rotation?: Vector3) {
        this.device = device
        this.geometry = geometry
        this.topology = buildTopology(geometry)

        this.initializeParticlesAndConstraints()

        console.log("vertices:", this.geometry.vertices.count)
        console.log("triangles:", this.topology.triangles.length)
        console.log("edges:", this.topology.edges.length)
        console.log("constraints:", this.constraints.length)
        console.log("stretch compliance:", stretchCompliance)

        this._position = position || new Vector3(0, 0, 0)
        this._rotation = rotation || new Vector3(0, 0, 0)
        this.updated = !!position || !!rotation

        this.renderPipeline = null
    }

    // set position sets the position of the cloth.
    public set position(position: Vector3) {
        this._position = position
        this.updated = true
    }
    // set rotation sets the rotation of the cloth.
    public set rotation(rotation: Vector3) {
        this._rotation = rotation
        this.updated = true
    }
    // get position gets the position of the cloth.
    public get position(): Vector3 { return this._position }
    // get rotation gets the rotation of the cloth.
    public get rotation(): Vector3 { return this._rotation }

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
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" as const }
                }
            ]
        })

        this.uniformBindGroup = this.device.createBindGroup({
            layout: uniformBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } }
            ]
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
                        { shaderLocation: 1, offset: 12, format: "float32x3" as const },
                    ],
                    arrayStride: 4 * 3 + 4 * 3,
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
                topology: "triangle-list"
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus-stencil8"
            },
        })

        return this.renderPipeline
    }

    public updatePositionsAndNormals(): void {
        this.geometry.vertices.forEach((vertex: Vertex): void => {
            const particle = this.particles.get(vertex.id)

            vertex.position.x = particle.position.x
            vertex.position.y = particle.position.y
            vertex.position.z = particle.position.z

            vertex.normal = vec.zero()
        })


        for (let triangle of this.topology.triangles) {
            const pa = this.geometry.vertices.get(triangle.a)
            const pb = this.geometry.vertices.get(triangle.b)
            const pc = this.geometry.vertices.get(triangle.c)

            const papb = vec.sub(pb.position, pa.position)
            const papc = vec.sub(pc.position, pa.position)

            const faceNormal = vec.cross(papb, papc)

            vec.addMut(pa.normal, faceNormal)
            vec.addMut(pb.normal, faceNormal)
            vec.addMut(pc.normal, faceNormal)
        }

        this.geometry.vertices.forEach((vertex: Vertex): void => {
            vec.normalizeMut(vertex.normal)
        })

        this.geometry.upload()
    }

    private updateUniforms(): void {
        if (!this.updated) return

        const data = this.computeUniform()

        this.device.queue.writeBuffer(this.uniformBuffer, 0, data, 0, data.length)
    }

    private computeUniform(): Float32Array {
        return new Matrix4()
            .translate(this.position)
            .rotateXYZ(this.rotation)
            .toFloat32Array()
    }

    private initializeParticlesAndConstraints(): void {
        const particles = new ParticleBuffer(this.geometry.vertices.count)

        this.geometry.vertices.forEach((vertex: Vertex) => {
            particles.add({
                position: vertex.position,
                velocity: Vector3.ZERO,
                estimatedPosition: Vector3.ZERO,
                inverseMass: 1.0,
            })
        })

        const constraints: Constraint[] = []

        // Generate stretching constraints.
        for (let edge of this.topology.edges) {
            constraints.push(new StretchConstraint(
                particles.get(edge.start),
                particles.get(edge.end),
                stretchCompliance,
            ))
        }

        // Attach cloth by the top.
        particles.forEach((particle: Particle) => {
            if (particle.position.x != 0) return

            constraints.push(new FixedConstraint(particle))
        })

        this.particles = particles
        this.constraints = constraints
    }
}

interface Topology {
    triangles: Triangle[]
    edges: Edge[]
}

interface Triangle {
    a: number
    b: number
    c: number
}

interface Edge {
    start: number
    end: number
    triangles: number[]
}

function buildTopology(geometry: Geometry) {
    const numTriangles = geometry.indices.length / 3

    const vertexTriangles = new Array(geometry.vertices.count)
    const existingEdges: Record<string, number> = {}

    const triangles: Triangle[] = []
    const edges: Edge[] = []

    const addTriangleToVertex = (id: number, i: number) => {
        if (!vertexTriangles[id]) {
            vertexTriangles[id] = []
        }

        vertexTriangles[id].push(i)
    }

    for (let i = 0; i < numTriangles; i++) {
        const triangle = {
            a: geometry.indices[i * 3],
            b: geometry.indices[i * 3 + 1],
            c: geometry.indices[i * 3 + 2],
        };

        addTriangleToVertex(triangle.a, i)
        addTriangleToVertex(triangle.b, i)
        addTriangleToVertex(triangle.c, i)

        const triangleEdges = [
            { start: Math.min(triangle.a, triangle.b), end: Math.max(triangle.a, triangle.b) },
            { start: Math.min(triangle.b, triangle.c), end: Math.max(triangle.b, triangle.c) },
            { start: Math.min(triangle.c, triangle.a), end: Math.max(triangle.c, triangle.a) },
        ];

        triangles.push(triangle);

        for (let edge of triangleEdges) {
            const key = `${edge.start}-${edge.end}`

            if (!existingEdges[key]) {
                edges.push({
                    start: edge.start,
                    end: edge.end,
                    triangles: [i],
                })
                existingEdges[key] = edges.length - 1
                continue
            }

            edges[existingEdges[key]].triangles.push(i)
        }
    }

    return { triangles, edges }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
