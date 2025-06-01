const { SerialPort } = require('serialport');
const { spawn } = require('child_process');

let currentFlashProcess = null;
let aborted = false;


/**
 * Helper to kill the current child process if it’s still running.
 */
function cleanupCurrentProcess() {
    if (currentFlashProcess && !currentFlashProcess.killed) {
        const sig = process.platform === 'win32' ? 'SIGTERM' : 'SIGINT';
        currentFlashProcess.kill(sig);
        currentFlashProcess = null;
    }
}

/**
 * Spawns mcumgr with `args`, pipes stdout/stderr to the callbacks,
 * and sets `currentFlashProcess` to the spawned process.
 */
function runMcumgrCommand(mcumgrPath, args, onData, onError, onClose) {
    if (aborted) {
        // If we've already been told to abort, skip spawning anything.
        return null;
    }
    // Spawn and store the child process
    currentFlashProcess = spawn(mcumgrPath, args);

    // Forward stdout/stderr
    currentFlashProcess.stdout.on('data', (data) => {
        if (onData) onData(data.toString());
    });
    currentFlashProcess.stderr.on('data', (data) => {
        if (onError) onError(data.toString());
    });

    // When the process exits, clear our reference and call onClose
    currentFlashProcess.on('close', (code) => {
        currentFlashProcess = null;
        if (onClose) onClose(code);
    });

    return currentFlashProcess;
}

/**
 * Touches the serial port at 1200 baud, waits 500 ms for the bootloader,
 * then runs the three-step mcumgr sequence (add → upload → reset).
 */
function flashFirmware({ comPort, firmwarePath, mcumgrPath }, progressCallback, onDone) {
    aborted = false;
    // 1) Open at 1200 baud to trigger the bootloader
    const touchPort = new SerialPort({ path: comPort, baudRate: 1200 }, (err) => {
        if (err) {
        progressCallback(`Error: Could not open port at 1200 baud. ${err.message}`);
        if (onDone) onDone();
        return;
    }

        // Close immediately to let the device reboot into its bootloader
        touchPort.close((closeErr) => {
        if (closeErr) {
            progressCallback(`Error: Failed to close 1200 baud port. ${closeErr.message}`);
            if (onDone) onDone();
            return;
        }

        progressCallback("Serial port touched at 1200 baud. Waiting for bootloader…");

        // 2) Wait ~500 ms, then run the mcumgr commands in sequence
        setTimeout(() => {
            // a) mcumgr conn add serial …
            runMcumgrCommand(
            mcumgrPath,
            [
                "conn", "add", "serial",
                "type=serial",
                `connstring=dev=${comPort},baud=115200,mtu=128`
            ],
            progressCallback,
            console.error,
            (code) => {
                if (code !== 0) {
                progressCallback("Error: Failed to add connection.");
                cleanupCurrentProcess();
                if (onDone) onDone();
                return;
                }

                // b) mcumgr -c serial image upload firmwarePath
                runMcumgrCommand(
                mcumgrPath,
                ["-c", "serial", "image", "upload", firmwarePath],
                progressCallback,
                console.error,
                (code) => {
                    if (code !== 0) {
                    progressCallback("Error: Firmware upload failed.");
                    cleanupCurrentProcess();
                    if (onDone) onDone();
                    return;
                    }

                    // c) mcumgr -c serial reset
                    runMcumgrCommand(
                    mcumgrPath,
                    ["-c", "serial", "reset"],
                    progressCallback,
                    console.error,
                    (code) => {
                    if (code !== 0) {
                        progressCallback("Error: Reset failed.");
                        cleanupCurrentProcess();
                        if (onDone) onDone();
                        return;
                    }
                    else {
                        progressCallback("Success: Flashing and reset complete!");
                    }
                    cleanupCurrentProcess();
                    if (onDone) onDone();
                    }
                  );
                }
              );
            }
          );
        }, 500);
      });
    });
  }

function cancelFlash() {
    if (currentFlashProcess) {
        const sig = process.platform === "win32" ? "SIGTERM" : "SIGINT";
        currentFlashProcess.kill(sig);
        currentFlashProcess = null;
    }
}

module.exports = {
    flashFirmware,
    cancelFlash
};
