class HdlTypelist {

    async found(id) {
        return this.list[id] != undefined;
    }

    async typeOfDevice(id) {
        if (this.list[id] == undefined) return null;

        return this.list[id].type;
    }

    async numberOfChannels(id) {
        if (this.list[id] == undefined) return null;

        return this.list[id].channels;
    }

    async mainCapability(id) {
        if (this.list[id] == undefined) return null;

        return this.list[id].main_capability;
    }

    async getDict(id) {
        if (this.list[id] == undefined) return null;

        return this.list[id];
    }

    get list() {
        return {
            "16": { type: "dimmer", channels: 48 },
            "17": { type: "dimmer", channels:6 },
            "18": { type: "dimmer", channels: 48 },
            "32": { type: "dimmer", channels: 48 },
            "35": { type: "dimmer", channels: 4 },
            "36": { type: "dimmer", channels: 6 },
            "37": { type: "dimmer", channels: 2 },
            "40": { type: "dimmer", channels: 48 },
            "41": { type: "dimmer", channels: 48 },
            "42": { type: "dimmer", channels: 64 },
            "43": { type: "dimmer", channels: 64 },
            "124": { type: "tempsensor", channels: 2 },
            "134": { type: "tempsensor", channels: 4 },
            "207": { type: "floorheater", channels: 6 },
            "208": { type: "floorheater", channels: 6 },
            "209": { type: "floorheater", channels: 6 },
            "210": { type: "floorheater", channels: 6 },
            "211": { type: "floorheater", channels: 6 },
            "212": { type: "floorheater", channels: 6 },
            "305": { type: "multisensor", main_capability: "alarm_motion"},
            "307": { type: "multisensor", main_capability: "alarm_motion"},
            "308": { type: "multisensor", main_capability: "alarm_motion"},
            "309": { type: "multisensor", main_capability: "alarm_motion"},
            "310": { type: "multisensor", main_capability: "measure_humidity"},
            "312": { type: "multisensor", main_capability: "alarm_motion"},
            "314": { type: "multisensor", main_capability: "alarm_motion"},
            "315": { type: "multisensor", main_capability: "alarm_motion"},
            "316": { type: "multisensor", main_capability: "alarm_motion"},
            "318": { type: "multisensor", main_capability: "alarm_motion"},
            "321": { type: "multisensor", main_capability: "alarm_motion"},
            "322": { type: "multisensor", main_capability: "alarm_motion"},
            "328": { type: "multisensor", main_capability: "alarm_motion"},
            "329": { type: "multisensor", main_capability: "alarm_motion"},
            "330": { type: "multisensor", main_capability: "alarm_motion"},
            "336": { type: "multisensor", main_capability: "alarm_motion"},
            "337": { type: "multisensor", main_capability: "alarm_motion"},
            "340": { type: "multisensor", main_capability: "alarm_motion"},
            "363": { type: "relay", channels: 6 },
            "423": { type: "relay", channels: 4 },
            "425": { type: "relay", channels: 6 },
            "426": { type: "relay", channels: 6 },
            "427": { type: "relay", channels: 8 },
            "428": { type: "relay", channels: 8 },
            "429": { type: "relay", channels: 12 },
            "430": { type: "relay", channels: 12 },
            "431": { type: "relay", channels: 12 },
            "432": { type: "relay", channels: 24 },
            "433": { type: "relay", channels: 4 },
            "434": { type: "relay", channels: 4 },
            "435": { type: "relay", channels: 4 },
            "436": { type: "relay", channels: 8 },
            "437": { type: "relay", channels: 4 },
            "438": { type: "relay", channels: 4 },
            "439": { type: "relay", channels: 8 },
            "440": { type: "relay", channels: 12 },
            "441": { type: "relay", channels: 4 },
            "442": { type: "relay", channels: 8 },
            "443": { type: "relay", channels: 12 },
            "444": { type: "relay", channels: 4 },
            "445": { type: "relay", channels: 8 },
            "446": { type: "relay", channels: 12 },
            "447": { type: "relay", channels: 4 },
            "448": { type: "relay", channels: 8 },
            "449": { type: "relay", channels: 12 },
            "450": { type: "relay", channels: 16 },
            "451": { type: "relay", channels: 16 },
            "454": { type: "relay", channels: 3 },
            "456": { type: "relay", channels: 8 },
            "457": { type: "relay", channels: 3 },
            "458": { type: "relay", channels: 4 },
            "459": { type: "relay", channels: 4 },
            "460": { type: "relay", channels: 8 },
            "461": { type: "relay", channels: 12 },
            "462": { type: "relay", channels: 4 },
            "463": { type: "relay", channels: 8 },
            "464": { type: "relay", channels: 12 },
            "465": { type: "relay", channels: 16 },
            "466": { type: "relay", channels: 16 },
            "467": { type: "relay", channels: 3 },
            "468": { type: "relay", channels: 6 },
            "469": { type: "relay", channels: 4 },
            "470": { type: "relay", channels: 6 },
            "600": { type: "dimmer", channels: 6 },
            "601": { type: "dimmer", channels: 4 },
            "602": { type: "dimmer", channels: 2 },
            "606": { type: "dimmer", channels: 2 },
            "607": { type: "dimmer", channels: 4 },
            "608": { type: "dimmer", channels: 6 },
            "609": { type: "dimmer", channels: 1 },
            "610": { type: "dimmer", channels: 6 },
            "611": { type: "dimmer", channels: 4 },
            "612": { type: "dimmer", channels: 2 },
            "613": { type: "dimmer", channels: 6 },
            "614": { type: "dimmer", channels: 2 },
            "615": { type: "dimmer", channels: 4 },
            "616": { type: "dimmer", channels: 4 },
            "617": { type: "dimmer", channels: 6 },
            "618": { type: "dimmer", channels: 1 },
            "619": { type: "dimmer", channels: 2 },
            "620": { type: "dimmer", channels: 4 },
            "621": { type: "dimmer", channels: 6 },
            "622": { type: "dimmer", channels: 6 },
            "623": { type: "dimmer", channels: 4 },
            "630": { type: "dimmer", channels: 4 },
            "631": { type: "dimmer", channels: 2 },
            "632": { type: "dimmer", channels: 4 },
            "633": { type: "dimmer", channels: 6 },
            "634": { type: "dimmer", channels: 2 },
            "635": { type: "dimmer", channels: 4 },
            "636": { type: "dimmer", channels: 6 },
            "713": { type: "curtain", channels: 2, hasDuration: true, hasLevelMonitor: false },
            "719": { type: "curtain", channels: 2, hasDuration: undefined, hasLevelMonitor: undefined },      
            "800": { type: "dimmer", channels: 8 },
            "850": { type: "dimmer", channels: 96 },
            "851": { type: "dimmer", channels: 96 },
            "852": { type: "dimmer", channels: 96 },
            "853": { type: "dimmer", channels: 48 },
            "854": { type: "dimmer", channels: 48 },
            "4300": { type: "dimmer", channels: 64 },
            "4301": { type: "dimmer", channels: 64 },
            "4302": { type: "dimmer", channels: 64 }
        };
    }
}

module.exports = HdlTypelist;