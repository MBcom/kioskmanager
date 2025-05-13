## Setting Up a Kiosk Device

To set up a kiosk device for use with Kioskmanager, you can utilize the [salt-kiosk-formula](https://github.com/MBcom/salt-kiosk-formula) project. This formula provides a SaltStack configuration for provisioning and managing kiosk devices in a centralized setup.

### Steps to Configure a Kiosk Device

1. **Set Up a Central Salt Master**: Ensure you have a Salt master configured on a central server. Follow the [SaltStack installation guide](https://docs.saltproject.io/en/latest/topics/installation/index.html) to set up the Salt master.

2. **Install Salt Minion on the Kiosk Device**: On each kiosk device, install the Salt minion and configure it to connect to the central Salt master:
    ```bash
    sudo apt-get install salt-minion
    ```
    Update the minion configuration file (`/etc/salt/minion`) to point to the Salt master:
    ```yaml
    master: <salt-master-ip-or-hostname>
    ```

3. **Clone the Formula on the Salt Master**: On the Salt master, clone the `salt-kiosk-formula` repository:
    ```bash
    git clone https://github.com/MBcom/salt-kiosk-formula.git /srv/salt/kiosk
    ```

4. **Configure Pillar Data on the Salt Master**: Define the necessary pillar data for each kiosk device to customize its setup. For example:
    ```yaml
    kiosk:
      start_url: "https://your-kioskmanager-url/play/"
      vnc_password: "CHANGE-ME"  # VNC access password
      user_password: "CHANGE-ME" # User password
    ```

See https://github.com/MBcom/salt-kiosk-formula/blob/main/Readme.md for further deatils.  

5. **Apply the State to the Kiosk Device**: From the Salt master, apply the state to the target kiosk device:
    ```bash
    salt '<kiosk-device-id>' state.apply kiosk
    ```

6. **Verify the Setup**: After applying the state, ensure the kiosk device boots into the configured environment and connects to the Kioskmanager application.

For more details on customizing the formula, refer to the [salt-kiosk-formula documentation](https://github.com/MBcom/salt-kiosk-formula#readme).