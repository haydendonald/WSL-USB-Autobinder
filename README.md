# WSL USB Auto Binder
This is a simple app that listens to usb devices and mounts them to WSL automatically so you don't have to run the commands every time. This was built as in my development processes i have usb devices that disconnect/reconnect many times and change ports when they do so. This allows them to connect back to WSL when they reconnect.

# Features
* Bind a list of devices using the hardware-id automatically
* Can bind all new devices to WSL automatically (devices plugged in after program launched)

# Installation
1. Install [usbipd-win](https://github.com/dorssel/usbipd-win) using [win-get](https://github.com/microsoft/winget-cli) using the following command `winget install usbipd`
2. Check that it is working by running `usbipd list`. You should see some devices here (if plugged in)
4. Run it for the first time so it can generate the configuration file
3. Download the [executable](https://github.com/haydendonald/WSL-USB-Autobinder/releases) and place it in the startup directory at `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp` or you can just run it manually, up to you!
5. Edit the configuration file to bind your usb devices, you can use `usbipd list` to see what devices are connected to your system

# Configuration
The configuration file will be stored in the `wsl-usb-autobinder` directory in your home folder. It has the following configuration options:


# Development
1. Clone the repo
2. Run `npm i` to install dependencies
3. Run `npm run start` to launch the application
3. Run `npm i nexe -g` to install the packager
4. Run `npm run package` to build the executable

# Troubleshooting
* If you have issues with serial -> usb converter devices not showing up try [this](https://askubuntu.com/questions/1373910/ch340-serial-device-doesnt-appear-in-dev-wsl/)
