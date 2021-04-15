# Simple IoT Central device to test connect/disconnect telemetry
1. Clone this repository to your local drive
1. Install the project packages
   ```
   npm i
   ```
1. Create a new device in the provisioned IoT Central application that is setup to test connect/disconnect device telemetry
   1. In the IoT Central app create a new device
   1. Select the device and choose the "Connect" option
   1. Copy the `ID scope`, `Device ID`, and `Primary key` and past them into the `.env` file at the root of this project. Example:
   ```
   scopeId=0ne000XXXX
   deviceId=your-device
   deviceKey=fjaToc7bigxt3v+m3aKPXtkY5oZt0LkctPifR5+TtOk=
   ```
1. Run the code from CLI
   ```
   node ./dist/index.js
   ```
1. Or, if you opened the project in VS Code just hit F5

When the code runs it will register the device you created in your IoT Central app. Every ~10 seconds it will send a heartbeat telemetry. Every ~30 seconds it will disconnect and then reconnect itself.

NOTE: this device does not register with a model. You can see the TELEMETRY_SYSTEM_HEARTBEAT telemetry as unmodeled data in the Raw data view.

The code is written to run continuously.
