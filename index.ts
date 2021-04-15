import './env';
import {
    type as osType,
    cpus as osCpus,
    freemem as osFreeMem,
    totalmem as osTotalMem
} from 'os';
import { IoTCentralDevice } from './device';

function log(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
}

async function start() {
    try {
        log('🚀 Starting IoT Central device...');
        log(` > Machine: ${osType()}, ${osCpus().length} core, `
            + `freemem=${(osFreeMem() / 1024 / 1024).toFixed(0)}mb, totalmem=${(osTotalMem() / 1024 / 1024).toFixed(0)}mb`);

        const {
            scopeId,
            deviceId,
            deviceKey
        } = process.env;

        if (!scopeId || !deviceId || !deviceKey) {
            log('Error - missing required environment variables scopeId, deviceId, deviceKey');
            return;
        }

        const iotDevice = new IoTCentralDevice(log, scopeId, deviceId, deviceKey);

        log('Starting device registration...');
        const connectionString = await iotDevice.provisionDeviceClient();

        if (connectionString) {
            do {
                await iotDevice.connectDeviceClient(connectionString);

                await new Promise((resolve) => {
                    setTimeout(() => {
                        return resolve('');
                    }, 1000 * 30);
                });

                await iotDevice.disconnectDeviceClient();

                await new Promise((resolve) => {
                    setTimeout(() => {
                        return resolve('');
                    }, 1000 * 2);
                });
            } while (true);
        }
        else {
            log(' Failed to obtain connection string for device.');
        }
    }
    catch (error) {
        log(`👹 Error starting process: ${error.message}`);
    }
}

void (async () => {
    await start();
})().catch();
