import {Matrix4, Vector3} from "@math.gl/core";

// PerspectiveSettings holds the settings for defining the perspective of the camera.
export interface PerspectiveSettings {
    fovy?: number
    aspect?: number
    far?: number
    near?: number
}

// Camera
export class Camera {
    public bindGroup: GPUBindGroup
    public bindGroupLayout: GPUBindGroupLayout

    private readonly device: GPUDevice
    private readonly uniformBuffer: GPUBuffer;

    private readonly perspective: PerspectiveSettings
    private readonly up: Vector3
    private eye: Vector3
    private target: Vector3

    constructor(device: GPUDevice, perspective?: PerspectiveSettings) {
        this.device = device
        this.perspective = { ...{
            fovy: Math.PI / 4,
            aspect: 4/3,
            near: 0.1,
            far: 1000,
        }, ...perspective }

        this.up = new Vector3(0, 1, 0)
        this.eye = new Vector3(1, 1, 1)
        this.target = new Vector3(0, 0, 0)

        const uniformData = this.computeUniform()

        this.uniformBuffer = device.createBuffer({
            size: fourBytesAlignment(uniformData.byteLength),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })

        const writeUniformArr = new Float32Array(this.uniformBuffer.getMappedRange())
        writeUniformArr.set(uniformData)
        this.uniformBuffer.unmap();

        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "uniform" as const,

                    }
                }
            ]
        });

        this.bindGroup = device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer
                    }
                }
            ]
        });
    }

    // lookAt moves the camera to the given eye position and look at the target.
    public lookAt(eye: Vector3, target: Vector3): void {
        this.eye = eye
        this.target = target

        const uniformData = this.computeUniform()

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData, 0, uniformData.length);
    }

    // setAspectRatio sets the aspect ratio of the camera.
    public setAspectRatio(aspect: number): void {
        this.perspective.aspect = aspect

        const uniformData = this.computeUniform()

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData, 0, uniformData.length);
    }

    private computeUniform(): Float32Array {
        const view = new Matrix4().lookAt({
            eye: this.eye,
            center: this.target,
            up: this.up
        });

        const projection = new Matrix4().perspective(this.perspective)

        return projection.multiplyRight(view).toFloat32Array()
    }
}

function fourBytesAlignment(size: number) {
    return (size + 3) & ~3
}
