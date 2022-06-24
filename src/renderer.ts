import {Geometry} from "./geometry"

// Renderer is a basic 3D renderer.
export class Renderer {
    private readonly device: GPUDevice
    private readonly context: GPUCanvasContext
    private readonly depthTextureView: GPUTextureView

    constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
        this.device = device

        this.context = canvas.getContext("webgpu") as unknown as GPUCanvasContext
        this.context.configure({
            device: this.device,
            format: "bgra8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            compositingAlphaMode: "opaque",
        })

        const depthTextureDesc: GPUTextureDescriptor = {
            size: [canvas.width, canvas.height, 1],
            dimension: "2d",
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        }

        const depthTexture = this.device.createTexture(depthTextureDesc)
        this.depthTextureView = depthTexture.createView()
    }

    public render(encoder: GPUCommandEncoder, geometry: Geometry, pipeline: GPURenderPipeline, bindGroups: GPUBindGroup[]): void {
        const colorTexture = this.context.getCurrentTexture()
        const colorTextureView = colorTexture.createView()

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

        passEncoder.setPipeline(pipeline)
        passEncoder.setViewport(0, 0, width, height, 0, 1)
        passEncoder.setScissorRect(0, 0, width, height)
        passEncoder.setVertexBuffer(0, geometry.positionBuffer)
        passEncoder.setVertexBuffer(1, geometry.normalBuffer)
        passEncoder.setIndexBuffer(geometry.indexBuffer, "uint32")

        for (let i = 0; i < bindGroups.length; i++) {
            passEncoder.setBindGroup(i, bindGroups[i])
        }

        passEncoder.drawIndexed(geometry.indexes.length)
        passEncoder.end()
    }
}
