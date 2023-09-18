/**
 * WSL USB Auto Binder by Hayden Donald (https://github.com/haydendonald)
 * 
 * A simple tool that automatically assigns usb devices to WSL using the usbipd tool (https://github.com/dorssel/usbipd-win)
 */

import * as path from "path";
import * as nconf from "nconf";
import * as ChildProcess from "child_process";

export interface Device { busId: string, hwId: string, name: string, attached: boolean }

var processes: ChildProcess.ChildProcess[] = [];
var config: nconf.Provider;
var startupDevices: Map<string, Device>;
const configDirectory = path.join(require("os").homedir(), `wsl-usb-autobinder`);
console.log("wsl-usb-autobinder by Hayden Donald\nhttps://github.com/haydendonald");
console.log(`Configuration file located at ${configDirectory}/config.json\n\n`);

//Attempt to load in the configuration
function loadConfig(): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            if (!require("fs").existsSync(configDirectory)) {
                require("fs").mkdirSync(configDirectory, { recursive: true });
            }

            config = nconf.use("file", { file: configDirectory + "/config.json" });
            await config.load();

            var errors: string[] = [];
            var validateConfig = async function (name: string, defaultValue: any, error: string | undefined = undefined) {
                if (config.get(name) === undefined) {
                    config.set(name, defaultValue);
                }

                //If there is an error set report it if the value is unset
                if (error && config.get(name) == defaultValue) {
                    errors.push(error);
                }
            }

            //Expected configuration options
            var exampleDevice: Device = {
                busId: "1-1.2",
                hwId: "067b:2303",
                name: "Example Device",
                attached: false
            };
            validateConfig("devices", [exampleDevice]);
            validateConfig("distribution", "");
            validateConfig("debug", false);
            validateConfig("unbindAllAtStartup", true);
            validateConfig("autoBindNewDevices", true);

            await config.save({});
            if (errors.length > 0) {
                reject(errors.join("\n"));
                return;
            }
            resolve();
        } catch (e) { reject(e); }
    });
}

/**
 * Spawn a new process
 * @param command The command to run
 * @param args The arguments to pass
 * @param dataCallback The data callback
 * @param errorCallback The error callback
 * @param closeCallback The close callback
 */
function spawnProcess(command: string, args: string[], dataCallback: (data: any) => any, errorCallback: (error: any) => any, closeCallback: (code: string) => any) {
    var process: ChildProcess.ChildProcess = ChildProcess.spawn(command, args);
    if (process.stdout) {
        process.stdout.on("data", (data: any) => {
            if (dataCallback) { dataCallback(data); }
        });
    }
    if (process.stderr) {
        process.stderr.on("data", (error: any) => {
            if (errorCallback) { errorCallback(error); }
        });
    }

    process.on("close", (code: string) => {
        if (closeCallback) { closeCallback(code); }
        processes.splice(processes.indexOf(process), 1);
    });
}

//Handle unhandled rejections
process.on('unhandledRejection', (error: any, promise: any) => {
    console.log(`Some error happened :( => ${error.stack || error}`);
});

//Destroy all processes on exit
async function cleanup() {
    console.log("Exiting...");
    processes.forEach((process: ChildProcess.ChildProcess) => {
        process.kill();
    });
    process.exit(2);
}
process.on("exit", async function () { await cleanup() });
process.on("SIGINT", async function () { await cleanup(); });

//Bind a device
function bindDevice(name: string, busId: string) {
    var args: string[] = ["wsl", "attach", "--busid", busId];
    if (config.get("distribution") != "") {
        args.push("--distribution");
        args.push(config.get("distribution"));
    }

    console.log(`${name}: Binding device ${busId}`);
    spawnProcess("usbipd", args, (data: any) => {
        if (config.get("debug")) { console.log(`${name}: ${data.toString()}`); }
    }, (error: any) => {
        if (config.get("debug")) { console.error(`${name}: ERROR: ${error.toString()}`); }
    }, (code: string) => {
        if (config.get("debug")) { console.log(`${name}: Exited with code ${code}`); }
    });
}

