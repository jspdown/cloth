
export interface Geometry {
    vertices: Float32Array
    indices: Uint16Array

    vertexBuffer: GPUBuffer
    indexBuffer: GPUBuffer
}

export class PlaneGeometry implements Geometry {
    public vertices: Float32Array
    public indices: Uint16Array

    public indexBuffer: GPUBuffer
    public vertexBuffer: GPUBuffer

    private device: GPUDevice

    constructor(device: GPUDevice, width: number, height: number, widthDivisions: number, heightDivisions: number) {
        this.device = device

        const widthStep = width / widthDivisions
        const heightStep = height / widthDivisions

        const vertexComponents = 6

        const triangles = 2 * (heightDivisions - 1) * (widthDivisions - 1)
        this.vertices = new Float32Array(heightDivisions * widthDivisions * vertexComponents)
        this.indices = new Uint16Array(3 * triangles)

        let verticesIdx = 0
        let indicesIdx = 0
        for (let j = 0; j < heightDivisions; j++) {
            for (let i = 0; i < widthDivisions; i++) {
                const vertex = [
                    /* px */ i * widthStep,
                    /* py */ 0,
                    /* pz */ j * heightStep,
                    /* nx */ 0,
                    /* ny */ 1,
                    /* nz */ 0,
                ]
                this.vertices.set(vertex, verticesIdx)
                verticesIdx += vertexComponents

                // Generate triangle indices following this pattern:
                // 0 - 1 - 2    j=1, i=0 => 0, 4, 1,
                // | / | / |    j=1, i=1 => 1, 4, 5,  1, 5, 2
                // 4 - 5 - 6    j=1, i=2 => 2, 5, 6,

                if (j == 0) {
                    continue
                }

                const k = i + j * widthDivisions

                if (i > 0) {
                    this.indices.set([
                        k - widthDivisions,
                        k - 1,
                        k,
                    ], indicesIdx)
                    indicesIdx += 3
                }
                if (i < widthDivisions - 1) {
                    this.indices.set([
                        k - widthDivisions,
                        k,
                        k - (widthDivisions - 1),
                    ], indicesIdx)
                    indicesIdx += 3
                }
            }
        }

        // Initialize index buffer.
        this.indexBuffer = device.createBuffer({
            size: fourBytesAlignment(this.indices.byteLength),
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true
        })

        const writeIndicesArr = new Uint16Array(this.indexBuffer.getMappedRange())
        writeIndicesArr.set(this.indices)
        this.indexBuffer.unmap();


        // Initialize vertex buffer.
        this.vertexBuffer = device.createBuffer({
            size: fourBytesAlignment(this.vertices.byteLength),
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        })

        const writeVerticesArr = new Float32Array(this.vertexBuffer.getMappedRange())
        writeVerticesArr.set(this.vertices)
        this.vertexBuffer.unmap()
    }

    upload() {
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices, 0, this.vertices.length)
    }
}


function fourBytesAlignment(size: number) {
    return (size + 3) & ~3
}
