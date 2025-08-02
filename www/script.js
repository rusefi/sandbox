// Get references to the HTML elements
const connectButton = document.getElementById('connectButton');
const output = document.getElementById('output');
const messageBox = document.getElementById('custom-message-box');
const messageText = document.getElementById('message-text');

/**
 * A function to display temporary messages in a styled box,
 * avoiding the use of the browser's `alert()` function.
 * @param {string} text - The message to display.
 */
function showMessage(text) {
    messageText.textContent = text;
    messageBox.classList.add('show');
    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000);
}

/**
 * Checks if the connected serial device is an "openblt" bootloader.
 * This function is based on the logic from the rusefi/rusefi project.
 * It reads a specific byte sequence to check for the openblt protocol magic numbers.
 * @param {ReadableStreamDefaultReader} reader The reader to use for reading from the serial port.
 * @returns {Promise<boolean>} A promise that resolves to true if it's an openblt device, false otherwise.
 */
async function checkOpenBLT(reader) {
    output.textContent += 'Checking for OpenBLT bootloader...\n';
    try {
        // Read 8 bytes to get the magic number and protocol version
        const { value, done } = await reader.read();

        if (done || !value || value.length < 8) {
            output.textContent += 'Failed to read enough data for OpenBLT check.\n';
            return false;
        }

        // The OpenBLT protocol starts with a magic number
        // Magic number bytes from rusefi/rusefi/commit/f2c1a0ae28428dfcb68837e9a081274973de6417
        const openbltMagicNumber = [0x50, 0x00, 0x49, 0x00];

        // The received data is a Uint8Array, so we compare byte by byte
        // The magic number is the first 4 bytes of the value
        for (let i = 0; i < openbltMagicNumber.length; i++) {
            if (value[i] !== openbltMagicNumber[i]) {
                output.textContent += 'Magic number mismatch. Not an OpenBLT device.\n';
                return false;
            }
        }

        // Protocol version is the 5th and 6th byte
        const protocolVersionMajor = value[4];
        const protocolVersionMinor = value[5];

        output.textContent += `OpenBLT device detected! Protocol version: ${protocolVersionMajor}.${protocolVersionMinor}\n`;
        return true;

    } catch (error) {
        console.error("Error checking OpenBLT protocol:", error);
        output.textContent += `Error during OpenBLT check: ${error.message}\n`;
        return false;
    }
}

/**
 * Main function to handle the serial connection process.
 */
async function connectAndSendMessage() {
    // Check if the Web Serial API is supported by the browser
    if (!('serial' in navigator)) {
        showMessage('Web Serial API not supported in this browser. Please use Chrome, Edge, or a Chromium-based browser.');
        return;
    }

    output.textContent = 'Web Serial API is supported. Attempting to connect...';

    // Request a serial port from the user
    try {
        const port = await navigator.serial.requestPort();

        await port.open({ baudRate: 9600 });
        output.textContent += 'Connection successful! Port opened at 9600 baud.\n';

        // Setup the text encoder and decoder streams
        const textEncoder = new TextEncoderStream();
        const textDecoder = new TextDecoderStream();

        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        const writer = textEncoder.writable.getWriter();
        const reader = textDecoder.readable.getReader();

        // Check if the port is an OpenBLT device
        const isOpenBLT = await checkOpenBLT(reader);
        if (!isOpenBLT) {
            // If it's not OpenBLT, proceed with sending the "Hello, World!" message.
            output.textContent += 'Proceeding with standard communication.\n';
            const messageToSend = "Hello, World!\n";
            await writer.write(messageToSend);
            output.textContent += `Sent message: "${messageToSend.trim()}"\n`;
            showMessage('Message sent successfully!');
        } else {
            // If it is an OpenBLT device, you would implement the specific communication
            // protocol here. For this example, we'll just acknowledge the detection.
            output.textContent += 'OpenBLT device detected. No "Hello, World!" message sent automatically.\n';
            showMessage('OpenBLT device detected. Ready for specific commands.');
        }

        // Keep listening for incoming data, regardless of the protocol check outcome
        output.textContent += 'Listening for incoming data...\n';
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                // Reader has been closed
                output.textContent += 'Reader closed.\n';
                break;
            }
            output.textContent += `Received: ${value}`;
        }
    } catch (error) {
        console.error("Serial connection error:", error);
        if (error.name === 'NotFoundError') {
            showMessage('No serial port selected.');
        } else if (error.name === 'NetworkError' && error.message.includes('permission denied')) {
            showMessage('Connection failed: Permission denied by user or system.');
        } else {
            showMessage(`An error occurred: ${error.message}`);
        }
        output.textContent += `\nError: ${error.message}`;
    }
}

// Add a click event listener to the button
connectButton.addEventListener('click', connectAndSendMessage);
