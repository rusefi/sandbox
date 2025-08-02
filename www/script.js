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
 * Main function to handle the serial connection process.
 */
async function connectAndSendMessage() {
    // Check if the Web Serial API is supported by the browser
    if ('serial' in navigator) {
        output.textContent = 'Web Serial API is supported. Attempting to connect...';
    } else {
        showMessage('Web Serial API not supported in this browser. Please use Chrome, Edge, or a Chromium-based browser.');
        return;
    }

    // Request a serial port from the user
    try {
        // Request a port. This will open a browser dialog for the user to select a device.
        const port = await navigator.serial.requestPort();

        // Open the selected port with a common baud rate (e.g., 9600)
        await port.open({ baudRate: 9600 });
        output.textContent = 'Connection successful! Port opened at 9600 baud.\n';

        // Setup the text encoder and decoder streams
        const textEncoder = new TextEncoderStream();
        const textDecoder = new TextDecoderStream();

        // Pipe the encoder to the port's writable stream
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);

        // Pipe the port's readable stream to the decoder
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);

        // Get a writer and a reader to send and receive data
        const writer = textEncoder.writable.getWriter();
        const reader = textDecoder.readable.getReader();

        // Send the "Hello, World!" message to the serial device
        const messageToSend = "Hello, World!\n";
        await writer.write(messageToSend);
        output.textContent += `Sent message: "${messageToSend.trim()}"\n`;

        showMessage('Message sent successfully!');

        // Listen for incoming data from the serial port
        output.textContent += 'Listening for incoming data...\n';
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                // Reader has been closed
                break;
            }
            // Append the received data to the output display
            output.textContent += `Received: ${value}`;
        }
    } catch (error) {
        // Handle any errors that occur during the connection or communication process
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
