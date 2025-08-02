// Get references to the HTML elements
const connectButton = document.getElementById('connectButton');
const output = document.getElementById('output');
const messageBox = document.getElementById('custom-message-box');
const messageText = document.getElementById('message-text');

// Import the CRC32 utility functions from the new file
import { makeCrc32Packet } from './crc32.js';

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
 * Helper function to convert a Uint8Array to a hex string for logging.
 * @param {Uint8Array} bytes The array of bytes to convert.
 * @returns {string} The hexadecimal representation of the bytes.
 */
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Checks if the connected serial device is an "openblt" bootloader.
 * This function is based on the logic from the rusefi/rusefi project.
 * It reads a specific byte sequence to check for the openblt protocol magic numbers,
 * with a 500ms timeout to prevent hanging.
 * @param {ReadableStreamDefaultReader} reader The reader to use for reading from the serial port.
 * @returns {Promise<boolean>} A promise that resolves to true if it's an openblt device, false otherwise.
 */
async function checkOpenBLT(reader) {
    output.textContent += 'Checking for OpenBLT bootloader with 500ms timeout...\n';
    try {
        // Create a promise for the reader.read() operation.
        const readPromise = reader.read();

        // Create a promise for the 500ms timeout.
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Timeout: Did not receive data within 500ms."));
            }, 500);
        });

        // Use Promise.race() to see which promise resolves or rejects first.
        const result = await Promise.race([readPromise, timeoutPromise]);

        // If the timeout didn't reject the promise, we have data.
        const { value, done } = result;

        console.log("Received bytes from OpenBLT check:", bytesToHex(value));

        if (done || !value || value.length < 8) {
            output.textContent += 'Failed to read enough data for OpenBLT check.\n';
            return false;
        }

        // The OpenBLT protocol starts with a magic number
        const openbltMagicNumber = [0x50, 0x00, 0x49, 0x00];

        // The received data is a Uint8Array, so we compare byte by byte
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
        // Since we got a timeout, we'll return false, as it's not the OpenBLT device we were looking for.
        return false;
    }
}

/**
 * Gets the device signature by sending a command and reading a length-prefixed string.
 * This is based on the rusefi binary protocol.
 * @param {WritableStreamDefaultWriter} writer The writer to send the command.
 * @param {ReadableStreamDefaultReader} reader The reader to read the response.
 * @returns {Promise<string|null>} The signature string, or null if an error occurs.
 */
async function getSignature(writer, reader) {
    output.textContent += 'Requesting device signature...\n';
    try {
        // Create the packet using the imported function. Command code is 'A' (0x41).
        const signaturePacket = makeCrc32Packet(0x41);

        // Log the packet before sending
        console.log("Sending signature request packet:", bytesToHex(signaturePacket));

        await writer.write(signaturePacket);
        output.textContent += `Sent signature request (command 'A') with CRC32 packet.\n`;

        // The response will also be a length-prefixed string followed by CRC32.
        // First, read the 16-bit length (little-endian)
        const readLengthPromise = reader.read();
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Timeout: Did not receive length within 500ms."));
            }, 500);
        });

        const lengthResult = await Promise.race([readLengthPromise, timeoutPromise]);
        const { value: lengthBytes, done: lengthDone } = lengthResult;

        console.log("Received length bytes:", bytesToHex(lengthBytes));

        if (lengthDone || !lengthBytes || lengthBytes.length < 2) {
            output.textContent += 'Failed to read signature length.\n';
            return null;
        }

        // Decode the 16-bit little-endian integer
        const length = new DataView(lengthBytes.buffer).getUint16(0, true);

        // Read the response data (signature string + 4 bytes for CRC32)
        const responseBytes = new Uint8Array(length + 4);
        let bytesRead = 0;
        while (bytesRead < length + 4) {
            const { value, done } = await reader.read();
            if (done || !value) {
                output.textContent += 'Failed to read full signature response.\n';
                return null;
            }
            console.log(`Received signature response chunk (${value.length} bytes):`, bytesToHex(value));
            responseBytes.set(value.slice(0, (length + 4) - bytesRead), bytesRead);
            bytesRead += value.length;
        }

        // Extract the signature and CRC32
        const signatureBytes = responseBytes.slice(0, length);
        // We'll skip CRC32 check for this example, but it would go here.

        const signature = new TextDecoder().decode(signatureBytes);
        output.textContent += `Received signature: "${signature}"\n`;
        return signature;

    } catch (error) {
        console.error("Error getting signature:", error);
        output.textContent += `Error getting signature: ${error.message}\n`;
        return null;
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
    let port;
    let reader;
    let writer;

    try {
        port = await navigator.serial.requestPort();

        await port.open({ baudRate: 9600 });
        output.textContent += 'Connection successful! Port opened at 9600 baud.\n';

        // Get a reader and writer for binary data
        writer = port.writable.getWriter();
        reader = port.readable.getReader();

        // Check if the port is an OpenBLT device
        const isOpenBLT = await checkOpenBLT(reader);

        // Since we are reading raw bytes for OpenBLT check, we need to release the lock
        // and re-get the reader/writer to switch to a TextDecoder.
        reader.releaseLock();
        writer.releaseLock();

        // The user's request is to check for openblt, if not found, get signature.
        if (!isOpenBLT) {
            // Re-get reader/writer for raw bytes for signature
            writer = port.writable.getWriter();
            reader = port.readable.getReader();

            const signature = await getSignature(writer, reader);

            // Re-release and re-get with text decoder for subsequent communication
            reader.releaseLock();
            writer.releaseLock();

            // Set up the text decoder and encoder streams for further communication.
            const textEncoder = new TextEncoderStream();
            const textDecoder = new TextDecoderStream();

            port.readable.pipeTo(textDecoder.writable);
            port.writable.pipeTo(textEncoder.writable);
            writer = textEncoder.writable.getWriter();
            reader = textDecoder.readable.getReader();

            if (signature) {
                 output.textContent += 'Proceeding with standard communication.\n';
                 const messageToSend = "Hello, World!\n";

                 // Log the message before sending
                 console.log("Sending text message:", messageToSend);

                 await writer.write(messageToSend);
                 output.textContent += `Sent message: "${messageToSend.trim()}"\n`;
                 showMessage('Message sent successfully!');
            }
        } else {
            // If it is an OpenBLT device, we would implement the specific communication
            // protocol here. For this example, we'll just acknowledge the detection.
            output.textContent += 'OpenBLT device detected. No "Hello, World!" message sent automatically.\n';
            showMessage('OpenBLT device detected. Ready for specific commands.');

            // Re-release and re-get with text decoder for subsequent communication
            const textEncoder = new TextEncoderStream();
            const textDecoder = new TextDecoderStream();
            port.readable.pipeTo(textDecoder.writable);
            port.writable.pipeTo(textEncoder.writable);
            writer = textEncoder.writable.getWriter();
            reader = textDecoder.readable.getReader();
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
            // Log the received text message
            console.log("Received text:", value);
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
    } finally {
        // Ensure streams are released if an error occurs
        if (writer) {
            writer.releaseLock();
        }
        if (reader) {
            reader.releaseLock();
        }
        if (port && port.opened) {
            await port.close();
        }
    }
}

// Add a click event listener to the button
connectButton.addEventListener('click', connectAndSendMessage);
