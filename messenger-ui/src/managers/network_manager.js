class NetworkManager {
    constructor(ipcRenderer) {
        this.ipcRenderer = ipcRenderer;
        this.ipcBuffer = '';
        this.handlers = {};

        this.ipcRenderer.on('from-cpp', (event, rawData) => {
            this.ipcBuffer += rawData.toString();
            let newlineIdx;
        
            while ((newlineIdx = this.ipcBuffer.indexOf('\n')) !== -1) {
                const packetStr = this.ipcBuffer.slice(0, newlineIdx).trim();
                this.ipcBuffer = this.ipcBuffer.slice(newlineIdx + 1);
                
                if (!packetStr) continue;
                
                let data;
                try {
                    data = JSON.parse(packetStr);
                } catch (e) {
                    console.error("JSON Parse Error:", packetStr, e.message);
                    continue;
                }
                if (this.handlers[data.type]) {
                    this.handlers[data.type](data);
                } else {
                    console.warn("[Client] Unknown packet type from server:", data.type);
                }
            }
        });
    }

    send(type, playload = {}) {
        this.ipcRenderer.send('to-cpp', JSON.stringify({type: type, ...playload}));
    }
}

module.exports = NetworkManager;