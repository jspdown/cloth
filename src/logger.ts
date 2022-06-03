interface Log {
    date: Date
    message: string
}

const strongRe = /(\*\*(.+)\*\*)/g

class Logger {
    private pending: Log[]
    private logEl: HTMLElement

    constructor() {
        this.pending = []
        this.logEl = document.getElementById("log")

        setInterval(() => this.flush(), 50)
    }

    flush() {
        this.pending.forEach(log => {
            const p = document.createElement("p")
            const date = log.date.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            })

            const message = this.replaceStrongMarkers(log.message)
            p.innerHTML = `<span class="date">${date}&nbsp&nbsp</span><span class="message">${message}</span>`

            this.logEl.appendChild(p)
            this.logEl.scrollTop = this.logEl.scrollHeight;
        })
        this.pending = []
    }

    replaceStrongMarkers(str: string): string {
        const marker = "**"
        let out = ""

        while (true) {
            const start = str.indexOf(marker)
            if (start === -1) {
                return out + str
            }

            const end = str.slice(start+marker.length).indexOf(marker)
            if (end === -1) {
                return out + str
            }

            out += str.slice(0, start)

            const strong = str.slice(start+marker.length, start+marker.length+end)
            out += `<span class="strong">${strong}</span>`

            str = str.slice(start+marker.length+end+marker.length)
        }
    }

    info(message: string) {
        this.pending.push({ date: new Date(), message })
    }

    warn(message: string) {
        this.pending.push({ date: new Date(), message })
    }

    error(message: string) {
        this.pending.push({ date: new Date(), message })
    }
}

export default new Logger()