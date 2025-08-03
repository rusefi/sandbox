// all the webserial shared code here

import { bytesToHex } from "../utils.js";

/**
 * Main function to handle the serial connection process.
 */
// TODO: only connect here!, let actual reading/write outside this function
export async function connectAndSendMessage() {
  // Check if the Web Serial API is supported by the browser
  if (!("serial" in navigator)) {
    showMessage(
      "Web Serial API not supported in this browser. Please use Chrome, Edge, or a Chromium-based browser."
    );
    return;
  }

  output.textContent =
    "Web Serial API is supported. Attempting to connect... \n";

  // Request a serial port from the user
  let port;
  let reader;
  let writer;

  try {
    port = await navigator.serial.requestPort();

    await port.open({ baudRate: 9600 });
    output.textContent += "Connection successful! Port opened at 9600 baud.\n";

    if (!port.writable || !port.readable) return;

    window.webSerialConnected = true;

    // Get a reader and writer for binary data
    const reader = port.readable.getReader();

    window.webSerialWriteString = async (data) => {
      if (!webSerialConnected) return;
      const writer = port.writable.getWriter();
      //TODO: dont make a new text encoder every time this func is called, is slow!
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);
      await writer.write(encoded);
      writer.releaseLock();
    };

    window.webSerialWriteBytes = async (data) => {
      if (!webSerialConnected) return;
      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
    };

    while (true) {
      const { value, done } = await reader.read();
      // |reader| has been canceled. (like disconection of the serial device)
      if (done) {
        break;
      }
      if (!value) continue;

      console.debug("\x1b[32m WebSerial raw bytes:", bytesToHex(value));

      window.pendingWebSerialBytes.push(value);
    }
  } catch (error) {
    console.error("Serial connection error:", error);
    if (error.name === "NotFoundError") {
      showMessage("No serial port selected.");
    } else if (
      error.name === "NetworkError" &&
      error.message.includes("permission denied")
    ) {
      showMessage("Connection failed: Permission denied by user or system.");
    } else {
      showMessage(`An error occurred: ${error.message}`);
    }
   
    output.textContent += `\nError: ${error.message}`;
    webSerialConnected = false;

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
