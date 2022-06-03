import {App} from "./app"

async function main() {
    const gpu: GPU = navigator.gpu
    if (!gpu) {
        throw new Error("WebGPU is not supported on this browser.")
    }

    const adapter = await gpu.requestAdapter()
    const device = await adapter.requestDevice()

    const canvas = document.getElementById("app") as HTMLCanvasElement

    canvas.width = 1000
    canvas.height = 512

    const app = new App(canvas, device)

    return app.run()
}

main()
    .then(() => console.log("done"))
    .catch(err => console.error(err))

