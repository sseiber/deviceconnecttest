import { Mqtt } from 'azure-iot-device-mqtt';
import { SymmetricKeySecurityClient } from 'azure-iot-security-symmetric-key';
import { ProvisioningDeviceClient } from 'azure-iot-provisioning-device';
import { Mqtt as ProvisioningTransport } from 'azure-iot-provisioning-device-mqtt';
import {
    Client as IoTDeviceClient,
    Twin,
    Message as IoTMessage
} from 'azure-iot-device';
import * as moment from 'moment';

const dpsProvisioningHost = 'global.azure-devices-provisioning.net';

const TelemetrySystemHeartbeat = 'TELEMETRY_SYSTEM_HEARTBEAT';
const SettingSample = 'SETTING_SAMPLE';

interface IDeviceSettings {
    [SettingSample]: string;
}

export class IoTCentralDevice {
    private log: (message: string) => void;
    private scopeId: string;
    private deviceId: string;
    private deviceKey: string;

    private deviceClient: IoTDeviceClient;
    private deviceTwin: Twin;
    private deviceSettings: IDeviceSettings;
    private healthTimer: NodeJS.Timeout;

    constructor(logFunc: (message: string) => void, scopeId: string, deviceId: string, deviceKey: string) {
        this.log = logFunc;
        this.scopeId = scopeId;
        this.deviceId = deviceId;
        this.deviceKey = deviceKey;

        this.deviceSettings = {
            [SettingSample]: moment.utc().format('YYYYMMDD-HHmmss')
        };
    }

    public async provisionDeviceClient(): Promise<string> {
        let connectionString = '';

        try {
            const provisioningSecurityClient = new SymmetricKeySecurityClient(this.deviceId, this.deviceKey);
            const provisioningClient = ProvisioningDeviceClient.create(
                dpsProvisioningHost,
                this.scopeId,
                new ProvisioningTransport(),
                provisioningSecurityClient
            );

            connectionString = await new Promise<string>((resolve, reject) => {
                provisioningClient.register((dpsError, dpsResult) => {
                    if (dpsError) {
                        return reject(dpsError);
                    }

                    this.log('DPS registration succeeded');

                    return resolve(`HostName=${dpsResult.assignedHub};DeviceId=${dpsResult.deviceId};SharedAccessKey=${this.deviceKey}`);
                });
            });
        }
        catch (ex) {
            this.log(`Failed to instantiate client interface from configuration: ${ex.message}`);
        }

        return connectionString;
    }

    public async connectDeviceClient(connectionString: string): Promise<void> {
        this.log(`Connecting device...`);

        try {
            this.deviceClient = await IoTDeviceClient.fromConnectionString(connectionString, Mqtt);
            if (!this.deviceClient) {
                this.log(`Failed to connect device client interface from connection string - device: ${this.deviceId}`);
                return;
            }

            await this.deviceClient.open();

            this.deviceTwin = await this.deviceClient.getTwin();
            this.deviceTwin.on('properties.desired', this.onHandleDeviceProperties.bind(this));

            this.deviceClient.on('error', this.onDeviceClientError.bind(this));

            this.log(`Starting health timer...`);
            this.healthTimer = setInterval(async () => {
                await this.getHealth();
            }, 1000 * 10);

            this.log(`IoT Central successfully connected device: ${this.deviceId}`);
        }
        catch (ex) {
            this.log(`IoT Central connection error: ${ex.message}`);
        }
    }

    public async disconnectDeviceClient(): Promise<void> {
        this.log('Disconneting the device...');

        try {
            this.log(`Clearing health timer...`);
            if (this.healthTimer) {
                clearInterval(this.healthTimer);
                this.healthTimer = null;
            }

            this.log(`Disconnecting device...`);
            this.deviceTwin?.removeAllListeners();
            this.deviceClient?.removeAllListeners();

            await this.deviceClient.close();

            this.deviceClient = null;
            this.deviceTwin = null;
        }
        catch (ex) {
            this.log(`Error while disconnecting device: ${ex.message}`);
        }
    }

    private async getHealth(): Promise<void> {
        await this.sendMeasurement({
            [TelemetrySystemHeartbeat]: 1
        });
    }

    private async onHandleDeviceProperties(desiredChangedSettings: any) {
        try {
            const patchedProperties = {};

            for (const setting in desiredChangedSettings) {
                if (!Object.prototype.hasOwnProperty.call(desiredChangedSettings, setting)) {
                    continue;
                }

                if (setting === '$version') {
                    continue;
                }

                const value = desiredChangedSettings[setting];

                switch (setting) {
                    case SettingSample:
                        this.log(`Updating setting: ${setting} with value: ${value}`);

                        // NOTE: validation should be in place for legal folder names
                        patchedProperties[setting] = this.deviceSettings[setting] = value || moment.utc().format('YYYYMMDD-HHmmss');
                        break;

                    default:
                        this.log(`Received desired property change for unknown setting '${setting}'`);
                        break;
                }
            }

            if (Object.keys(patchedProperties).length) {
                await this.updateDeviceProperties(patchedProperties);
            }
        }
        catch (ex) {
            this.log(`Exception while handling desired properties: ${ex.message}`);
        }
    }

    private onDeviceClientError(error: Error) {
        this.log(`Device client connection error: ${error.message}`);
    }

    private async sendMeasurement(data: any): Promise<void> {
        if (!data || !this.deviceClient) {
            return;
        }

        try {
            this.log(`Sending telemetry: ${JSON.stringify(data, null, 4)}`);

            const iotcMessage = new IoTMessage(JSON.stringify(data));

            await this.deviceClient.sendEvent(iotcMessage);
        }
        catch (ex) {
            this.log(`sendMeasurement: ${ex.message}`);
        }
    }

    private async updateDeviceProperties(properties: any): Promise<void> {
        if (!properties || !this.deviceTwin) {
            return;
        }

        this.log(`Updating twin properties: ${JSON.stringify(properties, null, 4)}`);

        try {
            await new Promise((resolve, reject) => {
                this.deviceTwin.properties.reported.update(properties, (error) => {
                    if (error) {
                        return reject(error);
                    }

                    return resolve('');
                });
            });
        }
        catch (ex) {
            this.log(`Error updating device properties: ${ex.message}`);
        }
    }
}
