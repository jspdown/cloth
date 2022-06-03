import {App} from "./app"
import logger from "./logger"

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
    .then(() => logger.info("done"))
    .catch(err => logger.error(err.toString()))

