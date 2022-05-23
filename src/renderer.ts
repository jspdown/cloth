import {Geometry} from "./geometry"
import {Camera} from "./camera"

export class Renderer {
    private readonly device: GPUDevice

    private context: GPUCanvasContext
    private readonly depthTextureView: GPUTextureView

    private readonly width: number
    private readonly height: number

    constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
        this.device = device;
        this.width = canvas.width
        this.height = canvas.height

        this.context = canvas.getContext("webgpu") as unknown as GPUCanvasContext
        this.context.configure({
            device: this.device,
            format: "bgra8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            compositingAlphaMode: "opaque",
        });

        const depthTextureDesc: GPUTextureDescriptor = {
            size: [this.width, this.height, 1],
            dimension: "2d",
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        };

        const depthTexture = this.device.createTexture(depthTextureDesc);
        this.depthTextureView = depthTexture.createView();
    }

    render(pipeline: GPURenderPipeline, geometry: Geometry, bindGroups: GPUBindGroup[]): void {
        const colorTexture = this.context.getCurrentTexture();
        const colorTextureView = colorTexture.createView();

        let colorAttachment: GPURenderPassColorAttachment = {
            view: colorTextureView,
            loadOp: "clear",
            clearValue: { r: 0.83, g: 0.85, b: 0.86, a: 1 },
            storeOp: "store",
        };

        const depthAttachment: GPURenderPassDepthStencilAttachment = {
            view: this.depthTextureView,
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            stencilClearValue: 0,
            stencilLoadOp: "clear",
            stencilStoreOp: "store",
        };

        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [colorAttachment],
            depthStencilAttachment: depthAttachment
        };

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);

        passEncoder.setPipeline(pipeline);
        passEncoder.setViewport(0, 0, this.width, this.height, 0, 1);
        passEncoder.setScissorRect(0, 0, this.width, this.height);
        passEncoder.setVertexBuffer(0, geometry.vertexBuffer);
        passEncoder.setIndexBuffer(geometry.indexBuffer, "uint16");

        for (let i = 0; i < bindGroups.length; i++) {
            passEncoder.setBindGroup(i, bindGroups[i])
        }

        passEncoder.drawIndexed(geometry.indices.length);
        passEncoder.end()

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
