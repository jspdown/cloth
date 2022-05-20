import {Geometry} from "./geometry";

import vertShaderCode from "./shaders/triangle.vert.wgsl";
import fragShaderCode from "./shaders/triangle.frag.wgsl";
import {Camera} from "./camera";

export class Cloth {
    public geometry: Geometry
    private renderPipeline: GPURenderPipeline | null

    constructor(geometry: Geometry) {
        this.geometry = geometry
        this.renderPipeline = null
    }

    getRenderPipeline(device: GPUDevice, camera: Camera): GPURenderPipeline {
        if (this.renderPipeline) {
            return this.renderPipeline
        }

        const vertModule = device.createShaderModule({ code: vertShaderCode });
        const fragModule = device.createShaderModule({ code: fragShaderCode });

        const layout = device.createPipelineLayout({
            bindGroupLayouts: [camera.bindGroupLayout]
        });

        this.renderPipeline = device.createRenderPipeline({
            layout,
            vertex: {
                module: vertModule,
                entryPoint: "main",
                buffers: [{
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x3" as const
                    }],
                    arrayStride: 4 * 3, // sizeof(float) * 3
                    stepMode: "vertex" as const
                }]
            },
            fragment: {
                module: fragModule,
                entryPoint: "main",
                targets: [{
                    format: "bgra8unorm" as const
                }],
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
        });

        return this.renderPipeline
    }
}
