import {App} from "./app"
import {logger} from "./logger"
import {monitor} from "./monitor"
import {Controller} from "./controller"

async function main() {
    const gpu: GPU = navigator.gpu
    if (!gpu) {
        throw new Error("WebGPU is not supported on this browser.")
    }

    const adapter = await gpu.requestAdapter({
        powerPreference: "high-performance"
    })

    await printSystemInfo(adapter)

    const device = await adapter.requestDevice()

    const canvas = document.getElementById("app") as HTMLCanvasElement

    canvas.width = 1000
    canvas.height = 512

    const app = new App(canvas, device)
    const controller = new Controller(app, device)

    logger.attach(document.getElementById("logger"))
    monitor.attach(document.getElementById("monitor"))
    controller.attach(document.getElementById("controller"))

    return app.run()
}

main()
    .then(() => logger.info("done"))
    .catch(err => console.error(err.toString() + "\n" + err.stack))


async function printSystemInfo(adapter: GPUAdapter) {
    const adapterInfo = await adapter.requestAdapterInfo()
    const adapterInfoLog = `adapter info:
    - vendor=${adapterInfo.vendor}
    - architecture=${adapterInfo.architecture}
    - description=${adapterInfo.description}
    `

    console.debug(adapterInfoLog)
    logger.info(adapterInfoLog)

    let adapterLimitLog = "adapter limits:\n"
    for (let key in adapter.limits as any) {
        adapterLimitLog += ` - ${key}: **${(adapter.limits as any)[key]}**\n`
    }

    console.debug(adapterLimitLog)
    logger.info(adapterLimitLog)
}
