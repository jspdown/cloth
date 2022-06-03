import * as vec3 from "./math/vector3"
import * as mat4 from "./math/matrix4"
import * as scalar from "./math/scalar"
import {Vector3} from "./math/vector3"

// Config holds the configuration of the camera.
export interface Config {
    fovy?: number
    far?: number
    near?: number
    width: number
    height: number
}

const float32DataSize = 4

// Camera is a 3D perspective camera with orbit control.
export class Camera {
    // Uniform.
    public uniformBindGroup: GPUBindGroup
    public uniformBindGroupLayout: GPUBindGroupLayout

    private readonly config: Config

    // Camera position.
    private distance: number
    private position: Vector3
    private rotation: Vector3

    // Camera movement state.
    private dragging: boolean
    private rotateX: number
    private rotateY: number
    private x: number
    private y: number
    private lastX: number
    private lastY: number
    private readonly limitX: number

    private readonly device: GPUDevice
    private readonly uniformBuffer: GPUBuffer

    constructor(device: GPUDevice, config?: Config) {
        this.device = device
        this.config = { ...{
            fovy: Math.PI / 4,
            near: 0.1,
            far: 1000,
        }, ...config }

        this.distance = 5.0
        this.position = vec3.create(0, 0, -this.distance)
        this.rotation = vec3.create(scalar.degToRad(90), 0, 0)

        this.dragging = false
        this.rotateX = this.rotation.x
        this.rotateY = this.rotation.y
        this.x = 0.0
        this.y = 0.0
        this.lastX = 0.0
        this.lastY = 0.0
        this.limitX = 85.0

        this.uniformBuffer = device.createBuffer({
            size: 2 * float32DataSize * 4 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        this.uniformBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "uniform" as const,
                    },
                },
            ],
        })

        this.uniformBindGroup = device.createBindGroup({
            layout: this.uniformBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer,
                    },
                },
            ],
        })

        window.addEventListener("mousedown", () => this.onMouseButtonPressed())
        window.addEventListener("mouseup", () => this.onMouseButtonReleased())
        window.addEventListener("wheel", e => this.onMouseWheel(e.deltaY))
        window.addEventListener("mousemove", e => this.onMouseMove(e.clientX, e.clientY))

        this.updateUniform()
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
        this.position.z = -this.distance

        this.updateUniform()
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

        let epsilon = 0.01

        if (Math.abs(rotateX - this.rotateX) > epsilon || Math.abs(rotateY - this.rotateY) > epsilon) {
            this.rotateX = rotateX
            this.rotateY = rotateY

            this.position.z = -this.distance
            this.rotation = vec3.create(
                scalar.degToRad(this.rotateX),
                scalar.degToRad(this.rotateY), 0.0)
        }

        this.updateUniform()
    }

    private updateUniform(): void {
        const projection = mat4.perspective(
            this.config.fovy,
            this.config.near,
            this.config.far,
            this.config.width / this.config.height)

        const view = mat4.mulMut(mat4.translation(this.position), mat4.rotation(this.rotation))

        const data = new Float32Array(2 * 4 * 4)

        data.set(projection, 0)
        data.set(view, 4 * 4)

        this.device.queue.writeBuffer(this.uniformBuffer, 0, data, 0, data.length)
    }
}
