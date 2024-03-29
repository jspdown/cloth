import vertShaderCode from "./shaders/vert.wgsl"
import fragShaderCode from "./shaders/frag.wgsl"

import {Camera} from "./camera"
import {Geometry} from "./geometry"
import { Triangles } from "./triangles"

const cameraLayoutDesc: GPUBindGroupLayoutDescriptor = {
    entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" as const },
    }],
}

interface RenderObject {
    id: string

    geometry: Geometry
    wireframe: boolean
}

// Renderer is a basic 3D renderer.
export class Renderer {
    private readonly device: GPUDevice
    private readonly context: GPUCanvasContext
    private readonly depthTextureView: GPUTextureView
    private readonly objectStates: Record<string, RenderObjectState>

    constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
        this.device = device

        this.objectStates = {}
        this.context = canvas.getContext("webgpu") as unknown as GPUCanvasContext
        this.context.configure({
            device: this.device,
            format: "bgra8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            alphaMode: "opaque"
        })

        const depthTextureDesc: GPUTextureDescriptor = {
            label: "depth texture",
            size: [canvas.width, canvas.height, 1],
            dimension: "2d",
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        }

        const depthTexture = this.device.createTexture(depthTextureDesc)
        this.depthTextureView = depthTexture.createView()
    }

    public render(encoder: GPUCommandEncoder, object: RenderObject, camera: Camera): void {
        let state = this.objectStates[object.id]
        if (!state || state.wireframe !== object.wireframe) {
            state = new RenderObjectState(this.device, object, camera)
            this.objectStates[object.id] = state
        }

        const colorTexture = this.context.getCurrentTexture()
        const colorTextureView = colorTexture.createView({
            label: "color texture"
        })

        let colorAttachment: GPURenderPassColorAttachment = {
            view: colorTextureView,
            loadOp: "clear",
            clearValue: { r: 0.83, g: 0.85, b: 0.86, a: 1 },
            storeOp: "store",
        }

        const depthAttachment: GPURenderPassDepthStencilAttachment = {
            view: this.depthTextureView,
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            stencilClearValue: 0,
            stencilLoadOp: "clear",
            stencilStoreOp: "store",
        }

        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [colorAttachment],
            depthStencilAttachment: depthAttachment
        }

        const passEncoder = encoder.beginRenderPass(renderPassDesc)

        const { width, height } = this.context.canvas as HTMLCanvasElement

        passEncoder.setPipeline(state.pipeline)
        passEncoder.setViewport(0, 0, width, height, 0, 1)
        passEncoder.setScissorRect(0, 0, width, height)
        passEncoder.setVertexBuffer(0, object.geometry.vertices.positionBuffer)
        passEncoder.setVertexBuffer(1, object.geometry.vertices.normalBuffer)
        passEncoder.setIndexBuffer(state.indexBuffer, "uint32")
        passEncoder.setBindGroup(0, state.cameraBindGroup)
        passEncoder.drawIndexed(state.indexCount)
        passEncoder.end()
    }
}

class RenderObjectState {
    public pipeline: GPURenderPipeline
    public cameraBindGroup: GPUBindGroup
    public indexBuffer: GPUBuffer
    public indexCount: number
    public wireframe: boolean

    constructor(device: GPUDevice, object: RenderObject, camera: Camera) {
        const vertModule = device.createShaderModule({ code: vertShaderCode })
        const fragModule = device.createShaderModule({ code: fragShaderCode })

        this.wireframe = object.wireframe
        this.indexBuffer = object.geometry.triangles.indexBuffer
        this.indexCount = object.geometry.triangles.count * 3

        this.cameraBindGroup = device.createBindGroup({
            layout: device.createBindGroupLayout(cameraLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: camera.buffer } },
            ],
        })

        let topology: GPUPrimitiveTopology = "triangle-list"

        if (this.wireframe) {
            topology = "line-list"

            const indices = buildWireframeIndices(object.geometry.triangles)

            this.indexCount = indices.length
            this.indexBuffer = device.createBuffer({
                label: "index",
                size: fourBytesAlignment(indices.byteLength),
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            })
            device.queue.writeBuffer(
                this.indexBuffer, 0,
                indices, 0,
                indices.length)
        }

        this.pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    device.createBindGroupLayout(cameraLayoutDesc),
                ],
            }),
            vertex: {
                module: vertModule,
                entryPoint: "main",
                buffers: [{
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" as const },
                    ],
                    arrayStride: 4*4,
                    stepMode: "vertex" as const
                }, {
                    attributes: [
                        { shaderLocation: 1, offset: 0, format: "sint32x3" as const },
                    ],
                    arrayStride: 4*4,
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
                topology,
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus-stencil8",
            },
        })
    }
}

function buildWireframeIndices(triangles: Triangles): Uint32Array {
    const topology = triangles.extractTopology()
    const indices = new Uint32Array(topology.edges.length * 2)

    let idx = 0
    topology.edges.forEach(edge => {
        indices[idx] = edge[0]
        indices[idx+1] = edge[1]
        idx += 2
    })

    return indices
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
