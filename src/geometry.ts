import {VertexBuffer} from "./vertex";

const vertexComponents = 6
const vertexPositionOffset = 0
const vertexNormalOffset = 3

// Geometry holds a mesh geometry.
export class Geometry {
    public indices: Uint16Array
    public vertices: VertexBuffer

    public vertexComponents: number
    public vertexPositionOffset: number
    public vertexNormalOffset: number

    public indexBuffer: GPUBuffer
    public vertexBuffer: GPUBuffer

    private device: GPUDevice

    constructor(device: GPUDevice, vertices: VertexBuffer, indices: Uint16Array) {
        this.device = device
        this.indices = indices
        this.vertices = vertices

        this.vertexComponents = vertexComponents
        this.vertexPositionOffset = vertexPositionOffset
        this.vertexNormalOffset = vertexNormalOffset

        // Initialize index buffer.
        this.indexBuffer = device.createBuffer({
            size: fourBytesAlignment(this.indices.byteLength),
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true
        })

        const writeIndicesArr = new Uint16Array(this.indexBuffer.getMappedRange())
        writeIndicesArr.set(this.indices)
        this.indexBuffer.unmap()


        // Initialize vertex buffer.
        this.vertexBuffer = device.createBuffer({
            size: fourBytesAlignment(this.vertices.buffer.byteLength),
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })

        const writeVerticesArr = new Float32Array(this.vertexBuffer.getMappedRange())
        writeVerticesArr.set(this.vertices.buffer)
        this.vertexBuffer.unmap()
    }

    // upload uploads the vertices to the GPU.
    public upload(): void {
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices.buffer, 0, this.vertices.buffer.length)
    }
}

// buildPlaneGeometry builds a plane geometry.
export function buildPlaneGeometry(device: GPUDevice, width: number, height: number, widthDivisions: number, heightDivisions: number): Geometry {
    const widthStep = width / widthDivisions
    const heightStep = height / widthDivisions

    const triangles = 2 * heightDivisions * widthDivisions
    const vertices = new VertexBuffer((heightDivisions + 1) * (widthDivisions + 1))
    const indices = new Uint16Array(3 * triangles)

    let indicesIdx = 0
    for (let j = 0; j <= heightDivisions; j++) {
        for (let i = 0; i <= widthDivisions; i++) {
            vertices.add({
                position: { x: i * widthStep, y: 0, z: j * heightStep },
                normal: { x: 0, y: 1, z: 0 },
            })

            // Generate triangle indices following this pattern:
            // 0 - 1 - 2    j=1, i=0 => 0, 4, 1,
            // | / | / |    j=1, i=1 => 1, 4, 5,  1, 5, 2
            // 4 - 5 - 6    j=1, i=2 => 2, 5, 6,

            if (j == 0) {
                continue
            }

            const k = i + j * (widthDivisions + 1)
            if (i > 0) {
                indices.set([
                    k - (widthDivisions + 1),
                    k - 1,
                    k,
                ], indicesIdx)
                indicesIdx += 3
            }
            if (i < widthDivisions) {
                indices.set([
                    k - (widthDivisions + 1),
                    k,
                    k - widthDivisions,
                ], indicesIdx)
                indicesIdx += 3
            }
        }
    }

    return new Geometry(device, vertices, indices)
}

function fourBytesAlignment(size: number) {
    return (size + 3) & ~3
}
