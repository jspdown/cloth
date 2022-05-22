import {Matrix4, Vector3} from "@math.gl/core";

// Config holds the configuration of the camera.
export interface Config {
    fovy?: number
    far?: number
    near?: number
    width: number
    height: number
}

// Camera
export class Camera {
    public bindGroup: GPUBindGroup
    public bindGroupLayout: GPUBindGroupLayout

    private readonly device: GPUDevice
    private readonly uniformBuffer: GPUBuffer;

    private readonly config: Config

    private distance: number
    private position: Vector3
    private rotation: Vector3

    private dragging: boolean
    private rotateX: number
    private rotateY: number
    private x: number
    private y: number
    private lastX: number
    private lastY: number
    private readonly limitX: number

    constructor(device: GPUDevice, config?: Config) {
        this.device = device
        this.config = { ...{
            fovy: Math.PI / 4,
            near: 0.1,
            far: 1000,
        }, ...config }

        this.distance = 5.0

        this.dragging = false
        this.rotateX = 0.0
        this.rotateY = 0.0
        this.x = 0.0
        this.y = 0.0
        this.lastX = 0.0
        this.lastY = 0.0
        this.limitX = 85.0
        this.rotation = new Vector3(0, 0, 0)
        this.position = new Vector3(0, 0, 0)

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

        window.addEventListener("mousedown", () => this.onMouseButtonPressed())
        window.addEventListener("mouseup", () => this.onMouseButtonReleased())
        window.addEventListener("wheel", e => this.onMouseWheel(e.deltaY))
        window.addEventListener("mousemove", e => this.onMouseMove(e.clientX, e.clientY))
    }

    private onMouseButtonPressed(): void {
        this.dragging = true

        this.lastX = this.x
        this.lastY = this.y
    }

    private onMouseButtonReleased(): void {
        this.dragging = false
    }

    private onMouseMove(x: number, y: number) {
        this.x = x
        this.y = y

        if (this.dragging) {
            this.drag(this.x, this.y)
        }
    }

    private onMouseWheel(y: number): void {
        this.distance += y * 0.5

        this.position = new Vector3(0.0, 0.0, -this.distance)

        this.updateUniform()
    }

    private updateUniform(): void {
        const data = this.computeUniform()

        this.device.queue.writeBuffer(this.uniformBuffer, 0, data, 0, data.length)
    }

    private drag(x: number, y: number) {
        let degreesPerPixelX = 90.0 / this.config.height
        let degreesPerPixelY = 180.0 / this.config.width

        let rotateX = this.rotateX + degreesPerPixelX * (y - this.lastY)
        let rotateY = this.rotateY + degreesPerPixelY * (x - this.lastX)

        if (rotateX < -this.limitX) {
            rotateX = this.limitX
        } else if (rotateX > this.limitX) {
            rotateX = this.limitX
        }

        this.lastX = x
        this.lastY = y

        let epsilon = 0.01;

        if (Math.abs(rotateX - this.rotateX) > epsilon || Math.abs(rotateY - this.rotateY) > epsilon) {
            this.rotateX = rotateX
            this.rotateY = rotateY

            this.position = new Vector3(0.0, 0.0, -this.distance)
            this.rotation = new Vector3(degToRad(this.rotateX), degToRad(this.rotateY), 0.0)
        }

        this.updateUniform()
    }

    private computeUniform(): Float32Array {
        const projection = new Matrix4().perspective({
            fovy: this.config.fovy,
            near: this.config.near,
            far: this.config.far,
            aspect: this.config.width / this.config.height
        })
        const view = new Matrix4().translate(this.position).rotateXYZ(this.rotation)

        return projection.multiplyRight(view).toFloat32Array()
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}

function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}