//unBind a device"
function unBindDevice(name: string, busId: string) {
    var args: string[] = ["wsl", "detach", "--busid", busId];
    if (config.get("distribution") != "") {
        args.push("--distribution");
        args.push(config.get("distribution"));
    }

    console.log(`${name}: Unbinding device ${busId}`);
    spawnProcess("usbipd", args, (data: any) => {
        if (config.get("debug")) { console.log(`${name}: ${data.toString()}`); }
    }, (error: any) => {
        if (config.get("debug")) { console.error(`${name}: ERROR: ${error.toString()}`); }
    }, (code: string) => {
        if (config.get("debug")) { console.log(`${name}: Exited with code ${code}`); }
    });
}

//Unbind all devices
function unbindAll() {
    var args: string[] = ["wsl", "detach", "--all"];
    if (config.get("distribution") != "") {
        args.push("--distribution");
        args.push(config.get("distribution"));
    }

    console.log(`Unbinding all devices`);
    spawnProcess("usbipd", args, (data: any) => {
        if (config.get("debug")) { console.log(`${data.toString()}`); }
    }, (error: any) => {
        if (config.get("debug")) { console.error(`ERROR: ${error.toString()}`); }
    }, (code: string) => {
        if (config.get("debug")) { console.log(`Exited with code ${code}`); }
    });
}

//List the devices connected
function listDevices(): Promise<string> {
    return new Promise((resolve) => {
        var args: string[] = ["wsl", "list"];
        if (config.get("distribution") != "") {
            args.push("--distribution");
            args.push(config.get("distribution"));
        }

        var builder = "";
        spawnProcess("usbipd", args, (data: any) => {
            builder += data.toString();
        }, (error: any) => {
            if (config.get("debug")) { console.error(error.toString()); }
        }, (code: string) => {
            resolve(builder);
        });
    });
}

//Update the devices
function updateDevices(): Promise<void> {
    return new Promise<void>(async (resolve) => {
        var devices: Map<string, Device> = new Map<string, Device>();
        (await listDevices()).split("\n").forEach(element => {
            if (config.get("debug")) { console.log(element); }
            if (element.includes("-") && element.includes(":") && element.includes(" ")) {
                element = element.replace(new RegExp(/ +(?= )/g, 'g'), "");
                var split = element.split(" ");
                var device = {
                    busId: split[0],
                    hwId: split[1],
                    name: "",
                    attached: element.includes("Attached")
                }
                device.name = device.attached ? element.split(device.hwId + " ")[1].split("Attached")[0] : element.split(device.hwId + " ")[1].split("Not attached")[0];
                devices.set(device.busId, device);
            }
        });

        if (!startupDevices) {
            startupDevices = devices;
        }

        //Find the devices that are different from the startup and mount them
        if (config.get("autoBindNewDevices")) {
            devices.forEach((device: Device, key: string) => {
                var shouldBind = !startupDevices.has(key);
                config.get("devices").forEach((dev: Device) => {
                    if (dev.hwId == device.hwId) {
                        shouldBind = dev.attached;
                    }
                });

                if (!device.attached && shouldBind) {
                    bindDevice(device.name, device.busId);
                    device.attached = true;
                }
            });
        }

        //Bind devices in the config file
        config.get("devices").forEach((device: Device) => {
            if (device.name != "Example Device" && device.attached) {
                devices.forEach((element: Device) => {
                    if (element.hwId == device.hwId && element.attached == false) {
                        bindDevice(device.name, element.busId);
                    }
                });
            }
        });

        resolve();
    });
}

async function main() {
    await loadConfig();
    if (config.get("unbindAllAtStartup")) {
        unbindAll();
        await new Promise((resolve) => { setTimeout(resolve, 5000); });
    }

    console.log(await listDevices());

    await updateDevices();
    setInterval(updateDevices, 1000);
}
main();
