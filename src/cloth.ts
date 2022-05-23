import {Geometry} from "./geometry";

import vertShaderCode from "./shaders/triangle.vert.wgsl";
import fragShaderCode from "./shaders/triangle.frag.wgsl";
import {Camera} from "./camera";
import {Matrix4, Vector3} from "@math.gl/core";
import Vector from "@math.gl/core/dist/es5/classes/base/vector";

export class Cloth {
    public geometry: Geometry
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

        this._position = position || new Vector3(0, 0, 0)
        this._rotation = rotation || new Vector3(0, 0, 0)
        this.updated = !!position || !!rotation

        this.renderPipeline = null
    }

    public set position(position: Vector3) {
        this._position = position
        this.updated = true
    }
    public set rotation(rotation: Vector3) {
        this._rotation = rotation
        this.updated = true
    }
    public get position(): Vector3 { return this._position }
    public get rotation(): Vector3 { return this._rotation }

    public getRenderPipeline(device: GPUDevice, camera: Camera): GPURenderPipeline {
        if (this.renderPipeline) {
            this.updateUniforms()

            return this.renderPipeline
        }

        const vertModule = device.createShaderModule({ code: vertShaderCode });
        const fragModule = device.createShaderModule({ code: fragShaderCode });

        const uniformData = this.computeUniform()
        this.uniformBuffer = device.createBuffer({
            size: fourBytesAlignment(uniformData.byteLength),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })

        const writeUniformArr = new Float32Array(this.uniformBuffer.getMappedRange())
        writeUniformArr.set(uniformData)
        this.uniformBuffer.unmap();

        const uniformBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "uniform" as const,
                    }
                }
            ]
        })

        this.uniformBindGroup = device.createBindGroup({
            layout: uniformBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer,
                    }
                }
            ]
        });

        const layout = device.createPipelineLayout({
            bindGroupLayouts: [
                camera.uniformBindGroupLayout,
                uniformBindGroupLayout,
            ],
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
                    }, {
                        shaderLocation: 1,
                        offset: 12,
                        format: "float32x3" as const
                    }],
                    arrayStride: 4 * 3 + 4 * 3,
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

    private updateUniforms(): void {
        const data = this.computeUniform()

        this.device.queue.writeBuffer(this.uniformBuffer, 0, data, 0, data.length)
    }

    private computeUniform(): Float32Array {
        return new Matrix4()
            .translate(this.position)
            .rotateXYZ(this.rotation)
            .toFloat32Array()
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
